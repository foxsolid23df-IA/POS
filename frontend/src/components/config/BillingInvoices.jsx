import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import {
  ArrowLeft,
  Search,
  FileText,
  Code,
  Ban,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import Swal from "sweetalert2";

export default function BillingInvoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [clientsMap, setClientsMap] = useState({});
  const [searchVal, setSearchVal] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError("");

      let query = supabase
        .from("invoices")
        .select("*, sales(id, created_at)")
        .order("created_at", { ascending: false });

      if (searchVal.trim()) {
        const term = searchVal.trim();
        const isNumeric = /^\d+$/.test(term);

        // Buscar clientes que coincidan por razón social
        const { data: matchedClients } = await supabase
          .from("clients")
          .select("rfc")
          .ilike("razon_social", `%${term}%`);

        const clientRfcs = matchedClients ? matchedClients.map((c) => c.rfc) : [];

        let orClause = `cliente_rfc.ilike.%${term}%,emisor_rfc.ilike.%${term}%,uuid_cfdi.ilike.%${term}%`;
        
        if (isNumeric) {
          orClause += `,sale_id.eq.${term}`;
        }
        
        if (clientRfcs.length > 0) {
          orClause += `,cliente_rfc.in.(${clientRfcs.map(r => `"${r}"`).join(",")})`;
        }

        query = query.or(orClause);
      } else {
        query = query.limit(50);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      const invoicesList = data || [];

      // Obtener los nombres de los clientes para los RFCs cargados
      const rfcs = [...new Set(invoicesList.map((inv) => inv.cliente_rfc).filter(Boolean))];
      
      let nameMap = {};
      if (rfcs.length > 0) {
        const { data: clientsData } = await supabase
          .from("clients")
          .select("rfc, razon_social")
          .in("rfc", rfcs);

        if (clientsData) {
          clientsData.forEach((c) => {
            nameMap[c.rfc] = c.razon_social;
          });
        }
      }

      setInvoices(invoicesList);
      setClientsMap(nameMap);
    } catch (err) {
      console.error("Error fetching invoices:", err);
      setError("No se pudieron cargar las facturas.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchInvoices();
  };

  const handleViewPdf = (invoice) => {
    if (!invoice.pdf_url) {
      Swal.fire("Error", "El PDF de esta factura no está disponible.", "error");
      return;
    }
    try {
      const byteCharacters = atob(invoice.pdf_url);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (e) {
      console.error("Error rendering PDF:", e);
      Swal.fire("Error", "No se pudo visualizar el PDF de la factura.", "error");
    }
  };

  const handleDownloadXml = (invoice) => {
    if (!invoice.xml_url) {
      Swal.fire("Error", "El XML de esta factura no está disponible.", "error");
      return;
    }
    try {
      const byteCharacters = atob(invoice.xml_url);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "text/xml" });
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Factura_${invoice.uuid_cfdi || invoice.id}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Error downloading XML:", e);
      Swal.fire("Error", "No se pudo descargar el archivo XML.", "error");
    }
  };

  const handleCancelInvoice = async (invoice) => {
    const { value: formValues } = await Swal.fire({
      title: "Cancelar Factura CFDI",
      html:
        '<div style="text-align: left; font-family: Inter, sans-serif; font-size: 14px;">' +
        '  <p style="margin-bottom: 15px; color: #64748b;">Esta acción anulará el CFDI ante el SAT. Selecciona el motivo de cancelación:</p>' +
        '  <label style="display: block; font-weight: 600; margin-bottom: 5px; color: #334155;">Motivo de Cancelación</label>' +
        '  <select id="swal-motive" style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 15px; outline: none; background: white; color: black;">' +
        '    <option value="02">02 - Comprobante emitido con errores sin relación</option>' +
        '    <option value="03">03 - No se llevó a cabo la operación</option>' +
        '    <option value="04">04 - Operación nominativa relacionada con una factura global</option>' +
        '    <option value="01">01 - Comprobante emitido con errores con relación</option>' +
        '  </select>' +
        '  <div id="swal-uuid-replacement-container" style="display: none;">' +
        '    <label style="display: block; font-weight: 600; margin-bottom: 5px; color: #334155;">UUID del CFDI Sustituto</label>' +
        '    <input id="swal-uuid-replacement" placeholder="Ej. d8e34abb-5bd4-..." style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; margin-bottom: 15px; outline: none; color: black;" />' +
        '  </div>' +
        '</div>',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Confirmar Cancelación",
      cancelButtonText: "Cerrar",
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      didOpen: () => {
        const selectEl = document.getElementById("swal-motive");
        const containerEl = document.getElementById("swal-uuid-replacement-container");
        selectEl.addEventListener("change", (e) => {
          if (e.target.value === "01") {
            containerEl.style.display = "block";
          } else {
            containerEl.style.display = "none";
          }
        });
      },
      preConfirm: () => {
        const motive = document.getElementById("swal-motive").value;
        const uuidReplacement = document.getElementById("swal-uuid-replacement").value;
        if (motive === "01" && !uuidReplacement) {
          Swal.showValidationMessage("Debes ingresar el UUID del comprobante que sustituye al cancelado.");
          return false;
        }
        return { motive, uuidReplacement };
      }
    });

    if (!formValues) return;

    const { motive, uuidReplacement } = formValues;

    setLoading(true);
    try {
      const response = await supabase.functions.invoke("cancelar-cfdi", {
        body: {
          id: invoice.id,
          motive,
          uuidReplacement
        }
      });

      if (response.error) {
        throw new Error(response.error.message || "Error al conectar con el servidor.");
      }

      const result = response.data;
      if (result && result.success) {
        Swal.fire("Factura Cancelada", "El comprobante ha sido cancelado ante el SAT y el estado se ha actualizado.", "success");
        fetchInvoices();
      } else {
        throw new Error(result?.message || "Error al procesar la cancelación en Facturama.");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Error de Cancelación", err.message || "No se pudo cancelar la factura.", "error");
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(amount || 0);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#f7f9fc] dark:bg-slate-900 transition-colors">
      <div className="p-8 lg:px-12 pt-10 flex-1 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 font-['Manrope'] tracking-tight">
              Facturas
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-['Inter']">
              Listado de facturas timbradas y herramientas de cancelación (SAT CFDI 4.0)
            </p>
            <button
              type="button"
              onClick={() => navigate("/configuracion")}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300 font-bold text-xs w-fit"
            >
              <ArrowLeft size={16} />
              <span>Volver a Configuración</span>
            </button>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex items-center w-full md:w-96 relative">
            <Search className="absolute left-4 text-slate-400" size={18} />
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Buscar Folio, UUID o Cliente..."
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-[#003f87] dark:focus:ring-blue-500/50 transition-all text-sm font-['Inter']"
            />
          </form>
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-slate-800 rounded-[20px] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)] border border-slate-100 dark:border-slate-700 p-2 relative overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <RefreshCw className="animate-spin text-4xl text-[#003f87] dark:text-blue-400" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-red-500">
              <AlertCircle size={40} className="mb-4 text-rose-500" />
              <h3 className="text-lg font-bold font-['Manrope']">{error}</h3>
              <button
                onClick={fetchInvoices}
                className="mt-4 px-4 py-2 bg-[#003f87] hover:bg-[#0056b3] text-white text-sm font-medium rounded-lg shadow-sm transition-all"
              >
                Reintentar
              </button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <FileText className="text-3xl text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-lg font-['Manrope'] font-bold text-slate-800 dark:text-slate-200">
                No se encontraron facturas
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-['Inter'] max-w-sm mt-2">
                Intente buscar con otros criterios como ticket, RFC o razón social del cliente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 text-[#424752] dark:text-slate-300 text-sm uppercase tracking-wider font-semibold font-['Inter']">
                    <th className="p-5 pl-6">Folio / Fecha</th>
                    <th className="p-5">Cliente</th>
                    <th className="p-5">UUID Fiscal</th>
                    <th className="p-5">Total</th>
                    <th className="p-5">Estado</th>
                    <th className="p-5 text-right pr-6">Acciones</th>
                  </tr>
                </thead>
                <tbody className="font-['Inter'] text-[15px] divide-y divide-slate-50 dark:divide-slate-700">
                  {invoices.map((invoice) => {
                    const clientName = clientsMap[invoice.cliente_rfc] || invoice.cliente_rfc || "Público en General";
                    const isCanceled = invoice.status === "CANCELADO";
                    const ticketId = invoice.sales?.id || invoice.sale_id || "N/A";
                    const invoiceDate = invoice.sales?.created_at || invoice.created_at;

                    return (
                      <tr
                        key={invoice.id}
                        className="hover:bg-[#f2f4f7]/40 dark:hover:bg-slate-700/40 transition-colors group"
                      >
                        <td className="p-5 pl-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {ticketId}
                            </span>
                            <span className="text-xs text-slate-400 mt-0.5">
                              {formatDate(invoiceDate)}
                            </span>
                          </div>
                        </td>
                        <td className="p-5 text-slate-700 dark:text-slate-300 font-medium">
                          {clientName}
                        </td>
                        <td className="p-5 text-slate-500 dark:text-slate-400 font-mono text-xs max-w-[200px] truncate">
                          {invoice.uuid_cfdi || "N/A"}
                        </td>
                        <td className="p-5 font-bold text-slate-800 dark:text-slate-200">
                          {formatCurrency(invoice.total)}
                        </td>
                        <td className="p-5">
                          <span
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                              isCanceled
                                ? "bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400"
                                : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                            }`}
                          >
                            {isCanceled ? "CANCELADO" : "ACTIVO"}
                          </span>
                        </td>
                        <td className="p-5 text-right pr-6">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleViewPdf(invoice)}
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                              title="Ver PDF"
                            >
                              <FileText size={18} />
                            </button>
                            <button
                              onClick={() => handleDownloadXml(invoice)}
                              className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors"
                              title="Descargar XML"
                            >
                              <Code size={18} />
                            </button>
                            {!isCanceled && (
                              <button
                                onClick={() => handleCancelInvoice(invoice)}
                                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-center gap-1.5 font-semibold text-xs transition-colors"
                                title="Cancelar Factura"
                              >
                                <Ban size={14} />
                                <span>Cancelar</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
