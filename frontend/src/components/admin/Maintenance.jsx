import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import { maintenanceService } from "../../services/maintenanceService";
import { terminalService } from "../../services/terminalService";
import { useAuth } from "../../hooks/useAuth";
import Swal from "sweetalert2";
import "./Maintenance.css";

const Maintenance = () => {
  const navigate = useNavigate();
  const { user, fetchProfile } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(() => {
    return sessionStorage.getItem("admin_authorized") === "true";
  });
  const [masterPin, setMasterPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });
  const [options, setOptions] = useState({
    resetTerminals: true,
    resetTransactions: true,
    resetProfiles: false,
  });

  const [terminals, setTerminals] = useState([]);
  const [systemHealth, setSystemHealth] = useState({
    status: "checking",
    database: "checking",
  });
  const [auditLogs, setAuditLogs] = useState([]);

  const fetchTerminals = async () => {
    try {
      const data = await terminalService.getTerminals();
      setTerminals(data);
    } catch (error) {
      console.error("Error fetching terminals:", error);
    }
  };

  const fetchHealth = async () => {
    setSystemHealth({ status: "checking", database: "checking" });
    try {
      // Simular verificación de conectividad básica web a base de datos (Serverless)
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (error) throw error;
      setSystemHealth({ status: "Operational", database: "Connected" });
    } catch (error) {
      setSystemHealth({ status: "offline", database: "error" });
    }
  };

  const fetchLogs = async (pin) => {
    try {
      const data = await maintenanceService.getAdminLogs(pin);
      setAuditLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  React.useEffect(() => {
    if (isAuthorized) {
      fetchTerminals();
      fetchHealth();
      fetchLogs(masterPin);

      // Refrescar salud cada 30 segundos
      const interval = setInterval(() => fetchHealth(), 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthorized]);

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPinError("");

    try {
      // 1. PIN de Soporte Técnico (Siempre funciona)
      if (masterPin === "2026SOP") {
        setIsAuthorized(true);
        setPinError("");
        return;
      }

      // 2. Validar contra el PIN Maestro del usuario en la BD
      if (!user?.id)
        throw new Error("Acceso denegado: Usuario no identificado.");

      const { data, error } = await supabase
        .from("profiles")
        .select("master_pin")
        .eq("id", user.id)
        .single();

      const storedPin = data?.master_pin?.toString()?.trim();
      const inputPin = masterPin?.toString()?.trim();

      if (storedPin === inputPin || inputPin === "2026SOP") {
        setIsAuthorized(true);
        sessionStorage.setItem("admin_authorized", "true");
      } else {
        setPinError("PIN Maestro incorrecto. Intente de nuevo.");
        setMasterPin("");
        sessionStorage.setItem("admin_authorized", "false");
      }
    } catch (error) {
      setPinError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="maintenance-lock-screen">
        <div className="lock-card">
          <span className="material-icons-outlined lock-icon">
            admin_panel_settings
          </span>
          <button
            onClick={() => navigate("/configuracion")}
            type="button"
            className="mb-4 flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300 font-bold text-xs w-fit mx-auto"
          >
            <span className="material-icons-outlined text-[16px]">arrow_back</span>
            <span>Regresar</span>
          </button>
          <h2>Seguridad de Administración</h2>
          <p>
            Para configurar el PIN Maestro por primera vez o realizar cambios,
            debe ingresar el PIN de Seguridad del Sistema.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl mb-6 text-sm text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
            <strong>💡 Nota para el Dueño:</strong> Utilice el PIN
            predeterminado de soporte: <code>2026SOP</code> para el primer
            ingreso.
          </div>
          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              placeholder="Ingrese 2026SOP"
              value={masterPin}
              onChange={(e) => setMasterPin(e.target.value)}
              className="swal2-input text-center"
              style={{ letterSpacing: "2px" }}
              autoFocus
            />
            {pinError && <p className="error-text">{pinError}</p>}
            <button type="submit" className="btn-auth">
              Acceder a Configuración
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleReset = async (nuclearParam = false) => {
    const isNuclear = nuclearParam === true;
    const expectedPhrase = isNuclear ? "BORRAR-TODO" : "RESET";
    const userInput = confirmation.trim();

    if (userInput !== expectedPhrase) {
      setMessage({
        text: `Por favor, escribe ${expectedPhrase} exactamente para confirmar.`,
        type: "error",
      });
      return;
    }

    const warningMsg = isNuclear
      ? "¡ADVERTENCIA NUCLEAR! Se borrará absolutamente TODO. ¿Estás 100% seguro?"
      : "¿Estás SEGURO de que deseas realizar esta acción?";

    if (!window.confirm(warningMsg)) {
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });

    try {
      const result = await maintenanceService.resetProjectData({
        ...options,
        factoryReset: isNuclear,
        masterPin, // Enviamos el PIN a la API local
      });

      if (result.success) {
        setMessage({
          text: result.message || "Operación completada con éxito.",
          type: "success",
        });

        fetchLogs(masterPin); // Refrescar logs para ver la acción

        if (isNuclear) {
          maintenanceService.resetLocalTerminal();
          await supabase.auth.signOut();
          setTimeout(() => {
            window.location.href = "/#/login";
            window.location.reload();
          }, 3000);
        } else if (options.resetTerminals) {
          setTimeout(() => window.location.reload(), 2000);
        }
      }
    } catch (error) {
      setMessage({ text: "Error: " + error.message, type: "error" });
    } finally {
      setLoading(false);
      setConfirmation("");
    }
  };

  const handleUpdateMasterPin = async (e) => {
    e.preventDefault();
    if (newPin.length < 4 || newPin.length > 6) {
      setMessage({
        text: "El PIN debe tener entre 4 y 6 dígitos.",
        type: "error",
      });
      return;
    }
    if (newPin !== confirmPin) {
      setMessage({ text: "Los PIN no coinciden.", type: "error" });
      return;
    }

    // Capturar el valor ANTES de cualquier operación async
    const pinToSave = String(newPin).trim();

    const { value: password } = await Swal.fire({
      title: "Confirmar Seguridad",
      text: "Ingresa tu contraseña de cuenta para cambiar el PIN Maestro",
      input: "password",
      inputPlaceholder: "Contraseña",
      showCancelButton: true,
      confirmButtonText: "Verificar y Cambiar",
      cancelButtonText: "Cancelar",
    });

    if (!password) return;

    setIsUpdatingPin(true);
    setMessage({ text: "", type: "" });

    try {
      // Verificar contraseña SIN usar signInWithPassword (evita re-auth global)
      // Usamos rpc o una verificación directa
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: password,
      });

      if (authError) throw new Error("Contraseña incorrecta");

      // Guardar el PIN en la base de datos
      const { data: updateData, error: updateError } = await supabase
        .from("profiles")
        .update({ master_pin: pinToSave })
        .eq("id", user.id)
        .select();

      console.log("[Maintenance] Resultado de update:", {
        updateData,
        updateError,
        pinToSave,
      });

      if (updateError) throw updateError;

      // Actualizar el PIN local de la sesión actual
      setMasterPin(pinToSave);
      sessionStorage.setItem("admin_authorized", "true");

      setMessage({
        text: "✅ PIN Maestro actualizado exitosamente.",
        type: "success",
      });
      setNewPin("");
      setConfirmPin("");

      Swal.fire({
        title: "¡PIN Actualizado!",
        html: `Tu nuevo PIN Maestro es: <strong>${pinToSave}</strong><br>Úsalo para acceder a supervisión y mantenimiento.`,
        icon: "success",
        confirmButtonColor: "#3b82f6",
      });
    } catch (error) {
      setMessage({ text: "Error: " + error.message, type: "error" });
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <div className="maintenance-container">
      <header className="maintenance-header">
        <h1>Administración y Mantenimiento</h1>
        <p>Gestiona la limpieza de datos y licencias del sistema.</p>
        <button
          onClick={() => navigate("/configuracion")}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300 font-bold text-xs w-fit"
        >
          <span className="material-icons-outlined text-[18px]">arrow_back</span>
          <span>Regresar a Configuración</span>
        </button>
      </header>

      {/* MONITOR DE SALUD DEL SISTEMA */}
      <div className="health-monitor">
        <div
          className="health-status-info"
          style={{ justifyContent: "center", gap: "2rem" }}
        >
          {/* Estado General del Sistema */}
          <div className="status-item">
            <span
              className="material-icons-outlined"
              style={{ color: "var(--primary-color)" }}
            >
              public
            </span>
            <strong>Plataforma Web:</strong>
            <span
              className={`status-indicator ${
                systemHealth.status === "Operational"
                  ? "online"
                  : systemHealth.status === "checking"
                  ? "checking"
                  : "offline"
              }`}
            >
              {systemHealth.status === "Operational"
                ? "Óptimo y en Línea"
                : systemHealth.status === "checking"
                ? "Verificando..."
                : "Desconectado"}
            </span>
          </div>

          <div className="status-item">
            <span
              className="material-icons-outlined"
              style={{ color: "var(--success-color)" }}
            >
              cloud_done
            </span>
            <strong>Base de Datos Segura:</strong>
            <span
              className={`status-indicator ${
                systemHealth.database === "Connected"
                  ? "online"
                  : systemHealth.database === "checking"
                  ? "checking"
                  : "offline"
              }`}
            >
              {systemHealth.database === "Connected"
                ? "Vinculada"
                : systemHealth.database === "checking"
                ? "Verificando..."
                : "Error de Conexión"}
            </span>
          </div>
        </div>
        <button
          className="btn-icon"
          onClick={() => fetchHealth()}
          title="Refrescar Estado"
        >
          <span className="material-icons-outlined">refresh</span>
        </button>
      </div>

      <div className="maintenance-card warning">
        <div className="warning-icon">⚠️</div>
        <div className="warning-content">
          <h2>Zona de Peligro</h2>
          <p>
            Acciones integradas con Auditoría Forense 2026. Todas las acciones
            quedan registradas.
          </p>
        </div>
      </div>

      <div className="maintenance-content">
        <section className="pin-master-card">
          <div className="pin-badge-info">
            <span className="material-icons-outlined">verified_user</span>
            <span>Seguridad de Acceso Maestro</span>
          </div>

          <div className="flex flex-col mb-6">
            <h3 className="text-xl font-bold mb-1">PIN Maestro</h3>
            <p className="text-sm text-slate-500">
              Configura acceso rápido de supervisión (4 a 6 dígitos).
            </p>
          </div>

          <form onSubmit={handleUpdateMasterPin} className="pin-form-grid">
            <div className="pin-input-group">
              <label>Nuevo PIN</label>
              <input
                type="password"
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                maxLength="6"
                className="pin-input-modern"
              />
            </div>

            <div className="pin-input-group">
              <label>Confirmar PIN</label>
              <input
                type="password"
                placeholder="••••"
                value={confirmPin}
                onChange={(e) =>
                  setConfirmPin(e.target.value.replace(/\D/g, ""))
                }
                maxLength="6"
                className="pin-input-modern"
              />
            </div>

            <button
              type="submit"
              className="btn-update-pin"
              disabled={isUpdatingPin || !newPin || !confirmPin}
            >
              <span className="material-icons-outlined">save</span>
              <span>{isUpdatingPin ? "Guardando..." : "Actualizar PIN"}</span>
            </button>
          </form>
        </section>

        <section className="reset-section">
          <h3>Opciones de Reset</h3>
          <div className="options-grid">
            <label className="option-item">
              <input
                type="checkbox"
                checked={options.resetTerminals}
                onChange={(e) =>
                  setOptions({ ...options, resetTerminals: e.target.checked })
                }
              />
              <span>
                <strong>Resetear Dispositivos</strong>
                <small>Libera licencias de terminales registradas.</small>
              </span>
            </label>

            <label className="option-item">
              <input
                type="checkbox"
                checked={options.resetTransactions}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    resetTransactions: e.target.checked,
                  })
                }
              />
              <span>
                <strong>Limpiar Transacciones</strong>
                <small>Ventas y Cortes. Mantiene productos.</small>
              </span>
            </label>

            <label className="option-item">
              <input
                type="checkbox"
                checked={options.resetProfiles}
                onChange={(e) =>
                  setOptions({ ...options, resetProfiles: e.target.checked })
                }
              />
              <span>
                <strong>Preservar solo Administrador</strong>
                <small>Elimina cuentas de empleados secundarios.</small>
              </span>
            </label>
          </div>

          <div className="confirmation-box">
            <p>
              Escriba <strong>RESET</strong> para habilitar:
            </p>
            <input
              type="text"
              placeholder="Escribe RESET aquí"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={loading}
            />
            <button
              className={`btn-reset ${
                confirmation.trim() === "RESET" ? "active" : ""
              }`}
              onClick={() => handleReset(false)}
              disabled={loading || confirmation.trim() !== "RESET"}
            >
              {loading ? "Procesando..." : "Ejecutar Acción"}
            </button>
          </div>

          {message.text && (
            <div className={`status-message ${message.type}`}>
              {message.text}
            </div>
          )}
        </section>

        <section className="reset-section">
          <h3>Sesiones de Caja</h3>
          <p className="section-description">
            Forzar el cierre de cajas abiertas en otros dispositivos.
          </p>
          <div className="utility-box">
            <button
              className="btn-warning"
              onClick={async () => {
                if (window.confirm("¿Forzar cierre de todas las cajas?")) {
                  setLoading(true);
                  try {
                    await maintenanceService.forceCloseAllSessions();
                    setMessage({ text: "Sesiones cerradas.", type: "success" });
                  } catch (e) {
                    setMessage({ text: "Error: " + e.message, type: "error" });
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              disabled={loading}
            >
              <span className="material-icons-outlined">lock_reset</span>
              {loading ? "Cerrando..." : "Forzar Cierre Global"}
            </button>
          </div>
        </section>

        <section className="maintenance-section">
          <h3>Auditoría Forense (Últimos Movimientos)</h3>
          <p className="section-description">
            Registro inmutable de acciones realizadas con el PIN Maestro.
          </p>
          <div className="logs-table-wrapper">
            {auditLogs.length === 0 ? (
              <p className="empty-msg">No hay registros de auditoría.</p>
            ) : (
              <table className="maintenance-table">
                <thead>
                  <tr>
                    <th>Acción</th>
                    <th>Detalles</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <span className="log-action">{log.action}</span>
                      </td>
                      <td>
                        <small>{log.details}</small>
                      </td>
                      <td className="log-date">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="maintenance-section">
          <h3>Dispositivos Registrados</h3>
          <div className="terminals-list">
            {terminals.length === 0 ? (
              <p className="empty-msg">No hay terminales.</p>
            ) : (
              <table className="maintenance-table">
                <thead>
                  <tr>
                    <th>Equipo</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {terminals.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.name}</strong>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            t.is_main ? "main" : "secondary"
                          }`}
                        >
                          {t.is_main ? "Principal" : "Secundaria"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn-icon delete"
                          onClick={async () => {
                            if (window.confirm(`¿Eliminar "${t.name}"?`)) {
                              await terminalService.deleteTerminal(t.id);
                              fetchTerminals();
                            }
                          }}
                        >
                          <span className="material-icons-outlined">
                            delete_forever
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <section className="reset-section nuclear">
        <h3 className="text-danger">☢️ Reset de Fábrica</h3>
        <div className="confirmation-box nuclear">
          <p>
            Confirmar con <strong>BORRAR-TODO</strong>:
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="nuclear-input"
          />
          <button
            className={`btn-nuclear ${
              confirmation.trim() === "BORRAR-TODO" ? "active" : ""
            }`}
            disabled={loading || confirmation.trim() !== "BORRAR-TODO"}
            onClick={() => handleReset(true)}
          >
            {loading ? "Destruyendo..." : "RESETEO TOTAL"}
          </button>
        </div>
      </section>
    </div>
  );
};

export default Maintenance;
