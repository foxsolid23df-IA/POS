import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useProducts } from "../../contexts/ProductContext";
import { terminalService } from "../../services/terminalService";

export const SalesHeader = ({ onOpenReportModal }) => {
  const { user, cashSession, activeStaff, closeCashSession } = useAuth();
  const { loading: loadingProducts, loadProducts: cargarDatos } = useProducts();
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));

  useEffect(() => {
    // Initial check
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    const newIsDark = document.documentElement.classList.contains("dark");
    setIsDark(newIsDark);
    localStorage.setItem("theme", newIsDark ? "dark" : "light");
  };

  const handleCloseRegister = async () => {
    if (window.confirm("¿Estás seguro de que deseas CERRAR LA CAJA y terminar el turno?")) {
      try {
        await closeCashSession();
      } catch (error) {
        console.error("Error al cerrar caja:", error);
        alert("Ocurrió un error al intentar cerrar la caja.");
      }
    }
  };

  return (
    <div className="sales-area-header">
      <div className="flex flex-row justify-between items-center w-full gap-4 flex-nowrap px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm rounded-xl mb-2">
        {/* Left: Title & User */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-lg">store</span>
            <h1 className="font-bold text-slate-800 dark:text-slate-100 text-sm tracking-tight uppercase">
              {user?.store_name || "NEXUM POS"}
            </h1>
          </div>
          
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">
              {activeStaff?.name || user?.full_name || "Usuario"}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md font-bold uppercase">
              {activeStaff?.role || "Admin"}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto scrollbar-hide flex-shrink-0">
          <button
            onClick={() => {
              const terminalId = terminalService.getTerminalId();
              const url = `${window.location.origin}${window.location.pathname}#/customer-display?u=${user?.id}&s=${cashSession?.id}&t=${terminalId || ""}&te=${user?.tax_enabled !== false}`;
              window.open(url, "_blank", "width=1024,height=768");
            }}
            className="header-action-btn monitor flex-shrink-0"
            title="Pantalla del Cliente"
          >
            <span className="material-symbols-outlined">monitor</span>
          </button>

          <button
            onClick={() => cargarDatos(true)}
            disabled={loadingProducts}
            className={`header-action-btn refresh flex-shrink-0 ${loadingProducts ? 'loading' : ''}`}
            title="Recargar Productos"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>

          <button
            onClick={toggleTheme}
            className="header-action-btn theme-toggle flex-shrink-0"
            title="Modo Oscuro"
          >
            <span className="material-symbols-outlined">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>

          <button
            onClick={onOpenReportModal}
            className="header-action-btn report flex-shrink-0"
            title="Ver Reporte (F7)"
          >
            <span className="material-symbols-outlined">analytics</span>
            <span className="hidden lg:inline text-[10px] font-bold">REPORTE</span>
          </button>

          {cashSession && (
            <button
              onClick={handleCloseRegister}
              className="header-action-btn close-register flex-shrink-0"
              title="Cerrar Caja"
            >
              <span className="material-symbols-outlined">lock</span>
              <span className="hidden lg:inline text-[10px] font-bold">CERRAR CAJA</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
