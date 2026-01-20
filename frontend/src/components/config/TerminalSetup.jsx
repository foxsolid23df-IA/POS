import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { terminalService } from '../../services/terminalService';
import './TerminalSetup.css';

export const TerminalSetup = ({ onTerminalConfigured }) => {
    const [name, setName] = useState('');
    const [location, setLocation] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!name.trim()) {
            Swal.fire('Error', 'Debes asignar un nombre a esta caja', 'warning');
            return;
        }

        setIsSubmitting(true);

        try {
            const terminal = await terminalService.registerTerminal(name.trim(), location.trim());
            
            Swal.fire({
                title: '¡Terminal Configurada!',
                text: `Esta PC ahora está identificada como: ${terminal.name}`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

            if (onTerminalConfigured) {
                onTerminalConfigured(terminal);
            }
        } catch (error) {
            console.error('Error configurando terminal:', error);
            Swal.fire('Error', 'No se pudo registrar la terminal. Intenta de nuevo.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="terminal-setup-overlay">
            <div className="terminal-setup-modal">
                <div className="terminal-setup-header">
                    <div className="terminal-icon">🖥️</div>
                    <h1>Configuración de Caja</h1>
                    <p>Identifica este equipo para comenzar</p>
                </div>

                <form onSubmit={handleSubmit} className="terminal-setup-form">
                    <div className="form-group">
                        <label>Nombre de la Caja</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: CAJA-01, CAJA-PRINCIPAL"
                            autoFocus
                            disabled={isSubmitting}
                        />
                        <span className="input-hint">Debe ser único para cada equipo</span>
                    </div>

                    <div className="form-group">
                        <label>Ubicación (Opcional)</label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Ej: Entrada Principal, Piso 2"
                            disabled={isSubmitting}
                        />
                    </div>

                    <button
                        type="submit"
                        className="setup-submit-btn"
                        disabled={isSubmitting || !name.trim()}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="spinner"></span>
                                Configurando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">save</span>
                                Guardar Configuración
                            </>
                        )}
                    </button>
                    
                    <div className="setup-info">
                        <p>ℹ️ Esta configuración se guardará en este dispositivo y es necesaria para operar en modo multicajas.</p>
                    </div>
                </form>
            </div>
        </div>
    );
};
