import React, { useState, useEffect, useRef } from 'react';

const ProductAddModal = ({ product, onClose, onAdd, formatearDinero, hasBoxConfig, sellByBoxOnly = false, boxUnits, boxPrice }) => {
  const [pzaQty, setPzaQty] = useState(sellByBoxOnly ? 0 : 1);
  const [cajaQty, setCajaQty] = useState(sellByBoxOnly && hasBoxConfig ? 1 : 0);
  const [focusSection, setFocusSection] = useState(sellByBoxOnly && hasBoxConfig ? 'caja' : 'pza');
  const [pzaPrice, setPzaPrice] = useState(() => parseFloat(product.price || 0));
  const [cajaPrice, setCajaPrice] = useState(() => boxPrice ? parseFloat(boxPrice) : 0);
  const [pzaPriceManuallyEdited, setPzaPriceManuallyEdited] = useState(false);
  const [cajaPriceManuallyEdited, setCajaPriceManuallyEdited] = useState(false);
  
  const pzaInputRef = useRef(null);
  const cajaInputRef = useRef(null);
  const addBtnRef = useRef(null);

  const defaultPPrice = parseFloat(product.price || 0);
  const defaultCPrice = boxPrice ? parseFloat(boxPrice) : 0;
  
  const pQtyNum = parseFloat(pzaQty) || 0;
  const cQtyNum = parseFloat(cajaQty) || 0;
  
  const pzaPriceOverridden = pzaPriceManuallyEdited;
  const cajaPriceOverridden = cajaPriceManuallyEdited;
  
  const pzaSubtotal = pQtyNum * pzaPrice;
  const cajaSubtotal = cQtyNum * cajaPrice;
  const totalAmount = pzaSubtotal + cajaSubtotal;
  
  const stock = parseFloat(product.stock || 0);
  const bUnits = parseInt(boxUnits || 0);
  const maxCajas = bUnits > 0 ? Math.floor(stock / bUnits) : 0;
  
  const totalRequestedPieces = pQtyNum + (cQtyNum * (bUnits || 0));
  const isOverStock = totalRequestedPieces > stock;

  const getAutomaticPrice = (totalQty) => {
    const basePrice = parseFloat(product.price || 0);
    const specialFrom = parseFloat(product.special_from_qty || 0);
    const wholesaleFrom = parseFloat(product.wholesale_from_qty || 0);
    const specialPrice = parseFloat(product.special_price || 0);
    const wholesalePrice = parseFloat(product.wholesale_price || 0);

    if (specialFrom > 0 && totalQty >= specialFrom && specialPrice > 0) {
      return { price: specialPrice, label: 'Especial' };
    }
    if (wholesaleFrom > 0 && totalQty >= wholesaleFrom && wholesalePrice > 0) {
      return { price: wholesalePrice, label: 'Mayoreo' };
    }
    return { price: basePrice, label: 'Menudeo' };
  };

  const autoPriceTier = getAutomaticPrice(totalRequestedPieces);

  const getAutomaticBoxPrice = (boxQty) => {
    const baseBoxPrice = parseFloat(boxPrice || product.box_price || 0);
    const specialBoxPrice = parseFloat(product.box_special_price || 0);
    const specialBoxFrom = parseFloat(product.box_special_from_qty || 0);
    const qty = parseFloat(boxQty || 0) || 0;

    if (specialBoxFrom > 0 && qty >= specialBoxFrom && specialBoxPrice > 0) {
      return { price: specialBoxPrice, label: 'Caja especial' };
    }

    if (baseBoxPrice > 0) {
      return { price: baseBoxPrice, label: 'Caja' };
    }

    return { price: autoPriceTier.price * (bUnits || 1), label: autoPriceTier.label };
  };

  const autoBoxPriceTier = getAutomaticBoxPrice(cQtyNum);

  useEffect(() => {
    const totalPzs = pQtyNum + (cQtyNum * (bUnits || 0));
    const auto = getAutomaticPrice(totalPzs);
    
    if (!pzaPriceManuallyEdited) {
      setPzaPrice(auto.price);
    }
    
    if (!cajaPriceManuallyEdited) {
      setCajaPrice(getAutomaticBoxPrice(cQtyNum).price);
    }
  }, [pQtyNum, cQtyNum, bUnits, boxPrice, pzaPriceManuallyEdited, cajaPriceManuallyEdited]);

  const isArrowNav = useRef(true); 

  useEffect(() => {
    if (isArrowNav.current) {
      if (focusSection === 'pza') {
        pzaInputRef.current?.focus();
        pzaInputRef.current?.select();
      } else if (focusSection === 'caja') {
        cajaInputRef.current?.focus();
        cajaInputRef.current?.select();
      } else if (focusSection === 'actions') {
        addBtnRef.current?.focus();
      }
      isArrowNav.current = false;
    }
  }, [focusSection]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (e.key === '+' || e.code === 'NumpadAdd') {
      e.preventDefault();
      if (focusSection === 'pza') setPzaQty(q => (parseFloat(q) || 0) + 1);
      else if (focusSection === 'caja') setCajaQty(q => (parseFloat(q) || 0) + 1);
      return;
    }

    if (e.key === '-' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      if (focusSection === 'pza') setPzaQty(q => Math.max(0, (parseFloat(q) || 0) - 1));
      else if (focusSection === 'caja') setCajaQty(q => Math.max(0, (parseFloat(q) || 0) - 1));
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      isArrowNav.current = true;
      if (focusSection === 'pza') {
        if (hasBoxConfig) setFocusSection('caja');
        else setFocusSection('actions');
      } else if (focusSection === 'caja') {
        setFocusSection('actions');
      } else if (focusSection === 'actions') {
        setFocusSection(sellByBoxOnly && hasBoxConfig ? 'caja' : 'pza');
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      isArrowNav.current = true;
      if (focusSection === 'pza') {
        setFocusSection('actions');
      } else if (focusSection === 'caja') {
        setFocusSection(sellByBoxOnly ? 'actions' : 'pza');
      } else if (focusSection === 'actions') {
        if (hasBoxConfig) setFocusSection('caja');
        else setFocusSection('pza');
      }
      return;
    }

    if (e.key === 'Enter') {
      e.stopPropagation();
      if (e.target.tagName === 'BUTTON') {
        return;
      }

      if (pQtyNum > 0 || cQtyNum > 0) {
        e.preventDefault();
        onAdd(
          pQtyNum,
          cQtyNum,
          pzaPrice,
          cajaPriceManuallyEdited ? cajaPrice : undefined,
        );
      }
    }
  };

  const stockText = stock > 0
    ? `${stock} ${stock === 1 ? 'pza' : 'pzas'}${maxCajas > 0 ? ` (${maxCajas} cajas)` : ''}`
    : 'Agotado';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onKeyDown={handleKeyDown}>
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-gray-100 dark:border-slate-700">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{product.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <p className={`text-sm ${stock <= 0 ? 'text-red-500 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                  {stockText}
                </p>
                {stock > 0 && (
                  <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    Precio: {autoPriceTier.label}
                  </span>
                )}
              </div>
            </div>
            {isOverStock && (
              <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                Excede Stock
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">

          {/* PZA Section */}
          {!sellByBoxOnly && (
          <div 
            className={`bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border transition-colors cursor-pointer ${
              focusSection === 'pza' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200 dark:border-slate-700'
            }`}
            onClick={() => setFocusSection('pza')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Piezas</span>
              <div className="flex items-center gap-2">
                <div className={`flex items-center bg-white dark:bg-slate-900 border rounded-lg transition-all shadow-sm ${
                  pzaPriceOverridden
                    ? 'border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/30 focus-within:border-orange-500'
                    : 'border-gray-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500'
                }`}>
                  <span className={`pl-2.5 text-sm font-bold ${pzaPriceOverridden ? 'text-orange-500' : 'text-gray-400'}`}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className={`w-20 py-1.5 pr-2.5 text-right text-sm font-bold outline-none border-none focus:ring-0 bg-transparent ${
                      pzaPriceOverridden
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                    value={pzaPrice}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val >= 0) {
                        setPzaPrice(val);
                        setPzaPriceManuallyEdited(true);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">c/u</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 font-bold text-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-40"
                  disabled={pQtyNum <= 0}
                  onClick={(e) => { e.stopPropagation(); setPzaQty(q => Math.max(0, (parseFloat(q) || 0) - 1)); }}
                  onFocus={() => setFocusSection('pza')}
                >
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <input
                  ref={pzaInputRef}
                  type="number"
                  className="w-16 text-center font-bold text-xl bg-transparent border-none focus:outline-none text-gray-900 dark:text-white"
                  value={pzaQty}
                  onChange={(e) => setPzaQty(e.target.value)}
                  onFocus={() => setFocusSection('pza')}
                  min="0"
                />
                <button
                  type="button"
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 font-bold text-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-40"
                  onClick={(e) => { e.stopPropagation(); setPzaQty(q => (parseFloat(q) || 0) + 1); }}
                  onFocus={() => setFocusSection('pza')}
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
              <span className="font-bold text-gray-900 dark:text-white">{formatearDinero(pzaSubtotal)}</span>
            </div>
          </div>
          )}

          {/* CAJA Section */}
          {hasBoxConfig && (
            <div 
              className={`bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border transition-colors cursor-pointer ${
                focusSection === 'caja' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-gray-200 dark:border-slate-700'
              }`}
              onClick={() => setFocusSection('caja')}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Cajas</span>
                  <p className="text-xs text-gray-400 mt-0.5">1 caja = {bUnits} piezas</p>
                  {cQtyNum > 0 && autoBoxPriceTier.label === 'Caja especial' && !cajaPriceManuallyEdited && (
                    <p className="text-[11px] font-bold text-emerald-600 mt-1">
                      Precio especial aplicado
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center bg-white dark:bg-slate-900 border rounded-lg transition-all shadow-sm ${
                    cajaPriceOverridden
                      ? 'border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/30 focus-within:border-orange-500'
                      : 'border-gray-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500'
                  }`}>
                    <span className={`pl-2.5 text-sm font-bold ${cajaPriceOverridden ? 'text-orange-500' : 'text-gray-400'}`}>$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className={`w-20 py-1.5 pr-2.5 text-right text-sm font-bold outline-none border-none focus:ring-0 bg-transparent ${
                        cajaPriceOverridden
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                      value={cajaPrice}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          setCajaPrice(val);
                          setCajaPriceManuallyEdited(true);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">/ caja</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 font-bold text-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-40"
                    disabled={cQtyNum <= 0}
                    onClick={(e) => { e.stopPropagation(); setCajaQty(q => Math.max(0, (parseFloat(q) || 0) - 1)); }}
                    onFocus={() => setFocusSection('caja')}
                  >
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <input
                    ref={cajaInputRef}
                    type="number"
                    className="w-16 text-center font-bold text-xl bg-transparent border-none focus:outline-none text-gray-900 dark:text-white"
                    value={cajaQty}
                    onChange={(e) => setCajaQty(e.target.value)}
                    onFocus={() => setFocusSection('caja')}
                    min="0"
                  />
                  <button
                    type="button"
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-200 font-bold text-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-40"
                    onClick={(e) => { e.stopPropagation(); setCajaQty(q => (parseFloat(q) || 0) + 1); }}
                    onFocus={() => setFocusSection('caja')}
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">{formatearDinero(cajaSubtotal)}</span>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-slate-700">
            <span className="font-bold text-gray-800 dark:text-gray-200">Total</span>
            <span className="text-2xl font-black text-gray-900 dark:text-white">{formatearDinero(totalAmount)}</span>
          </div>
          
          {isOverStock && (
            <p className="text-xs text-amber-600 font-medium text-center bg-amber-50 dark:bg-amber-900/20 py-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
              Atención: La cantidad seleccionada supera el stock disponible ({stock} pzas).
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            onFocus={() => setFocusSection('actions')}
            className="flex-1 py-3 bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
          >
            Cancelar
          </button>
          <button
            ref={addBtnRef}
            type="button"
            onClick={() => onAdd(
              parseFloat(pzaQty) || 0,
              parseFloat(cajaQty) || 0,
              pzaPrice,
              cajaPriceManuallyEdited ? cajaPrice : undefined,
            )}
            disabled={(parseFloat(pzaQty) || 0) === 0 && (parseFloat(cajaQty) || 0) === 0}
            onFocus={() => setFocusSection('actions')}
            className={`flex-[2] py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none ${
              focusSection === 'actions' ? 'ring-4 ring-blue-500/50' : ''
            }`}
          >
            <span className="material-symbols-outlined">add_shopping_cart</span>
            Agregar al carrito
          </button>
        </div>

      </div>
    </div>
  );
};

export default ProductAddModal;
