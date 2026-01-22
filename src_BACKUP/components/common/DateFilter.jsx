import React from 'react'

// Componente reutilizable para filtros de fecha
const DateFilter = ({
    fechaDesde,
    fechaHasta,
    onFechaDesdeChange,
    onFechaHastaChange,
    onLimpiar,
    onBuscar,
    showButtons = true,
    showClearButton = true,
    className = '',
    layout = 'horizontal' // 'horizontal' o 'vertical'
}) => {
    return (
        <div className={`date-filter-component ${className}`}>
            <div className={`date-inputs ${layout === 'vertical' ? 'vertical' : 'horizontal'}`}>
                <div className="input-group flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Desde:</label>
                    <div className="relative">
                        <input
                            type="date"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-slate-500 outline-none transition-all text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                            value={fechaDesde}
                            min="2020-01-01"
                            max="2030-12-31"
                            onChange={(e) => onFechaDesdeChange(e.target.value)}
                        />
                    </div>
                </div>
                <div className="input-group flex-1 min-w-[150px]">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Hasta:</label>
                    <div className="relative">
                        <input
                            type="date"
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-slate-500 outline-none transition-all text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                            value={fechaHasta}
                            min="2020-01-01"
                            max="2030-12-31"
                            onChange={(e) => onFechaHastaChange(e.target.value)}
                        />
                    </div>
                </div>
            </div>
            {showButtons && (
                <div className="date-buttons">
                    {onBuscar && (
                        <button
                            onClick={onBuscar}
                            className="search-btn"
                            disabled={!fechaDesde && !fechaHasta}
                        >
                            Buscar
                        </button>
                    )}
                    {showClearButton && onLimpiar && (fechaDesde || fechaHasta) && (
                        <button
                            onClick={onLimpiar}
                            className="clear-btn"
                        >
                            Limpiar
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

export default DateFilter