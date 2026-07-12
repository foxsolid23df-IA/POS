import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { ticketSettingsService } from "../../services/ticketSettingsService";
import { printerService, TICKET_PRINT_MODES } from "../../services/printerService";
import { useSettings } from "../../contexts/SettingsContext";
import { useAuth } from "../../hooks/useAuth";
import "./TicketConfig.css";

export const TicketConfig = () => {
  const navigate = useNavigate();
  const { refreshSettings } = useSettings();
    const { user } = useAuth();
  const [settings, setSettings] = useState({
    business_name: "",
    owner_name: "",
    rfc: "",
    curp: "",
    email: "",
    address: "",
    phone: "",
    logo_url: "",
    footer_message: "¡Gracias por su compra, vuelva pronto!",
    paper_width: "58mm",
    font_size: 12,
    margin: 0,
    font_family: "Sistema",
    is_bold: false,
    show_business_name: true,
    show_owner_name: true,
    show_rfc: true,
    show_curp: true,
    show_email: true,
    show_address: true,
    show_phone: true,
    show_footer: true,
    cc_show_initial_fund: true,
    cc_show_card_sales: true,
    cc_show_transfer_sales: true,
    cc_show_withdrawals: true,
    cc_show_sales_count: true,
    cc_show_expected_cash: true,
    cc_show_counted_cash: true,
    cc_show_differences: true,
    cc_show_operator_name: true,
    show_billing_section: true,
    qr_code_size: "medium",
    cc_enable_day_cut: true,
    auto_customer_display: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printMode, setPrintMode] = useState(() => printerService.getTicketPrintMode());
  const fileInputRef = useRef(null);
  const [displayAssignment, setDisplayAssignment] = useState({ cashierDisplayIndex: 0, clientDisplayIndex: 1 });
  const [availableDisplays, setAvailableDisplays] = useState([]);
  const [savingDisplays, setSavingDisplays] = useState(false);

  useEffect(() => {
    fetchSettings();
    loadDisplayConfig();
  }, []);

  const loadDisplayConfig = async () => {
    if (!window.electronAPI?.isElectron) return;
    try {
      const displays = await window.electronAPI.getAvailableDisplays();
      setAvailableDisplays(displays);
      const assignment = await window.electronAPI.getDisplayAssignment();
      setDisplayAssignment(assignment);
    } catch (error) {
      console.error('Error loading display config:', error);
    }
  };

  const handleDisplayChange = (key, value) => {
    setDisplayAssignment(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyDisplaySettings = async () => {
    if (!window.electronAPI?.isElectron) return;
    setSavingDisplays(true);
    try {
      await window.electronAPI.setDisplayAssignment(displayAssignment);
      Swal.fire({
        title: '¡Aplicado!',
        text: 'La configuración de pantallas se aplicó correctamente.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error('Error applying display settings:', error);
      Swal.fire('Error', 'No se pudo aplicar la configuración.', 'error');
    } finally {
      setSavingDisplays(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await ticketSettingsService.getSettings(user?.id);
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
      await ticketSettingsService.saveSettings(settings, user?.id);
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

  const handlePrintModeChange = (e) => {
    const nextMode = printerService.setTicketPrintMode(e.target.value);
    setPrintMode(nextMode);
  };

  const handleTestPrint = () => {
    const testSale = {
      id: "PRUEBA",
      total: 30,
      metodoPago: "efectivo",
      montoRecibido: 30,
      cambio: 0,
      created_at: new Date().toISOString(),
      items: [
        { quantity: 1, name: "Producto de Prueba", price: 10, total: 10, barcode: "TEST-1" },
        { quantity: 2, name: "Item de Muestra", price: 10, total: 20, barcode: "TEST-2" },
      ],
    };

    printerService.printSaleTicketFast(testSale, settings, user, {
      paperWidth: settings.paper_width || "58mm",
      mode: printMode,
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
          <button
            onClick={() => navigate("/configuracion")}
            type="button"
            className="mt-4 mx-auto flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300 font-bold text-xs w-fit"
          >
            <span className="material-icons-outlined text-[18px]">arrow_back</span>
            <span>Regresar a Configuración</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ticket-config-form mt-8">
          {/* PANEL DE ENCABEZADO DESGLOSADO */}
          <div className="printer-settings-box mb-8 p-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                Datos del Encabezado del Ticket
              </h3>
              <p className="text-xs text-slate-500 mb-6">
                Desglosa y personaliza la información de tu negocio en la parte superior del ticket. Activa o desactiva la visibilidad de cada dato de forma independiente.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Nombre Comercial / Negocio */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-3">
                  <div className="form-group mb-0">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Nombre Comercial / Negocio</label>
                    <input
                      type="text"
                      name="business_name"
                      value={settings.business_name || ""}
                      onChange={handleChange}
                      placeholder="Ej: DISTRIBUIDORA DE ADHESIVOS 'ROYAL TAPE'"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-2">
                    <span className="text-xs font-semibold text-slate-500">Mostrar en ticket</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="show_business_name"
                        checked={settings.show_business_name !== false}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                {/* Propietario / Razón Social Fiscal */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-3">
                  <div className="form-group mb-0">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Propietario / Razón Social Fiscal</label>
                    <input
                      type="text"
                      name="owner_name"
                      value={settings.owner_name || ""}
                      onChange={handleChange}
                      placeholder="Ej: VICTOR GERARDO MIRANDA VEGA"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-2">
                    <span className="text-xs font-semibold text-slate-500">Mostrar en ticket</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="show_owner_name"
                        checked={settings.show_owner_name !== false}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                {/* R.F.C. */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-3">
                  <div className="form-group mb-0">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">R.F.C.</label>
                    <input
                      type="text"
                      name="rfc"
                      value={settings.rfc || ""}
                      onChange={handleChange}
                      placeholder="Ej: MIVV570323EX5"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-2">
                    <span className="text-xs font-semibold text-slate-500">Mostrar en ticket</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="show_rfc"
                        checked={settings.show_rfc !== false}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                {/* C.U.R.P. */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-3">
                  <div className="form-group mb-0">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">C.U.R.P.</label>
                    <input
                      type="text"
                      name="curp"
                      value={settings.curp || ""}
                      onChange={handleChange}
                      placeholder="Ej: MIVV570323HDFRGC08"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-2">
                    <span className="text-xs font-semibold text-slate-500">Mostrar en ticket</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="show_curp"
                        checked={settings.show_curp !== false}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                {/* Teléfono / Contacto */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-3">
                  <div className="form-group mb-0">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Teléfono de Contacto</label>
                    <input
                      type="text"
                      name="phone"
                      value={settings.phone || ""}
                      onChange={handleChange}
                      placeholder="Ej: 10549550-10549551"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-2">
                    <span className="text-xs font-semibold text-slate-500">Mostrar en ticket</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="show_phone"
                        checked={settings.show_phone !== false}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                {/* Correo Electrónico */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between gap-3">
                  <div className="form-group mb-0">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Correo Electrónico</label>
                    <input
                      type="email"
                      name="email"
                      value={settings.email || ""}
                      onChange={handleChange}
                      placeholder="Ej: royaltape@hotmail.com"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-2">
                    <span className="text-xs font-semibold text-slate-500">Mostrar en ticket</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="show_email"
                        checked={settings.show_email !== false}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                {/* Dirección */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-1 md:col-span-2 flex flex-col justify-between gap-3">
                  <div className="form-group mb-0">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Dirección Completa / Horarios</label>
                    <textarea
                      name="address"
                      value={settings.address || ""}
                      onChange={handleChange}
                      placeholder="Ej: Roldan No. 100 Loc B, Col. Centro, Deleg. Cuauhtémoc C.P. 06010 México D.F."
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white shadow-sm"
                      rows="3"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-700/50 pt-2">
                    <span className="text-xs font-semibold text-slate-500">Mostrar en ticket</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="show_address"
                        checked={settings.show_address !== false}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

          <div className="form-grid">
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
                className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
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
                  <select className="flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium outline-none ring-primary/20 focus:ring-4 transition-all appearance-none cursor-pointer">
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
                <label className="text-[10px]">Modo de ImpresiÃ³n</label>
                <select
                  value={printMode}
                  onChange={handlePrintModeChange}
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm"
                >
                  <option value={TICKET_PRINT_MODES.AUTO}>AutomÃ¡tico rÃ¡pido</option>
                  <option value={TICKET_PRINT_MODES.RAW}>ESC/POS raw</option>
                  <option value={TICKET_PRINT_MODES.HTML}>HTML clÃ¡sico</option>
                </select>
              </div>
              <div className="form-group">
                <label className="text-[10px]">Ancho del Papel</label>
                <select
                  name="paper_width"
                  value={settings.paper_width}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm"
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
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm text-center"
                />
              </div>
              <div className="form-group">
                <label className="text-[10px]">Margen (px)</label>
                <input
                  type="number"
                  name="margin"
                  value={settings.margin}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm text-center"
                />
              </div>
              <div className="form-group">
                <label className="text-[10px]">Tipo de Fuente</label>
                <select
                  name="font_family"
                  value={settings.font_family}
                  onChange={handleChange}
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white border-none ring-1 ring-slate-200 dark:ring-slate-700 rounded-xl px-4 py-2 text-sm"
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
              Facturación en el Ticket
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Controla la sección de facturación con código QR que aparece al final del ticket.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Mostrar sección de facturación
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="show_billing_section"
                    checked={settings.show_billing_section}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Tamaño del código QR
                </span>
                <select
                  name="qr_code_size"
                  value={settings.qr_code_size}
                  onChange={handleChange}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm dark:text-white outline-none"
                >
                  <option value="small">Pequeño</option>
                  <option value="medium">Mediano</option>
                  <option value="large">Grande</option>
                </select>
              </div>
            </div>
          </div>

          <div className="printer-settings-box mt-8 p-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 border-b border-slate-200 dark:border-slate-700 pb-2">
              Configuración de Pantallas
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Selecciona en qué pantalla se mostrará cada ventana. El orden respeta la configuración de Windows.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pantalla del Cajero */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-2">
                  Pantalla del Cajero (Principal)
                </label>
                <select
                  value={displayAssignment.cashierDisplayIndex}
                  onChange={(e) => handleDisplayChange('cashierDisplayIndex', parseInt(e.target.value))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white"
                >
                  {availableDisplays.map((d) => (
                    <option key={d.index} value={d.index}>
                      {d.label} ({d.size}) {d.isPrimary ? '- Primaria' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  Ventana principal del sistema POS
                </p>
              </div>

              {/* Pantalla del Cliente */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-2">
                  Pantalla del Cliente
                </label>
                <select
                  value={displayAssignment.clientDisplayIndex}
                  onChange={(e) => handleDisplayChange('clientDisplayIndex', parseInt(e.target.value))}
                  disabled={availableDisplays.length < 2}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white disabled:opacity-50"
                >
                  {availableDisplays.map((d) => (
                    <option key={d.index} value={d.index}>
                      {d.label} ({d.size}) {d.isPrimary ? '- Primaria' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                  {availableDisplays.length < 2
                    ? 'Conecta una segunda pantalla para habilitar'
                    : 'Pantalla orientada al cliente'}
                </p>
              </div>
            </div>

            {/* Toggle auto-abrir */}
            <div className="mt-6 flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex-1 mr-4">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
                  Abrir automáticamente en segunda pantalla
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Al iniciar la aplicación, se abrirá la pantalla del cliente automáticamente.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  name="auto_customer_display"
                  checked={settings.auto_customer_display || false}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {/* Botón aplicar */}
            <button
              type="button"
              onClick={handleApplyDisplaySettings}
              disabled={savingDisplays}
              className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
            >
              {savingDisplays ? 'Aplicando...' : 'Aplicar Configuración de Pantallas'}
            </button>
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
                { name: "cc_enable_day_cut", label: "Habilitar Cierre del Día" },
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
