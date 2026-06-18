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

const parseTicketAmount = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;

  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!cleaned) return NaN;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandsSep = decimalSep === "," ? "." : ",";
    normalized = cleaned.split(thousandsSep).join("").replace(decimalSep, ".");
  } else {
    const sep = lastComma >= 0 ? "," : lastDot >= 0 ? "." : "";

    if (sep) {
      const parts = cleaned.split(sep);
      const decimalPart = parts[parts.length - 1];

      if (parts.length > 2) {
        const integerPart = parts.slice(0, -1).join("");
        normalized = decimalPart.length > 0 && decimalPart.length <= 2
          ? `${integerPart}.${decimalPart}`
          : parts.join("");
      } else if (decimalPart.length === 3 && parts[0].length <= 3) {
        normalized = parts.join("");
      } else {
        normalized = cleaned.replace(sep, ".");
      }
    }
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
};

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const folio = String(body?.folio ?? "").trim();
    const pin = String(body?.pin ?? "").trim().toUpperCase();
    const inputTotal = parseTicketAmount(body?.total);

    if (!folio || !pin || !Number.isFinite(inputTotal)) {
      return errorResponse("Captura folio, PIN y monto total del ticket.");
    }

    if (!/^\d+$/.test(folio)) {
      return errorResponse("El folio del ticket no tiene un formato valido.");
    }

    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .select("id, ticket_uuid, pin_facturacion, total, created_at, facturado")
      .eq("id", folio)
      .eq("pin_facturacion", pin)
      .maybeSingle();

    if (saleErr) {
      console.error("Error consultando ticket para recuperar factura:", saleErr);
      return errorResponse("No se pudo consultar el ticket. Intenta de nuevo.");
    }

    if (!sale) {
      return errorResponse("No encontramos un ticket con ese folio y PIN.");
    }

    const dbTotal = parseTicketAmount(sale.total);
    if (!Number.isFinite(dbTotal) || Math.abs(dbTotal - inputTotal) > 0.01) {
      return errorResponse("El monto ingresado no coincide con el registrado en el ticket.");
    }

    const { data: invoice, error: invoiceErr } = await supabase
      .from("invoices")
      .select("id, sale_id, uuid_cfdi, facturama_id, xml_url, pdf_url, status, total, created_at")
      .eq("sale_id", sale.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (invoiceErr) {
      console.error("Error consultando factura previa:", invoiceErr);
      return errorResponse("No se pudo consultar la factura emitida. Intenta de nuevo.");
    }

    if (!invoice) {
      return errorResponse("Este ticket ya fue facturado, pero no encontramos el CFDI descargable. Contacta soporte con folio, PIN y monto.");
    }

    const uuid = firstString(invoice.uuid_cfdi);
    const facturamaId = firstString(invoice.facturama_id, uuid, invoice.id);

    return jsonResponse({
      success: true,
      invoice: {
        id: facturamaId,
        facturama_id: invoice.facturama_id,
        uuid,
        xml_url: invoice.xml_url,
        pdf_url: invoice.pdf_url,
        status: invoice.status,
        total: invoice.total,
        created_at: invoice.created_at,
      },
      sale: {
        id: sale.id,
        ticket_uuid: sale.ticket_uuid,
        total: sale.total,
        created_at: sale.created_at,
        facturado: sale.facturado,
      },
    });
  } catch (err: any) {
    console.error("Error inesperado en buscar-factura-ticket:", err);
    return errorResponse(err.message || "Error inesperado al recuperar la factura.", 500);
  }
});
