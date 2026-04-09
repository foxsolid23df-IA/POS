import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabase";
import Swal from "sweetalert2";
import "./InventoryConfig.css";

const InventoryConfig = () => {
  const { user, fetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(user?.inventory_mode || "comprehensive");

  const handleSave = async (selectedMode) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("profiles")
        .update({ inventory_mode: selectedMode })
        .eq("id", user.id);

      if (error) throw error;

      setMode(selectedMode);
      await fetchProfile(user.id, true);
      
      Swal.fire({
        icon: "success",
        title: "Configuración guardada",
        text: `El inventario ahora opera en modo ${selectedMode === "comprehensive" ? "Completo" : "Simplificado"}.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error updating inventory mode:", error);
      Swal.fire("Error", "No se pudo actualizar la configuración", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inventory-config-container">
      <header className="inventory-config-header">
        <h1 className="inventory-config-title">Configuración de Inventario</h1>
        <p className="inventory-config-subtitle">
          Selecciona el nivel de detalle que deseas manejar en tus productos
        </p>
      </header>

      <div className="inventory-config-content">
        <div className="mode-cards-grid">
          {/* Comprehensive Mode */}
          <div 
            className={`mode-card ${mode === "comprehensive" ? "active" : ""}`}
            onClick={() => handleSave("comprehensive")}
          >
            <div className="mode-card-icon comprehensive">
              <span className="material-symbols-outlined">inventory_2</span>
            </div>
            <div className="mode-card-info">
              <h3 className="mode-card-title">Modo Completo</h3>
              <p className="mode-card-description">
                Control total de tu inventario. Maneja precios de costo, mayoreo, 
                stock mínimo y alertas de inventario bajo.
              </p>
              <ul className="mode-card-features">
                <li><span className="material-symbols-outlined">check_circle</span> Precio de Costo</li>
                <li><span className="material-symbols-outlined">check_circle</span> Precio de Mayoreo</li>
                <li><span className="material-symbols-outlined">check_circle</span> Stock Mínimo y Alertas</li>
                <li><span className="material-symbols-outlined">check_circle</span> Control de Mermas</li>
              </ul>
            </div>
            {mode === "comprehensive" && (
              <div className="mode-selected-badge">
                <span className="material-symbols-outlined">check</span>
                Seleccionado
              </div>
            )}
          </div>

          {/* Simplified Mode */}
          <div 
            className={`mode-card ${mode === "simplified" ? "active" : ""}`}
            onClick={() => handleSave("simplified")}
          >
            <div className="mode-card-icon simplified">
              <span className="material-symbols-outlined">shopping_basket</span>
            </div>
            <div className="mode-card-info">
              <h3 className="mode-card-title">Modo Simplificado</h3>
              <p className="mode-card-description">
                Ideal para quienes solo necesitan saber qué hay en stock y a qué 
                precio se vende. Interfaz más limpia y rápida.
              </p>
              <ul className="mode-card-features">
                <li><span className="material-symbols-outlined">check_circle</span> Precio de Venta</li>
                <li><span className="material-symbols-outlined">check_circle</span> Existencia actual</li>
                <li><span className="material-symbols-outlined">block</span> Sin campos de costo</li>
                <li><span className="material-symbols-outlined">block</span> Sin mayoreo ni mínimos</li>
              </ul>
            </div>
            {mode === "simplified" && (
              <div className="mode-selected-badge">
                <span className="material-symbols-outlined">check</span>
                Seleccionado
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="config-loading-overlay">
            <div className="spinner"></div>
            <p>Guardando cambios...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryConfig;
