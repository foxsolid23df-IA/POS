import React, { useState, useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { invitationService } from '../../services/invitationService';
import './Login.css';

export const Login = () => {
    const { login, signUp, user } = useAuth();
    const { invitationCode } = useParams(); // Para rutas como /register/ADMIN2024

    // UI State
    const [isRegistering, setIsRegistering] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form Data
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        storeName: '',
        fullName: '',
        invitationCode: ''
    });

    // Estado para el código de invitación validado
    const [validatedCode, setValidatedCode] = useState(null);

    // Si hay código de invitación en la URL, activar modo registro y pre-llenar el código
    useEffect(() => {
        if (invitationCode) {
            setIsRegistering(true);
            setFormData(prev => ({
                ...prev,
                invitationCode: invitationCode.toUpperCase()
            }));
        }
    }, [invitationCode]);

    if (user) {
        return <Navigate to="/" />;
    }

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (isRegistering) {
                // Validar código de invitación contra la base de datos
                if (!formData.invitationCode) {
                    setError('Código de invitación requerido. Solo el área administrativa puede proporcionar códigos de registro.');
                    setLoading(false);
                    return;
                }

                const validation = await invitationService.validateCode(formData.invitationCode);
                
                if (!validation.valid) {
                    setError(validation.error || 'Código de invitación inválido.');
                    setLoading(false);
                    return;
                }

                // Proceder con el registro pasando el código validado
                await signUp(formData.email, formData.password, formData.storeName, formData.fullName, validation.codeId);
                // Signup usually logs in automatically in Supabase, or requires email confirmation.
                // Si auto-login, el efecto 'user' redirigirá. 
                // Si requiere confirmación, podríamos necesitar un mensaje. 
            } else {
                await login(formData.email, formData.password);
            }
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error de autenticación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon">🔐</div>
                    <h1>{isRegistering ? 'Crear Cuenta' : 'Bienvenido'}</h1>
                    <p>{isRegistering ? 'Registra tu negocio en Business Pro' : 'Gestiona tu negocio profesionalmente'}</p>
                </div>

                {error && <div className="login-error-msg">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    {isRegistering && (
                        <>
                            <div className="form-group">
                                <label>Código de Invitación *</label>
                                <input
                                    type="text"
                                    name="invitationCode"
                                    value={formData.invitationCode}
                                    onChange={handleChange}
                                    placeholder="Código proporcionado por administración"
                                    required
                                    style={{ 
                                        textTransform: 'uppercase',
                                        letterSpacing: '2px',
                                        fontWeight: '600'
                                    }}
                                />
                                <small style={{ 
                                    color: '#888', 
                                    fontSize: '12px', 
                                    marginTop: '4px',
                                    display: 'block'
                                }}>
                                    Solo disponible para el área administrativa
                                </small>
                            </div>
                            <div className="form-group">
                                <label>Nombre del Negocio</label>
                                <input
                                    type="text"
                                    name="storeName"
                                    value={formData.storeName}
                                    onChange={handleChange}
                                    placeholder="Ej: Minimarket Central"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Tu Nombre Completo</label>
                                <input
                                    type="text"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    placeholder="Ej: Juan Pérez"
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label>Correo Electrónico</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="nombre@ejemplo.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Contraseña</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    <button type="submit" className="login-submit-btn" disabled={loading}>
                        {loading ? 'Procesando...' : (isRegistering ? 'Registrarse' : 'Iniciar Sesión')}
                    </button>
                </form>

                {/* Ocultar el enlace de registro público - Solo área administrativa puede registrar */}
                {/* El registro solo está disponible con código de invitación */}
                {isRegistering && (
                    <div className="login-footer">
                        <p>
                            ¿Ya tienes cuenta?
                            <button
                                type="button"
                                className="toggle-auth-btn"
                                onClick={() => setIsRegistering(false)}
                            >
                                Inicia Sesión
                            </button>
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
