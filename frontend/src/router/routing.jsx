import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  HashRouter,
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Sidebar } from "../components/sidebar/Sidebar";
import { Sales } from "../components/sales/Sales";
import { Inventory } from "../components/inventory/Inventory";
import { Historial } from "../components/historial/Historial";
import { Stats } from "../components/stats/Stats";
import { Customers } from "../components/customers/Customers";
import { Login } from "../components/auth/Login";
import { UpdatePassword } from "../components/auth/UpdatePassword";
import { LockScreen } from "../components/auth/LockScreen";
import { ExpiredLicense } from "../components/auth/ExpiredLicense";
import { CashFundModal } from "../components/auth/CashFundModal";
import { UserManager } from "../components/admin/UserManager";
import { AttendanceRegistry } from "../components/admin/AttendanceRegistry";
import Suppliers from "../components/suppliers/Suppliers";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import CustomerDisplay from "../components/customer/CustomerDisplay";
import ExchangeRateSettings from "../components/admin/ExchangeRateSettings";
import { TerminalSetup } from "../components/config/TerminalSetup";
import { TicketConfig } from "../components/config/TicketConfig";
import { ConfiguracionHub } from "../components/config/ConfiguracionHub";
import TaxConfig from "../components/config/TaxConfig";
import PaymentMethodsConfig from "../components/config/PaymentMethodsConfig";
import BillingIssuers from "../components/config/BillingIssuers";
import InventoryConfig from "../components/config/InventoryConfig";
import { terminalService } from "../services/terminalService";
import Maintenance from "../components/admin/Maintenance";
import { Orders } from "../components/orders/Orders";
import { ScrollToTop } from "../components/common/ScrollToTop";
import { ScrollTopButton } from "../components/common/ScrollTopButton";
import { ProductProvider } from "../contexts/ProductContext";
import { SettingsProvider } from "../contexts/SettingsContext";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";
import { SuperAdminPortal } from "../pages/SuperAdmin/SuperAdminPortal";

// Componente invisible que maneja el botón "Atrás" de Android
const BackButtonHandler = () => {
  useAndroidBackButton();
  return null;
};

const PrivateLayout = ({ children }) => {
  const {
    user,
    loading,
    isLocked,
    activeStaff,
    needsCashFund,
    checkCashSession,
    openCashSession,
    storeName,
    isLicenseExpired,
    isLicenseValidating,
    isSupervising,
  } = useAuth();

  const location = useLocation();
  const isPOSRoute =
    location.pathname === "/" || location.pathname === "/ventas";

  const [isTerminalConfigured, setIsTerminalConfigured] = useState(
    !!terminalService.getTerminalId() ||
      sessionStorage.getItem("visor_mode") === "true",
  );
  const [isValidating, setIsValidating] = useState(false);

  // Flag persistente en localStorage para evitar re-validaciones innecesarias
  // Este flag dura entre pestañas y sesiones hasta que se cierre el navegador
  const terminalValidatedKey = "terminal_validated_global";

  // Validar existencia de terminal solo una vez al cargar la app
  useEffect(() => {
    if (!user || isValidating) return;

    // No validar si estamos en modo visor
    if (sessionStorage.getItem("visor_mode") === "true") {
      return;
    }

    // Verificar si ya foi validado nesta sessão ou sessão anterior
    const sessionValidated = sessionStorage.getItem("terminal_validated");
    const globalValidated = localStorage.getItem(terminalValidatedKey);
    
    if (sessionValidated === "true" || globalValidated === "true") {
      console.log("[Routing] Terminal ya validada previamente.");
      return;
    }

    const validateTerminal = async () => {
      // Re-verificar el estado actual de la terminal antes de validar
      const currentTerminalId = terminalService.getTerminalId();
      
      if (!currentTerminalId) {
        console.log("[Routing] No hay terminal ID, requiriendo configuración");
        setIsTerminalConfigured(false);
        return;
      }

      setIsValidating(true);
      try {
        const isValid = await terminalService.validateTerminalExistence();
        if (!isValid) {
          console.log("[Routing] Validación falló, mostrando TerminalSetup");
          setIsTerminalConfigured(false);
          localStorage.removeItem(terminalValidatedKey);
        } else {
          console.log("[Routing] Terminal validada exitosamente");
          sessionStorage.setItem("terminal_validated", "true");
          localStorage.setItem(terminalValidatedKey, "true");
        }
      } catch (err) {
        console.error("[Routing] Error en validación de terminal:", err);
        // En caso de error, permitir continuar si hay ID local
        if (currentTerminalId) {
          sessionStorage.setItem("terminal_validated", "true");
          localStorage.setItem(terminalValidatedKey, "true");
        } else {
          setIsTerminalConfigured(false);
        }
      } finally {
        setIsValidating(false);
      }
    };

    validateTerminal();
  }, [user?.id]);

  // Verificar sesión de caja por separado
  useEffect(() => {
    if (
      user &&
      activeStaff &&
      !isLocked &&
      isTerminalConfigured &&
      !isValidating
    ) {
      checkCashSession();
    }
  }, [user, activeStaff, isLocked, isTerminalConfigured, isValidating]);

  if (loading || isValidating || isLicenseValidating)
    return <div className="loading-screen">Verificando configuración...</div>;
  if (!user) return <Navigate to="/login" />;

  // 0. Verificación de Licencia Expirada
  if (isLicenseExpired) {
    return <ExpiredLicense />;
  }

  // 1. Verificación de Terminal (Fundamental para operar)
  if (!isTerminalConfigured) {
    return (
      <TerminalSetup
        onTerminalConfigured={() => {
          setIsTerminalConfigured(true);
          // Guardar flag global para evitar re-validación
          sessionStorage.setItem("terminal_validated", "true");
          localStorage.setItem("terminal_validated_global", "true");
        }}
      />
    );
  }

  // 2. Si la pantalla está bloqueada, mostrar pantalla de PIN
  if (isLocked) return <LockScreen />;

  // 3. Si necesita ingresar fondo de caja y está en Ventas, mostrar modal (excepto en supervisión)
  if (
    needsCashFund &&
    isPOSRoute &&
    !isSupervising &&
    !(sessionStorage.getItem("visor_mode") === "true")
  ) {
    return (
      <CashFundModal
        staffName={activeStaff?.name || storeName || "Operador"}
        staffId={activeStaff?.id}
        onSessionCreated={(session) => {
          // La sesión se actualiza automáticamente en el contexto
          console.log("Sesión de caja creada:", session);
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
        <ScrollTopButton />
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
    <HashRouter>
      <BackButtonHandler />
      <ScrollToTop />
      <Routes>
        {/* Pantalla Cliente: Independiente de AuthProvider y ProductProvider */}
        <Route path="/customer-display" element={<CustomerDisplay />} />

        {/* Portal de SuperAdministrador: Totalmente Aislado */}
        <Route path="/superadmin" element={<SuperAdminPortal />} />

        {/* Rutas de la Aplicación Principal */}
        <Route
          path="/*"
          element={
            <AuthProvider>
              <ProductProvider>
                <SettingsProvider>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/update-password" element={<UpdatePassword />} />
                    <Route
                      path="/register/:invitationCode?"
                      element={<Login />}
                    />

                    <Route
                      path="/"
                      element={
                        <PrivateLayout>
                          {sessionStorage.getItem("visor_mode") === "true" ? <Navigate to="/estadisticas" replace /> : <Sales />}
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/ventas"
                      element={
                        <PrivateLayout>
                          {sessionStorage.getItem("visor_mode") === "true" ? <Navigate to="/estadisticas" replace /> : <Sales />}
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/ordenes"
                      element={
                        <PrivateLayout>
                          <Orders />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/clientes"
                      element={
                        <PrivateLayout>
                          <Customers />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/inventario"
                      element={
                        <PrivateLayout>
                          <Inventory />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/proveedores"
                      element={
                        <PrivateLayout>
                          <Suppliers />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/historial"
                      element={
                        <PrivateLayout>
                          <Historial />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/estadisticas"
                      element={
                        <PrivateLayout>
                          <Stats />
                        </PrivateLayout>
                      }
                    />

                    {/* Gestión de Usuarios y Asistencia solo para Admin */}
                    <Route
                      path="/usuarios"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <UserManager />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/asistencia"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <AttendanceRegistry />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/configuracion"
                      element={
                        <PrivateLayout>
                          <ConfiguracionHub />
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/configuracion-dolares"
                      element={
                        <PrivateLayout>
                          <ExchangeRateSettings />
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/config-ticket"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <TicketConfig />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/config-impuestos"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <TaxConfig />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/config-pagos"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <PaymentMethodsConfig />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/config-emisores"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <BillingIssuers />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/config-inventario"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <InventoryConfig />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/mantenimiento"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <Maintenance />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/nexumpos-soporte"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <Maintenance />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="*"
                      element={
                        <div style={{ padding: "2rem", textAlign: "center" }}>
                          <h1>Error 404</h1>
                          <p>Página no encontrada</p>
                          <Link to="/">Volver al Inicio</Link>
                        </div>
                      }
                    />
                  </Routes>
                </SettingsProvider>
              </ProductProvider>
            </AuthProvider>
          }
        />
      </Routes>
    </HashRouter>
  );
};
