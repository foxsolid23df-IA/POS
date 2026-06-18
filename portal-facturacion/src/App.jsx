import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import Swal from 'sweetalert2';

// Configuración de Marca y Textos por defecto
const APP_NAME = import.meta.env.VITE_APP_NAME || 'NexumPOS';
const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'Auto-Facturación | NexumPos';
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'soporte@nexumpos.com';
const SUPPORT_WHATSAPP = import.meta.env.VITE_SUPPORT_WHATSAPP || '5215650607108';

const parseTicketAmount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;

  const cleaned = String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\d,.-]/g, '');

  if (!cleaned) return NaN;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? ',' : '.';
    const thousandsSep = decimalSep === ',' ? '.' : ',';
    normalized = cleaned.split(thousandsSep).join('').replace(decimalSep, '.');
  } else {
    const sep = lastComma >= 0 ? ',' : lastDot >= 0 ? '.' : '';

    if (sep) {
      const parts = cleaned.split(sep);
      const decimalPart = parts[parts.length - 1];

      if (parts.length > 2) {
        const integerPart = parts.slice(0, -1).join('');
        normalized = decimalPart.length > 0 && decimalPart.length <= 2
          ? `${integerPart}.${decimalPart}`
          : parts.join('');
      } else if (decimalPart.length === 3 && parts[0].length <= 3) {
        normalized = parts.join('');
      } else {
        normalized = cleaned.replace(sep, '.');
      }
    }
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : NaN;
};

const extractFunctionErrorMessage = async (error, fallback = 'Error al procesar la solicitud.') => {
  let message = error?.message || fallback;
  const response = error?.context;

  if (!response) return message;

  try {
    const text = await response.clone().text();
    if (!text) return message;

    try {
      const body = JSON.parse(text);
      message = body.message || body.error || (typeof body.details === 'string' ? body.details : '') || message;

      if (body.details?.Message && !String(message).includes(body.details.Message)) {
        message = `${message}: ${body.details.Message}`;
      }
    } catch {
      message = text;
    }
  } catch (parseErr) {
    console.warn('No se pudo leer el detalle de error de la Edge Function:', parseErr);
  }

  return String(message);
};

export default function App() {
  const [step, setStep] = useState(1);
  const [folioValue, setFolioValue] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [prefillNotice, setPrefillNotice] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [processStep, setProcessStep] = useState('');
  const [ticketData, setTicketData] = useState(null);

  // Información extendida del ticket
  const [storeName, setStoreName] = useState('Nexum POS');
  const [ticketItems, setTicketItems] = useState([]);

  // Formulario Fiscal
  const [rfc, setRfc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [regimenFiscal, setRegimenFiscal] = useState('601'); // 601 General de Ley
  const [usoCfdi, setUsoCfdi] = useState('G03'); // G03 Gastos en General
  const [email, setEmail] = useState('');

  const [invoiceResult, setInvoiceResult] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folioParam = params.get('folio') || params.get('ticket') || '';
    const pinParam = params.get('pin') || '';
    const totalParam = params.get('total') || '';

    if (folioParam) setFolioValue(folioParam.trim());
    if (pinParam) setPinValue(pinParam.trim().toUpperCase());
    if (totalParam) setTotalValue(totalParam.trim());

    if (folioParam && pinParam) {
      setPrefillNotice(`Encontramos tu ticket #${folioParam.trim()}. Solo confirma el monto total para continuar.`);
    }
  }, []);

  useEffect(() => {
    const draftKey = getDraftKey(ticketData);
    if (!draftKey) return;

    try {
      const savedDraft = JSON.parse(localStorage.getItem(draftKey) || '{}');
      if (!savedDraft || typeof savedDraft !== 'object') return;

      if (savedDraft.rfc) setRfc(savedDraft.rfc);
      if (savedDraft.razonSocial) setRazonSocial(savedDraft.razonSocial);
      if (savedDraft.codigoPostal) setCodigoPostal(savedDraft.codigoPostal);
      if (savedDraft.regimenFiscal) setRegimenFiscal(savedDraft.regimenFiscal);
      if (savedDraft.usoCfdi) setUsoCfdi(savedDraft.usoCfdi);
      if (savedDraft.email) setEmail(savedDraft.email);
    } catch (err) {
      console.warn('No se pudo recuperar el borrador fiscal:', err);
    }
  }, [ticketData?.id]);

  useEffect(() => {
    const draftKey = getDraftKey(ticketData);
    if (!draftKey) return;

    const draft = { rfc, razonSocial, codigoPostal, regimenFiscal, usoCfdi, email };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [ticketData?.id, rfc, razonSocial, codigoPostal, regimenFiscal, usoCfdi, email]);

  const getTicketReference = () => {
    const folio = ticketData?.id || folioValue.trim();
    const pin = pinValue.trim().toUpperCase();
    const total = totalValue.trim();
    const parts = [];

    if (folio) parts.push(`folio ${folio}`);
    if (pin) parts.push(`PIN ${pin}`);
    if (total) parts.push(`monto ${total}`);

    return parts.length ? parts.join(', ') : 'los datos de tu ticket';
  };

  const getSupportMessage = () => (
    `Tengo problema facturando ${getTicketReference()}. ` +
    `Error mostrado: ${errorMsg || 'Sin error visible todavía'}.`
  );

  const openSupportEmail = () => {
    const subject = encodeURIComponent('Soporte de facturación');
    const body = encodeURIComponent(getSupportMessage());
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const openSupportWhatsApp = () => {
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(getSupportMessage())}`, '_blank', 'noopener,noreferrer');
  };

  const getDraftKey = (ticket = ticketData) => (
    ticket?.id ? `nexumpos:billing-draft:${ticket.user_id || 'public'}:${ticket.id}` : null
  );

  const getFriendlyErrorMessage = (message) => {
    const rawMessage = String(message || '').trim();
    const reference = getTicketReference();

    if (/bloquear|facturacion en proceso|facturaci[oó]n en proceso|ya fue facturado/i.test(rawMessage)) {
      return `Este ticket ya fue facturado o está en proceso. Espera 1 minuto y vuelve a buscarlo. Si no aparece el CFDI, contacta soporte con ${reference}.`;
    }

    if (/No se encontr[oó]|ticket con esos datos|PGRST116|22P02/i.test(rawMessage)) {
      return `No encontramos el ticket. Revisa que el folio y PIN estén escritos exactamente como aparecen en tu recibo. Datos capturados: ${reference}.`;
    }

    if (/monto ingresado no coincide|monto total/i.test(rawMessage)) {
      return `El monto no coincide con el ticket. Escríbelo como aparece en el recibo, por ejemplo 4.044,96 o 4044.96. Datos capturados: ${reference}.`;
    }

    if (/Nombre del emisor|RFC del Emisor|ExpeditionPlace|emisor fiscal/i.test(rawMessage)) {
      return `El comercio necesita corregir su configuración fiscal antes de emitir esta factura. Contacta soporte con ${reference}.`;
    }

    if (/identificador fiscal|guardar en el POS|registro local/i.test(rawMessage)) {
      return `La factura requiere revisión de soporte antes de intentar de nuevo para evitar duplicados. Contacta soporte con ${reference}.`;
    }

    return rawMessage || 'No se pudo completar la solicitud. Intenta de nuevo o contacta soporte con los datos del ticket.';
  };

  const mapIssuedInvoiceResult = (invoice) => ({
    id: invoice?.id || invoice?.facturama_id || invoice?.uuid || 'UUID no disponible',
    facturama_id: invoice?.facturama_id,
    uuid: invoice?.uuid || 'UUID no disponible',
    xml_url: invoice?.xml_url,
    pdf_url: invoice?.pdf_url,
    status: invoice?.status,
    created_at: invoice?.created_at,
    alreadyIssued: true
  });

  const recoverIssuedInvoice = async ({ folio, pin, total }) => {
    const { data, error } = await supabase.functions.invoke('buscar-factura-ticket', {
      body: { folio, pin, total }
    });

    if (error) {
      const errorDetails = await extractFunctionErrorMessage(error, 'No se pudo recuperar la factura.');
      throw new Error(errorDetails);
    }

    if (!data?.success) {
      throw new Error(data?.message || 'No encontramos la factura emitida para este ticket.');
    }

    return data;
  };

  const getFiscalValidation = () => {
    const errors = {};
    const warnings = {};
    const cleanRfc = rfc.trim().toUpperCase();
    const cleanPostalCode = codigoPostal.trim();
    const cleanBusinessName = razonSocial.trim().replace(/\s+/g, ' ');
    const cleanEmail = email.trim();

    if (cleanRfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(cleanRfc)) {
      errors.rfc = 'El RFC debe tener 12 o 13 caracteres y el formato correcto del SAT.';
    }

    if (cleanPostalCode && !/^\d{5}$/.test(cleanPostalCode)) {
      errors.codigoPostal = 'El código postal fiscal debe tener exactamente 5 dígitos.';
    }

    if (cleanBusinessName && cleanBusinessName.length < 3) {
      errors.razonSocial = 'La razón social debe tener al menos 3 caracteres.';
    }

    if (/\bS\.?\s*A\.?\s*(DE)?\s*C\.?\s*V\.?\b|\bSA\s+DE\s+CV\b|\bS\.?\s*DE\s*R\.?\s*L\.?/i.test(cleanBusinessName)) {
      warnings.razonSocial = 'Revisa tu constancia fiscal: en muchos casos el nombre se captura sin S.A. de C.V. ni régimen societario.';
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = 'Ingresa un correo válido o deja este campo vacío.';
    }

    return { errors, warnings };
  };

  // Carga el nombre del establecimiento y los conceptos del ticket
  const loadExtraTicketInfo = async (ticket) => {
    try {
      // 1. Consultar el nombre del establecimiento (profiles)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('store_name')
        .eq('id', ticket.user_id)
        .single();
      
      setStoreName(profileData?.store_name || 'Nexum POS Station');

      // 2. Consultar los conceptos (sale_items)
      const { data: itemsData, error: itemsErr } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', ticket.id);

      if (itemsErr) throw itemsErr;

      if (itemsData && itemsData.length > 0) {
        setTicketItems(itemsData);
      } else {
        setTicketItems([
          {
            id: 'fallback-item',
            product_name: 'Consumo General',
            quantity: 1,
            price: ticket.total,
            total: ticket.total,
            unit_sold: 'PZA'
          }
        ]);
      }
    } catch (err) {
      console.warn("No se pudo cargar información adicional del ticket:", err);
      setStoreName('Nexum POS Station');
      setTicketItems([
        {
          id: 'fallback-item',
          product_name: 'Consumo General',
          quantity: 1,
          price: ticket.total,
          total: ticket.total,
          unit_sold: 'PZA'
        }
      ]);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setProcessStep('Validando datos fiscales');

    try {
      if (!folioValue || !pinValue || !totalValue) {
        throw new Error("Por favor, rellena todos los campos.");
      }

      // Buscar la venta en la base de datos
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('id', folioValue.trim()) 
        .eq('pin_facturacion', pinValue.trim().toUpperCase())
        .single();

      if (error) {
        console.error("DB Error fetching ticket:", error);
        if (error.code === 'PGRST116' || error.code === '22P02') {
          throw new Error('No se encontró ningún ticket con esos datos. Verifica el Folio y PIN.');
        }
        throw new Error(`Error BD: ${error.message}`);
      }

      if (!data) throw new Error("No se encontró ningún ticket devuelto por el servidor.");

      // Validar monto total ingresado vs registrado
      const dbTotal = parseTicketAmount(data.total);
      const inputTotal = parseTicketAmount(totalValue);

      if (!Number.isFinite(inputTotal)) {
        throw new Error('Ingresa el monto total como aparece en el ticket, por ejemplo 4.044,96 o 4044.96.');
      }

      if (!Number.isFinite(dbTotal)) {
        throw new Error('No se pudo validar el monto registrado del ticket.');
      }
      
      if (Math.abs(dbTotal - inputTotal) > 0.01) {
        throw new Error('El monto ingresado no coincide con el registrado en el ticket.');
      }

      // Cargar tienda y conceptos
      await loadExtraTicketInfo(data);

      if (data.facturado) {
        const issuedData = await recoverIssuedInvoice({
          folio: data.id,
          pin: pinValue.trim().toUpperCase(),
          total: totalValue
        });

        setInvoiceResult(mapIssuedInvoiceResult(issuedData.invoice));
        setTicketData(data);
        localStorage.removeItem(getDraftKey(data));
        setStep(4);
        return;
      }

      setTicketData(data);
      setStep(2); // Revisión de ticket
    } catch (err) {
      const friendlyMessage = getFriendlyErrorMessage(err.message || 'Error al buscar el ticket.');
      setErrorMsg(friendlyMessage);
      Swal.fire({
        title: 'Error de Búsqueda',
        text: friendlyMessage,
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#00c2cb',
        background: '#171f33',
        color: '#dae2fd'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchRfc = async () => {
    if (!rfc || rfc.length < 12) return;
    setLoading(true);
    try {
      let query = supabase
        .from('clients')
        .select('*')
        .eq('rfc', rfc.toUpperCase())
        .limit(1);

      if (ticketData?.user_id) {
        query = query.eq('user_id', ticketData.user_id);
      }

      const { data } = await query.maybeSingle();
      
      if (data) {
        setRazonSocial(data.razon_social);
        setCodigoPostal(data.codigo_postal);
        setRegimenFiscal(data.regimen_fiscal);
        setUsoCfdi(data.uso_cfdi);
        if (data.email) setEmail(data.email);
      }
    } catch (err) {
      console.warn("No se encontró historial previo para este RFC.", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFacturar = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const validation = getFiscalValidation();
      const validationMessages = Object.values(validation.errors);

      if (validationMessages.length > 0) {
        throw new Error(validationMessages.join(' '));
      }

      const confirmation = await Swal.fire({
        title: 'Verifica tus datos fiscales',
        html: `
          <div style="text-align:left;display:grid;gap:8px;font-size:14px;line-height:1.45">
            <p style="margin-bottom:6px;color:#bbc9ca">Deben coincidir exactamente con tu constancia fiscal.</p>
            <div><b>RFC:</b> ${rfc.toUpperCase()}</div>
            <div><b>Razón social:</b> ${razonSocial}</div>
            <div><b>Código postal:</b> ${codigoPostal}</div>
            <div><b>Régimen fiscal:</b> ${regimenFiscal}</div>
            <div><b>Uso CFDI:</b> ${usoCfdi}</div>
            <div><b>Correo:</b> ${email || 'Sin correo'}</div>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, generar factura',
        cancelButtonText: 'Revisar datos',
        confirmButtonColor: '#00c2cb',
        cancelButtonColor: '#2d3449',
        background: '#171f33',
        color: '#dae2fd'
      });

      if (!confirmation.isConfirmed) return;

      // 1. Guardar o actualizar cliente
      setProcessStep('Guardando datos fiscales');
      if (ticketData?.user_id) {
        const { data: existingClient, error: selectErr } = await supabase
          .from('clients')
          .select('id')
          .eq('rfc', rfc.toUpperCase())
          .eq('user_id', ticketData.user_id)
          .limit(1)
          .maybeSingle();

        if (selectErr && selectErr.code !== 'PGRST116') {
          console.warn("Error consultando cliente", selectErr);
        }

        const clientData = {
          user_id: ticketData.user_id,
          rfc: rfc.toUpperCase(), 
          razon_social: razonSocial,
          regimen_fiscal: regimenFiscal,
          uso_cfdi: usoCfdi,
          codigo_postal: codigoPostal,
          email: email
        };

        if (existingClient) {
          const { error: updateErr } = await supabase.from('clients').update(clientData).eq('id', existingClient.id);
          if (updateErr) console.warn("Error actualizando cliente", updateErr);
        } else {
          const { error: insertErr } = await supabase.from('clients').insert([clientData]);
          if (insertErr) console.warn("Error guardando nuevo cliente", insertErr);
        }
      } else {
        console.warn("No se guardó historial del cliente porque el ticket no trae user_id.");
      }

      // 2. Invocar la Edge Function 'timbrar'
      setProcessStep('Enviando al SAT / Facturama');
      const { data: timbradoData, error: timbrarErr } = await supabase.functions.invoke('timbrar', {
        body: {
          ticket_uuid: ticketData.ticket_uuid,
          rfc: rfc.toUpperCase(),
          razon_social: razonSocial,
          codigo_postal: codigoPostal,
          regimen_fiscal: regimenFiscal,
          uso_cfdi: usoCfdi,
          email: email
        }
      });

      if (timbrarErr) {
        const errorDetails = await extractFunctionErrorMessage(timbrarErr, 'No se pudo timbrar la factura.');
        throw new Error(`Error en timbrado: ${errorDetails}`);
      }
      
      if (timbradoData && timbradoData.success) {
        setProcessStep('Preparando PDF y XML');
        const invoice = timbradoData.invoice || timbradoData.data?.Invoice || {};
        const cfdiId = invoice.facturama_id || timbradoData.data?.Id || timbradoData.data?.id || timbradoData.data?.CfdiId || timbradoData.data?.cfdiId;
        const uuid = invoice.uuid_cfdi || timbradoData.data?.FolioFiscal || timbradoData.data?.Uuid || timbradoData.data?.uuid;

        if (!cfdiId && !uuid) {
          throw new Error('La factura se timbro, pero el servidor no devolvio un identificador fiscal valido.');
        }

        setInvoiceResult({
          id: cfdiId || uuid,
          facturama_id: cfdiId,
          uuid: uuid || cfdiId,
          xml_url: invoice.xml_url || timbradoData.data?.Xml,
          pdf_url: invoice.pdf_url || timbradoData.data?.Pdf,
          created_at: invoice.created_at || new Date().toISOString(),
          alreadyIssued: false
        });
      } else {
        throw new Error(timbradoData?.message || 'Error desconocido al facturar');
      }
      
      localStorage.removeItem(getDraftKey());
      setStep(4); // Éxito
      
    } catch (err) {
      console.error("Error en handleFacturar:", err);
      const friendlyMessage = getFriendlyErrorMessage(err.message || "Error al procesar la factura con el SAT.");
      setErrorMsg(friendlyMessage);
      Swal.fire({
        title: 'Error de Facturación',
        text: friendlyMessage,
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#00c2cb',
        background: '#171f33',
        color: '#dae2fd'
      });
    } finally {
      setLoading(false);
      setProcessStep('');
    }
  };

  const handleDownload = (content, fileName, type) => {
    if (!content) {
      Swal.fire({
        title: 'Error',
        text: 'El contenido del archivo no está disponible.',
        icon: 'error',
        confirmButtonColor: '#00c2cb',
        background: '#171f33',
        color: '#dae2fd'
      });
      return;
    }

    if (content.startsWith('http')) {
      window.open(content, '_blank');
      return;
    }
    
    try {
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: type });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error procesando archivo para descarga:", e);
      const blob = new Blob([content], { type: type });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const handleCopyUuid = async () => {
    if (!invoiceResult?.uuid) return;

    try {
      await navigator.clipboard.writeText(invoiceResult.uuid);
      Swal.fire({
        title: 'UUID copiado',
        text: 'El folio fiscal se copió al portapapeles.',
        icon: 'success',
        timer: 1600,
        showConfirmButton: false,
        background: '#171f33',
        color: '#dae2fd'
      });
    } catch {
      Swal.fire({
        title: 'UUID Fiscal',
        text: invoiceResult.uuid,
        icon: 'info',
        confirmButtonColor: '#00c2cb',
        background: '#171f33',
        color: '#dae2fd'
      });
    }
  };

  const handleSendEmail = async () => {
    if (!email) {
      Swal.fire({
        title: 'Error',
        text: 'Por favor, ingresa un correo electrónico.',
        icon: 'error',
        confirmButtonColor: '#00c2cb',
        background: '#171f33',
        color: '#dae2fd'
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-factura-email', {
        body: {
          cfdi_id: invoiceResult.id,
          email: email,
          subject: 'Tu factura electrónica está lista',
          comments: 'Adjuntamos tu factura electrónica generada automáticamente.',
          issuer_email: 'noreply@facturama.mx'
        }
      });

      if (error) throw error;

      if (data && data.success) {
        Swal.fire({
          title: 'Correo Enviado',
          text: 'La factura ha sido enviada exitosamente a ' + email,
          icon: 'success',
          confirmButtonColor: '#00c2cb',
          background: '#171f33',
          color: '#dae2fd'
        });
      } else {
        throw new Error(data?.message || 'No se pudo enviar el correo.');
      }
    } catch (err) {
      Swal.fire({
        title: 'Error al Enviar',
        text: err.message || 'Ocurrió un error al enviar el email.',
        icon: 'error',
        confirmButtonColor: '#00c2cb',
        background: '#171f33',
        color: '#dae2fd'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Confirmas la cancelación?',
      text: "Esta acción anulará el CFDI ante el SAT y no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3c494a',
      confirmButtonText: 'Sí, Cancelar Factura',
      cancelButtonText: 'No, mantener',
      background: '#171f33',
      color: '#dae2fd'
    });

    if (!isConfirmed) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancelar-cfdi', {
        body: { id: invoiceResult.id, motive: '02' }
      });

      if (error) throw error;

      if (data && data.success) {
        Swal.fire({
          title: 'Cancelada',
          text: 'La factura ha sido cancelada exitosamente ante el SAT.',
          icon: 'success',
          confirmButtonColor: '#00c2cb',
          background: '#171f33',
          color: '#dae2fd'
        });
        resetFlow();
      } else {
        throw new Error(data?.message || 'Error al cancelar la factura.');
      }
    } catch (err) {
      console.error("Error al cancelar CFDI:", err);
      Swal.fire({
        title: 'Error de Cancelación',
        text: err.message || 'Error al cancelar el CFDI.',
        icon: 'error',
        confirmButtonColor: '#00c2cb',
        background: '#171f33',
        color: '#dae2fd'
      });
    } finally {
      setLoading(false);
    }
  };

  const isCancellationExpired = () => {
    if (!invoiceResult?.created_at) return true;
    const created = new Date(invoiceResult.created_at);
    const now = new Date();
    const diffHours = (now - created) / (1000 * 60 * 60);
    return diffHours > 24; 
  };

  const resetFlow = () => {
    setStep(1);
    setFolioValue('');
    setPinValue('');
    setTotalValue('');
    setPrefillNotice('');
    setTicketData(null);
    setInvoiceResult(null);
    setErrorMsg('');
    setProcessStep('');
  };

  // Ayuda y soporte mock actions
  const showHelpAlert = () => {
    Swal.fire({
      title: 'Ubica los datos en tu ticket',
      html: `
        <div style="display:grid;gap:14px;text-align:left">
          <div style="background:#0b1326;border:1px solid rgba(69,222,231,.35);border-radius:12px;padding:14px;font-family:monospace;color:#dae2fd">
            <div style="text-align:center;font-weight:800;margin-bottom:10px">*** VENTA ***</div>
            <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px">
              <span style="background:rgba(69,222,231,.14);border:1px solid rgba(69,222,231,.5);border-radius:8px;padding:6px 8px">Folio: 2867</span>
              <span>Hora: 8:14</span>
            </div>
            <div style="border-top:1px dashed #859394;border-bottom:1px dashed #859394;padding:10px 0;margin:10px 0">
              <div>PRODUCTO EJEMPLO</div>
              <div style="text-align:right;font-weight:800;background:rgba(69,222,231,.14);border:1px solid rgba(69,222,231,.5);border-radius:8px;padding:6px 8px;margin-top:8px">TOTAL $7,200.00</div>
            </div>
            <div style="border:1px dashed #859394;border-radius:10px;padding:12px;text-align:center">
              <div style="width:74px;height:74px;margin:0 auto 10px;background:repeating-linear-gradient(45deg,#dae2fd 0 4px,#0b1326 4px 8px);border:8px solid #dae2fd"></div>
              <div style="font-weight:800;background:rgba(69,222,231,.14);border:1px solid rgba(69,222,231,.5);border-radius:8px;padding:6px 8px;margin-bottom:6px">FOLIO 2867</div>
              <div style="font-weight:800;background:rgba(69,222,231,.14);border:1px solid rgba(69,222,231,.5);border-radius:8px;padding:6px 8px">PIN 4F1B78</div>
            </div>
          </div>
          <div style="font-size:13px;line-height:1.5;color:#dae2fd">
            Escanea el QR o escribe <b>Folio</b>, <b>PIN</b> y <b>Total</b> tal como aparecen en el ticket. El monto acepta formatos como <b>7,200.00</b>, <b>7200.00</b> o <b>7.200,00</b>.
          </div>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#00c2cb',
      background: '#171f33',
      color: '#dae2fd'
    });
  };

  const showSupportAlert = async () => {
    const result = await Swal.fire({
      title: 'Soporte Técnico',
      html: `<div style="text-align:left;line-height:1.5">
        <p>Te ayudamos con tu factura. El mensaje incluirá: <b>${getTicketReference()}</b>.</p>
        <p style="margin-top:8px;color:#bbc9ca">Teléfono: +52 1 56 5060 7108</p>
      </div>`,
      icon: 'question',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'WhatsApp',
      denyButtonText: 'Correo',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#00c2cb',
      denyButtonColor: '#2d3449',
      background: '#171f33',
      color: '#dae2fd'
    });

    if (result.isConfirmed) openSupportWhatsApp();
    if (result.isDenied) openSupportEmail();
  };

  const showFeatureAlert = async () => {
    const result = await Swal.fire({
      title: 'Mis Facturas',
      html: `
        <div style="display:grid;gap:10px;text-align:left">
          <label style="font-size:12px;color:#bbc9ca">Folio del ticket</label>
          <input id="lookup-folio" class="swal2-input" style="margin:0;width:100%" value="${folioValue}" placeholder="Ej. 2867" />
          <label style="font-size:12px;color:#bbc9ca">PIN</label>
          <input id="lookup-pin" class="swal2-input" style="margin:0;width:100%;text-transform:uppercase" value="${pinValue}" placeholder="Ej. 4F1B78" />
          <label style="font-size:12px;color:#bbc9ca">Monto total del ticket</label>
          <input id="lookup-total" class="swal2-input" style="margin:0;width:100%" value="${totalValue}" placeholder="Ej. 10,780.00" />
          <label style="font-size:12px;color:#bbc9ca">Correo para reenviar (opcional)</label>
          <input id="lookup-email" class="swal2-input" style="margin:0;width:100%" value="${email}" placeholder="correo@ejemplo.com" />
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Buscar factura',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#00c2cb',
      cancelButtonColor: '#2d3449',
      background: '#171f33',
      color: '#dae2fd',
      preConfirm: () => {
        const folio = document.getElementById('lookup-folio')?.value?.trim();
        const pin = document.getElementById('lookup-pin')?.value?.trim().toUpperCase();
        const total = document.getElementById('lookup-total')?.value?.trim();
        const lookupEmail = document.getElementById('lookup-email')?.value?.trim();

        if (!folio || !pin || !total) {
          Swal.showValidationMessage('Captura folio, PIN y monto total del ticket.');
          return false;
        }

        return { folio, pin, total, lookupEmail };
      }
    });

    if (!result.isConfirmed) return;

    const { folio, pin, total, lookupEmail } = result.value;
    setLoading(true);
    setFolioValue(folio);
    setPinValue(pin);
    setTotalValue(total);
    if (lookupEmail) setEmail(lookupEmail);

    try {
      const issuedData = await recoverIssuedInvoice({ folio, pin, total });
      setTicketData(issuedData.sale);
      setInvoiceResult(mapIssuedInvoiceResult(issuedData.invoice));
      setStep(4);
    } catch (err) {
      Swal.fire({
        title: 'Factura no encontrada',
        text: getFriendlyErrorMessage(err.message || 'No se pudo buscar la factura.'),
        icon: 'info',
        confirmButtonColor: '#00c2cb',
        background: '#171f33',
        color: '#dae2fd'
      });
    } finally {
      setLoading(false);
    }
  };

  const fiscalValidation = getFiscalValidation();

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body-md relative overflow-hidden">
      
      {/* TopNavBar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-outline-variant/10 bg-surface/85 backdrop-blur-md h-14 flex items-center">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-3 cursor-pointer" onClick={resetFlow}>
            <img alt="Nexum POS" className="h-9 w-9 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-FvRoI1Z_JHYweQCm5tKKkeZqtfH7GJJRW2eEa20gQGuuR3qFi4G78mKeQpE8ueThNGYakg910ia9n33QWies3t9BaEttny1gTLpz1W8ldmdWWXe9YiVdR7qsaUNLQvSvrXOYvfX_5GzDsAwrfWhaJL0PNclUaEBtZbQZ0vAy3FHDhtw7YAnzPquPI4Y7Lg2T_AvC61jp5cUTgcMhPagzzULIMjW2sk2kb-YA70e2LrMAfA44OkdEdJ6JFiPVN7G8Jyr5ATnqzkE" />
            <div className="font-headline-md text-headline-md font-bold text-on-surface select-none">{APP_NAME}</div>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={resetFlow} className={`font-label-md text-label-md transition-colors ${step < 4 ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}>
              Inicio
            </button>
            <button onClick={showFeatureAlert} className={`font-label-md text-label-md transition-colors ${step === 4 ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-primary'}`}>
              Mis Facturas
            </button>
            <button onClick={showSupportAlert} className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors">
              Soporte
            </button>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={showHelpAlert} className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-full hover:bg-surface-container-high/50">notifications</button>
            <button onClick={showSupportAlert} className="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-full hover:bg-surface-container-high/50">account_circle</button>
            <button onClick={resetFlow} className="font-label-md text-label-md text-on-primary bg-primary px-4 md:px-6 py-1.5 rounded-lg hover:brightness-110 active:scale-95 transition-all duration-150 ease-in-out">
              Nueva Factura
            </button>
          </div>
        </div>
      </nav>

      {/* Stepper / Progress bar */}
      {step > 1 && step < 4 && (
        <div className="w-full bg-surface-container-low h-1 fixed top-14 left-0 right-0 z-40">
          <div 
            className="bg-primary h-full transition-all duration-750" 
            style={{ width: step === 2 ? '66%' : '100%' }}
          ></div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-grow flex items-center justify-center pt-24 pb-20 px-4 md:px-margin-mobile relative">
        {/* Background Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] md:w-[800px] h-[600px] md:h-[800px] bg-primary/5 blur-[100px] md:blur-[120px] rounded-full pointer-events-none"></div>

        {/* STEP 1: Search Ticket */}
        {step === 1 && (
          <div className="w-full max-w-[540px] bg-surface-container rounded-xl p-8 md:p-10 border border-outline-variant/20 shadow-xl relative z-10 animate-fade-in">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 mb-5 flex items-center justify-center bg-primary/10 rounded-2xl border border-primary/20">
                <span className="material-symbols-outlined text-[32px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Auto-Facturación</h1>
              <p className="text-body-md font-body-md text-on-surface-variant">
                Ingresa los detalles de tu ticket de compra para generar tu factura fiscal de forma segura.
              </p>
            </div>

            {prefillNotice && (
              <div className="mb-6 bg-primary/10 border border-primary/40 rounded-lg p-3 text-sm text-primary text-center animate-fade-in">
                {prefillNotice}
              </div>
            )}

            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-label-md font-label-md text-on-surface-variant" htmlFor="folio">Folio del Ticket</label>
                  <input 
                    required 
                    id="folio" 
                    type="text" 
                    value={folioValue} 
                    onChange={(e) => setFolioValue(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                    placeholder="Ej. 1254" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-label-md font-label-md text-on-surface-variant" htmlFor="pin">PIN</label>
                  <input 
                    required 
                    id="pin" 
                    type="text" 
                    value={pinValue} 
                    onChange={(e) => setPinValue(e.target.value.toUpperCase())} 
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono" 
                    placeholder="Ej. F7D1" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-label-md font-label-md text-on-surface-variant" htmlFor="total">Monto Total</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-medium">$</span>
                  <input 
                    required 
                    id="total" 
                    type="text" 
                    inputMode="decimal"
                    value={totalValue} 
                    onChange={(e) => setTotalValue(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant/30 rounded-lg pl-9 pr-4 py-3 text-on-surface placeholder:text-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                    placeholder="Ej. 4.044,96" 
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-error-container/40 border border-error/50 rounded-lg p-3 text-sm text-error/90 text-center animate-fade-in">
                  {errorMsg}
                </div>
              )}

              {loading && processStep && (
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm text-primary text-center animate-fade-in">
                  {processStep}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-primary hover:bg-primary-fixed-dim text-on-primary-container font-headline-md py-4 rounded-lg flex items-center justify-center space-x-3 transition-all duration-300 shadow-lg shadow-primary/10 active:scale-[0.98] cursor-pointer"
              >
                {loading ? (
                  <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">search</span>
                    <span>Buscar Ticket</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-outline-variant/10 flex flex-col items-center gap-4">
              <div className="flex items-center space-x-3 text-on-surface-variant/70">
                <span className="material-symbols-outlined text-xl text-primary">verified_user</span>
                <p className="text-label-sm font-label-sm">Conexión Segura SSL — Datos Encriptados</p>
              </div>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
                <button onClick={showHelpAlert} className="text-label-sm font-label-sm text-primary hover:underline underline-offset-4 flex items-center space-x-1">
                  <span className="material-symbols-outlined text-base">help</span>
                  <span>Ayuda</span>
                </button>
                <button onClick={showSupportAlert} className="text-label-sm font-label-sm text-primary hover:underline underline-offset-4 flex items-center space-x-1">
                  <span className="material-symbols-outlined text-base">support_agent</span>
                  <span>Soporte</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Confirm Ticket */}
        {step === 2 && ticketData && (
          <div className="w-full max-w-[600px] bg-surface-container-low border border-outline-variant/30 rounded-xl p-6 md:p-8 relative z-10 backdrop-blur-sm animate-slide-in">
            <div className="flex items-center gap-2 mb-6 border-b border-outline-variant/10 pb-4">
              <span className="text-label-sm text-primary font-bold uppercase tracking-wider">Paso 2 de 3</span>
              <div className="flex-grow h-[1px] bg-outline-variant/20"></div>
              <span className="text-label-sm text-on-surface-variant">Revisión de Ticket</span>
            </div>

            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-container-highest border border-primary/20 mb-3 shadow-inner">
                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
              </div>
              <h1 className="text-headline-md font-headline-md text-on-surface mb-1">Resumen del Ticket</h1>
              <p className="text-body-md text-on-surface-variant text-sm">
                Por favor verifique que la información de su compra sea correcta antes de generar el comprobante fiscal.
              </p>
            </div>

            <div className="space-y-6">
              {/* Tienda y Fecha */}
              <div className="bg-surface-container p-5 rounded-lg border-l-4 border-primary shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <h3 className="text-label-sm text-primary uppercase tracking-widest font-bold mb-1">Establecimiento</h3>
                    <p className="text-body-lg font-bold text-on-surface">{storeName}</p>
                    <p className="text-label-sm text-on-surface-variant mt-1">Ticket ID: {ticketData.id}</p>
                  </div>
                  <div className="sm:text-right">
                    <h3 className="text-label-sm text-primary uppercase tracking-widest font-bold mb-1">Fecha y Hora</h3>
                    <p className="text-body-md font-bold text-on-surface">{new Date(ticketData.created_at).toLocaleDateString()}</p>
                    <p className="text-label-sm text-on-surface-variant mt-0.5">{new Date(ticketData.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              </div>

              {/* Lista de Conceptos */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-label-sm text-on-surface-variant font-bold uppercase tracking-widest">Conceptos del Recibo</span>
                  <div className="h-[1px] flex-grow bg-outline-variant/10"></div>
                </div>
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {ticketItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center group py-0.5">
                      <div className="flex flex-col">
                        <span className="text-body-md font-medium text-on-surface group-hover:text-primary transition-colors text-sm">
                          {item.product_name}
                        </span>
                        <span className="text-label-sm text-on-surface-variant text-xs">
                          {Number(item.quantity).toFixed(2)} {item.unit_sold || 'PZA'} × ${Number(item.price).toFixed(2)}
                        </span>
                      </div>
                      <span className="text-body-md font-bold text-on-surface text-sm">
                        ${Number(item.total).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totales */}
              <div className="border-t border-outline-variant/20 pt-4 space-y-2">
                <div className="flex justify-between items-center text-sm text-on-surface-variant">
                  <span>Subtotal (Base Imponible)</span>
                  <span className="font-mono">${(Number(ticketData.total) / 1.16).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-on-surface-variant">
                  <span>IVA (16%)</span>
                  <span className="font-mono">${(Number(ticketData.total) - (Number(ticketData.total) / 1.16)).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center bg-surface-container-highest/50 p-4 rounded-xl border border-primary/10 mt-2">
                  <span className="text-headline-md font-bold text-primary">Total Recibo</span>
                  <span className="text-headline-md font-extrabold text-primary tracking-tight font-mono">
                    ${Number(ticketData.total).toFixed(2)} MXN
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={() => setStep(3)} 
                className="flex-grow py-3.5 px-6 bg-primary text-on-primary font-bold rounded-lg brand-glow hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continuar a Facturación</span>
                <span className="material-symbols-outlined text-xl">chevron_right</span>
              </button>
              <button 
                onClick={() => setStep(1)} 
                className="py-3.5 px-6 bg-transparent border border-outline text-on-surface-variant hover:text-primary hover:border-primary rounded-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
                <span>Regresar</span>
              </button>
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-2 text-label-sm text-on-surface-variant/60">
              <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <span>Transacción segura protegida por Nexum Shield</span>
            </div>
          </div>
        )}

        {/* STEP 3: Fiscal Form */}
        {step === 3 && ticketData && (
          <div className="w-full max-w-[600px] bg-surface-container rounded-xl p-6 md:p-8 border border-outline-variant/20 shadow-xl relative z-10 animate-slide-in">
            <div className="flex items-center gap-2 mb-6 border-b border-outline-variant/10 pb-4">
              <span className="text-label-sm text-primary font-bold uppercase tracking-wider">Paso 3 de 3</span>
              <div className="flex-grow h-[1px] bg-outline-variant/20"></div>
              <span className="text-label-sm text-on-surface-variant">Datos Fiscales</span>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary-container text-2xl">description</span>
              </div>
              <div>
                <h1 className="text-headline-lg font-headline-lg text-on-surface">Información Fiscal</h1>
                <p className="text-body-md font-body-md text-on-surface-variant text-sm">Complete los datos requeridos para generar su factura CFDI 4.0</p>
              </div>
            </div>

            <form onSubmit={handleFacturar} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-label-md text-on-surface-variant" htmlFor="rfc">RFC del Receptor</label>
                  <input 
                    required 
                    id="rfc" 
                    type="text" 
                    value={rfc} 
                    onChange={(e) => setRfc(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    onBlur={handleSearchRfc}
                    placeholder="XAXX010101000" 
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono uppercase"
                  />
                  {rfc && fiscalValidation.errors.rfc && (
                    <p className="text-error text-xs leading-relaxed">{fiscalValidation.errors.rfc}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-label-md text-on-surface-variant" htmlFor="cp">Código Postal Domicilio Fiscal</label>
                  <input 
                    required 
                    id="cp" 
                    type="text" 
                    maxLength={5} 
                    value={codigoPostal} 
                    onChange={(e) => setCodigoPostal(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="Ej. 06000" 
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono"
                  />
                  {codigoPostal && fiscalValidation.errors.codigoPostal && (
                    <p className="text-error text-xs leading-relaxed">{fiscalValidation.errors.codigoPostal}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-label-md text-on-surface-variant" htmlFor="razonSocial">Razón Social / Nombre exacto SAT</label>
                <input 
                  required 
                  id="razonSocial" 
                  type="text" 
                  value={razonSocial} 
                  onChange={(e) => setRazonSocial(e.target.value.toUpperCase())} 
                  placeholder="Ej. JUAN PEREZ MARTINEZ o EMPRESA DE PRUEBAS" 
                  className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all uppercase"
                />
                {razonSocial && fiscalValidation.errors.razonSocial && (
                  <p className="text-error text-xs leading-relaxed">{fiscalValidation.errors.razonSocial}</p>
                )}
                {razonSocial && fiscalValidation.warnings.razonSocial && (
                  <p className="text-primary text-xs leading-relaxed">{fiscalValidation.warnings.razonSocial}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-label-md text-on-surface-variant" htmlFor="regimen">Régimen Fiscal</label>
                  <select 
                    id="regimen"
                    value={regimenFiscal} 
                    onChange={(e) => setRegimenFiscal(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="601">601 - General de Ley Personas Morales</option>
                    <option value="603">603 - Personas Morales con Fines no Lucrativos</option>
                    <option value="605">605 - Sueldos y Salarios e Ingresos Asimilados</option>
                    <option value="606">606 - Arrendamiento</option>
                    <option value="612">612 - Personas Físicas con Actividades Empresariales</option>
                    <option value="616">616 - Sin obligaciones fiscales</option>
                    <option value="626">626 - Régimen Simplificado de Confianza (RESICO)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-md font-label-md text-on-surface-variant" htmlFor="usoCfdi">Uso del CFDI</label>
                  <select 
                    id="usoCfdi"
                    value={usoCfdi} 
                    onChange={(e) => setUsoCfdi(e.target.value)} 
                    className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="G01">G01 - Adquisición de mercancías</option>
                    <option value="G03">G03 - Gastos en general</option>
                    <option value="I08">I08 - Otra maquinaria y equipo</option>
                    <option value="S01">S01 - Sin efectos fiscales</option>
                    <option value="CP01">CP01 - Pagos</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label-md font-label-md text-on-surface-variant" htmlFor="email">Correo Electrónico (Opcional - Envío automático)</label>
                <input 
                  id="email"
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="correo@ejemplo.com" 
                  className="w-full bg-surface-container-low border border-outline-variant/40 rounded-lg px-4 py-3 text-on-surface placeholder:text-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                />
                {email && fiscalValidation.errors.email && (
                  <p className="text-error text-xs leading-relaxed">{fiscalValidation.errors.email}</p>
                )}
              </div>

              {errorMsg && (
                <div className="bg-error-container/40 border border-error/50 rounded-lg p-3 text-sm text-error/90 text-center animate-fade-in">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-start gap-3 p-4 bg-surface-container-highest/30 rounded-lg border border-outline-variant/10 text-xs">
                <span className="material-symbols-outlined text-primary text-xl mt-0.5">verified_user</span>
                <p className="text-on-surface-variant leading-relaxed">
                  Su información está protegida bajo los más altos estándares de seguridad fiscal y en estricto cumplimiento con las normativas del SAT para CFDI 4.0.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 border-t border-outline-variant/10">
                <button 
                  type="submit" 
                  disabled={loading || Object.keys(fiscalValidation.errors).length > 0}
                  className="flex-grow py-3.5 bg-primary hover:brightness-110 text-on-primary font-headline-md rounded-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-xl">sync</span>
                      <span>{processStep || 'Procesando factura'}</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                      <span>Generar Factura</span>
                    </>
                  )}
                </button>
                <button 
                  type="button" 
                  disabled={loading} 
                  onClick={() => setStep(2)} 
                  className="py-3.5 px-6 bg-transparent border border-outline text-on-surface-variant hover:text-primary hover:border-primary rounded-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Regresar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 4: Success Screen */}
        {step === 4 && invoiceResult && (
          <div className="w-full max-w-xl bg-surface-container border border-outline-variant/20 rounded-xl p-8 flex flex-col items-center text-center brand-glow relative z-10 animate-zoom-in">
            {/* Success Circle */}
            <div className="mb-6 relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
              <div className="relative w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center border-2 border-primary/30">
                <span className="material-symbols-outlined text-[52px] text-primary" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
                  {invoiceResult.alreadyIssued ? 'receipt_long' : 'check_circle'}
                </span>
              </div>
            </div>

            <h1 className="text-headline-xl font-headline-xl text-on-surface mb-1">
              {invoiceResult.alreadyIssued ? 'Esta compra ya fue facturada' : '¡Factura Exitosa!'}
            </h1>
            <p className="text-body-lg font-body-lg text-on-surface-variant mb-6 text-sm">
              {invoiceResult.alreadyIssued
                ? 'Este ticket ya cuenta con un CFDI emitido. Puedes descargarlo o reenviarlo sin generar una factura nueva.'
                : 'Tu comprobante fiscal ha sido generado y timbrado correctamente.'}
            </p>

            {/* Resumen Fiscal */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 border-y border-outline-variant/20 py-4 mb-6 text-left">
              <div>
                <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider text-xs">Folio Fiscal (UUID CFDI)</p>
                <p className="text-body-md font-mono text-primary text-xs break-all mt-1">{invoiceResult.uuid}</p>
                <button
                  type="button"
                  onClick={handleCopyUuid}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Copiar UUID
                </button>
              </div>
              <div className="md:text-right">
                <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider text-xs">Monto Total</p>
                <p className="text-body-md font-bold text-on-surface mt-1">${Number(ticketData.total).toFixed(2)} MXN</p>
              </div>
            </div>

            {/* Acciones principales */}
            <div className="w-full flex flex-col gap-3 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  onClick={() => handleDownload(invoiceResult.pdf_url, `Factura_${invoiceResult.id}.pdf`, 'application/pdf')}
                  className="bg-primary text-on-primary py-3.5 rounded-lg flex items-center justify-center gap-2 font-label-md text-label-md hover:brightness-110 transition-all active:scale-95 cursor-pointer shadow-sm shadow-primary/10"
                >
                  <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                  <span>Descargar PDF</span>
                </button>
                <button 
                  onClick={() => handleDownload(invoiceResult.xml_url, `Factura_${invoiceResult.id}.xml`, 'text/xml')}
                  className="border border-primary text-primary py-3.5 rounded-lg flex items-center justify-center gap-2 font-label-md text-label-md hover:bg-primary/5 transition-all active:scale-95 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">terminal</span>
                  <span>Descargar XML</span>
                </button>
              </div>
              
              {invoiceResult.status !== 'CANCELADO' ? (
                <>
                  <button
                    disabled={loading}
                    onClick={handleSendEmail}
                    className="bg-surface-container-highest text-on-surface py-3.5 rounded-lg flex items-center justify-center gap-2 font-label-md text-label-md hover:bg-surface-variant transition-all active:scale-95 border border-outline-variant/20 cursor-pointer"
                  >
                    {loading ? (
                      <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">mail</span>
                        <span>Enviar por Email a {email || '...'}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={resetFlow}
                    className="border border-outline text-on-surface py-3.5 rounded-lg flex items-center justify-center gap-2 font-label-md text-label-md hover:border-primary hover:text-primary transition-all active:scale-95 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    <span>Facturar otro ticket</span>
                  </button>

                  {!isCancellationExpired() ? (
                    <button 
                      disabled={loading}
                      onClick={handleCancel}
                      className="text-red-500 hover:text-red-400 text-xs font-semibold py-2.5 transition-colors border border-red-500/10 rounded-lg hover:bg-red-500/5 cursor-pointer mt-2"
                    >
                      Solicitar Cancelación de Factura ante el SAT
                    </button>
                  ) : (
                    <div className="text-on-surface-variant/60 text-xs mt-3 italic px-4">
                      El período de cancelación automática por portal ha expirado (límite de 24 horas). 
                      Póngase en contacto directo con el comercio para su refacturación.
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-error-container/40 border border-error/50 rounded-lg p-3 text-sm text-error/90 text-center font-bold">
                  Esta factura se encuentra CANCELADA ante el SAT.
                </div>
              )}
            </div>

            {/* Back action */}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-outline-variant/10 py-6 md:py-8 mt-auto z-10">
        <div className="flex flex-col md:flex-row justify-between items-center w-full px-margin-mobile md:px-margin-desktop max-w-7xl mx-auto gap-4">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <span className="font-headline-lg text-headline-lg text-on-surface font-bold text-lg">{APP_NAME}</span>
            <p className="font-body-md text-body-md text-on-surface-variant/75 text-sm mt-0.5">© 2026 {APP_NAME}. Todos los derechos reservados.</p>
          </div>
          <div className="flex gap-x-8 text-sm">
            <button onClick={showHelpAlert} className="text-on-surface-variant hover:text-primary transition-colors font-label-sm text-label-sm">Privacidad</button>
            <button onClick={showHelpAlert} className="text-on-surface-variant hover:text-primary transition-colors font-label-sm text-label-sm">Términos</button>
            <button onClick={showSupportAlert} className="text-on-surface-variant hover:text-primary transition-colors font-label-sm text-label-sm">Contacto</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
