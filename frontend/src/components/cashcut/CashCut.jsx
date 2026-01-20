import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { cashCutService } from '../../services/cashCutService';
import { salesService } from '../../services/salesService';
import Swal from 'sweetalert2';
import './CashCut.css';

export const CashCut = ({ onClose }) => {
    const { activeStaff, activeRole, lockScreen, storeName, closeCashSession, cashSession } = useAuth();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [salesDetails, setSalesDetails] = useState([]);
    const [actualCash, setActualCash] = useState('');
    const [notes, setNotes] = useState('');
    const [cutType, setCutType] = useState('turno');
    const [submitting, setSubmitting] = useState(false);
    const [showTicket, setShowTicket] = useState(false);
    const [cutResult, setCutResult] = useState(null);

    const ticketRef = useRef(null);

    useEffect(() => {
        loadSummary();
    }, []);

    const loadSummary = async () => {
        try {
            setLoading(true);
            const data = await cashCutService.getCurrentShiftSummary();
            setSummary(data);
            setSalesDetails(data.sales || []);
            setActualCash(data.salesTotal.toFixed(2));
        } catch (error) {
            console.error('Error cargando resumen:', error);
            Swal.fire('Error', 'No se pudo cargar el resumen del turno', 'error');
        } finally {
            setLoading(false);
        }
    };

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount);
    };

    const formatTime = (dateString) => {
        return new Date(dateString).toLocaleString('es-MX', {
            dateStyle: 'short',
            timeStyle: 'short'
        });
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('es-MX', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const handleSubmit = async () => {
        if (submitting) return;

        const result = await Swal.fire({
            title: cutType === 'dia' ? '¿Cerrar el día?' : '¿Cerrar turno?',
            html: `
                <p><strong>Fondo Inicial:</strong> ${formatMoney(parseFloat(cashSession?.opening_fund) || 0)}</p>
                <p><strong>Ventas:</strong> ${summary.salesCount}</p>
                <p><strong>Total en Caja Esperado:</strong> ${formatMoney(summary.salesTotal + (parseFloat(cashSession?.opening_fund) || 0))}</p>
                <p><strong>Efectivo contado:</strong> ${formatMoney(parseFloat(actualCash) || 0)}</p>
                <p><strong>Diferencia:</strong> ${formatMoney((parseFloat(actualCash) || 0) - (summary.salesTotal + (parseFloat(cashSession?.opening_fund) || 0)))}</p>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar',
            cancelButtonText: 'Cancelar'
        });

        if (!result.isConfirmed) return;

        setSubmitting(true);

        try {
            const cutData = {
                staffName: activeStaff?.name || 'Desconocido',
                staffRole: activeRole,
                cutType,
                startTime: summary.startTime,
                salesCount: summary.salesCount,
                salesTotal: summary.salesTotal,
                expectedCash: summary.salesTotal + (parseFloat(cashSession?.opening_fund) || 0),
                actualCash: parseFloat(actualCash) || null,
                notes
            };

            const savedCut = await cashCutService.createCashCut(cutData);

            // Guardar resultado para el ticket
            setCutResult({
                ...savedCut,
                ...cutData,
                endTime: new Date().toISOString(),
                difference: (parseFloat(actualCash) || 0) - (summary.salesTotal + (parseFloat(cashSession?.opening_fund) || 0))
            });

            // Mostrar ticket antes de bloquear
            setShowTicket(true);

        } catch (error) {
            console.error('Error al crear corte:', error);
            Swal.fire('Error', 'No se pudo realizar el corte', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePrint = () => {
        if (!ticketRef.current) return;

        const printWindow = window.open('', '', 'width=400,height=600');
        printWindow.document.write('<html><head><title>Corte de Caja</title>');
        printWindow.document.write(`
            <style>
                body { 
                    font-family: 'Courier New', monospace; 
                    padding: 10px; 
                    max-width: 300px;
                    margin: 0 auto;
                    font-size: 11px;
                }
                .ticket-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; }
                .store-name { font-size: 16px; font-weight: bold; }
                .ticket-title { font-size: 13px; margin-top: 5px; }
                .section { margin: 10px 0; padding: 10px 0; border-bottom: 1px dashed #000; }
                .row { display: flex; justify-content: space-between; margin: 3px 0; }
                .label { color: #666; }
                .value { font-weight: bold; }
                .total-row { font-size: 13px; font-weight: bold; margin-top: 10px; }
                .sales-list { font-size: 10px; }
                .sale-item { padding: 8px 0; border-bottom: 1px dotted #999; margin-bottom: 5px; }
                .sale-header-row { background: #f0f0f0; padding: 3px 5px; margin-bottom: 3px; }
                .product-row { display: flex; justify-content: space-between; padding: 2px 0; padding-left: 10px; font-size: 10px; }
                .product-name { color: #333; }
                .product-price { font-weight: 500; }
                .sale-total-row { border-top: 1px solid #ccc; margin-top: 5px; padding-top: 5px; font-size: 11px; }
                .footer { text-align: center; margin-top: 15px; font-size: 10px; color: #666; }
                .difference-positive { color: green; }
                .difference-negative { color: red; }
            </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write(ticketRef.current.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    };

    const handleFinish = async () => {
        Swal.fire({
            title: '¡Corte realizado!',
            text: cutType === 'dia'
                ? 'El día ha sido cerrado exitosamente'
                : 'Tu turno ha sido cerrado exitosamente',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        // Cerrar la sesión de visualización de caja
        await closeCashSession();

        lockScreen();
        if (onClose) onClose();
    };

    // Cálculos en tiempo real para la UI
    const expectedTotalValue = (summary?.salesTotal || 0) + (parseFloat(cashSession?.opening_fund) || 0);
    const diffValue = (parseFloat(actualCash) || 0) - expectedTotalValue;

    // Efecto para recargar el resumen si cambia el tipo (proactivo por si el servicio se expande)
    useEffect(() => {
        loadSummary();
    }, [cutType]);

    if (loading && !summary) {
        return (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4 animate-pulse">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
                    <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">Cargando Resumen...</p>
                </div>
            </div>
        );
    }

    // Modal de Ticket
    if (showTicket && cutResult) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[1050] p-4">
                <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-300">
                    <div className="px-8 py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                                <span className="material-symbols-rounded text-emerald-600 dark:text-emerald-400">receipt_long</span>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Corte Exitoso</h2>
                        </div>
                        <button onClick={handleFinish} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </div>

                    <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 dark:bg-slate-950/20">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 font-mono text-sm" ref={ticketRef}>
                            <div className="text-center border-b-2 border-dashed border-slate-200 dark:border-slate-700 pb-6 mb-6">
                                <div className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tighter">{storeName || 'MI TIENDA'}</div>
                                <div className="text-[10px] mt-1 text-slate-500 font-sans uppercase tracking-[0.2em] font-bold">
                                    {cutType === 'dia' ? 'CIERRE FINAL DEL DÍA' : 'CORTE DE TURNO'}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-2 mb-6 text-slate-600 dark:text-slate-400 border-b border-dashed border-slate-200 dark:border-slate-700 pb-6">
                                <span>Fecha:</span> <span className="text-right font-bold text-slate-900 dark:text-white">{formatDate(cutResult.endTime)}</span>
                                <span>Hora:</span> <span className="text-right font-bold text-slate-900 dark:text-white">{new Date(cutResult.endTime).toLocaleTimeString('es-MX')}</span>
                                <span>Operador:</span> <span className="text-right font-bold text-slate-900 dark:text-white truncate ml-4">{cutResult.staffName}</span>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                                    <span className="text-xs uppercase font-bold text-slate-400">Fondo Inicial:</span>
                                    <span className="font-bold">{formatMoney(parseFloat(cashSession?.opening_fund) || 0)}</span>
                                </div>
                                <div className="flex justify-between items-center p-3">
                                    <span className="text-xs uppercase font-bold text-slate-400">Total Ventas ({cutResult.salesCount}):</span>
                                    <span className="font-bold">{formatMoney(cutResult.salesTotal)}</span>
                                </div>
                                <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                                    <span className="text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400">Total Esperado:</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{formatMoney(cutResult.expectedCash)}</span>
                                </div>
                            </div>

                            <div className="pt-4 border-t-2 border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                                <div className="flex justify-between text-slate-900 dark:text-white font-bold">
                                    <span>EFECTIVO CONTADO:</span>
                                    <span>{formatMoney(cutResult.actualCash || 0)}</span>
                                </div>
                                <div className={`flex justify-between font-black text-lg ${cutResult.difference === 0 ? 'text-slate-900 dark:text-white' : cutResult.difference > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                    <span>DIFERENCIA:</span>
                                    <span>{cutResult.difference === 0 ? 'CORRECTO' : formatMoney(cutResult.difference)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                        <button onClick={handleFinish} className="flex-1 py-4 px-6 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">
                            Cerrar
                        </button>
                        <button onClick={handlePrint} className="flex-[1.5] py-4 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                            <span className="material-symbols-rounded">print</span>
                            Imprimir Ticket
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
            <style>{`
                .material-symbols-rounded { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
            `}</style>
            
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[95vh] lg:max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-8 py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-2xl shadow-inner shadow-amber-200/50 dark:shadow-none">
                            <span className="material-symbols-rounded text-amber-600 dark:text-amber-400 text-3xl">savings</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">Cierre de Caja</h1>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Control de Efectivo</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-xl">
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                    {/* Selector de Tipo de Corte */}
                    <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl gap-1">
                        <button 
                            onClick={() => setCutType('turno')}
                            className={`flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition-all font-bold text-sm ${
                                cutType === 'turno' 
                                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span className="material-symbols-rounded">person</span>
                            Cierre de Turno
                        </button>
                        <button 
                            onClick={() => setCutType('dia')}
                            className={`flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition-all font-bold text-sm ${
                                cutType === 'dia' 
                                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span className="material-symbols-rounded">dark_mode</span>
                            Cierre del Día
                        </button>
                    </div>

                    {/* Resumen Section */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs">
                                <span className="material-symbols-rounded text-blue-500 text-lg">analytics</span>
                                Resumen del Período
                            </div>
                            <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                Inicio: {formatTime(summary?.startTime)}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">{summary?.salesCount || 0}</div>
                                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Ventas Realizadas</div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">{formatMoney(summary?.salesTotal || 0)}</div>
                                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Monto en Ventas</div>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">
                                    {formatMoney(parseFloat(cashSession?.opening_fund) || 0)}
                                </div>
                                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Fondo de Caja</div>
                            </div>
                            <div className="bg-emerald-500 p-5 rounded-2xl shadow-lg shadow-emerald-500/20">
                                <div className="text-2xl font-black text-white mb-1 leading-none">
                                    {formatMoney(expectedTotalValue)}
                                </div>
                                <div className="text-[9px] uppercase font-bold text-emerald-100 tracking-widest">Total Esperado</div>
                            </div>
                        </div>
                    </section>

                    {/* Efectivo en Caja Input */}
                    <section>
                        <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs mb-4">
                            <span className="material-symbols-rounded text-emerald-500">payments</span>
                            Efectivo en Caja (Contado)
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                                <span className="text-3xl font-black text-emerald-500 transition-all duration-300 group-focus-within:scale-120">$</span>
                            </div>
                            <input 
                                className="block w-full pl-14 pr-6 py-7 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-3xl text-4xl font-black text-slate-900 dark:text-white focus:ring-0 focus:border-emerald-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner"
                                placeholder="0.00" 
                                type="number"
                                step="0.01"
                                value={actualCash}
                                onChange={(e) => setActualCash(e.target.value)}
                            />
                        </div>
                    </section>

                    {/* Diferencia Display con feedback visual mejorado */}
                    <div className={`p-6 rounded-2xl border-2 flex items-center justify-between transition-all duration-500 ${
                        diffValue === 0 
                        ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20' 
                        : diffValue > 0 
                        ? 'bg-blue-50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/20'
                        : 'bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20'
                    }`}>
                        <div>
                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-1 ${
                                diffValue === 0 ? 'text-emerald-500' :
                                diffValue > 0 ? 'text-blue-500' :
                                'text-rose-500'
                            }`}>
                                Balance de Arqueo
                            </span>
                            <span className={`text-sm font-bold ${
                                diffValue === 0 ? 'text-emerald-700 dark:text-emerald-300' :
                                diffValue > 0 ? 'text-blue-700 dark:text-blue-300' :
                                'text-rose-700 dark:text-rose-300'
                            }`}>
                                {diffValue === 0 ? '✓ Los montos coinciden perfectamente' : 
                                 diffValue > 0 ? '⬆ Existe un sobrante en caja' : 
                                 '⬇ Existe un faltante en el arqueo'}
                            </span>
                        </div>
                        <span className={`text-4xl font-black tabular-nums transition-all ${
                            diffValue === 0 ? 'text-emerald-600' :
                            diffValue > 0 ? 'text-blue-600' :
                            'text-rose-600'
                        }`}>
                            {diffValue === 0 ? '0.00' : formatMoney(diffValue)}
                        </span>
                    </div>

                    {/* Observaciones */}
                    <section>
                        <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs mb-4">
                            <span className="material-symbols-rounded text-slate-400">notes</span>
                            Observaciones (Opcional)
                        </label>
                        <textarea 
                            className="block w-full p-6 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 focus:ring-0 focus:border-emerald-500 transition-all resize-none shadow-inner" 
                            placeholder="Anota cualquier detalle relevante del corte..." 
                            rows="3"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        ></textarea>
                    </section>
                </div>

                {/* Footer and Actions */}
                <div className="p-8 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/30 dark:bg-slate-900/40">
                    <div className="flex gap-4">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-5 px-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="flex-[2.5] py-5 px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-[0.2em] text-sm hover:translate-y-[-2px] hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0"
                        >
                            {submitting ? 'Procesando Corte...' : `Ejecutar ${cutType === 'dia' ? 'Cierre de Día' : 'Cierre de Turno'}`}
                            {!submitting && <span className="material-symbols-rounded">chevron_right</span>}
                        </button>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <p className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            Autenticado como: <span className="text-slate-600 dark:text-slate-300">{activeStaff?.name || 'Desconocido'}</span>
                        </p>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    </div>
                </div>
            </div>
        </div>
    );
};

