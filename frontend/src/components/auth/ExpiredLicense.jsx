import React from "react";
import { useAuth } from "../../hooks/useAuth";
import "./ExpiredLicense.css";
import { FiAlertCircle, FiLogOut, FiPhoneCall } from "react-icons/fi";

export const ExpiredLicense = () => {
  const { logout, storeName } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <div className="expired-license-container">
      <div className="expired-license-card">
        <div className="expired-icon-wrapper">
          <FiAlertCircle size={48} className="expired-icon" />
        </div>

        <h1 className="expired-title">Licencia Expirada</h1>

        <div className="expired-content">
          <p className="expired-greeting">
            Hola, {storeName ? <strong>{storeName}</strong> : "usuario"}.
          </p>
          <p className="expired-message">
            El tiempo de vigencia de tu licencia para usar el sistema ha
            expirado. Para seguir disfrutando de todas las funcionalidades, por
            favor renueva tu licencia contactando a soporte técnico.
          </p>
        </div>

        <div className="expired-actions">
          <a
            href="https://wa.me/521123456789"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-contact-support"
          >
            <FiPhoneCall className="icon-mr" /> Contactar Soporte
          </a>

          <button onClick={handleLogout} className="btn-logout-alt">
            <FiLogOut className="icon-mr" /> Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};
