import React from "react";

export const QuickActions = ({
  isSupervising,
  onOpenComun,
  onOpenSalida,
  onOpenEntrada,
  setMostrarCameraScanner,
  toggleScannerMode,
  isScannerAvailable,
  scannerMode,
}) => {
  return (
    <div className="flex gap-3 mb-4 flex-wrap">
      <button
        onClick={() => !isSupervising && onOpenComun()}
        disabled={isSupervising}
        className={`flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors font-medium text-sm flex-1 md:flex-none justify-center border border-slate-200 dark:border-slate-700 shadow-sm ${
          isSupervising ? "opacity-50 cursor-not-allowed" : ""
        }`}
        title="Agregar un producto sin registro"
      >
        <span className="material-symbols-outlined text-[18px]">add_box</span>
        <span>Producto común</span>
      </button>
      <button
        onClick={() => !isSupervising && onOpenSalida()}
        disabled={isSupervising}
        className={`flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl transition-colors font-medium text-sm flex-1 md:flex-none justify-center border border-rose-200 dark:border-rose-800 shadow-sm ${
          isSupervising ? "opacity-50 cursor-not-allowed" : ""
        }`}
        title="Registrar salida de dinero (Gasto)"
      >
        <span className="material-symbols-outlined text-[18px]">output</span>
        <span>Salida</span>
      </button>
      <button
        onClick={() => !isSupervising && onOpenEntrada()}
        disabled={isSupervising}
        className={`flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl transition-colors font-medium text-sm flex-1 md:flex-none justify-center border border-emerald-200 dark:border-emerald-800 shadow-sm ${
          isSupervising ? "opacity-50 cursor-not-allowed" : ""
        }`}
        title="Registrar entrada de dinero manual"
      >
        <span className="material-symbols-outlined text-[18px]">input</span>
        <span>Entrada</span>
      </button>
      <button
        onClick={() => setMostrarCameraScanner(true)}
        className={`quick-action-btn camera-btn ${
          isSupervising ? "opacity-50 cursor-not-allowed" : ""
        }`}
        disabled={isSupervising}
        type="button"
        title="Escanear código con cámara"
      >
        📷 Cámara
      </button>
      {isScannerAvailable && (
        <button
          onClick={toggleScannerMode}
          className={`quick-action-btn scanner-btn ${scannerMode ? 'active' : ''}`}
          type="button"
          title={
            scannerMode
              ? "Desactivar modo escáner"
              : "Activar modo escáner de código de barras"
          }
        >
          📡 {scannerMode ? "Teclado" : "Escáner BT"}
        </button>
      )}
    </div>
  );
};
