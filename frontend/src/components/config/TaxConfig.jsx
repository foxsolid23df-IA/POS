import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import "./TaxConfig.css";

const TaxConfig = () => {
  const { user, fetchProfile } = useAuth();
  const navigate = useNavigate();

  const [taxPercentage, setTaxPercentage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user && user.tax_percentage !== undefined) {
      setTaxPercentage(user.tax_percentage.toString());
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const percentage = parseFloat(taxPercentage);

      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        throw new Error("El porcentaje debe ser un número entre 0 y 100");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ tax_percentage: percentage })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Actualizamos el contexto global
      await fetchProfile(user.id, true);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tax-config-container">
      <div className="tax-config-header">
        <button className="back-button" onClick={() => navigate("/configuracion")}>
          <span className="material-symbols-outlined">arrow_back</span>
          Regresar a Configuración
        </button>
        <h2>Configuración de Impuestos</h2>
        <p>Ajusta el porcentaje de impuesto que se aplicará en cada venta y se desglosará en el ticket.</p>
      </div>

      <div className="tax-config-content">
        <form className="tax-config-form" onSubmit={handleSave}>
          <div className="form-group">
            <label htmlFor="taxPercentage">Porcentaje de Impuesto (%)</label>
            <div className="input-with-icon">
              <span className="material-symbols-outlined">percent</span>
              <input
                type="number"
                id="taxPercentage"
                name="taxPercentage"
                step="0.01"
                min="0"
                max="100"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(e.target.value)}
                placeholder="Ejemplo: 16"
                required
              />
            </div>
            <span className="help-text">
              Introduce 0 si no deseas aplicar impuestos. Este valor se reflejará como desglose en el cobro.
            </span>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && (
            <div className="success-message">
              <span className="material-symbols-outlined">check_circle</span>
              Configuración guardada correctamente
            </div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              className="save-button"
              disabled={loading}
              title="Guardar Configuración"
            >
              <span className="material-symbols-outlined">save</span>
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaxConfig;
