import React from "react";

const SearchSection = ({
  searchContainerRef,
  campoCodigoRef,
  scannerInputMode,
  scannerMode,
  codigoEscaneado,
  manejarCambioCodigo,
  manejarEnter,
  isSupervising,
  children
}) => {
  return (
    <div
      ref={searchContainerRef}
      className="search-section-modern"
      style={{ position: "relative", zIndex: 50 }}
    >
      <div className="search-bar-full-row">
        <div className="search-input-full">
          <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 flex-shrink-0">search</span>
          <input
            ref={campoCodigoRef}
            type="text"
            enterKeyHint="search"
            inputMode={scannerInputMode}
            placeholder={
              scannerMode
                ? "Escáner activo - escanee un código de barras..."
                : "Buscar producto o escanea código de barras..."
            }
            value={codigoEscaneado}
            onChange={manejarCambioCodigo}
            onKeyDown={manejarEnter}
            disabled={isSupervising}
            className={`barcode-input-modern ${
              scannerMode ? "scanner-mode-active" : ""
            } ${isSupervising ? "opacity-50 cursor-not-allowed" : ""}`}
            autoFocus
          />
          <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 flex-shrink-0 cursor-pointer hover:text-slate-600 dark:hover:text-slate-400" title="Atajos de teclado">keyboard_alt</span>
        </div>
      </div>

      <div className="search-shortcut-hints-inline">
        <div className="hint-pill">
          <kbd>F2</kbd> VARIOS
        </div>
        <div className="hint-pill">
          <kbd>F4</kbd> EMPACAR
        </div>
        <div className="hint-pill">
          <kbd>F12</kbd> COBRAR
        </div>
      </div>

      {children}
    </div>
  );
};

export default SearchSection;
