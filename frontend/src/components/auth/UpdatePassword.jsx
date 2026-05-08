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

  // Redirigir si no hay sesión y no estamos cargando
  // (Aunque usualmente Supabase inicia sesión al usar el link de recuperación)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && !loading) {
        // Podríamos redirigir, pero si acaba de hacer el cambio, success será true
      }
    };
    checkSession();
  }, []);

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
      // No redirigir inmediatamente para que vean el éxito
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al actualizar la contraseña");
      setLoading(false);
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
            <h1>{success ? "¡Éxito!" : "Nueva Contraseña"}</h1>
            <p>
              {success 
                ? "Tu contraseña ha sido actualizada correctamente." 
                : "Ingresa tu nueva contraseña para acceder a tu cuenta."}
            </p>
          </div>

          {error && <div className="login-error-msg">{error}</div>}
          
          {success ? (
            <div className="success-content" style={{ textAlign: 'center', padding: '1rem' }}>
              <div className="success-icon-wrapper" style={{ 
                width: '80px', 
                height: '80px', 
                background: 'rgba(16, 185, 129, 0.1)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#10b981' }}>check_circle</span>
              </div>
              <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>Ahora puedes iniciar sesión con tus nuevas credenciales.</p>
              <button 
                type="button"
                className="login-submit-btn" 
                onClick={() => navigate('/login')}
              >
                IR AL INICIO DE SESIÓN
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
                style={{ marginTop: '1rem' }}
              >
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <div className="spinner-small"></div>
                    <span>ACTUALIZANDO...</span>
                  </div>
                ) : "GUARDAR CONTRASEÑA"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
