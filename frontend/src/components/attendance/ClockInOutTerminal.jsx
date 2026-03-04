import React, { useState, useEffect, useRef } from "react";
import Swal from "sweetalert2";
import { staffService } from "../../services/staffService";
import { attendanceService } from "../../services/attendanceService";
import "./ClockInOutTerminal.css";

export const ClockInOutTerminal = ({ onClose, onAutoLogin }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pin, setPin] = useState("");
  const [authMethod, setAuthMethod] = useState("pin"); // 'pin' or 'fingerprint'
  const [isProcessing, setIsProcessing] = useState(false);
  const fingerprintInputRef = useRef(null);

  // Actualizar reloj cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Enfocar input de huella si está en ese modo (para simular lectores USB tipo teclado)
  useEffect(() => {
    if (authMethod === "fingerprint" && fingerprintInputRef.current) {
      fingerprintInputRef.current.focus();
    }
  }, [authMethod]);

  const handlePinInput = (digit) => {
    if (pin.length < 6 && !isProcessing) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (!isProcessing) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (!isProcessing) setPin("");
  };

  const processAttendance = async (action) => {
    if (authMethod === "pin" && pin.length < 4) {
      Swal.fire("Error", "Ingrese su PIN completo", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      // Identificar al empleado
      // Nota: Aquí simulamos que el lector USB manda el PIN o ID por ahora.
      // Cuando se integre el SDK de huella, esto se reemplazará por la validación biométrica.
      const staff = await staffService.validatePin(pin);

      // Verificar permisos para checar huella/pin según configuración del staff
      if (staff.auth_method === "fingerprint" && authMethod === "pin") {
        Swal.fire(
          "Acceso Denegado",
          "Su perfil requiere autenticación por Huella",
          "error",
        );
        setPin("");
        return;
      }

      // Validar último registro para evitar dobles entradas/salidas
      const lastLog = await attendanceService.getLastLog(staff.id);
      if (lastLog && lastLog.action === action) {
        const actionName = action === "check_in" ? "Entrada" : "Salida";
        Swal.fire(
          "Aviso",
          `Ya tienes una ${actionName} registrada recientemente.`,
          "info",
        );
        setPin("");
        return;
      }

      // Registrar asitencia
      await attendanceService.logAttendance(staff.id, action, authMethod);

      const actionName = action === "check_in" ? "Entrada" : "Salida";
      Swal.fire({
        title: `¡${actionName} Registrada!`,
        text: `${staff.name} ${staff.last_name || ""}\n${currentTime.toLocaleTimeString()}`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      setPin("");
      if (onAutoLogin && action === "check_in") {
        setTimeout(() => onAutoLogin(staff), 1500);
      } else if (onClose) {
        setTimeout(onClose, 2000);
      }
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        "No se pudo verificar la identidad o registrar la asistencia.",
        "error",
      );
      setPin("");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="clock-terminal-overlay">
      <div className="clock-terminal-container">
        <button className="close-terminal-btn" onClick={onClose}>
          <span className="material-icons-outlined">close</span>
        </button>

        <div className="clock-header">
          <h2>Reloj Checador</h2>
          <div className="digital-clock">
            <span className="time">
              {currentTime.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <span className="date">
              {currentTime.toLocaleDateString("es-MX", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        <div className="auth-method-tabs">
          <button
            className={`tab-btn ${authMethod === "pin" ? "active" : ""}`}
            onClick={() => setAuthMethod("pin")}
          >
            <span className="material-icons-outlined">dialpad</span>
            PIN
          </button>
          <button
            className={`tab-btn ${authMethod === "fingerprint" ? "active" : ""}`}
            onClick={() => setAuthMethod("fingerprint")}
          >
            <span className="material-icons-outlined">fingerprint</span>
            Huella USB
          </button>
        </div>

        {authMethod === "pin" ? (
          <div className="pin-section">
            <div className="pin-display">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`pin-dot ${i < pin.length ? "filled" : ""}`}
                />
              ))}
            </div>
            <div className="terminal-keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <button
                  key={num}
                  onClick={() => handlePinInput(num.toString())}
                  disabled={isProcessing}
                >
                  {num}
                </button>
              ))}
              <button
                className="action-key clear"
                onClick={handleClear}
                disabled={isProcessing}
              >
                C
              </button>
              <button
                onClick={() => handlePinInput("0")}
                disabled={isProcessing}
              >
                0
              </button>
              <button
                className="action-key"
                onClick={handleBackspace}
                disabled={isProcessing}
              >
                ⌫
              </button>
            </div>
          </div>
        ) : (
          <div className="fingerprint-section">
            <div className="fingerprint-animation">
              <span className="material-icons-outlined scanner-icon">
                fingerprint
              </span>
              <div className="scan-line"></div>
            </div>
            <p className="scanner-instruction">
              {pin.length > 0
                ? "¡Lectura recibida! Seleccione Entrada o Salida abajo."
                : "Coloque su huella en el lector USB..."}
            </p>
            {/* Input oculto para recibir el escaneo si funciona como teclado */}
            <input
              type="password"
              autoFocus
              ref={fingerprintInputRef}
              className="hidden-scanner-input"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onBlur={() => {
                // Pequeño delay para no interrumpir si el usuario cambia de tab deliberadamente
                setTimeout(() => {
                  if (
                    authMethod === "fingerprint" &&
                    fingerprintInputRef.current
                  ) {
                    fingerprintInputRef.current.focus();
                  }
                }, 100);
              }}
            />
          </div>
        )}

        <div className="action-buttons">
          <button
            className="btn-check-in"
            onClick={() => processAttendance("check_in")}
            disabled={isProcessing || (authMethod === "pin" && pin.length < 4)}
          >
            <span className="material-icons-outlined">login</span>
            Registrar Entrada
          </button>
          <button
            className="btn-check-out"
            onClick={() => processAttendance("check_out")}
            disabled={isProcessing || (authMethod === "pin" && pin.length < 4)}
          >
            <span className="material-icons-outlined">logout</span>
            Registrar Salida
          </button>
        </div>
      </div>
    </div>
  );
};
