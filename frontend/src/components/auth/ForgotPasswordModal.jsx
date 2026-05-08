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
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>Recuperar Contraseña</h2>
          <button className="close-btn" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="modal-body">
          {success ? (
            <div className="success-message" style={{ textAlign: 'center', padding: '1rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#10b981' }}>check_circle</span>
              <p style={{ marginTop: '1rem' }}>Se ha enviado un enlace de recuperación a tu correo electrónico.</p>
              <button 
                className="btn-primary mt-4" 
                onClick={onClose}
                style={{ width: '100%' }}
              >
                Entendido
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ marginBottom: '1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>
              
              {error && <div className="login-error-msg" style={{ marginBottom: '1rem' }}>{error}</div>}

              <div className="form-group">
                <label>Correo Electrónico</label>
                <div className="input-wrapper">
                  <span className="material-symbols-outlined input-icon">mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@ejemplo.com"
                    required
                  />
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? "Enviando..." : "Enviar Enlace"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
