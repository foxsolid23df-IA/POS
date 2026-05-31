import { useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import "./InstallPwaPrompt.css";

const DISMISSED_KEY = "nexum-pos-install-prompt-dismissed";

const isStandaloneMode = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

const InstallPwaPrompt = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const canShowPrompt = useMemo(() => {
    if (Capacitor.isNativePlatform()) return false;
    if (isStandaloneMode()) return false;
    return localStorage.getItem(DISMISSED_KEY) !== "true";
  }, []);

  useEffect(() => {
    if (!canShowPrompt) return;

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setInstallEvent(null);
      setIsVisible(false);
      localStorage.setItem(DISMISSED_KEY, "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [canShowPrompt]);

  const handleInstall = async () => {
    if (!installEvent) return;

    installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setIsVisible(false);
  };

  if (!isVisible || !installEvent) return null;

  return (
    <aside className="pwa-install-prompt" aria-label="Instalar NEXUM POS">
      <div className="pwa-install-copy">
        <strong>Instalar NEXUM POS</strong>
        <span>Abre el punto de venta desde el icono de tu Android.</span>
      </div>
      <div className="pwa-install-actions">
        <button type="button" className="pwa-install-primary" onClick={handleInstall}>
          Instalar
        </button>
        <button type="button" className="pwa-install-close" onClick={handleDismiss} aria-label="Ocultar instalacion">
          x
        </button>
      </div>
    </aside>
  );
};

export default InstallPwaPrompt;
