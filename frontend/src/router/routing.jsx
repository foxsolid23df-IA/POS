import React, { useEffect, useState } from "react";
import { Routes, Route, HashRouter, Link, Navigate } from "react-router-dom"
import { Sidebar } from "../components/sidebar/Sidebar"
import { Sales } from "../components/sales/Sales"
import { Inventory } from "../components/inventory/Inventory"
import { Historial } from "../components/historial/Historial"
import { Stats } from "../components/stats/Stats"
import { Login } from "../components/auth/Login"
import { LockScreen } from "../components/auth/LockScreen"
import { CashFundModal } from "../components/auth/CashFundModal"
import { UserManager } from "../components/admin/UserManager"
import Suppliers from "../components/suppliers/Suppliers"
import { AuthProvider, useAuth } from "../hooks/useAuth"
import CustomerDisplay from "../components/customer/CustomerDisplay"
import ExchangeRateSettings from "../components/admin/ExchangeRateSettings";
import { TerminalSetup } from "../components/config/TerminalSetup";
import { terminalService } from "../services/terminalService";
import Maintenance from "../components/admin/Maintenance";

const PrivateLayout = ({ children }) => {
    const { 
        user, 
        loading, 
        isLocked, 
        activeStaff,
        needsCashFund, 
        checkCashSession,
        openCashSession,
        storeName
    } = useAuth();

    const [isTerminalConfigured, setIsTerminalConfigured] = useState(!!terminalService.getTerminalId());

    // Validar existencia de terminal y sesión de caja
    useEffect(() => {
        const validateTerminal = async () => {
            if (isTerminalConfigured) {
                const isValid = await terminalService.validateTerminalExistence();
                if (!isValid) {
                    setIsTerminalConfigured(false);
                }
            }
        };

        validateTerminal();

        if (user && activeStaff && !isLocked && isTerminalConfigured) {
            checkCashSession();
        }
    }, [user, activeStaff, isLocked, isTerminalConfigured]);

    if (loading) return <div className="loading-screen">Cargando...</div>;
    if (!user) return <Navigate to="/login" />;

    // 1. Verificación de Terminal (Fundamental para operar)
    if (!isTerminalConfigured) {
        return <TerminalSetup onTerminalConfigured={() => setIsTerminalConfigured(true)} />;
    }

    // 2. Si la pantalla está bloqueada, mostrar pantalla de PIN
    if (isLocked) return <LockScreen />;

    // 3. Si necesita ingresar fondo de caja, mostrar modal
    if (needsCashFund) {
        return (
            <CashFundModal 
                staffName={activeStaff?.name || storeName || 'Operador'}
                staffId={activeStaff?.id}
                onSessionCreated={(session) => {
                    // La sesión se actualiza automáticamente en el contexto
                    console.log('Sesión de caja creada:', session);
                    checkCashSession(); // Actualizar estado global para cerrar modal
                }}
            />
        );
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};


const AdminRoute = ({ children }) => {
    const { isAdmin } = useAuth();
    return isAdmin ? children : <Navigate to="/" />;
};

export const Routing = () => {
    return (
        <AuthProvider>
            <HashRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register/:invitationCode?" element={<Login />} />

                    <Route path="/" element={<PrivateLayout><Sales /></PrivateLayout>} />
                    <Route path="/ventas" element={<PrivateLayout><Sales /></PrivateLayout>} />
                    <Route path="/inventario" element={<PrivateLayout><Inventory /></PrivateLayout>} />
                    <Route path="/proveedores" element={<PrivateLayout><Suppliers /></PrivateLayout>} />
                    <Route path="/historial" element={<PrivateLayout><Historial /></PrivateLayout>} />
                    <Route path="/estadisticas" element={<PrivateLayout><Stats /></PrivateLayout>} />
                    <Route path="/customer-display" element={<CustomerDisplay />} />

                    {/* Gestión de Usuarios solo para Admin */}
                    <Route path="/usuarios" element={
                        <PrivateLayout>
                            <AdminRoute>
                                <UserManager />
                            </AdminRoute>
                        </PrivateLayout>
                    } />

                    <Route path="/configuracion-dolares" element={
                        <PrivateLayout>
                            <ExchangeRateSettings />
                        </PrivateLayout>
                    } />

                    <Route path="/soporte-tecnico-especializado-foxsolid" element={
                        <PrivateLayout>
                            <AdminRoute>
                                <Maintenance />
                            </AdminRoute>
                        </PrivateLayout>
                    } />

                    <Route path="*" element={
                        <div style={{ padding: '2rem', textAlign: 'center' }}>
                            <h1>Error 404</h1>
                            <p>Página no encontrada</p>
                            <Link to="/">Volver al Inicio</Link>
                        </div>
                    } />
                </Routes>
            </HashRouter>
        </AuthProvider>
    )
}
