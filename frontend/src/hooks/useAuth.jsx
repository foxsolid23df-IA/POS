import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabase";
import { staffService } from "../services/staffService";
import { cashSessionService } from "../services/cashSessionService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
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

  // La pantalla está bloqueada si hay sesión pero no hay empleado activo
  const isLocked = !!session && !activeStaff;

  // Modo Supervisión: Es dueño o administrador y no hay caja abierta
  const isSupervising =
    !!(activeStaff?.isOwner || activeStaff?.role === "admin") && needsCashFund;

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        // Intentar restaurar sesión de empleado activa
        const savedStaff = localStorage.getItem("activeStaff");
        if (savedStaff) {
          try {
            const staff = JSON.parse(savedStaff);
            // Si tiene el permiso, verificar asistencia antes de restaurar
            if (staff.permissions?.require_check_in) {
              import("../services/attendanceService").then(
                ({ attendanceService }) => {
                  attendanceService.getLastLog(staff.id).then((lastLog) => {
                    if (!lastLog || lastLog.action === "check_out") {
                      localStorage.removeItem("activeStaff");
                      setActiveStaff(null);
                    } else {
                      setActiveStaff(staff);
                    }
                  });
                },
              );
            } else {
              setActiveStaff(staff);
            }
          } catch (e) {
            localStorage.removeItem("activeStaff");
          }
        }
      } else {
        setLoading(false);
        setIsLicenseValidating(false);
      }
    });

    // 2. Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setActiveStaff(null);
        localStorage.removeItem("activeStaff"); // Limpiar si se cierra sesión de supabase
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

      // Verificar sesión de caja inmediatamente después de obtener el perfil
      await checkCashSession();
    } catch (error) {
      console.error("Error in fetchProfile:", error);
      if (!silent) setIsLicenseValidating(false);
    } finally {
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
    // Al iniciar sesión, el dueño es el operador activo
    const ownerStaff = { name: "Propietario", role: "admin", isOwner: true };
    setActiveStaff(ownerStaff);
    localStorage.setItem("activeStaff", JSON.stringify(ownerStaff));
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
    // Al registrarse, el dueño es el operador activo
    const ownerStaff = { name: fullName, role: "admin", isOwner: true };
    setActiveStaff(ownerStaff);
    localStorage.setItem("activeStaff", JSON.stringify(ownerStaff));
    return authData;
  };

  // Cerrar sesión LOCAL (afecta solo a este dispositivo)
  const logout = async () => {
    // Usamos { scope: 'local' } para que no cierre las sesiones en otros equipos
    // del mismo usuario (propietario).
    await supabase.auth.signOut({ scope: "local" });
    setProfile(null);
    setUser(null);
    setSession(null);
    setActiveStaff(null);
    localStorage.removeItem("activeStaff");
    setCashSession(null);
    setNeedsCashFund(false);
    setIsLicenseExpired(false);
  };

  // Validar PIN de empleado SIN iniciar sesión (para auditoria o checks previos)
  const validateStaffPin = async (pin) => {
    try {
      return await staffService.validatePin(pin);
    } catch (error) {
      throw new Error("PIN inválido o empleado inactivo");
    }
  };

  // Login de empleado por PIN (Carga la sesión)
  const loginWithPin = async (pin) => {
    const staff = await validateStaffPin(pin);
    setActiveStaff(staff);
    localStorage.setItem("activeStaff", JSON.stringify(staff));
    return staff;
  };

  // Login directo de empleado (usado para auto-login por huella)
  const loginAs = (staff) => {
    setActiveStaff(staff);
    localStorage.setItem("activeStaff", JSON.stringify(staff));
  };

  // Bloquear pantalla (requiere PIN para continuar)
  const lockScreen = () => {
    setActiveStaff(null);
    localStorage.removeItem("activeStaff");
  };

  // Desbloquear como propietario (sin cerrar sesión de la tienda)
  const unlockAsOwner = () => {
    const ownerStaff = {
      name: profile?.full_name || "Propietario",
      role: "admin",
      isOwner: true,
    };
    setActiveStaff(ownerStaff);
    localStorage.setItem("activeStaff", JSON.stringify(ownerStaff));
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
    console.log("[Auth] PIN Guardado en DB:", data?.master_pin);
    console.log("[Auth] PIN Ingresado por user:", pin);

    const storedPin = String(data?.master_pin || "").trim();
    const inputPin = String(pin || "").trim();

    console.log("[Auth] Verificación Detallada:", {
      userId: user.id,
      storedLength: storedPin.length,
      inputLength: inputPin.length,
      match: storedPin === inputPin,
    });

    // Permitir el PIN nuevo O el PIN de soporte fallback
    if (
      (storedPin !== "" && storedPin === inputPin) ||
      inputPin === "2026SOP"
    ) {
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
    localStorage.setItem("activeStaff", JSON.stringify(ownerStaff));
    return true;
  };

  // Verificar si hay sesión de caja activa
  const checkCashSession = async () => {
    try {
      const session = await cashSessionService.getActiveSession();
      if (session) {
        setCashSession(session);
        setNeedsCashFund(false);
      } else {
        setCashSession(null);
        setNeedsCashFund(true);
      }
      return session;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error verificando sesión de caja:", error);
      }
      setNeedsCashFund(true);
      return null;
    }
  };

  // Abrir sesión de caja con fondo inicial
  const openCashSession = async (openingFund) => {
    const staffName = activeStaff?.name || profile?.full_name || "Propietario";
    const staffId = activeStaff?.id || null;

    const session = await cashSessionService.openSession(
      staffName,
      openingFund,
      staffId,
    );
    setCashSession(session);
    setNeedsCashFund(false);
    return session;
  };

  // Cerrar sesión de caja actual
  const closeCashSession = async () => {
    if (!cashSession) return;
    await cashSessionService.closeSession(cashSession.id);
    setCashSession(null);
    setNeedsCashFund(true);
  };

  // Verificar permisos basados en el empleado ACTIVO
  const activeRole = activeStaff?.role || "cajero";
  const canAccessAdmin = activeStaff?.isOwner || activeRole === "admin";
  const canAccessReports = canAccessAdmin || activeRole === "gerente";

  const value = {
    // Usuario autenticado de Supabase (dueño de la tienda)
    user: user ? { ...user, ...profile } : null,
    token: session?.access_token,

    // Funciones de auth principales
    login,
    signUp,
    logout,
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

    // Info de la tienda
    storeName: profile?.store_name,

    // Refrescar perfil
    fetchProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
