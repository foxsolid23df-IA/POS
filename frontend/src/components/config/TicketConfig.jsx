import React, { useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { ticketSettingsService } from "../../services/ticketSettingsService";
import { useSettings } from "../../contexts/SettingsContext";
import "./TicketConfig.css";

export const TicketConfig = () => {
  const { refreshSettings } = useSettings();
  const [settings, setSettings] = useState({
    business_name: "",
    address: "",
    phone: "",
    logo_url: "",
    footer_message: "¡Gracias por su compra, vuelva pronto!",
    paper_width: "58mm",
    font_size: 12,
    margin: 0,
    font_family: "Sistema",
    is_bold: false,
    cc_show_initial_fund: true,
    cc_show_card_sales: true,
    cc_show_transfer_sales: true,
    cc_show_withdrawals: true,
    cc_show_sales_count: true,
    cc_show_expected_cash: true,
    cc_show_counted_cash: true,
    cc_show_differences: true,
    cc_show_operator_name: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await ticketSettingsService.getSettings();
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      Swal.fire("Error", "No se pudo cargar la configuración.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      Swal.fire(
        "Archivo muy grande",
        "El logo no debe superar los 500KB.",
        "warning",
      );
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings((prev) => ({
        ...prev,
        logo_url: reader.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await ticketSettingsService.saveSettings(settings);
      await refreshSettings();
      Swal.fire({
        title: "¡Guardado!",
        text: "La configuración del ticket se actualizó correctamente.",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      Swal.fire("Error", "No se pudo guardar la configuración.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = () => {
    import("../../services/printerService").then(({ printerService }) => {
      const ticketHtml = `<!DOCTYPE html>
            <html>
                <head>
                    <title>Prueba de Ticket</title>
                    <style>
                        @media print {
                            @page { margin: 0; }
                            body { margin: 0; padding: 0; background: none !important; }
                        }
                        body {
                            font-family: ${
                              settings.font_family === "Sistema"
                                ? "system-ui, sans-serif"
                                : "monospace"
                            };
                            font-size: ${settings.font_size}px;
                            font-weight: ${
                              settings.is_bold ? "bold" : "normal"
                            };
                            width: ${
                              settings.paper_width === "58mm"
                                ? "180px"
                                : "280px"
                            };
                            margin: ${settings.margin}px auto;
                            padding: 10px;
                            color: black;
                        }
                        .header { text-align: center; margin-bottom: 10px; }
                        .logo { max-width: 100%; height: auto; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; }
                        .name { font-weight: bold; font-size: 1.2em; text-transform: uppercase; }
                        .content { margin: 10px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; }
                        .footer { text-align: center; margin-top: 10px; font-size: 0.9em; text-transform: uppercase; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${
                          settings.logo_url
                            ? `<img src="${settings.logo_url}" class="logo" />`
                            : ""
                        }
                        <div class="name">${
                          settings.business_name || "Nombre del Negocio"
                        }</div>
                        <div>${settings.address || "Dirección del Local"}</div>
                        <div>${settings.phone || "Teléfono"}</div>
                    </div>
                    <div class="content">
                        <div>Producto de Prueba x 1 ... $10.00</div>
                        <div>Item de Muestra x 2 ... $20.00</div>
                        <div style="text-align: right; font-weight: bold; margin-top: 5px;">TOTAL: $30.00</div>
                    </div>
                    <div class="footer">
                        ${settings.footer_message}
                    </div>
                </body>
            </html>
        `;

      printerService.printHtmlTicket(ticketHtml);
    });
  };

  if (loading)
    return (
      <div className="ticket-config-loading">Cargando configuración...</div>
    );

  return (
    <div className="ticket-config-container">
      <div className="ticket-config-card">
        <div className="ticket-config-header text-center">
          <h1 className="text-2xl font-bold dark:text-white">
            Configuración del Ticket
          </h1>
          <p className="text-slate-500">
            Personaliza la información que aparece en el ticket de venta para
            tus clientes.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="ticket-config-form mt-8">
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre del Negocio</label>
              <input
                type="text"
                name="business_name"
                value={settings.business_name}
                onChange={handleChange}
                placeholder="Ej: El Cañotal Express"
                className="dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="form-group">
              <label>Dirección</label>
              <textarea
                name="address"
                value={settings.address}
                onChange={handleChange}
                placeholder="Horarios, ubicación, etc."
                className="dark:bg-slate-800 dark:text-white"
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Teléfono / Contacto</label>
              <input
                type="text"
                name="phone"
                value={settings.phone}
                onChange={handleChange}
                placeholder="+52 998..."
                className="dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="form-group">
              <label>Logo del Negocio</label>
              <div className="file-input-wrapper">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="bg-slate-200 dark:bg-slate-700 dark:text-white px-4 py-2 rounded-lg text-sm font-bold"
                  >
                    Seleccionar archivo
                  </button>
                  <span className="text-xs text-slate-500">
                    {settings.logo_url
                      ? "Imagen seleccionada"
                      : "Ningún archivo seleccionado"}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Formatos: PNG, JPG. Máximo 500KB.
              </p>

              {settings.logo_url && (
                <div className="logo-preview-container mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">
                      Vista previa:
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, logo_url: "" }))
                      }
                      className="text-rose-500 text-xs hover:underline"
                    >
                      Eliminar Logo
                    </button>
                  </div>
                  <div className="logo-preview-box bg-slate-50 dark:bg-slate-800 p-4 rounded-xl flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700">
                    <img
                      src={settings.logo_url}
                      alt="Logo Preview"
                      style={{ maxHeight: "100px" }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Mensaje de Pie de Página</label>
              <textarea
                name="footer_message"
                value={settings.footer_message}
                onChange={handleChange}
                placeholder="¡Gracias por su compra!"
                className="dark:bg-slate-800 dark:text-white"
                rows="2"
              />
            </div>
          </div>

          <div className="printer-settings-box mt-8 p-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Seleccionar Impresora
                </label>
                <div className="flex gap-2">
                  <select className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium dark:text-white outline-none ring-primary/20 focus:ring-4 transition-all appearance-none cursor-pointer">
                    <option>Impresora Predeterminada</option>
                  </select>
                  <button
                    type="button"
                    className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px] dark:text-white">
                      sync
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                  >
                    Pruebas
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="form-group">
                <label className="text-[10px]">Ancho del Papel</label>
                <select
                  name="paper_width"
                  value={settings.paper_width}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm dark:text-white"
                >
                  <option value="58mm">58 mm (Mini)</option>
                  <option value="80mm">80 mm (Estándar)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="text-[10px]">Tamaño Fuente (px)</label>
                <input
                  type="number"
                  name="font_size"
                  value={settings.font_size}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm dark:text-white text-center"
                />
              </div>
              <div className="form-group">
                <label className="text-[10px]">Margen (px)</label>
                <input
                  type="number"
                  name="margin"
                  value={settings.margin}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm dark:text-white text-center"
                />
              </div>
              <div className="form-group">
                <label className="text-[10px]">Tipo de Fuente</label>
                <select
                  name="font_family"
                  value={settings.font_family}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm dark:text-white"
                >
                  <option value="Sistema">Sistema</option>
                  <option value="Monospace">Monospace</option>
                </select>
              </div>
              <div className="form-group">
                <label className="text-[10px]">Texto en Negrita</label>
                <div className="flex items-center gap-2 mt-1">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      name="is_bold"
                      checked={settings.is_bold}
                      onChange={handleChange}
                    />
                    <span className="checkmark"></span>
                    <span className="text-xs font-bold dark:text-white ml-2">
                      SI
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="printer-settings-box mt-8 p-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
              Configuración de Ticket de Cierre de Día
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Elige qué información se debe imprimir al realizar el corte de
              caja.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { name: "cc_show_initial_fund", label: "Ver Fondo Inicial" },
                { name: "cc_show_card_sales", label: "Ver Pagos con Tarjeta" },
                {
                  name: "cc_show_transfer_sales",
                  label: "Ver Pagos Transferencia",
                },
                { name: "cc_show_withdrawals", label: "Ver Retiros/Depósitos" },
                {
                  name: "cc_show_sales_count",
                  label: "Ver Conteo Total Ventas",
                },
                {
                  name: "cc_show_expected_cash",
                  label: "Ver Efectivo Esperado",
                },
                { name: "cc_show_counted_cash", label: "Ver Efectivo Contado" },
                {
                  name: "cc_show_differences",
                  label: "Ver Diferencias (Sobrante/Faltante)",
                },
                {
                  name: "cc_show_operator_name",
                  label: "Ver Nombre del Operador",
                },
              ].map((toggle) => (
                <div
                  key={toggle.name}
                  className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {toggle.label}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name={toggle.name}
                      checked={settings[toggle.name]}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="spinner-white"></span>
                Guardando...
              </>
            ) : (
              "Guardar Cambios"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
