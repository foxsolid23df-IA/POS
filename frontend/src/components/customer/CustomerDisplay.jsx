import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { activeCartService } from '../../services/activeCartService';
import './CustomerDisplay.css';

const CustomerDisplay = () => {
    const [searchParams] = useSearchParams();
    const userId = searchParams.get('u');
    const sessionId = searchParams.get('s'); // Obtener ID de sesión
    const [cart, setCart] = useState(null);
    const [status, setStatus] = useState('active'); // active, processing, completed
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!userId && !sessionId) return;

        // Función de carga segura estrictamente por sesión
        const fetchCartSafe = async () => {
            if (!sessionId) {
                console.log("Esperando identificación de sesión...");
                return;
            }

            try {
                // ÚNICO INTENTO: ID específico de sesión
                // Eliminamos cualquier fallback genérico por userId para evitar mezclar información de otras cajas
                const data = await activeCartService.getActiveCart(userId, sessionId);
                
                if (data) {
                    console.log("Datos cargados para sesión:", sessionId);
                    setCart(data);
                    setStatus(data.status);
                } else {
                    console.log("No se encontró información para la sesión activa:", sessionId);
                }
            } catch (err) {
                // Silencioso
            }
        };

        // 1. Carga inicial inmediata
        fetchCartSafe();

        // 2. Suscripción en tiempo real (Canal Específico)
        // Eliminamos la suscripción general (subGeneral) para evitar que se mezclen carritos de otras cajas
        const subSpecific = activeCartService.subscribeToCart(userId, sessionId, (newCart) => {
            if (newCart) { 
                console.log("Cambio detectado para esta sesión:", newCart);
                setCart(newCart); 
                setStatus(newCart.status); 
            }
        });

        // 3. Polling de respaldo (solo si no hay tiempo real o para reconexión)
        const pollingInterval = setInterval(fetchCartSafe, 3000);

        return () => {
            if (subSpecific) subSpecific.unsubscribe();
            clearInterval(pollingInterval);
        };
    }, [userId, sessionId]);



    // Temporizador para regresar a pantalla de bienvenida después de completar venta
    useEffect(() => {
        if (status === 'completed') {
            const timer = setTimeout(() => {
                // Resetear a pantalla de bienvenida
                setCart(null);
                setStatus('active');
            }, 3000); // 3 segundos después de completar la venta

            return () => clearTimeout(timer);
        }
    }, [status]);

    if (!userId) {
        return (
            <div className="customer-display-error">
                <h1 className="welcome-text">Configuración Requerida</h1>
                <p className="welcome-subtext">
                    Esta pantalla necesita el identificador del vendedor para funcionar. 
                    Por favor, abra esta ruta con el parámetro '?u=UUID' correspondiente.
                </p>
            </div>
        );
    }

    // Mostrar pantalla de bienvenida si:
    // 1. No hay carrito (null)
    // 2. El carrito está vacío Y el status es 'active'
    const shouldShowWelcome = !cart || (cart.cart_data?.length === 0 && status === 'active');

    if (shouldShowWelcome) {
        return (
            <div className="customer-display-welcome">
                <div className="logo-placeholder">
                    {/* Contenedor para logo si existiera */}
                </div>
                <h1 className="welcome-text">¡Bienvenido!</h1>
                <p className="welcome-subtext">
                    Estamos listos para atenderle. <br />
                    Sus productos aparecerán aquí conforme sean escaneados.
                </p>
                <div className="footer-clock" style={{marginTop: '4rem', opacity: 0.5}}>
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        );
    }

    return (
        <div className={`customer-display-container status-${status}`}>
            <div className="display-main">
                <div className="items-column">
                    <div className="items-header">
                        <span>Descripción del Producto</span>
                        <div className="header-right">
                            <span>Cant.</span>
                            <span>Subtotal</span>
                        </div>
                    </div>
                    <div className="items-list">
                        {cart?.cart_data.map((item, index) => (
                            <div key={`${item.id}-${index}`} className="item-row item-animate">
                                <div className="item-info">
                                    <span className="item-name">{item.name}</span>
                                    <span className="item-price">${parseFloat(item.price).toFixed(2)} por unidad</span>
                                </div>
                                <div className="item-values">
                                    <span className="item-qty">x{item.quantity}</span>
                                    <span className="item-total">${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="summary-column">
                    <div className="total-card pop-animate">
                        <span className="total-label">Total a Pagar</span>
                        <span className="total-value">${parseFloat(cart?.total || 0).toFixed(2)}</span>
                    </div>

                    {status === 'processing' && (
                        <div className="payment-info pop-animate">
                            <div className="info-row">
                                <span className="info-label">Método de Pago</span>
                                <span className="info-value">{cart.payment_method || 'A definir'}</span>
                            </div>
                            {parseFloat(cart.amount_received) > 0 && (
                                <>
                                    <div className="info-row">
                                        <span className="info-label">Efectivo Recibido</span>
                                        <span className="info-value">${parseFloat(cart.amount_received).toFixed(2)}</span>
                                    </div>
                                    <div className="info-row change-row">
                                        <span className="info-label">Su Cambio</span>
                                        <span className="info-value cambio-value">${parseFloat(cart.change_amount).toFixed(2)}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                </div>
            </div>
            
            <footer className="display-footer">
                <div className="footer-content">
                    <span className="store-name-footer">Sistema de Ventas PosMulticajas</span>
                    <span className="datetime-footer">
                        {currentTime.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} | 
                        {" "}{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                </div>
            </footer>
        </div>
    );
};

export default CustomerDisplay;
