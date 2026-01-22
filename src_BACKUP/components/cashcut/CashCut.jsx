import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { cashCutService } from '../../services/cashCutService';
import { salesService } from '../../services/salesService';
import Swal from 'sweetalert2';
import './CashCut.css';

export const CashCut = ({ onClose }) => {
    const { activeStaff, activeRole, lockScreen, storeName } = useAuth();
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
                <p><strong>Ventas:</strong> ${summary.salesCount}</p>
                <p><strong>Total esperado:</strong> ${formatMoney(summary.salesTotal)}</p>
                <p><strong>Efectivo contado:</strong> ${formatMoney(parseFloat(actualCash) || 0)}</p>
                <p><strong>Diferencia:</strong> ${formatMoney((parseFloat(actualCash) || 0) - summary.salesTotal)}</p>
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
                expectedCash: summary.salesTotal,
                actualCash: parseFloat(actualCash) || null,
                notes
            };

            const savedCut = await cashCutService.createCashCut(cutData);

            // Guardar resultado para el ticket
            setCutResult({
                ...savedCut,
                ...cutData,
                endTime: new Date().toISOString(),
                difference: (parseFloat(actualCash) || 0) - summary.salesTotal
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

    const handleFinish = () => {
        Swal.fire({
            title: '¡Corte realizado!',
            text: cutType === 'dia'
                ? 'El día ha sido cerrado exitosamente'
                : 'Tu turno ha sido cerrado exitosamente',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });

        lockScreen();
        if (onClose) onClose();
    };

    const difference = (parseFloat(actualCash) || 0) - (summary?.salesTotal || 0);

    if (loading) {
        return (
            <div className="cash-cut-overlay">
                <div className="cash-cut-modal">
                    <div className="loading-state">Calculando resumen del turno...</div>
                </div>
            </div>
        );
    }

    // Mostrar ticket de impresión
    if (showTicket && cutResult) {
        return (
            <div className="cash-cut-overlay">
                <div className="cash-cut-modal ticket-modal">
                    <div className="modal-header">
                        <h2>🧾 Ticket de Corte</h2>
                        <button className="close-btn" onClick={handleFinish}>×</button>
                    </div>

                    {/* Ticket para imprimir */}
                    <div className="ticket-preview" ref={ticketRef}>
                        <div className="ticket-header">
                            <div className="store-name">{storeName || 'MI TIENDA'}</div>
                            <div className="ticket-title">
                                {cutType === 'dia' ? 'CIERRE DEL DÍA' : 'CIERRE DE TURNO'}
                            </div>
                        </div>

                        <div className="section">
                            <div className="row">
                                <span className="label">Fecha:</span>
                                <span className="value">{formatDate(cutResult.endTime)}</span>
                            </div>
                            <div className="row">
                                <span className="label">Hora:</span>
                                <span className="value">{new Date(cutResult.endTime).toLocaleTimeString('es-MX')}</span>
                            </div>
                            <div className="row">
                                <span className="label">Operador:</span>
                                <span className="value">{cutResult.staffName}</span>
                            </div>
                            <div className="row">
                                <span className="label">Rol:</span>
                                <span className="value">{cutResult.staffRole?.toUpperCase()}</span>
                            </div>
                        </div>

                        <div className="section">
                            <div className="row">
                                <span className="label">Período desde:</span>
                                <span className="value">{formatTime(cutResult.startTime)}</span>
                            </div>
                            <div className="row">
                                <span className="label">Período hasta:</span>
                                <span className="value">{formatTime(cutResult.endTime)}</span>
                            </div>
                        </div>

                        <div className="section">
                            <strong>📊 RESUMEN DE VENTAS</strong>
                            <div className="row total-row">
                                <span>Total de ventas:</span>
                                <span>{cutResult.salesCount}</span>
                            </div>
                            <div className="row total-row">
                                <span>Monto total:</span>
                                <span>{formatMoney(cutResult.salesTotal)}</span>
                            </div>
                        </div>

                        {salesDetails.length > 0 && (
                            <div className="section sales-list">
                                <strong>📋 DETALLE DE VENTAS Y PRODUCTOS</strong>
                                {salesDetails.map((sale, index) => (
                                    <div key={sale.id || index} className="sale-item">
                                        <div className="row sale-header-row">
                                            <span><strong>Venta #{index + 1}</strong></span>
                                            <span>{formatTime(sale.created_at)}</span>
                                        </div>
                                        {/* Productos de esta venta */}
                                        {sale.sale_items && sale.sale_items.map((item, itemIndex) => (
                                            <div key={itemIndex} className="product-row">
                                                <span className="product-name">
                                                    {item.quantity}x {item.product_name}
                                                </span>
                                                <span className="product-price">
                                                    {formatMoney(item.total || item.price * item.quantity)}
                                                </span>
                                            </div>
                                        ))}
                                        <div className="row sale-total-row">
                                            <span>Subtotal:</span>
                                            <span><strong>{formatMoney(sale.total)}</strong></span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="section">
                            <strong>💰 ARQUEO DE CAJA</strong>
                            <div className="row">
                                <span className="label">Esperado:</span>
                                <span className="value">{formatMoney(cutResult.expectedCash)}</span>
                            </div>
                            <div className="row">
                                <span className="label">Contado:</span>
                                <span className="value">{formatMoney(cutResult.actualCash || 0)}</span>
                            </div>
                            <div className="row total-row">
                                <span>Diferencia:</span>
                                <span className={cutResult.difference === 0 ? '' : cutResult.difference > 0 ? 'difference-positive' : 'difference-negative'}>
                                    {cutResult.difference === 0 ? '✓ CUADRA' : formatMoney(cutResult.difference)}
                                </span>
                            </div>
                        </div>

                        {cutResult.notes && (
                            <div className="section">
                                <strong>📝 OBSERVACIONES</strong>
                                <p>{cutResult.notes}</p>
                            </div>
                        )}

                        <div className="footer">
                            <p>Sistema de Ventas</p>
                            <p>Documento generado automáticamente</p>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button className="btn-secondary" onClick={handleFinish}>
                            Continuar sin imprimir
                        </button>
                        <button className="btn-primary" onClick={handlePrint}>
                            🖨️ Imprimir Ticket
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="cash-cut-overlay">
            <div className="cash-cut-modal">
                <div className="modal-header">
                    <h2>💰 Cierre de Caja</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="cut-type-selector">
                    <button
                        className={`type-btn ${cutType === 'turno' ? 'active' : ''}`}
                        onClick={() => setCutType('turno')}
                    >
                        👤 Cierre de Turno
                    </button>
                    <button
                        className={`type-btn ${cutType === 'dia' ? 'active' : ''}`}
                        onClick={() => setCutType('dia')}
                    >
                        🌙 Cierre del Día
                    </button>
                </div>

                <div className="summary-section">
                    <div className="summary-header">
                        <span>📊 Resumen del {cutType === 'dia' ? 'Día' : 'Turno'}</span>
                        <small>Desde: {formatTime(summary.startTime)}</small>
                    </div>

                    <div className="summary-stats">
                        <div className="stat-card">
                            <span className="stat-value">{summary.salesCount}</span>
                            <span className="stat-label">Ventas</span>
                        </div>
                        <div className="stat-card highlight">
                            <span className="stat-value">{formatMoney(summary.salesTotal)}</span>
                            <span className="stat-label">Total Esperado</span>
                        </div>
                    </div>

                    {/* Lista de ventas */}
                    {salesDetails.length > 0 && (
                        <div className="sales-preview">
                            <strong>Últimas ventas:</strong>
                            <div className="sales-scroll">
                                {salesDetails.slice(0, 5).map((sale, index) => (
                                    <div key={sale.id || index} className="sale-row">
                                        <span>{formatTime(sale.created_at)}</span>
                                        <span>{formatMoney(sale.total)}</span>
                                    </div>
                                ))}
                                {salesDetails.length > 5 && (
                                    <div className="more-sales">
                                        +{salesDetails.length - 5} ventas más
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="cash-count-section">
                    <label>💵 Efectivo en Caja (contado)</label>
                    <div className="money-input-container">
                        <span className="currency-symbol">$</span>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={actualCash}
                            onChange={(e) => setActualCash(e.target.value)}
                        />
                    </div>
                </div>

                <div className={`difference-display ${difference === 0 ? 'even' : difference > 0 ? 'over' : 'under'}`}>
                    <span className="diff-label">Diferencia:</span>
                    <span className="diff-value">
                        {difference === 0 ? '✓ Cuadra' : formatMoney(difference)}
                    </span>
                </div>

                <div className="notes-section">
                    <label>📝 Observaciones (opcional)</label>
                    <textarea
                        placeholder="Ej: Faltó $20 por error en cambio..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                <div className="modal-actions">
                    <button className="btn-secondary" onClick={onClose}>
                        Cancelar
                    </button>
                    <button
                        className="btn-primary"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? 'Procesando...' : `Cerrar ${cutType === 'dia' ? 'Día' : 'Turno'}`}
                    </button>
                </div>

                <div className="staff-info">
                    <small>Operador: {activeStaff?.name || 'Desconocido'} ({activeRole})</small>
                </div>
            </div>
        </div>
    );
};
