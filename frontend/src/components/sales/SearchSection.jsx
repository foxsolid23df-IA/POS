import React from "react";

const SearchSection = ({
  searchContainerRef,
  campoSkuRef,
  campoNombreRef,
  scannerInputMode,
  scannerMode,
  codigoSku,
  codigoNombre,
  manejarCambioSku,
  manejarCambioNombre,
  manejarEnterSku,
  manejarEnterNombre,
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
        <div className="search-input-full search-input-dual">
          <div className="search-input-half search-input-sku">
            <input
              ref={campoSkuRef}
              type="text"
              enterKeyHint="search"
              inputMode={scannerInputMode}
              placeholder={scannerMode ? "Escáner activo..." : "Clave / SKU..."}
              value={codigoSku}
              onChange={manejarCambioSku}
              onKeyDown={manejarEnterSku}
              disabled={isSupervising}
              className={`barcode-input-modern barcode-input-half ${
                scannerMode ? "scanner-mode-active" : ""
              } ${isSupervising ? "opacity-50 cursor-not-allowed" : ""}`}
              autoFocus
            />
          </div>
          <div className="search-input-divider" />
          <div className="search-input-half search-input-name">
            <span className="material-symbols-outlined search-input-icon">description</span>
            <input
              ref={campoNombreRef}
              type="text"
              enterKeyHint="search"
              placeholder="Nombre del producto..."
              value={codigoNombre}
              onChange={manejarCambioNombre}
              onKeyDown={manejarEnterNombre}
              disabled={isSupervising}
              className={`barcode-input-modern barcode-input-half ${
                isSupervising ? "opacity-50 cursor-not-allowed" : ""
              }`}
            />
          </div>
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
