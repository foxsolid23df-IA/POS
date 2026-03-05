// Hook para manejar el botón "Atrás" de Android con Capacitor
// En vez de cerrar la app, navega hacia atrás en el historial del router
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";

export const useAndroidBackButton = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Solo activar en plataforma nativa (Android)
        if (!Capacitor.isNativePlatform()) return;

        let backButtonListener = null;

        const setupListener = async () => {
            try {
                const { App } = await import("@capacitor/app");

                backButtonListener = await App.addListener(
                    "backButton",
                    ({ canGoBack }) => {
                        // Si estamos en la ruta raíz (/), minimizar la app en vez de cerrarla
                        if (
                            location.pathname === "/" ||
                            location.pathname === "/ventas" ||
                            location.pathname === "/login"
                        ) {
                            // Minimizar la app (enviar a background)
                            App.minimizeApp();
                        } else if (canGoBack || window.history.length > 1) {
                            // Navegar hacia atrás en el historial del router
                            navigate(-1);
                        } else {
                            // Si no hay historial, ir a la pantalla principal
                            navigate("/");
                        }
                    },
                );
            } catch (error) {
                console.warn(
                    "[BackButton] No se pudo configurar el listener:",
                    error,
                );
            }
        };

        setupListener();

        // Limpiar listener al desmontar
        return () => {
            if (backButtonListener) {
                backButtonListener.remove();
            }
        };
    }, [navigate, location.pathname]);
};
