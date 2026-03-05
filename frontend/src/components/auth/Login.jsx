import React, { useState, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { invitationService } from "../../services/invitationService";
import logo from "../../assets/icon.png";
import "./Login.css";

export const Login = () => {
  const { login, signUp, user } = useAuth();
  const { invitationCode } = useParams(); // Para rutas como /register/ADMIN2024

  // UI State
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Form Data
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    storeName: "",
    fullName: "",
    invitationCode: "",
  });

  // Estado para el código de invitación validado
  const [validatedCode, setValidatedCode] = useState(null);

  // Si hay código de invitación en la URL, activar modo registro y pre-llenar el código
  useEffect(() => {
    if (invitationCode) {
      setIsRegistering(true);
      setFormData((prev) => ({
        ...prev,
        invitationCode: invitationCode.toUpperCase(),
      }));
    }
  }, [invitationCode]);

  if (user) {
    return <Navigate to="/" />;
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isRegistering) {
        // Validar código de invitación contra la base de datos
        if (!formData.invitationCode) {
          setError(
            "Código de invitación requerido. Solo el área administrativa puede proporcionar códigos de registro.",
          );
          setLoading(false);
          return;
        }

        const validation = await invitationService.validateCode(
          formData.invitationCode,
        );

        if (!validation.valid) {
          setError(validation.error || "Código de invitación inválido.");
          setLoading(false);
          return;
        }

        // Proceder con el registro pasando el código validado
        await signUp(
          formData.email,
          formData.password,
          formData.storeName,
          formData.fullName,
          validation.codeId,
        );
      } else {
        await login(formData.email, formData.password);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-content-wrapper">
        <div className="login-brand-header">
          <div className="login-brand-glow"></div>
          <div className="login-brand-icon-wrapper">
            <img src={logo} alt="NEXUM POS Logo" className="login-brand-logo" />
          </div>
          <div className="login-brand-title">
            <h2>NEXUM POS</h2>
          </div>
        </div>

        <div className="glass-panel">
          <div className="glass-panel-header">
            <h1>{isRegistering ? "Crear Cuenta" : "Bienvenido"}</h1>
            <p>
              {isRegistering
                ? "Registra tu negocio en NEXUM POS"
                : "Gestiona tu negocio profesionalmente"}
            </p>
          </div>

          {error && <div className="login-error-msg">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            {isRegistering && (
              <>
                <div className="form-group">
                  <label>Código de Invitación *</label>
                  <div className="input-wrapper">
                    <span className="material-symbols-outlined input-icon">
                      badge
                    </span>
                    <input
                      type="text"
                      name="invitationCode"
                      value={formData.invitationCode}
                      onChange={handleChange}
                      placeholder="Código proporcionado"
                      required
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: "2px",
                        fontWeight: "600",
                      }}
                    />
                  </div>
                  <small
                    style={{
                      color: "#64748b",
                      fontSize: "11px",
                      marginTop: "2px",
                      marginLeft: "4px",
                    }}
                  >
                    Solo para área administrativa
                  </small>
                </div>
                <div className="form-group">
                  <label>Nombre del Negocio</label>
                  <div className="input-wrapper">
                    <span className="material-symbols-outlined input-icon">
                      store
                    </span>
                    <input
                      type="text"
                      name="storeName"
                      value={formData.storeName}
                      onChange={handleChange}
                      placeholder="Ej: Minimarket Central"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Tu Nombre Completo</label>
                  <div className="input-wrapper">
                    <span className="material-symbols-outlined input-icon">
                      person
                    </span>
                    <input
                      type="text"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleChange}
                      placeholder="Ej: Juan Pérez"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Correo Electrónico</label>
              <div className="input-wrapper">
                <span className="material-symbols-outlined input-icon">
                  mail
                </span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="nombre@ejemplo.com"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Contraseña</label>
              <div className="input-wrapper">
                <span className="material-symbols-outlined input-icon">
                  lock
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="has-right-icon"
                  required
                  minLength={6}
                />
                <span
                  className="material-symbols-outlined input-icon-right cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </div>
            </div>

            {!isRegistering && (
              <div className="forgot-password-link">
                <button type="button" className="text-link">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading
                ? "Procesando..."
                : isRegistering
                ? "REGISTRARSE"
                : "INICIAR SESIÓN"}
            </button>
          </form>

          {isRegistering && (
            <div className="login-footer-text">
              <p>
                ¿Ya tienes cuenta?
                <button
                  type="button"
                  className="text-link primary-link ml-2"
                  onClick={() => setIsRegistering(false)}
                >
                  Inicia Sesión
                </button>
              </p>
            </div>
          )}
        </div>

        <div className="login-footer-links">
          <button type="button">Privacidad</button>
          <span>•</span>
          <button type="button">Términos</button>
          <span>•</span>
          <button type="button">Soporte</button>
        </div>
      </div>
    </div>
  );
};
