import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabase";
import { productService } from "../../services/productService";
import Swal from "sweetalert2";
import "./InventoryConfig.css";

const InventoryConfig = () => {
  const { user, fetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [wiping, setWiping] = useState(false);
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

  // =====================================================
  // BORRADO TOTAL DE INVENTARIO — Flujo de confirmación
  // =====================================================
  const handleWipeInventory = async () => {
    // Paso 1: Primera alerta informativa
    const firstConfirm = await Swal.fire({
      icon: "warning",
      title: "⚠️ Borrar Todo el Inventario",
      html: `
        <div style="text-align:left; font-size:0.95rem; line-height:1.7; color:#7f1d1d;">
          <p style="margin-bottom:0.75rem;">Estás a punto de <strong>eliminar permanentemente</strong> todos los productos de tu tienda.</p>
          <p style="margin-bottom:0.75rem;">📌 Esta acción <strong>NO</strong> se puede deshacer.</p>
          <p style="margin-bottom:0.75rem;">📌 Tu historial de ventas <strong>NO</strong> se verá afectado.</p>
          <p>📌 Solo se eliminan productos de <strong>tu tienda</strong>.</p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Continuar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!firstConfirm.isConfirmed) return;

    // Paso 2: Confirmación con la palabra "BORRAR"
    const { value: confirmText } = await Swal.fire({
      icon: "error",
      title: "Confirmación Final",
      html: `
        <p style="font-size:0.95rem; color:#7f1d1d; margin-bottom:1rem;">
          Para confirmar el borrado total, escribe la palabra <strong style="color:#dc2626; font-size:1.1rem;">BORRAR</strong> en el campo de abajo:
        </p>
      `,
      input: "text",
      inputPlaceholder: "Escribe BORRAR aquí...",
      inputAttributes: {
        autocapitalize: "characters",
        autocomplete: "off",
        style: "text-align:center; font-size:1.1rem; font-weight:700; letter-spacing:0.1em;",
      },
      showCancelButton: true,
      confirmButtonText: "Borrar Inventario Completo",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#b91c1c",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      inputValidator: (value) => {
        if (!value || value.trim().toUpperCase() !== "BORRAR") {
          return "Debes escribir la palabra BORRAR para continuar.";
        }
      },
    });

    if (!confirmText) return;

    // Paso 3: Ejecutar el borrado
    try {
      setWiping(true);

      const result = await productService.deleteAllProducts();

      setWiping(false);

      await Swal.fire({
        icon: "success",
        title: "Inventario Eliminado",
        html: `
          <p style="font-size:1rem; line-height:1.7;">
            Se eliminaron <strong>${result.deletedCount}</strong> producto${result.deletedCount !== 1 ? "s" : ""} exitosamente.
          </p>
          <p style="font-size:0.9rem; color:#64748b; margin-top:0.5rem;">
            Ya puedes subir un nuevo catálogo desde la sección de inventario.
          </p>
        `,
        confirmButtonText: "Entendido",
        confirmButtonColor: "#16a34a",
      });
    } catch (error) {
      setWiping(false);
      console.error("Error en borrado total:", error);
      Swal.fire({
        icon: "error",
        title: "Error al borrar",
        text: error.message || "Ocurrió un error inesperado. Intenta de nuevo.",
        confirmButtonColor: "#dc2626",
      });
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

        {/* ========================================
            ZONA DE PELIGRO — Borrado Total
        ======================================== */}
        <section className="danger-zone-section">
          <div className="danger-zone-card">
            <div className="danger-zone-header">
              <div className="danger-zone-icon">
                <span className="material-symbols-outlined">delete_forever</span>
              </div>
              <div>
                <h2 className="danger-zone-title">Zona de Peligro</h2>
                <p className="danger-zone-subtitle">Acciones irreversibles sobre tu inventario</p>
              </div>
            </div>

            <div className="danger-zone-body">
              <p className="danger-zone-description">
                Si necesitas reemplazar tu catálogo completo, puedes eliminar <strong>todos los productos</strong> de 
                tu tienda de una sola vez. Esto te permitirá subir un nuevo inventario limpio desde Excel sin 
                duplicados ni errores de encimamiento.
              </p>

              <ul className="danger-zone-info-list">
                <li>
                  <span className="material-symbols-outlined">info</span>
                  Solo se eliminan los productos de <strong>tu tienda</strong>. No afecta a otros negocios.
                </li>
                <li>
                  <span className="material-symbols-outlined">info</span>
                  Tu historial de ventas y reportes se mantienen intactos.
                </li>
                <li>
                  <span className="material-symbols-outlined">warning</span>
                  Esta acción es <strong>permanente</strong> y no se puede deshacer.
                </li>
              </ul>

              <div className="danger-zone-actions">
                <button
                  className="btn-danger-wipe"
                  onClick={handleWipeInventory}
                  disabled={wiping || loading}
                >
                  <span className="material-symbols-outlined">delete_forever</span>
                  Borrar Todo el Inventario
                </button>
                <span className="danger-zone-note">
                  Se te pedirá confirmación antes de proceder.
                </span>
              </div>
            </div>
          </div>
        </section>

        {loading && (
          <div className="config-loading-overlay">
            <div className="spinner"></div>
            <p>Guardando cambios...</p>
          </div>
        )}

        {wiping && (
          <div className="wipe-loading-overlay">
            <div className="wipe-loading-content">
              <div className="wipe-spinner"></div>
              <h3>Eliminando inventario...</h3>
              <p>Por favor, no cierres esta ventana.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryConfig;
