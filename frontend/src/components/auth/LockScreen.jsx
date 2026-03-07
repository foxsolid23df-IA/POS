import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabase";
import { staffService } from "../../services/staffService";
import { attendanceService } from "../../services/attendanceService";
import Swal from "sweetalert2";
import logo from "../../assets/icon.png";
import { ClockInOutTerminal } from "../attendance/ClockInOutTerminal";
import "./LockScreen.css";

export const LockScreen = () => {
  const [pin, setPin] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [showClockTerminal, setShowClockTerminal] = useState(false);
  const {
    loginWithPin,
    validateStaffPin,
    loginAs,
    unlockAsOwner,
    unlockWithMasterPin,
    storeName,
    logout,
    user,
  } = useAuth();
  const containerRef = React.useRef(null);
  const bufferRef = React.useRef("");
  const timeoutRef = React.useRef(null);

  // Auto-enfocar el contenedor al montar para habilitar teclado de inmediato
  React.useEffect(() => {
    if (containerRef.current && !showClockTerminal) {
      containerRef.current.focus();
    }
  }, [showClockTerminal]);

  const handlePinInput = (digit) => {
    if (pin.length < 6 && !isValidating) {
      setPin((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (!isValidating) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (!isValidating) {
      setPin("");
    }
  };

  const handleSubmit = async () => {
    if (pin.length < 4 || isValidating) {
      return;
    }

    setIsValidating(true);

    try {
      // 1. Validar el PIN sin iniciar sesión todavía
      const staff = await validateStaffPin(pin);
      console.log(
        "Validando staff:",
        staff.name,
        "Permisos:",
        staff.permissions,
      );

      // 2. Validar si requiere entrada obligatoria
      if (staff.permissions?.require_check_in) {
        const lastLog = await attendanceService.getLastLog(staff.id);
        console.log(
          "Último registro de asistencia:",
          lastLog?.action,
          "para",
          staff.name,
        );

        if (!lastLog || lastLog.action === "check_out") {
          console.warn("Acceso denegado: Entrada requerida por asistencia.");
          Swal.fire({
            title: "Entrada Requerida",
            text: "Debes registrar tu entrada en el Reloj Checador o usar el Lector de Huella antes de iniciar sesión.",
            icon: "warning",
            confirmButtonText: "Ir a Reloj Checador",
            confirmButtonColor: "var(--primary-color)",
          }).then((result) => {
            setShowClockTerminal(true);
            setPin("");
          });
          return;
        }
      }

      // 3. Si pasó los checks, ahora sí iniciamos sesión oficial
      await loginWithPin(pin);

      Swal.fire({
        title: `¡Bienvenido!`,
        text: `${staff.name} - ${staff.role.toUpperCase()}`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire(
        "PIN Incorrecto",
        "Verifica tu PIN e intenta de nuevo",
        "error",
      );
      setPin("");
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (isValidating) return;

    // Números (Teclado principal y numérico)
    if (/^[0-9]$/.test(e.key)) {
      handlePinInput(e.key);
    }
    // Borrar uno atrás
    else if (e.key === "Backspace") {
      handleBackspace();
    }
    // Borrar todo
    else if (
      e.key === "Delete" ||
      e.key === "Escape" ||
      e.key === "c" ||
      e.key === "C"
    ) {
      handleClear();
    }
    // Lector de Huella USB (ráfaga que termina en Enter)
    else if (e.key === "Enter") {
      if (bufferRef.current.length > 5) {
        e.preventDefault();
        handleFingerprint(bufferRef.current);
        bufferRef.current = "";
      } else {
        handleSubmit();
      }
    }

    // Acumulador para lector de huellas USB
    if (
      (e.key.length === 1 && !/^[0-9]$/.test(e.key)) ||
      /^[0-9a-zA-Z]$/.test(e.key)
    ) {
      bufferRef.current += e.key;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = ""; // Limpiar si es muy lento (no es escáner)
      }, 50); // 50ms es muy rápido, solo factible para escáners automáticos
    }
  };

  const handleFingerprint = async (scannedCode) => {
    setIsValidating(true);
    try {
      const staff = await staffService.loginWithFingerprint(scannedCode);
      const lastLog = await attendanceService.getLastLog(staff.id);

      if (!lastLog || lastLog.action === "check_out") {
        // Registrar Entrada e Iniciar Sesión automáticamente
        await attendanceService.logAttendance(
          staff.id,
          "check_in",
          "fingerprint",
        );
        Swal.fire({
          title: "¡Entrada Registrada!",
          text: `Bienvenido, ${staff.name}`,
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          loginAs(staff);
        });
      } else {
        // Ya tiene entrada registrada, preguntar qué desea hacer
        Swal.fire({
          title: `Hola, ${staff.name}`,
          text: `Tu último registro fue entrada. ¿Qué deseas hacer ahora?`,
          icon: "question",
          showCancelButton: true,
          confirmButtonColor: "var(--primary-color)",
          cancelButtonColor: "#f59e0b",
          confirmButtonText: "🏠 Iniciar Sesión POS",
          cancelButtonText: "👋 Registrar Salida",
        }).then(async (result) => {
          if (result.isConfirmed) {
            loginAs(staff);
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            setIsValidating(true);
            await attendanceService.logAttendance(
              staff.id,
              "check_out",
              "fingerprint",
            );
            setIsValidating(false);
            Swal.fire({
              title: "¡Salida Registrada!",
              text: `Hasta pronto, ${staff.name}`,
              icon: "success",
              timer: 2000,
              showConfirmButton: false,
            });
            setPin("");
          }
        });
      }
    } catch (error) {
      Swal.fire(
        "Error Biométrico",
        error.message || "Huella no reconocida o empleado inactivo",
        "error",
      );
    } finally {
      if (!Swal.isVisible()) setIsValidating(false);
      setPin("");
    }
  };

  const handleOwnerAccess = async () => {
    // Pedir PIN Maestro para verificar identidad
    const result = await Swal.fire({
      title: "👑 Acceso de Propietario",
      html: `
        <p style="margin-bottom: 15px; color: #666;">
            Ingresa tu PIN Maestro de 6 dígitos.
        </p>
      `,
      input: "password",
      inputAttributes: {
        inputMode: "numeric",
        pattern: "[0-9]*",
        maxLength: "6",
      },
      inputPlaceholder: "PIN de 6 dígitos",
      showCancelButton: true,
      confirmButtonText: "Ingresar",
      cancelButtonText: "Usar Contraseña",
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#64748b",
      customClass: {
        confirmButton: "swal-confirm-btn-modern",
        cancelButton: "swal-cancel-btn-modern",
        input: "swal-input-modern",
      },
      inputValidator: (value) => {
        if (!value || value.length < 4) {
          return "Ingresa un PIN válido";
        }
      },
    });

    if (result.isConfirmed && result.value) {
      // Mostrar loading
      Swal.fire({
        title: "Verificando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        await unlockWithMasterPin(result.value);
        Swal.fire({
          title: "¡Modo Supervisión Activado!",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        }).then(() => {
          window.location.hash = "#/estadisticas";
        });
      } catch (error) {
        Swal.fire(
          "PIN Incorrecto",
          error.message || "No se pudo verificar el PIN",
          "error",
        );
      }
    } else if (result.dismiss === Swal.DismissReason.cancel) {
      handleOwnerPasswordAccess();
    }
  };

  const handleOwnerPasswordAccess = async () => {
    // Pedir contraseña para verificar identidad
    const { value: password } = await Swal.fire({
      title: "🔐 Acceso con Contraseña",
      html: `
        <p style="margin-bottom: 15px; color: #666;">
            Por seguridad, ingresa tu contraseña de cuenta
        </p>
                <p style="font-size: 12px; color: #999;">
                    Email: ${user?.email || "usuario@email.com"}
                </p>
            `,
      input: "password",
      inputPlaceholder: "Tu contraseña",
      showCancelButton: true,
      confirmButtonText: "Verificar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#3b82f6",
      inputValidator: (value) => {
        if (!value) {
          return "Debes ingresar tu contraseña";
        }
      },
    });

    if (!password) return;

    // Mostrar loading
    Swal.fire({
      title: "Verificando...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // Verificar contraseña con Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: user?.email,
        password: password,
      });

      if (error) {
        Swal.fire({
          title: "Contraseña incorrecta",
          text: "La contraseña no es válida. Intenta de nuevo.",
          icon: "error",
        });
        return;
      }

      // Contraseña correcta - desbloquear
      unlockAsOwner();
      Swal.fire({
        title: "¡Bienvenido, Propietario!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error verificando contraseña:", error);
      Swal.fire("Error", "No se pudo verificar la contraseña", "error");
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: "¿Cerrar sesión de la tienda?",
      text: "Esto desvinculará este dispositivo. Necesitarás email y contraseña para volver a iniciar sesión.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, cerrar sesión",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      logout();
    }
  };

  return (
    <div
      className="lock-screen"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      ref={containerRef}
      style={{ outline: "none" }}
    >
      <div className="lock-container">
        <div className="lock-header">
          <button
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-primary dark:hover:text-white transition-colors"
            onClick={() => {
              document.documentElement.classList.toggle("dark");
              localStorage.setItem(
                "theme",
                document.documentElement.classList.contains("dark")
                  ? "dark"
                  : "light",
              );
            }}
            title="Cambiar Tema"
          >
            <span className="material-icons-outlined">dark_mode</span>
          </button>
          <div className="lock-logo-wrapper">
            <img src={logo} alt="NEXUM POS Logo" className="lock-logo" />
          </div>
          <div className="store-name">{storeName || "NEXUM POS"}</div>
          <h1>Pantalla Bloqueada</h1>
          <p>Ingresa tu PIN para comenzar</p>
        </div>

        <div className="pin-display">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`pin-dot ${i < pin.length ? "filled" : ""}`}
            />
          ))}
        </div>

        <div className="pin-keypad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              className="key-btn"
              onClick={() => handlePinInput(digit.toString())}
              disabled={isValidating}
            >
              {digit}
            </button>
          ))}
          <button
            className="key-btn clear"
            onClick={handleClear}
            disabled={isValidating}
          >
            C
          </button>
          <button
            className="key-btn"
            onClick={() => handlePinInput("0")}
            disabled={isValidating}
          >
            0
          </button>
          <button
            className="key-btn backspace"
            onClick={handleBackspace}
            disabled={isValidating}
          >
            ⌫
          </button>
        </div>

        <button
          className="unlock-btn"
          onClick={handleSubmit}
          disabled={pin.length < 4 || isValidating}
        >
          {isValidating ? "Verificando..." : "Desbloquear"}
        </button>

        <div className="lock-actions">
          <button
            className="owner-btn"
            onClick={() => setShowClockTerminal(true)}
            style={{ backgroundColor: "var(--primary-color)", color: "white" }}
          >
            ⌚ Reloj Checador
          </button>
          <button className="owner-btn" onClick={handleOwnerAccess}>
            👑 Soy el Propietario
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            🚪 Cerrar Sesión de la Tienda
          </button>
        </div>

        <div
          className="lock-hint"
          style={{
            marginTop: "1.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span
            className="material-icons-outlined"
            style={{ fontSize: "2.5rem", color: "var(--primary-color)" }}
          >
            fingerprint
          </span>
          <small>
            Ingresa tu PIN de 4-6 dígitos o <strong>coloca tu huella</strong> en
            el lector para ingresar o registrar asistencia automáticamente.
          </small>
        </div>

        {showClockTerminal && (
          <ClockInOutTerminal
            onClose={() => setShowClockTerminal(false)}
            onAutoLogin={(staff) => loginAs(staff)}
          />
        )}
      </div>
    </div>
  );
};
