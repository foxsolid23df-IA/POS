import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (message: string, status = 200, details?: unknown) =>
  jsonResponse({ success: false, error: message, message, details }, status);

const flattenFacturamaModelState = (modelState: unknown): string[] => {
  if (!modelState || typeof modelState !== "object") return [];

  return Object.values(modelState as Record<string, unknown>).flatMap((value) => {
    if (Array.isArray(value)) return value.map((item) => String(item));
    if (value && typeof value === "object") return flattenFacturamaModelState(value);
    return value ? [String(value)] : [];
  });
};

const normalizePostalCode = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 5 ? digits.slice(0, 5) : "";
};

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const getFacturamaResourceId = (data: any) =>
  firstString(data?.Id, data?.id, data?.CfdiId, data?.cfdiId, data?.ResourceId, data?.resourceId);

const getFacturamaUuid = (data: any) =>
  firstString(
    data?.Uuid,
    data?.uuid,
    data?.UUID,
    data?.FolioFiscal,
    data?.folioFiscal,
    data?.Complement?.TaxStamp?.Uuid,
    data?.Complement?.TaxStamp?.UUID,
    data?.Complement?.TimbreFiscalDigital?.UUID,
    data?.Complements?.TaxStamp?.Uuid,
    data?.Complements?.TaxStamp?.UUID,
  );

const isMissingRpcError = (error: any) => {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`;
  return /function .*claim_sale_for_invoicing|Could not find|schema cache/i.test(message);
};

const MEXICO_TIME_ZONE = "America/Mexico_City";

const getMexicoMonthParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MEXICO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const getPart = (type: string) => parts.find((part) => part.type === type)?.value || "";

  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
  };
};

const isSameBillingMonth = (saleDate: Date, now = new Date()) => {
  const saleParts = getMexicoMonthParts(saleDate);
  const nowParts = getMexicoMonthParts(now);

  return saleParts.year === nowParts.year && saleParts.month === nowParts.month;
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ─── CONFIGURACIÓN FACTURAMA ─────────────────────────────────────
    const BASE_URL = Deno.env.get("FACTURAMA_API_URL") || "https://api.facturama.mx";
    
    // Credenciales de la API Facturama
    const FACTURAMA_USER = Deno.env.get("FACTURAMA_USER") || (BASE_URL.includes("sandbox") ? "NexumPos" : "");
    const FACTURAMA_PASSWORD = Deno.env.get("FACTURAMA_PASSWORD") || (BASE_URL.includes("sandbox") ? "NexumPos" : "");
    
    if (!FACTURAMA_USER || !FACTURAMA_PASSWORD) {
      return errorResponse("Las credenciales de Facturama (FACTURAMA_USER / FACTURAMA_PASSWORD) no están configuradas.", 500);
    }
    
    // Authorization: Basic base64(usuario:contraseña)
    const encodedCredentials = btoa(`${FACTURAMA_USER}:${FACTURAMA_PASSWORD}`);

    // El Emisor será resuelto dinámicamente desde Supabase usando el terminal de la venta

    // ─── PASO 0: Parsear body del frontend ────────────────────────
    const body = await req.json();
    const { ticket_uuid, rfc, razon_social, codigo_postal, regimen_fiscal, uso_cfdi, email } = body;
    const receiverPostalCode = normalizePostalCode(codigo_postal);

    console.log("Body recibido para Facturama Multiemisor:", JSON.stringify(body));

    if (!ticket_uuid || !rfc || !razon_social || !codigo_postal || !regimen_fiscal || !uso_cfdi) {
      return errorResponse("Faltan campos requeridos para timbrar: ticket_uuid, rfc, razon_social, codigo_postal, regimen_fiscal, uso_cfdi");
    }

    if (!receiverPostalCode) {
      return errorResponse("El código postal del receptor debe contener 5 dígitos.");
    }

    // ─── PASO 1: Obtener datos reales de la venta y sus productos ────
    const { data: sale, error: saleErr } = await supabase
      .from('sales')
      .select('*, sale_items(*)')
      .eq('ticket_uuid', ticket_uuid)
      .single();

    if (saleErr || !sale) {
      console.error("No se pudo obtener la venta para timbrar:", saleErr);
      return errorResponse("No se encontró el ticket para timbrar. Verifica el folio/PIN o vuelve a buscar el ticket.");
    }

    sale.sale_items = Array.isArray(sale.sale_items) ? sale.sale_items : [];

    // ─── PASO 1.1: OBTENER DATA DEL EMISOR ───
    let issuer = null;
    let portal = null;

    if (sale.billing_issuer_id) {
      // Si el cajero seleccionó en caja manualmente al emisor
      const { data: directIssuer } = await supabase.from('billing_issuers').select('*').eq('id', sale.billing_issuer_id).single();
      if (directIssuer) {
        issuer = directIssuer;
      }
      
      // Intentamos recuperar también un portal ligado a este usuario por si requerimos limites_tipo
      const { data: foundPortal } = await supabase.from('billing_portals').select('*').eq('billing_issuer_id', sale.billing_issuer_id).limit(1).maybeSingle();
      if (foundPortal) portal = foundPortal;
    } 

    if (issuer && (!issuer.rfc || !issuer.razon_social || !issuer.regimen_fiscal)) {
      return errorResponse("El emisor fiscal está incompleto. Verifica RFC, razón social y régimen fiscal en Configuración > Facturas.");
    }

    if (!issuer) {
      // 1) Resolver por portal asignado a la terminal, si existe.
      let fetchedPortal: any = null;

      if (sale.terminal_id) {
        const { data: terminal } = await supabase
          .from('terminals')
          .select('billing_portal_id')
          .eq('id', sale.terminal_id)
          .maybeSingle();

        if (terminal?.billing_portal_id) {
          const { data: terminalPortal } = await supabase
            .from('billing_portals')
            .select('*, billing_issuers(*)')
            .eq('id', terminal.billing_portal_id)
            .maybeSingle();

          if (terminalPortal?.billing_issuers) {
            fetchedPortal = terminalPortal;
          }
        }
      }

      // 2) Fallback: usar el portal del comercio dueño del ticket.
      if (!fetchedPortal) {
        const { data: userPortal } = await supabase
          .from('billing_portals')
          .select('*, billing_issuers(*)')
          .eq('user_id', sale.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (userPortal?.billing_issuers) {
          fetchedPortal = userPortal;
        }
      }

      if (fetchedPortal?.billing_issuers) {
        portal = fetchedPortal;
        issuer = fetchedPortal.billing_issuers;
      }
    }

    if (!issuer) {
      // 3) Ultimo fallback: usar cualquier emisor fiscal del comercio.
      const { data: fallbackIssuer } = await supabase
        .from('billing_issuers')
        .select('*')
        .eq('user_id', sale.user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackIssuer) {
        issuer = fallbackIssuer;

        const { data: fallbackPortal } = await supabase
          .from('billing_portals')
          .select('*')
          .eq('billing_issuer_id', fallbackIssuer.id)
          .limit(1)
          .maybeSingle();

        if (fallbackPortal) portal = fallbackPortal;
      }
    }

    if (!issuer) {
      return errorResponse("El comercio no tiene un emisor fiscal configurado. Registra un emisor en Configuración > Facturas.");
    }

    let issuerPostalCode = normalizePostalCode(issuer?.codigo_postal);

    if (issuer && !issuerPostalCode) {
      const { data: validIssuers } = await supabase
        .from('billing_issuers')
        .select('*')
        .eq('user_id', sale.user_id)
        .order('created_at', { ascending: false });

      const validIssuer = (validIssuers || []).find((candidate: any) => normalizePostalCode(candidate.codigo_postal));

      if (validIssuer) {
        issuer = validIssuer;
        issuerPostalCode = normalizePostalCode(validIssuer.codigo_postal);

        const { data: validPortal } = await supabase
          .from('billing_portals')
          .select('*')
          .eq('billing_issuer_id', validIssuer.id)
          .limit(1)
          .maybeSingle();

        if (validPortal) portal = validPortal;
      }
    }

    if (!issuer || !issuer.rfc || !issuer.razon_social || !issuer.regimen_fiscal || !issuerPostalCode) {
      return errorResponse("El emisor fiscal está incompleto. Verifica RFC, razón social, régimen fiscal y código postal en Configuración > Facturas.");
    }

    // Paso 1.2: validacion global de limites de tiempo.
    const saleDate = new Date(sale.created_at);
    const now = new Date();

    if (!isSameBillingMonth(saleDate, now)) {
      return errorResponse("Este ticket ya expiro. Debe facturarse dentro del mismo mes de la compra.");
    }

    if (portal?.limite_tipo === 'dias' && portal.limite_dias > 0) {
      const diffTime = Math.abs(now.getTime() - saleDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > portal.limite_dias) {
        return errorResponse(`Su ticket ha expirado. El comercio permite facturar máximo ${portal.limite_dias} días después del consumo.`);
      }
    }

    // ─── PASO 1.3: VALIDACIÓN DE LÍMITES DE FOLIOS (TIMBRES) ───
    const { data: license, error: licenseErr } = await supabase
      .from('invitation_codes')
      .select('allocated_folios, consumed_folios')
      .eq('used_by', sale.user_id)
      .maybeSingle();

    if (licenseErr) {
      console.error("Error al consultar saldo de folios:", licenseErr);
    } else if (license) {
      const { allocated_folios, consumed_folios } = license;
      if (allocated_folios !== null && consumed_folios >= allocated_folios) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Límite de folios contratados agotado (${consumed_folios}/${allocated_folios}). Por favor, adquiera más folios con soporte técnico.` 
          }), 
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Paso 1.5: proteger reintentos para no timbrar duplicado.
    const { data: existingInvoice, error: existingInvoiceErr } = await supabase
      .from('invoices')
      .select('id, sale_id, user_id, uuid_cfdi, facturama_id, xml_url, pdf_url, total, status, created_at')
      .eq('sale_id', sale.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingInvoiceErr) {
      console.error("Error al consultar factura previa:", existingInvoiceErr);
      return errorResponse("No se pudo validar si el ticket ya estaba facturado. Intenta de nuevo.");
    }

    if (existingInvoice) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          Id: existingInvoice.facturama_id,
          Uuid: existingInvoice.uuid_cfdi,
          Xml: existingInvoice.xml_url,
          Pdf: existingInvoice.pdf_url,
          Invoice: existingInvoice,
        },
        invoice: existingInvoice,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sale.facturado) {
      return errorResponse(
        "Este ticket ya fue facturado, pero no se encontro el registro local de la factura. Contacta soporte para recuperar o reconciliar el CFDI antes de intentar nuevamente.",
        200,
        { sale_id: sale.id, ticket_uuid: sale.ticket_uuid },
      );
    }

    if (sale.sale_items.length === 0) {
      return errorResponse("El ticket no tiene partidas para facturar. Revisa la venta en el POS antes de timbrar.");
    }

    // Calcular factor de impuesto
    const hasTax = (sale.tax_amount || 0) > 0;
    const taxRate = hasTax ? (sale.tax_amount / (sale.subtotal || (sale.total - sale.tax_amount))) : 0;

    // ─── PASO 1.8: AGRUPACIÓN U ORDINARIO ───
    let facturamaItems = [];
    if (portal && portal.agrupar_conceptos) {
      // Lógica de Venta General
      let totalSubtotal = 0;
      let totalTax = 0;
      
      sale.sale_items.forEach((item: any) => {
        const unitPriceBeforeTax = hasTax ? (item.price / (1 + taxRate)) : item.price;
        const subtotalItem = unitPriceBeforeTax * item.quantity;
        const taxAmountItem = (item.total || (item.price * item.quantity)) - subtotalItem;
        totalSubtotal += subtotalItem;
        totalTax += taxAmountItem;
      });

      const genericItem: any = {
        ProductCode: portal.clave_servicio_agrupada || "01010101",
        Description: "Venta General",
        UnitCode: "E48",
        Quantity: 1,
        UnitPrice: parseFloat(totalSubtotal.toFixed(2)),
        Subtotal: parseFloat(totalSubtotal.toFixed(2)),
        TaxObject: hasTax ? "02" : "01",
        Total: parseFloat((totalSubtotal + totalTax).toFixed(2))
      };

      if (hasTax) {
        genericItem.Taxes = [{
            Total: parseFloat(totalTax.toFixed(2)),
            Name: "IVA",
            Base: parseFloat(totalSubtotal.toFixed(2)),
            Rate: parseFloat(taxRate.toFixed(2)),
            IsRetention: false
        }];
      }
      facturamaItems.push(genericItem);
    } else {
      // Lógica Desglosada actual
      facturamaItems = sale.sale_items.map((item: any) => {
        const unitPriceBeforeTax = hasTax ? (item.price / (1 + taxRate)) : item.price;
        const subtotalItem = unitPriceBeforeTax * item.quantity;
        const taxAmountItem = (item.total || (item.price * item.quantity)) - subtotalItem;

        const itemObj: any = {
          ProductCode: "01010101",
          Description: item.product_name || "Venta de Producto",
          UnitCode: "E48",
          Quantity: item.quantity,
          UnitPrice: parseFloat(unitPriceBeforeTax.toFixed(2)),
          Subtotal: parseFloat(subtotalItem.toFixed(2)),
          TaxObject: hasTax ? "02" : "01",
          Total: parseFloat((item.total || (item.price * item.quantity)).toFixed(2))
        };

        if (hasTax) {
          itemObj.Taxes = [{
            Total: parseFloat(taxAmountItem.toFixed(2)),
            Name: "IVA",
            Base: parseFloat(subtotalItem.toFixed(2)),
            Rate: parseFloat(taxRate.toFixed(2)),
            IsRetention: false
          }];
        }
        return itemObj;
      });
    }

    const facturamaBody = {
      CfdiType: "I",
      NameId: "1",
      LogoUrl: portal?.logo_url || null,
      PaymentForm: (sale.payment_method === 'tarjeta') ? "04" : "01", 
      PaymentMethod: "PUE",
      ExpeditionPlace: issuerPostalCode,
      Folio: ticket_uuid.substring(0, 8).toUpperCase(),
      Issuer: {
        Rfc: issuer.rfc,
        Name: issuer.razon_social,
        FiscalRegime: issuer.regimen_fiscal
      },
      Receiver: {
        Rfc: rfc,
        CfdiUse: uso_cfdi,
        Name: razon_social,
        FiscalRegime: regimen_fiscal,
        TaxZipCode: receiverPostalCode
      },
      Items: facturamaItems
    };

    console.log("Enviando Payload REAL a Facturama:", JSON.stringify(facturamaBody));

    // ─── PASO 2: POST a Facturama API-LITE ──────────────────────────
    let claimedSale = false;
    let claimErr = null;

    const { data: rpcClaimed, error: rpcClaimErr } = await supabase
      .rpc('claim_sale_for_invoicing', { p_sale_id: sale.id });

    if (!rpcClaimErr) {
      claimedSale = rpcClaimed === true;
    } else if (isMissingRpcError(rpcClaimErr)) {
      console.warn("RPC claim_sale_for_invoicing no disponible, usando fallback PostgREST:", rpcClaimErr);
      const { data: fallbackClaimed, error: fallbackClaimErr } = await supabase
        .from('sales')
        .update({ facturado: true })
        .eq('id', sale.id)
        .eq('facturado', false)
        .select('id')
        .maybeSingle();

      claimedSale = !!fallbackClaimed;
      claimErr = fallbackClaimErr;
    } else {
      claimErr = rpcClaimErr;
    }

    if (claimErr) {
      console.error("Error al reservar ticket para timbrado:", claimErr);
      return errorResponse(
        "No se pudo bloquear el ticket para facturacion. Intenta de nuevo.",
        200,
        claimErr,
      );
    }

    if (!claimedSale) {
      const { data: claimedInvoice } = await supabase
        .from('invoices')
        .select('id, sale_id, user_id, uuid_cfdi, facturama_id, xml_url, pdf_url, total, status, created_at')
        .eq('sale_id', sale.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (claimedInvoice) {
        return new Response(JSON.stringify({
          success: true,
          data: {
            Id: claimedInvoice.facturama_id,
            Uuid: claimedInvoice.uuid_cfdi,
            Xml: claimedInvoice.xml_url,
            Pdf: claimedInvoice.pdf_url,
            Invoice: claimedInvoice,
          },
          invoice: claimedInvoice,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return errorResponse(
        "Este ticket ya fue facturado o tiene una facturacion en proceso. Contacta soporte si no aparece el CFDI en Mis Facturas.",
        200,
        { sale_id: sale.id, ticket_uuid: sale.ticket_uuid },
      );
    }

    const cfdiRes = await fetch(`${BASE_URL}/api-lite/3/cfdis`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${encodedCredentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(facturamaBody),
    });

    const textResponse = await cfdiRes.text();
    console.log("Facturama API-LITE Body:", textResponse);

    let cfdiData;
    try {
      cfdiData = textResponse ? JSON.parse(textResponse) : {};
    } catch {
      cfdiData = { rawText: textResponse };
    }

    if (!cfdiRes.ok) {
      await supabase
        .from('sales')
        .update({ facturado: false })
        .eq('id', sale.id);

      let errorMsg = `Facturama Error ${cfdiRes.status}`;
      if (cfdiData.ModelState) {
        errorMsg += ": " + flattenFacturamaModelState(cfdiData.ModelState).join(", ");
      } else if (cfdiData.Message) {
        errorMsg += ": " + cfdiData.Message;
      }
      if (/Nombre del emisor/i.test(errorMsg)) {
        errorMsg += " Corrige la Razón Social SAT del emisor en Configuración > Facturas > Editar. Debe coincidir exactamente con la constancia fiscal del RFC emisor.";
      }
      return errorResponse(errorMsg, 200, cfdiData);
    }
    
    // ─── PASO 3: OBTENER ARCHIVOS BASE64 (API LITE - issuedLite) ───
    const resourceId = getFacturamaResourceId(cfdiData);
    const cfdiUuid = getFacturamaUuid(cfdiData);

    if (!resourceId && !cfdiUuid) {
      console.error("Facturama timbro sin devolver identificador fiscal:", cfdiData);
      return errorResponse(
        "Facturama timbro la factura, pero no devolvio un identificador fiscal para guardarla. Contacta soporte antes de reintentar para evitar duplicados.",
        200,
        cfdiData,
      );
    }

    try {
      if (resourceId) {
        console.log(`Pausa de 1.5s para archivos ID: ${resourceId}`);
        await new Promise(r => setTimeout(r, 1500));

        // PDF
        const pdfReq = await fetch(`${BASE_URL}/cfdi/pdf/issuedLite/${resourceId}`, {
          headers: { "Authorization": `Basic ${encodedCredentials}` }
        });
        if (pdfReq.ok) {
          const pdfData = await pdfReq.json();
          if (pdfData.Content) cfdiData.Pdf = pdfData.Content;
        }

        // XML
        const xmlReq = await fetch(`${BASE_URL}/cfdi/xml/issuedLite/${resourceId}`, {
          headers: { "Authorization": `Basic ${encodedCredentials}` }
        });
        if (xmlReq.ok) {
          const xmlData = await xmlReq.json();
          if (xmlData.Content) cfdiData.Xml = xmlData.Content;
        }

      }

      const invoiceRecord = {
        sale_id: sale.id,
        user_id: sale.user_id,
        uuid_cfdi: cfdiUuid || resourceId,
        facturama_id: resourceId || null,
        emisor_rfc: issuer.rfc,
        cliente_rfc: rfc,
        xml_url: cfdiData.Xml || null,
        pdf_url: cfdiData.Pdf || null,
        total: sale.total,
        status: 'VIGENTE'
      };
        
      const { data: insertedInvoice, error: insertErr } = await supabase
        .from('invoices')
        .insert([invoiceRecord])
        .select('id, sale_id, user_id, uuid_cfdi, facturama_id, xml_url, pdf_url, total, status, created_at')
        .single();

      if (insertErr || !insertedInvoice) {
        console.error("Error al insertar registro de factura:", insertErr);
        return errorResponse(
          "La factura se timbro en Facturama, pero no se pudo guardar en el POS. Contacta soporte antes de reintentar para evitar duplicados.",
          200,
          { insertErr, facturama: cfdiData, invoiceRecord },
        );
      }

      const { error: saleUpdateErr } = await supabase
        .from('sales')
        .update({ facturado: true })
        .eq('id', sale.id);

      if (saleUpdateErr) {
        console.error("Factura guardada, pero no se pudo marcar la venta como facturada:", saleUpdateErr);
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          ...cfdiData,
          Id: resourceId || cfdiData.Id || cfdiData.id,
          Uuid: cfdiUuid || insertedInvoice.uuid_cfdi,
          Invoice: insertedInvoice,
        },
        invoice: insertedInvoice,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (err: any) {
      console.error("Error persistencia:", err);
      return errorResponse(
        "La factura se timbro en Facturama, pero ocurrio un error al guardar sus datos en el POS. Contacta soporte antes de reintentar para evitar duplicados.",
        200,
        { error: err.message, facturama: cfdiData },
      );
    }

  } catch (err: any) {
    console.error("Error inesperado en timbrar:", err);
    return errorResponse(err.message || "Error inesperado al timbrar la factura.", 500);
  }
});
