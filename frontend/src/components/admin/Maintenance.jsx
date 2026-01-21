import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { maintenanceService } from '../../services/maintenanceService';
import { terminalService } from '../../services/terminalService';
import './Maintenance.css';

const Maintenance = () => {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [masterPin, setMasterPin] = useState('');
    const [pinError, setPinError] = useState('');

    const [loading, setLoading] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [options, setOptions] = useState({
        resetTerminals: true,
        resetTransactions: true,
        resetProfiles: false
    });

    const [terminals, setTerminals] = useState([]);

    const fetchTerminals = async () => {
        try {
            const data = await terminalService.getTerminals();
            setTerminals(data);
        } catch (error) {
            console.error('Error fetching terminals:', error);
        }
    };

    React.useEffect(() => {
        if (isAuthorized) {
            fetchTerminals();
        }
    }, [isAuthorized]);

    const handlePinSubmit = (e) => {
        e.preventDefault();
        // PIN Maestro Hardcoded para soporte (Puede moverse a .env después)
        if (masterPin === '2026SOP') {
            setIsAuthorized(true);
            setPinError('');
        } else {
            setPinError('PIN Maestro incorrecto. Acceso denegado.');
            setMasterPin('');
        }
    };

    if (!isAuthorized) {
        return (
            <div className="maintenance-lock-screen">
                <div className="lock-card">
                    <span className="material-icons-outlined lock-icon">admin_panel_settings</span>
                    <h2>Soporte Técnico Especializado</h2>
                    <p>Ingrese el PIN Maestro para acceder a las herramientas de bajo nivel.</p>
                    <form onSubmit={handlePinSubmit}>
                        <input 
                            type="password" 
                            placeholder="PIN de Seguridad"
                            value={masterPin}
                            onChange={(e) => setMasterPin(e.target.value)}
                            autoFocus
                        />
                        {pinError && <p className="error-text">{pinError}</p>}
                        <button type="submit" className="btn-auth">Validar Acceso</button>
                    </form>
                </div>
            </div>
        );
    }

    const handleReset = async (nuclearParam = false) => {
        // Asegurarnos de que sea un booleano (el evento de clic puede venir como primer argumento)
        const isNuclear = nuclearParam === true;
        const expectedPhrase = isNuclear ? 'BORRAR-TODO' : 'RESET';
        const userInput = confirmation.trim();
        
        if (userInput !== expectedPhrase) {
            setMessage({ text: `Por favor, escribe ${expectedPhrase} exactamente para confirmar.`, type: 'error' });
            return;
        }

        const warningMsg = isNuclear 
            ? '¡ADVERTENCIA NUCLEAR! Se borrará absolutamente TODO (incluyendo inventario y perfiles admin). ¿Estás 100% seguro?'
            : '¿Estás SEGURO de que deseas realizar esta acción? Esta operación borrará permanentemente los datos seleccionados (excepto el inventario).';

        if (!window.confirm(warningMsg)) {
            return;
        }

        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            console.log('Iniciando Reset con:', { ...options, isNuclear });
            const result = await maintenanceService.resetProjectData({
                ...options,
                factoryReset: isNuclear
            });
            console.log('Resultado del servidor:', result);
            
            if (result.success) {
                setMessage({ 
                    text: isNuclear ? 'SISTEMA DESTRUIDO CON ÉXITO. Redirigiendo...' : 'Reset completado con éxito.', 
                    type: 'success' 
                });
                
                // Si es nuclear, limpiar todo y sacar al usuario
                if (isNuclear) {
                    maintenanceService.resetLocalTerminal();
                    await supabase.auth.signOut();
                    setTimeout(() => {
                        window.location.href = '/#/login';
                        window.location.reload();
                    }, 3000);
                } else if (options.resetTerminals) {
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('Error en Reset:', error);
            setMessage({ text: 'Error: ' + error.message, type: 'error' });
        } finally {
            setLoading(false);
            setConfirmation('');
        }
    };

    return (
        <div className="maintenance-container">
            <header className="maintenance-header">
                <h1>Administración y Mantenimiento</h1>
                <p>Gestiona la limpieza de datos y licencias del sistema.</p>
            </header>

            <div className="maintenance-card warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                    <h2>Zona de Peligro</h2>
                    <p>Estas acciones son irreversibles. Se recomienda realizar un respaldo de la base de datos antes de proceder.</p>
                </div>
            </div>

            <div className="maintenance-content">
                <section className="reset-section">
                    <h3>Opciones de Reset</h3>
                    <div className="options-grid">
                        <label className="option-item">
                            <input 
                                type="checkbox" 
                                checked={options.resetTerminals} 
                                onChange={(e) => setOptions({...options, resetTerminals: e.target.checked})}
                            />
                            <span>
                                <strong>Resetear Dispositivos</strong>
                                <small>Elimina todas las terminales registradas. Útil para liberar licencias.</small>
                            </span>
                        </label>

                        <label className="option-item">
                            <input 
                                type="checkbox" 
                                checked={options.resetTransactions} 
                                onChange={(e) => setOptions({...options, resetTransactions: e.target.checked})}
                            />
                            <span>
                                <strong>Limpiar Transacciones</strong>
                                <small>Borra historial de ventas, sesiones y cortes. Mantiene el inventario.</small>
                            </span>
                        </label>

                        <label className="option-item">
                            <input 
                                type="checkbox" 
                                checked={options.resetProfiles} 
                                onChange={(e) => setOptions({...options, resetProfiles: e.target.checked})}
                            />
                            <span>
                                <strong>Resetear Usuarios Secundarios</strong>
                                <small>Elimina cuentas de cajeros y otros perfiles no administradores.</small>
                            </span>
                        </label>
                    </div>

                    <div className="confirmation-box">
                        <p>Escriba <strong>RESET</strong> para habilitar el botón:</p>
                        <input 
                            type="text" 
                            placeholder="Escribe RESET aquí"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            disabled={loading}
                        />
                        <button 
                            className={`btn-reset ${confirmation.trim() === 'RESET' ? 'active' : ''}`}
                            onClick={() => handleReset(false)}
                            disabled={loading || confirmation.trim() !== 'RESET'}
                        >
                            {loading ? 'Procesando...' : 'Ejecutar Limpieza'}
                        </button>
                    </div>

                    {message.text && (
                        <div className={`status-message ${message.type}`}>
                            {message.text}
                        </div>
                    )}
                </section>

                <section className="reset-section">
                    <h3>Gestión de Sesiones de Caja</h3>
                    <p className="section-description">
                        Usa esta herramienta si no puedes realizar el Cierre de Día porque hay otras cajas abiertas que no tienes a la mano.
                    </p>
                    <div className="utility-box">
                        <button 
                            className="btn-warning"
                            onClick={async () => {
                                if (window.confirm('¿Deseas forzar el cierre de TODAS las cajas abiertas en el sistema? Esto permitirá realizar el Cierre de Día. Los cajeros deberán abrir turno de nuevo.')) {
                                    setLoading(true);
                                    try {
                                        await maintenanceService.forceCloseAllSessions();
                                        setMessage({ text: 'Todas las sesiones han sido cerradas con éxito.', type: 'success' });
                                    } catch (e) {
                                        setMessage({ text: 'Error: ' + e.message, type: 'error' });
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                            disabled={loading}
                        >
                            <span className="material-icons-outlined">lock_reset</span>
                            {loading ? 'Cerrando...' : 'Forzar Cierre de Todas las Cajas'}
                        </button>
                    </div>
                </section>
                <section className="maintenance-section">
                    <h3>Dispositivos Registrados</h3>
                    <p className="section-description">
                        Lista de equipos autorizados. Elimina los que ya no se utilicen para liberar espacio.
                    </p>
                    <div className="terminals-list">
                        {terminals.length === 0 ? (
                            <p className="empty-msg">No hay terminales registradas.</p>
                        ) : (
                            <table className="maintenance-table">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Ubicación</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {terminals.map(t => (
                                        <tr key={t.id}>
                                            <td>
                                                <div className="terminal-name-cell">
                                                    <span className="material-icons-outlined">desktop_windows</span>
                                                    <strong>{t.name}</strong>
                                                </div>
                                            </td>
                                            <td>{t.location || 'Sin ubicación'}</td>
                                            <td>
                                                <span className={`status-badge ${t.is_main ? 'main' : 'secondary'}`}>
                                                    {t.is_main ? 'Caja Principal' : 'Caja Secundaria'}
                                                </span>
                                            </td>
                                            <td className="actions-cell">
                                                <button 
                                                    className="btn-icon delete"
                                                    title="Eliminar Dispositivo"
                                                    onClick={async () => {
                                                        if (window.confirm(`¿Seguro que deseas eliminar la terminal "${t.name}"? El dispositivo perderá acceso inmediato.`)) {
                                                            setLoading(true);
                                                            try {
                                                                await terminalService.deleteTerminal(t.id);
                                                                await fetchTerminals();
                                                                setMessage({ text: `Terminal "${t.name}" eliminada correctamente.`, type: 'success' });
                                                            } catch (e) {
                                                                setMessage({ text: 'Error: ' + e.message, type: 'error' });
                                                            } finally {
                                                                setLoading(false);
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <span className="material-icons-outlined">delete_forever</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </div>

            <section className="reset-section nuclear">
                <h3 className="text-danger">☢️ Reset de Fábrica (Baja de Cliente)</h3>
                <p className="nuclear-warning">
                    Esta acción borrará <strong>TODO</strong> el sistema: productos, ventas, usuarios y perfiles. 
                    Úselo solo para dar de baja un cliente o reiniciar el sistema por completo.
                </p>
                
                <div className="confirmation-box nuclear">
                    <p>Escriba <strong>BORRAR-TODO</strong> para confirmar la destrucción:</p>
                    <input 
                        type="text" 
                        placeholder="BORRAR-TODO"
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        className="nuclear-input"
                    />
                    <button 
                        className={`btn-nuclear ${confirmation.trim() === 'BORRAR-TODO' ? 'active' : ''}`}
                        disabled={loading || confirmation.trim() !== 'BORRAR-TODO'}
                        onClick={() => handleReset(true)}
                    >
                        {loading ? 'Destruyendo datos...' : 'EJECUTAR RESET TOTAL'}
                    </button>
                </div>
            </section>
        </div>
    );
};

export default Maintenance;
