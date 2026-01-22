import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { staffService } from '../services/staffService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Empleado activo (quien está usando la caja)
    const [activeStaff, setActiveStaff] = useState(null);

    // La pantalla está bloqueada si hay sesión pero no hay empleado activo
    const isLocked = !!session && !activeStaff;

    useEffect(() => {
        // 1. Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
                // NO auto-desbloquear, requiere PIN o acceso como propietario
            } else {
                setLoading(false);
            }
        });

        // 2. Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchProfile(session.user.id);
            } else {
                setProfile(null);
                setActiveStaff(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchProfile = async (userId) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                console.warn('Error fetching profile:', error);
            }
            setProfile(data);
        } catch (error) {
            console.error('Error in fetchProfile:', error);
        } finally {
            setLoading(false);
        }
    };

    // Login del dueño con email/password
    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Al iniciar sesión, el dueño es el operador activo
        setActiveStaff({ name: 'Propietario', role: 'admin', isOwner: true });
        return data;
    };

    // Registro de nueva tienda
    const signUp = async (email, password, storeName, fullName, invitationCodeId = null) => {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });
        if (authError) throw authError;

        if (authData.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([
                    {
                        id: authData.user.id,
                        store_name: storeName,
                        full_name: fullName,
                        role: 'admin'
                    }
                ]);

            if (profileError) {
                console.error('Error creating profile:', profileError);
                throw new Error('Error creating user profile: ' + profileError.message);
            }

            // Marcar el código de invitación como usado después del registro exitoso
            if (invitationCodeId && authData.user.id) {
                try {
                    // Importación dinámica para evitar dependencias circulares
                    const invitationService = (await import('../services/invitationService')).invitationService;
                    await invitationService.markAsUsed(invitationCodeId, authData.user.id);
                } catch (codeError) {
                    // Si falla marcar como usado, registrar pero no bloquear el registro
                    console.error('Error marcando código de invitación como usado:', codeError);
                    // No lanzamos el error para no bloquear el registro exitoso
                }
            }
        }
        // Al registrarse, el dueño es el operador activo
        setActiveStaff({ name: fullName, role: 'admin', isOwner: true });
        return authData;
    };

    // Cerrar sesión COMPLETA (desvincula el dispositivo de la tienda)
    const logout = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
        setActiveStaff(null);
    };

    // Login de empleado por PIN
    const loginWithPin = async (pin) => {
        try {
            const staff = await staffService.validatePin(pin);
            setActiveStaff(staff);
            return staff;
        } catch (error) {
            throw new Error('PIN inválido o empleado inactivo');
        }
    };

    // Bloquear pantalla (requiere PIN para continuar)
    const lockScreen = () => {
        setActiveStaff(null);
    };

    // Desbloquear como propietario (sin cerrar sesión de la tienda)
    const unlockAsOwner = () => {
        setActiveStaff({
            name: profile?.full_name || 'Propietario',
            role: 'admin',
            isOwner: true
        });
    };

    // Verificar permisos basados en el empleado ACTIVO
    const activeRole = activeStaff?.role || 'cajero';
    const canAccessAdmin = activeStaff?.isOwner || activeRole === 'admin';
    const canAccessReports = canAccessAdmin || activeRole === 'gerente';

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
        isAdmin: canAccessAdmin,           // Solo propietario o admin pueden gestionar usuarios
        canAccessReports: canAccessReports, // Gerentes pueden ver reportes
        activeRole,                         // Rol del empleado actual

        // Sistema de empleados
        activeStaff,           // Quien está operando la caja actualmente
        isLocked,              // Si la pantalla está bloqueada
        loginWithPin,          // Login de empleado por PIN
        lockScreen,            // Bloquear pantalla
        unlockAsOwner,         // Desbloquear como propietario

        // Info de la tienda
        storeName: profile?.store_name

    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
