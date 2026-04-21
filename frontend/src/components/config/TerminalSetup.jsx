import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { terminalService } from "../../services/terminalService";
import { useAuth } from "../../hooks/useAuth";
import "./TerminalSetup.css";

export const TerminalSetup = ({ onTerminalConfigured }) => {
  const { user, logout } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasMainAlready, setHasMainAlready] = useState(false);
  const [terminalsCount, setTerminalsCount] = useState(0);
  const [checkingLimit, setCheckingLimit] = useState(true);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    const checkMainTerminal = async () => {
      const exists = await terminalService.hasMainTerminal();
      setHasMainAlready(exists);
    };

    const checkLimits = async () => {
      try {
        const terminals = await terminalService.getTerminals();
        setTerminalsCount(terminals.length);

        const maxRegisters = user?.max_registers || 1;

        if (terminals.length >= maxRegisters) {
          setLimitReached(true);
        } else {
          setLimitReached(false);
        }
      } catch (error) {
        console.error("Error checking limits:", error);
      } finally {
        setCheckingLimit(false);
      }
    };

    checkMainTerminal();
    checkLimits();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      Swal.fire("Error", "Debes asignar un nombre a esta caja", "warning");
      return;
    }

    setIsSubmitting(true);

    try {
      const terminal = await terminalService.registerTerminal(
        name.trim(),
        location.trim(),
        isMain,
      );

      Swal.fire({
        title: "¡Terminal Configurada!",
        text: `Esta PC ahora está identificada como: ${terminal.name}`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      if (onTerminalConfigured) {
        onTerminalConfigured(terminal);
      }
    } catch (error) {
      console.error("Error configurando terminal:", error);
      Swal.fire(
        "Error",
        "No se pudo registrar la terminal. Intenta de nuevo.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (checkingLimit) {
    return (
      <div className="terminal-setup-overlay">
        <div
          className="terminal-setup-modal"
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 20px",
          }}
        >
          <span
            className="spinner"
            style={{
              width: "32px",
              height: "32px",
              borderTopColor: "#3b82f6",
              marginBottom: "16px",
            }}
          ></span>
          <p>Verificando licencia y cajas registradas...</p>
        </div>
      </div>
    );
  }

  if (limitReached) {
    return (
      <div className="terminal-setup-overlay">
        <div className="terminal-setup-modal" style={{ textAlign: "center" }}>
          <div
            className="terminal-icon"
            style={{
              backgroundColor: "#fef2f2",
              color: "#ef4444",
              margin: "0 auto 20px auto",
            }}
          >
            <span className="material-symbols-outlined">block</span>
          </div>
          <h1>Límite de Cajas Alcanzado</h1>
          <p style={{ margin: "20px 0", color: "#64748b", lineHeight: "1.6" }}>
            Tu licencia actual (
            {user?.license_type === "multicajas" ? "Multicajas" : "Monocaja"})
            te permite registrar hasta{" "}
            <strong>{user?.max_registers} caja(s)</strong>. Actualmente ya
            tienes <strong>{terminalsCount} caja(s)</strong> registradas en tu
            red.
          </p>
          <div
            className="setup-info"
            style={{
              backgroundColor: "#fffbeb",
              color: "#92400e",
              border: "1px solid #fde68a",
              borderLeft: "4px solid #f59e0b",
              textAlign: "left",
              marginBottom: "24px",
              padding: "16px",
              borderRadius: "8px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
            }}
          >
            <span
              className="material-symbols-outlined info-icon"
              style={{ color: "#f59e0b", fontSize: "24px" }}
            >
              warning
            </span>
            <div className="setup-info-content">
              <h4
                style={{
                  color: "#78350f",
                  fontWeight: "700",
                  marginBottom: "4px",
                }}
              >
                Atención Comercial
              </h4>
              <p
                style={{
                  margin: 0,
                  color: "#92400e",
                  fontSize: "14px",
                  lineHeight: "1.4",
                }}
              >
                Para expandir tu negocio y activar más cajas registradoras, por
                favor comunícate con soporte para subir de nivel a una licencia{" "}
                <strong>Multicajas</strong>.
              </p>
            </div>
          </div>
          <div
            className="setup-actions"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "24px",
            }}
          >
            <button
              type="button"
              className="setup-submit-btn"
              style={{ backgroundColor: "#10b981", border: "none" }}
              onClick={() => {
                window.location.reload();
              }}
            >
              <span className="material-symbols-outlined">refresh</span>
              Verificar Licencia de Nuevo
            </button>

            {user?.role === "admin" && (
              <button
                type="button"
                className="setup-submit-btn"
                style={{ backgroundColor: "#3b82f6", border: "none" }}
                onClick={() => {
                  sessionStorage.setItem("visor_mode", "true");
                  if (onTerminalConfigured) {
                    onTerminalConfigured({ name: "Modo Visor", id: "visor" });
                  }
                }}
              >
                <span className="material-symbols-outlined">visibility</span>
                Entrar como Administrador (Solo Vista)
              </button>
            )}

            <button
              type="button"
              className="setup-submit-btn"
              style={{ backgroundColor: "#64748b", border: "none" }}
              onClick={logout}
            >
              <span className="material-symbols-outlined">logout</span>
              Cerrar Sesión Segura
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-setup-overlay">
      <div className="terminal-setup-modal">
        <div className="terminal-setup-header">
          <div className="terminal-icon">
            <span className="material-symbols-outlined">point_of_sale</span>
          </div>
          <h1>Configuración de Caja</h1>
          <p>Identifica este equipo para comenzar</p>
        </div>

        <form onSubmit={handleSubmit} className="terminal-setup-form">
          <div className="form-group">
            <label>Nombre de la Caja</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: CAJA-01, CAJA-PRINCIPAL"
              autoFocus
              disabled={isSubmitting}
            />
            <span className="input-hint">Debe ser único para cada equipo</span>
          </div>

          <div className="form-group">
            <label>Ubicación (Opcional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: Entrada Principal, Piso 2"
              disabled={isSubmitting}
            />
          </div>

          {!hasMainAlready && (
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isMain}
                  onChange={(e) => setIsMain(e.target.checked)}
                  disabled={isSubmitting}
                />
                <div className="checkbox-text-wrapper">
                  <span className="checkbox-title">
                    ESTA ES LA CAJA PRINCIPAL
                  </span>
                  <span className="checkbox-desc">
                    Solo la caja principal puede realizar el Cierre de Día.
                  </span>
                </div>
              </label>
            </div>
          )}

          <button
            type="submit"
            className="setup-submit-btn"
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                Configurando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                Guardar Configuración
              </>
            )}
          </button>
        </form>

        {user?.role === "admin" && (
          <button
            type="button"
            className="setup-visor-btn"
            style={{
              width: "100%",
              marginTop: "16px",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              backgroundColor: "transparent",
              border: "1px solid #e2e8f0",
              color: "#64748b",
              borderRadius: "12px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "15px",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
              e.currentTarget.style.borderColor = "#cbd5e1";
              e.currentTarget.style.color = "#334155";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.color = "#64748b";
            }}
            onClick={() => {
              sessionStorage.setItem("visor_mode", "true");
              if (onTerminalConfigured) {
                onTerminalConfigured({ name: "Modo Visor", id: "visor" });
              }
            }}
          >
            <span className="material-symbols-outlined">visibility</span>
            Entrar como Administrador (Solo Vista)
          </button>
        )}

        <div
          className="setup-info"
          style={{ marginTop: user?.role === "admin" ? "16px" : "24px" }}
        >
          <span className="material-symbols-outlined info-icon">info</span>
          <div className="setup-info-content">
            <h4>Importante</h4>
            <p>
              Esta configuración se guardará en este dispositivo y es necesaria
              para operar en modo multicajas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
