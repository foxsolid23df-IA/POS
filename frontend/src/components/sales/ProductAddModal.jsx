import React, { useState, useEffect, useRef } from 'react';

const ProductAddModal = ({ product, onClose, onAdd, formatearDinero, hasBoxConfig, boxUnits, boxPrice }) => {
  const [pzaQty, setPzaQty] = useState(1);
  const [cajaQty, setCajaQty] = useState(0);
  const [focusSection, setFocusSection] = useState('pza');
  
  const pzaInputRef = useRef(null);
  const cajaInputRef = useRef(null);
  const addBtnRef = useRef(null);

  const pPrice = parseFloat(product.price || 0);
  const cPrice = boxPrice ? parseFloat(boxPrice) : 0;
  
  const pQtyNum = parseFloat(pzaQty) || 0;
  const cQtyNum = parseFloat(cajaQty) || 0;
  
  const pzaSubtotal = pQtyNum * pPrice;
  const cajaSubtotal = cQtyNum * cPrice;
  const totalAmount = pzaSubtotal + cajaSubtotal;
  
  const stock = parseFloat(product.stock || 0);
  const bUnits = parseInt(boxUnits || 0);
  const maxCajas = bUnits > 0 ? Math.floor(stock / bUnits) : 0;
  
  const totalRequestedPieces = pQtyNum + (cQtyNum * (bUnits || 0));
  const isOverStock = totalRequestedPieces > stock;

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
        setFocusSection('pza');
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      isArrowNav.current = true;
      if (focusSection === 'pza') {
        setFocusSection('actions');
      } else if (focusSection === 'caja') {
        setFocusSection('pza');
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
        onAdd(pQtyNum, cQtyNum);
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
              <p className={`text-sm mt-1 ${stock <= 0 ? 'text-red-500 font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                {stockText}
              </p>
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
          <div 
            className={`bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border transition-colors cursor-pointer ${
              focusSection === 'pza' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200 dark:border-slate-700'
            }`}
            onClick={() => setFocusSection('pza')}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Piezas</span>
              <span className="text-xs text-gray-400">{formatearDinero(pPrice)} c/u</span>
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
                </div>
                <span className="text-xs text-gray-400">{formatearDinero(cPrice)} / caja</span>
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
            onClick={() => onAdd(parseFloat(pzaQty) || 0, parseFloat(cajaQty) || 0)}
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
