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
          <span className="search-lupa">🔍</span>
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
        </div>
      </div>

      <div className="search-shortcut-hints-inline">
        <div className="hint-pill">
          <kbd>F2</kbd> Varios
        </div>
        <div className="hint-pill">
          <kbd>F4</kbd> Empacar
        </div>
        <div className="hint-pill">
          <kbd>F12</kbd> Cobrar
        </div>
      </div>

      {children}
    </div>
  );
};

export default SearchSection;
