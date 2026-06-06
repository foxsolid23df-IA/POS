import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabase";
import { staffService } from "../services/staffService";
import { cashSessionService } from "../services/cashSessionService";
import {
  secureSet,
  secureGet,
  secureRemove,
  purgeSessionData,
  isSessionExpired,
} from "../utils/secureStorage";
import { useSessionTimeout } from "../hooks/useSessionTimeout";
import { isAbortError } from "../utils/supabaseErrorHandler";
import { SessionTimeoutModal } from "../components/common/SessionTimeoutModal";
import { isWebAdminMode } from "../utils/appMode";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const webAdminMode = isWebAdminMode();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Empleado activo (quien está usando la caja)
  const [activeStaff, setActiveStaff] = useState(null);
  const [isVerifyingAttendance, setIsVerifyingAttendance] = useState(false);
  const [isLicenseExpired, setIsLicenseExpired] = useState(false);
  const [isLicenseValidating, setIsLicenseValidating] = useState(true);

  // Sistema de sesión de caja (fondo de caja)
  const [cashSession, setCashSession] = useState(null);
  const [needsCashFund, setNeedsCashFund] = useState(false);

  // Estado para el modal de advertencia de sesión
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // La pantalla está bloqueada si hay sesión pero no hay empleado activo
  const isLocked = !!session && !activeStaff;

  // Modo Supervisión: No hay caja abierta para el empleado actual
  // Esto permite entrar al sistema para ver inventario o cerrar el día sin forzar fondo inicial
  const isSupervising = !!activeStaff && needsCashFund;

  // Timeout de sesión por inactividad (15 minutos)
  const handleSessionTimeout = () => {
    console.warn("[Auth] Cerrando sesión por inactividad");
    purgeSessionData();
    supabase.auth
      .signOut({ scope: "local" })
      .then(() => {
        setProfile(null);
        setUser(null);
        setSession(null);
        setActiveStaff(null);
        setCashSession(null);
        setNeedsCashFund(false);
      })
      .catch(() => {
        /* silenciar error de logout automático */
      });
  };

  // useSessionTimeout(handleSessionTimeout, 15 * 60 * 1000);
  const { resetTimeout } = useSessionTimeout(
    handleSessionTimeout,
    () => setShowTimeoutWarning(true),
    12 * 60 * 60 * 1000, // 12 horas
    15 * 60 * 1000,      // 15 minutos de advertencia
  );

  useEffect(() => {
    if (user && isSessionExpired(12 * 60 * 60 * 1000)) {
      console.warn("[Auth] Sesión expirada al cargar");
      handleSessionTimeout();
    }
  }, [user]);

  const handleExtendSession = () => {
    setShowTimeoutWarning(false);
    resetTimeout();
  };

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        if (webAdminMode) return;
        // Intentar restaurar sesion de empleado activa (con integridad verificada)
        secureGet("activeStaff", 24 * 60 * 60 * 1000)
          .then((savedStaff) => {
            if (savedStaff) {
              // Si tiene el permiso, verificar asistencia antes de restaurar
              if (savedStaff.permissions?.require_check_in) {
                import("../services/attendanceService").then(
                  ({ attendanceService }) => {
                    attendanceService
                      .getLastLog(savedStaff.id)
                      .then((lastLog) => {
                        if (!lastLog || lastLog.action === "check_out") {
                          secureRemove("activeStaff");
                          setActiveStaff(null);
                        } else {
                          setActiveStaff(savedStaff);
                        }
                      });
                  },
                );
              } else {
                setActiveStaff(savedStaff);
              }
            }
          })
          .catch(() => {
            // Si hay error de integridad, limpiar
            secureRemove("activeStaff");
          });
      } else {
        setLoading(false);
        setIsLicenseValidating(false);
      }
    });

    // 2. Listen for changes
    let currentUserId = null;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] Evento de autenticación:", event);
      
      if (event === "PASSWORD_RECOVERY") {
        console.log("[Auth] Detectado flujo de recuperación de contraseña. Redirigiendo...");
        // Usamos un timeout corto para permitir que el router se inicialice correctamente
        setTimeout(() => {
          window.location.hash = "#/update-password";
        }, 100);
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Solo recargar perfil completo si es un usuario NUEVO (login real)
        // Si es el MISMO usuario (re-auth para verificar contraseña), hacer refresh silencioso
        if (currentUserId && currentUserId === session.user.id) {
          console.log(
            "[Auth] Mismo usuario re-autenticado, refresh silencioso.",
          );
          fetchProfile(session.user.id, true);
        } else {
          console.log("[Auth] Nuevo usuario detectado, carga completa.");
          currentUserId = session.user.id;
          fetchProfile(session.user.id, false);
        }
      } else {
        currentUserId = null;
        setProfile(null);
        setActiveStaff(null);
        secureRemove("activeStaff");
        setLoading(false);
        setIsLicenseValidating(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        console.warn("Error fetching profile:", error);
      }
      setProfile(data);

      // Check license status before assuming the app is ready
      await checkLicenseStatus(userId, silent);

      if (webAdminMode) {
        setCashSession(null);
        setNeedsCashFund(false);

        if (data?.role === "admin") {
          const adminStaff = {
            name: data.full_name || "Administrador",
            role: "admin",
            isOwner: true,
            webAdmin: true,
          };
          setActiveStaff(adminStaff);
          secureSet("activeStaff", adminStaff);
        } else {
          setActiveStaff(null);
          secureRemove("activeStaff");
        }
        return;
      }

      // Verificar sesión de caja inmediatamente después de obtener el perfil
      await checkCashSession(data);
    } catch (error) {
      console.error("Error in fetchProfile:", error);
      if (!silent) setIsLicenseValidating(false);
    } finally {
      console.log("[Auth] Carga de perfil finalizada.");
      if (!silent) setLoading(false);
    }
  };

  const checkLicenseStatus = async (userId, silent = false) => {
    try {
      if (!silent) setIsLicenseValidating(true);
      const { data, error } = await supabase
        .from("invitation_codes")
        .select("expires_at")
        .eq("used_by", userId)
        .maybeSingle();

      if (error) {
        console.warn("Error fetching license status:", error);
        setIsLicenseExpired(false); // Fail open if error
        return;
      }

      if (data?.expires_at) {
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        if (now > expiresAt) {
          setIsLicenseExpired(true);
        } else {
          setIsLicenseExpired(false);
        }
      } else {
        // Obsolete or old users without expiration
        setIsLicenseExpired(false);
      }
    } catch (error) {
      console.error("Error verifying license:", error);
    } finally {
      if (!silent) setIsLicenseValidating(false);
    }
  };

  // Login del dueño con email/password
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (webAdminMode) return data;

    // Al iniciar sesion, el dueno es el operador activo
    const ownerStaff = { name: "Propietario", role: "admin", isOwner: true };
    setActiveStaff(ownerStaff);
    secureSet("activeStaff", ownerStaff);
    
    return data;
  };

  // Registro de nueva tienda
  const signUp = async (
    email,
    password,
    storeName,
    fullName,
    invitationCodeId = null,
    licenseType = "monocaja",
    maxRegisters = 1,
  ) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (authError) throw authError;

    if (authData.user) {
      const { error: profileError } = await supabase.from("profiles").insert([
        {
          id: authData.user.id,
          store_name: storeName,
          full_name: fullName,
          role: "admin",
          license_type: licenseType,
          max_registers: maxRegisters,
        },
      ]);

      if (profileError) {
        console.error("Error creating profile:", profileError);
        throw new Error("Error creating user profile: " + profileError.message);
      }

      // Marcar el código de invitación como usado después del registro exitoso
      if (invitationCodeId && authData.user.id) {
        try {
          // Importación dinámica para evitar dependencias circulares
          const invitationService = (
            await import("../services/invitationService")
          ).invitationService;
          await invitationService.markAsUsed(
            invitationCodeId,
            authData.user.id,
          );
        } catch (codeError) {
          // Si falla marcar como usado, registrar pero no bloquear el registro
          console.error(
            "Error marcando código de invitación como usado:",
            codeError,
          );
          // No lanzamos el error para no bloquear el registro exitoso
        }
      }
    }
    // Al registrarse, el dueno es el operador activo
    const ownerStaff = { name: fullName, role: "admin", isOwner: true };
    setActiveStaff(ownerStaff);
    secureSet("activeStaff", ownerStaff);
    return authData;
  };

  // Cerrar sesion LOCAL (afecta solo a este dispositivo)
  const logout = async () => {
    // Usamos { scope: 'local' } para que no cierre las sesiones en otros equipos
    // del mismo usuario (propietario).
    await supabase.auth.signOut({ scope: "local" });
    setProfile(null);
    setUser(null);
    setSession(null);
    setActiveStaff(null);
    secureRemove("activeStaff");
    setCashSession(null);
    setNeedsCashFund(false);
    setIsLicenseExpired(false);
  };

  // Solicitar reseteo de contraseña
  const resetPassword = async (email) => {
    // Usamos VITE_SITE_URL si está definido (para producción), de lo contrario usamos el origen actual (local)
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/`,
    });
    if (error) throw error;
    return data;
  };

  // Actualizar contraseña (después de usar el link)
  const updatePassword = async (newPassword) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
    return data;
  };

  // Validar PIN de empleado SIN iniciar sesión (para auditoria o checks previos)
  const validateStaffPin = async (pin) => {
    try {
      return await staffService.validatePin(pin);
    } catch (error) {
      throw new Error("PIN inválido o empleado inactivo");
    }
  };

  // Validar PIN maestro sin cambiar el operador activo ni desbloquear la caja.
  const validateMasterPin = async (pin) => {
    if (!user?.id) throw new Error("No hay usuario activo");

    const inputPin = String(pin || "").trim();
    if (!inputPin) {
      throw new Error("Ingresa el PIN maestro");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("master_pin")
      .eq("id", user.id)
      .single();

    if (error) {
      throw new Error(error.message || "No se pudo validar el PIN maestro");
    }

    const storedPin = String(data?.master_pin || "").trim();
    if (!storedPin) {
      throw new Error("Configura primero el PIN maestro");
    }

    if (storedPin !== inputPin) {
      throw new Error("PIN maestro incorrecto");
    }

    return true;
  };

  // Login de empleado por PIN (Carga la sesion)
  const loginWithPin = async (pin) => {
    const staff = await validateStaffPin(pin);
    setActiveStaff(staff);
    secureSet("activeStaff", staff);
    return staff;
  };

  // Login directo de empleado (usado para auto-login por huella)
  const loginAs = (staff) => {
    setActiveStaff(staff);
    secureSet("activeStaff", staff);
  };

  // Bloquear pantalla (requiere PIN para continuar)
  const lockScreen = () => {
    setActiveStaff(null);
    secureRemove("activeStaff");
  };

  // Desbloquear como propietario (sin cerrar sesion de la tienda)
  const unlockAsOwner = () => {
    const ownerStaff = {
      name: profile?.full_name || "Propietario",
      role: "admin",
      isOwner: true,
    };
    setActiveStaff(ownerStaff);
    secureSet("activeStaff", ownerStaff);
  };

  // Desbloquear con PIN maestro (Modo Supervisión)
  const unlockWithMasterPin = async (pin) => {
    if (!user?.id) throw new Error("No hay usuario activo");

    const { data, error } = await supabase
      .from("profiles")
      .select("master_pin, full_name")
      .eq("id", user.id)
      .single();

    console.log("[Auth] Verificando PIN Maestro para user:", user.id);
    console.log("[Auth] PIN Maestro encontrado:", Boolean(data?.master_pin));

    const storedPin = String(data?.master_pin || "").trim();
    const inputPin = String(pin || "").trim();

    console.log("[Auth] Verificación Detallada:", {
      userId: user.id,
      storedLength: storedPin.length,
      inputLength: inputPin.length,
      match: storedPin === inputPin,
    });

    // Validar exclusivamente contra el PIN maestro configurado para la tienda.
    if (storedPin !== "" && storedPin === inputPin) {
      console.log("[Auth] Acceso Maestro concedido.");
    } else {
      console.warn(
        "[Auth] Acceso Maestro denegado. PIN ingresado no coincide con el guardado.",
      );
      throw new Error("PIN maestro incorrecto o no configurado");
    }

    const ownerStaff = {
      name: data.full_name || "Propietario",
      role: "admin",
      isOwner: true,
    };
    setActiveStaff(ownerStaff);
    secureSet("activeStaff", ownerStaff);
    return true;
  };

  // Verificar si hay sesión de caja activa
  const checkCashSession = async (profileOverride = profile) => {
    if (webAdminMode) {
      setCashSession(null);
      setNeedsCashFund(false);
      return null;
    }

    try {
      const cashboxMode = profileOverride?.cashbox_mode || "terminal";
      const session = await cashSessionService.getActiveSession(cashboxMode);
      if (session) {
        setCashSession(session);
        setNeedsCashFund(false);
      } else {
        setCashSession(null);
        setNeedsCashFund(true);
      }
      return session;
    } catch (error) {
      if (typeof isAbortError === 'function' && !isAbortError(error)) {
        console.error("Error verificando sesión de caja:", error);
      } else if (typeof isAbortError !== 'function') {
        console.error("Error verificando sesión de caja (isAbortError no definido):", error);
      }
      setNeedsCashFund(true);
      return null;
    }
  };

  // Abrir sesión de caja con fondo inicial
  const openCashSession = async (openingFund) => {
    if (webAdminMode) {
      throw new Error("Caja no disponible en modo web admin.");
    }

    const staffName = activeStaff?.name || profile?.full_name || "Propietario";
    const staffId = activeStaff?.id || null;
    const cashboxMode = profile?.cashbox_mode || "terminal";

    const session = await cashSessionService.openSession(
      staffName,
      openingFund,
      staffId,
      cashboxMode,
    );
    setCashSession(session);
    setNeedsCashFund(false);
    return session;
  };

  // Cerrar sesión de caja actual
  const closeCashSession = async () => {
    if (webAdminMode) return;
    if (!cashSession) return;
    await cashSessionService.closeSession(cashSession.id);
    setCashSession(null);
    setNeedsCashFund(true);
  };

  // Verificar permisos basados en el empleado ACTIVO.
  // En web admin no hay flujo de PIN/caja, por eso el perfil admin tambien
  // debe habilitar permisos aunque activeStaff aun no se haya hidratado.
  const isWebAdminOwner = webAdminMode && profile?.role === "admin";
  const activeRole = activeStaff?.role || (isWebAdminOwner ? "admin" : "cajero");
  const canAccessAdmin = isWebAdminOwner || activeStaff?.isOwner || activeRole === "admin";
  const canAccessReports = canAccessAdmin || activeRole === "gerente";

  const memoizedUser = React.useMemo(
    () => (user ? { ...user, ...profile } : null),
    [user, profile],
  );

  const value = {
    // Usuario autenticado de Supabase (dueño de la tienda)
    user: memoizedUser,
    token: session?.access_token,

    // Funciones de auth principales
    login,
    signUp,
    logout,
    resetPassword,
    updatePassword,
    loading,

    // PERMISOS basados en el empleado activo
    isAdmin: canAccessAdmin, // Solo propietario o admin pueden gestionar usuarios
    canAccessReports: canAccessReports, // Gerentes pueden ver reportes
    activeRole, // Rol del empleado actual

    // Sistema de empleados
    activeStaff, // Quien está operando la caja actualmente
    isLocked, // Si la pantalla está bloqueada
    loginWithPin, // Login de empleado por PIN
    validateStaffPin, // Validar PIN sin sesión
    validateMasterPin, // Validar PIN maestro sin cambiar sesion
    loginAs, // Login de empleado directo
    lockScreen, // Bloquear pantalla
    unlockAsOwner, // Desbloquear como propietario
    unlockWithMasterPin, // Desbloquear con PIN maestro
    isSupervising, // Está en modo supervisión (caja cerrada)

    // Sistema de sesión de caja (fondo de caja)
    cashSession, // Sesión de caja activa
    needsCashFund, // Si necesita ingresar fondo de caja
    checkCashSession, // Verificar si hay sesión activa
    openCashSession, // Abrir sesión con fondo inicial
    closeCashSession, // Cerrar sesión de caja

    // Info de la licencia
    isLicenseExpired,
    isLicenseValidating,
    isWebAdminMode: webAdminMode,

    // Info de la tienda
    storeName: profile?.store_name,

    // Refrescar perfil
    fetchProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
      {showTimeoutWarning && (
        <SessionTimeoutModal
          onExtend={handleExtendSession}
          onLogout={handleSessionTimeout}
          countdownSeconds={60}
        />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
