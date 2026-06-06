import React, { Suspense, lazy, useEffect, useState } from "react";
import {
  Routes,
  Route,
  HashRouter,
  Link,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Sidebar } from "../components/sidebar/Sidebar";
import { Login } from "../components/auth/Login";
import { UpdatePassword } from "../components/auth/UpdatePassword";
import { LockScreen } from "../components/auth/LockScreen";
import { ExpiredLicense } from "../components/auth/ExpiredLicense";
import { CashFundModal } from "../components/auth/CashFundModal";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { TerminalSetup } from "../components/config/TerminalSetup";
import { ConfiguracionHub } from "../components/config/ConfiguracionHub";
import { terminalService } from "../services/terminalService";
import { ScrollToTop } from "../components/common/ScrollToTop";
import { ScrollTopButton } from "../components/common/ScrollTopButton";
import { ProductProvider } from "../contexts/ProductContext";
import { SettingsProvider } from "../contexts/SettingsContext";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";
import { isWebAdminMode } from "../utils/appMode";

const Sales = lazy(() => import("../components/sales/Sales").then(m => ({ default: m.Sales })));
const Inventory = lazy(() => import("../components/inventory/Inventory").then(m => ({ default: m.Inventory })));
const Historial = lazy(() => import("../components/historial/Historial").then(m => ({ default: m.Historial })));
const Stats = lazy(() => import("../components/stats/Stats").then(m => ({ default: m.Stats })));
const Customers = lazy(() => import("../components/customers/Customers").then(m => ({ default: m.Customers })));
const UserManager = lazy(() => import("../components/admin/UserManager").then(m => ({ default: m.UserManager })));
const AttendanceRegistry = lazy(() => import("../components/admin/AttendanceRegistry").then(m => ({ default: m.AttendanceRegistry })));
const Suppliers = lazy(() => import("../components/suppliers/Suppliers"));
const CustomerDisplay = lazy(() => import("../components/customer/CustomerDisplay"));
const ExchangeRateSettings = lazy(() => import("../components/admin/ExchangeRateSettings"));
const TicketConfig = lazy(() => import("../components/config/TicketConfig").then(m => ({ default: m.TicketConfig })));
const TaxConfig = lazy(() => import("../components/config/TaxConfig"));
const PaymentMethodsConfig = lazy(() => import("../components/config/PaymentMethodsConfig"));
const CashboxConfig = lazy(() => import("../components/config/CashboxConfig"));
const BillingIssuers = lazy(() => import("../components/config/BillingIssuers"));
const InventoryConfig = lazy(() => import("../components/config/InventoryConfig"));
const AppUpdates = lazy(() => import("../components/config/AppUpdates"));
const Maintenance = lazy(() => import("../components/admin/Maintenance"));
const Orders = lazy(() => import("../components/orders/Orders").then(m => ({ default: m.Orders })));
const CreditMenu = lazy(() => import("../components/credit/CreditMenu").then(m => ({ default: m.CreditMenu })));
const CustomerCreditCard = lazy(() => import("../components/credit/CustomerCreditCard").then(m => ({ default: m.CustomerCreditCard })));
const SuperAdminPortal = lazy(() => import("../pages/SuperAdmin/SuperAdminPortal").then(m => ({ default: m.SuperAdminPortal })));

// Componente invisible que maneja el botón "Atrás" de Android
const BackButtonHandler = () => {
  useAndroidBackButton();
  return null;
};

const AccessRestricted = () => {
  const { logout } = useAuth();

  return (
    <div className="loading-screen" style={{ gap: "1rem", padding: "2rem", textAlign: "center" }}>
      <span className="material-icons-outlined" style={{ fontSize: "3rem", color: "#ef4444" }}>
        admin_panel_settings
      </span>
      <h1 style={{ margin: 0 }}>Acceso restringido</h1>
      <p style={{ maxWidth: "32rem", margin: 0 }}>
        Esta version web solo esta disponible para cuentas administradoras.
      </p>
      <button type="button" className="btn-primary" onClick={logout}>
        Cerrar sesion
      </button>
    </div>
  );
};

const WebAdminLayout = ({ children }) => {
  const { user, loading, isLicenseExpired, isLicenseValidating } = useAuth();

  if (loading || isLicenseValidating)
    return <div className="loading-screen">Verificando acceso...</div>;
  if (!user) return <Navigate to="/login" />;
  if (isLicenseExpired) return <ExpiredLicense />;
  if (user.role !== "admin") return <AccessRestricted />;

  return (
    <div className="app-layout web-admin-layout">
      <Sidebar />
      <main className="main-content web-admin-main">
        <div className="web-admin-content-frame">{children}</div>
        <ScrollTopButton />
      </main>
    </div>
  );
};

const DesktopPOSLayout = ({ children }) => {
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
  // Validar existencia de terminal solo una vez al cargar la app
  useEffect(() => {
    if (!user || isValidating) return;

    // No validar si estamos en modo visor
    if (sessionStorage.getItem("visor_mode") === "true") {
      return;
    }

    // Verificar si ya foi validado nesta sessão ou sessão anterior
    const sessionValidated = sessionStorage.getItem("terminal_validated");
    
    if (sessionValidated === "true") {
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
        } else {
          console.log("[Routing] Terminal validada exitosamente");
          sessionStorage.setItem("terminal_validated", "true");
        }
      } catch (err) {
        console.error("[Routing] Error en validación de terminal:", err);
        // En caso de error, permitir continuar si hay ID local
        if (currentTerminalId) {
          sessionStorage.setItem("terminal_validated", "true");
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

const PrivateLayout = ({ children }) =>
  isWebAdminMode() ? (
    <WebAdminLayout>{children}</WebAdminLayout>
  ) : (
    <DesktopPOSLayout>{children}</DesktopPOSLayout>
  );

const AdminRoute = ({ children }) => {
  const { isAdmin, user } = useAuth();
  if (isWebAdminMode() && user?.role === "admin") return children;
  return isAdmin ? children : <Navigate to="/" />;
};

const PermissionRoute = ({ children, permission, reports = false }) => {
  const { isAdmin, activeStaff, canAccessReports, user } = useAuth();
  if (isWebAdminMode() && user?.role === "admin") return children;
  if (isAdmin) return children;
  if (reports && canAccessReports) return children;
  if (permission && activeStaff?.permissions?.[permission]) return children;
  return <Navigate to="/" />;
};

export const Routing = () => {
  return (
    <HashRouter>
      <BackButtonHandler />
      <ScrollToTop />
      <Suspense fallback={<div className="loading-screen">Cargando módulo...</div>}>
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
                          {isWebAdminMode() || sessionStorage.getItem("visor_mode") === "true" ? <Navigate to="/estadisticas" replace /> : <Sales />}
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/ventas"
                      element={
                        <PrivateLayout>
                          {isWebAdminMode() || sessionStorage.getItem("visor_mode") === "true" ? <Navigate to="/estadisticas" replace /> : <Sales />}
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
                          <PermissionRoute permission="inventory">
                            <Inventory />
                          </PermissionRoute>
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/creditos"
                      element={
                        <PrivateLayout>
                          <PermissionRoute reports>
                            <CreditMenu />
                          </PermissionRoute>
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/creditos/:customerId"
                      element={
                        <PrivateLayout>
                          <PermissionRoute reports>
                            <CustomerCreditCard />
                          </PermissionRoute>
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/proveedores"
                      element={
                        <PrivateLayout>
                          <PermissionRoute permission="inventory">
                            <Suppliers />
                          </PermissionRoute>
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/historial"
                      element={
                        <PrivateLayout>
                          <PermissionRoute reports>
                            <Historial />
                          </PermissionRoute>
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/estadisticas"
                      element={
                        <PrivateLayout>
                          <PermissionRoute reports>
                            <Stats />
                          </PermissionRoute>
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
                      path="/config-caja"
                      element={
                        <PrivateLayout>
                          {isWebAdminMode() ? (
                            <Navigate to="/configuracion" replace />
                          ) : (
                            <AdminRoute>
                              <CashboxConfig />
                            </AdminRoute>
                          )}
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
                      path="/config-actualizaciones"
                      element={
                        <PrivateLayout>
                          {isWebAdminMode() ? (
                            <Navigate to="/configuracion" replace />
                          ) : (
                            <AdminRoute>
                              <AppUpdates />
                            </AdminRoute>
                          )}
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
      </Suspense>
    </HashRouter>
  );
};
