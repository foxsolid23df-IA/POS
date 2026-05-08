import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import logo from "../../assets/icon.png";
import "./Login.css";

export const UpdatePassword = () => {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Verificamos si estamos en una sesión de recuperación (la URL tendrá access_token si vino de correo, 
  // pero Supabase se encarga de iniciar la sesión con él. Así que deberíamos tener sesión pero tal vez
  // sin el objeto 'user' completamente cargado, o simplemente dejamos que intenten actualizar).

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }
    
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      setLoading(false);
      return;
    }

    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al actualizar la contraseña");
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
            <h1>Nueva Contraseña</h1>
            <p>Ingresa tu nueva contraseña para acceder a tu cuenta.</p>
          </div>

          {error && <div className="login-error-msg">{error}</div>}
          
          {success ? (
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#10b981' }}>check_circle</span>
              <p style={{ marginTop: '1rem', color: '#e2e8f0' }}>¡Contraseña actualizada con éxito!</p>
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginTop: '0.5rem' }}>Serás redirigido al inicio de sesión en unos segundos...</p>
              <button 
                type="button"
                className="login-submit-btn" 
                style={{ marginTop: '1.5rem' }}
                onClick={() => navigate('/login')}
              >
                Ir a Iniciar Sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label>Nueva Contraseña</label>
                <div className="input-wrapper">
                  <span className="material-symbols-outlined input-icon">lock</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
              
              <div className="form-group">
                <label>Confirmar Contraseña</label>
                <div className="input-wrapper">
                  <span className="material-symbols-outlined input-icon">lock_reset</span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="has-right-icon"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={loading}
              >
                {loading ? "ACTUALIZANDO..." : "GUARDAR CONTRASEÑA"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
