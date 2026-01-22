import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { activeCartService } from '../../services/activeCartService';
import './CustomerDisplay.css';

const CustomerDisplay = () => {
    const [searchParams] = useSearchParams();
    const userId = searchParams.get('u');
    const [cart, setCart] = useState(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!userId) return;

        // Función de carga reutilizable
        const fetchCart = async () => {
            try {
                const data = await activeCartService.getActiveCart(userId);
                if (data) {
                    console.log('Datos del carrito cargados con éxito');
                    setCart(data);
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error fetching initial cart:', error);
                return false;
            }
        };

        // Carga inicial inmediata
        fetchCart();

        // Reintento automático cada 3 segundos si no hay datos aún
        const retryInterval = setInterval(async () => {
            if (!cart) {
                console.log('Intentando recarga automática...');
                const success = await fetchCart();
                if (success) clearInterval(retryInterval);
            } else {
                clearInterval(retryInterval);
            }
        }, 3000);

        // Suscripción en tiempo real
        const subscription = activeCartService.subscribeToCart(userId, (newCart) => {
            if (newCart) {
                console.log('Actualización recibida por Realtime');
                setCart(newCart);
                clearInterval(retryInterval);
            }
        });

        return () => {
            clearInterval(retryInterval);
            if (subscription) subscription.unsubscribe();
        };
    }, [userId, !!cart]); // Se reinicia si cart cambia a null (reinicio manual)

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

    const cartData = (cart?.cart_data && Array.isArray(cart.cart_data)) ? cart.cart_data : [];
    const currentStatus = cart?.status || 'active';
    const isEmpty = !cart || (cartData.length === 0 && (currentStatus === 'active' || currentStatus === 'completed'));

    // Función para refresco manual
    const handleManualRefresh = async () => {
        const data = await activeCartService.getActiveCart(userId);
        if (data) setCart(data);
    };

    // Si está vacío y no es una venta recién completada (que queremos mostrar a 0), mostrar bienvenida
    if (isEmpty && currentStatus !== 'completed') {
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
                
                {/* Botón de refresco manual discreto */}
                <button 
                    onClick={handleManualRefresh}
                    className="manual-refresh-btn"
                >
                    <span className="material-icons-outlined">refresh</span>
                    ¿No ves tu compra? Clic aquí para reintentar
                </button>

                <div className="footer-clock" style={{marginTop: '2rem', opacity: 0.5}}>
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        );
    }

    return (
        <div className={`customer-display-container status-${currentStatus}`}>
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
                        {cartData.map((item, index) => (
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

                    {currentStatus === 'processing' && (
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
