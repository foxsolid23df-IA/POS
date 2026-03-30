import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { exchangeRateService } from '../../services/exchangeRateService';
import './ExchangeRateSettings.css';

const ExchangeRateSettings = () => {
    const navigate = useNavigate();
    const [rate, setRate] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        fetchRate();
    }, []);

    const fetchRate = async () => {
        try {
            setLoading(true);
            const data = await exchangeRateService.getActiveRate();
            if (data) {
                setRate(data.rate);
                setIsActive(data.is_active);
            }
        } catch (error) {
            console.error('Error cargando tipo de cambio:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await exchangeRateService.updateRate(parseFloat(rate));
            await exchangeRateService.toggleActive(isActive);
            setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
        } catch (error) {
            console.error('Error guardando:', error);
            setMessage({ type: 'error', text: 'Error al guardar la configuración' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async () => {
        const newState = !isActive;
        setIsActive(newState);
        // Opcionalmente guardar el estado inmediatamente
        // await exchangeRateService.toggleActive(newState);
    };

    if (loading) return <div className="p-4 text-slate-400">Cargando configuración...</div>;

    return (
        <div className="exchange-rate-settings-container">
            <div className="flex justify-between items-center mb-2">
                <h2 className="settings-title m-0">Configuración de Dólares (USD)</h2>
                <button
                    onClick={() => navigate("/configuracion")}
                    type="button"
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                    <span className="material-icons-outlined text-[16px]">arrow_back</span>
                    <span>Regresar</span>
                </button>
            </div>
            <p className="settings-subtitle">Establece el tipo de cambio para aceptar pagos en moneda extranjera.</p>

            {message && (
                <div className={`message-alert ${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSave} className="settings-form">
                <div className="form-group-switch">
                    <label className="switch-label">
                        <span className="label-text">Habilitar Pagos en Dólares</span>
                        <div className="switch-wrapper">
                            <input 
                                type="checkbox" 
                                checked={isActive} 
                                onChange={handleToggle}
                                className="switch-input" 
                            />
                            <span className="switch-slider"></span>
                        </div>
                    </label>
                </div>

                <div className={`form-group-input ${!isActive ? 'disabled' : ''}`}>
                    <label>Tipo de Cambio Actual ($ MXN por 1 USD)</label>
                    <div className="input-with-icon">
                        <span className="currency-symbol">$</span>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                            disabled={!isActive}
                            required={isActive}
                        />
                        <span className="currency-code">MXN</span>
                    </div>
                </div>

                <div className="preview-box">
                    <span>Ejemplo: $10.00 USD = </span>
                    <span className="preview-value">
                        {rate ? `$${(10 * parseFloat(rate)).toFixed(2)}` : '$0.00'} MXN
                    </span>
                </div>

                <button 
                    type="submit" 
                    className="btn-save-settings" 
                    disabled={saving || (isActive && !rate)}
                >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </form>
        </div>
    );
};

export default ExchangeRateSettings;
