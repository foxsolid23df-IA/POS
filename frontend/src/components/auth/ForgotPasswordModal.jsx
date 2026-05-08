import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

export const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Error al enviar el correo de recuperación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '420px', padding: '2.5rem' }}>
        <div className="modal-header" style={{ marginBottom: '1.5rem', borderBottom: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Recuperar Acceso</h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>Te ayudaremos a volver a tu cuenta.</p>
          </div>
          <button className="close-btn" onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '8px' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          {success ? (
            <div className="success-message" style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ 
                width: '70px', 
                height: '70px', 
                background: 'rgba(16, 185, 129, 0.1)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 1.5rem auto'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#10b981' }}>mail</span>
              </div>
              <h3 style={{ margin: '0 0 1rem 0', color: '#fff' }}>¡Correo Enviado!</h3>
              <p style={{ color: '#94a3b8', lineHeight: '1.6' }}>
                Revisa tu bandeja de entrada (y la carpeta de spam). Hemos enviado un enlace para que restaures tu contraseña.
              </p>
              <button 
                className="login-submit-btn" 
                onClick={onClose}
                style={{ marginTop: '2rem' }}
              >
                ENTENDIDO
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && <div className="login-error-msg" style={{ marginBottom: '1.5rem' }}>{error}</div>}

              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Correo Electrónico
                </label>
                <div className="input-wrapper">
                  <span className="material-symbols-outlined input-icon">mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    required
                    style={{
                        width: '100%',
                        background: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '12px',
                        padding: '1.1rem 1.25rem 1.1rem 3.25rem',
                        color: '#ffffff',
                        fontSize: '1rem',
                        outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={loading}
                  style={{ margin: 0 }}
                >
                  {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <div className="spinner-small"></div>
                      <span>ENVIANDO...</span>
                    </div>
                  ) : "ENVIAR ENLACE DE RECUPERACIÓN"}
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={onClose}
                  disabled={loading}
                  style={{ alignSelf: 'center', padding: '0.5rem' }}
                >
                  Regresar al inicio de sesión
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
