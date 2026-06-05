import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const initialMessage = "Busca una nueva version cuando quieras actualizar este equipo.";

const getUpdateApi = () => {
  if (typeof window === "undefined") return null;
  return window.electronAPI?.isElectron ? window.electronAPI : null;
};

const getErrorMessage = (response) =>
  response?.error?.message ||
  response?.reason ||
  "No se pudo completar la operacion de actualizacion.";

export const AppUpdates = () => {
  const navigate = useNavigate();
  const updateApi = useMemo(() => getUpdateApi(), []);
  const [versionInfo, setVersionInfo] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState("");
  const [updateInfo, setUpdateInfo] = useState(null);
  const [progress, setProgress] = useState(0);

  const isChecking = status === "checking";
  const isDownloading = status === "downloading" || status === "download-started";
  const isDownloaded = status === "downloaded";
  const hasUpdate = Boolean(updateInfo?.version);
  const isUpdaterEnabled = Boolean(versionInfo?.updaterAvailable);

  useEffect(() => {
    let mounted = true;

    const loadVersion = async () => {
      if (!updateApi?.getVersion) {
        if (mounted) {
          setMessage("Las actualizaciones solo estan disponibles en el .exe de escritorio.");
        }
        return;
      }

      const info = await updateApi.getVersion();
      if (!mounted) return;

      setVersionInfo(info);
      if (!info.updaterAvailable) {
        setStatus("disabled");
        setMessage(info.lastStatus?.reason || "Las actualizaciones solo estan disponibles en la app instalada para Windows.");
      }
    };

    loadVersion();

    const unsubscribe = updateApi?.onUpdateStatus?.((event) => {
      if (!mounted || !event) return;

      setStatus(event.type);
      setError("");

      if (event.updateInfo) setUpdateInfo(event.updateInfo);

      if (event.type === "checking") {
        setMessage("Buscando actualizaciones...");
      } else if (event.type === "available") {
        setMessage(`Version ${event.updateInfo?.version || "nueva"} disponible.`);
      } else if (event.type === "not-available") {
        setUpdateInfo(null);
        setProgress(0);
        setMessage("Este equipo ya tiene la version mas reciente.");
      } else if (event.type === "download-started") {
        setProgress(0);
        setMessage("Descargando actualizacion...");
      } else if (event.type === "downloading") {
        const percent = Number(event.progress?.percent || 0);
        setProgress(Math.max(0, Math.min(100, percent)));
        setMessage("Descargando actualizacion...");
      } else if (event.type === "downloaded") {
        setProgress(100);
        setMessage("Actualizacion descargada. Reinicia para instalarla.");
      } else if (event.type === "installing") {
        setMessage("Cerrando la app para instalar la nueva version...");
      } else if (event.type === "disabled") {
        setMessage(event.reason || "Actualizaciones no disponibles en este entorno.");
      } else if (event.type === "error") {
        setError(event.error?.message || "No se pudo actualizar la app.");
        setMessage("Revisa tu conexion o intenta de nuevo mas tarde.");
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [updateApi]);

  const handleCheck = async () => {
    if (!updateApi?.checkForUpdates) return;

    setError("");
    setProgress(0);
    setUpdateInfo(null);
    setStatus("checking");
    setMessage("Buscando actualizaciones...");

    const response = await updateApi.checkForUpdates();
    if (!response?.ok) {
      setStatus(response?.available === false ? "disabled" : "error");
      setError(getErrorMessage(response));
      setMessage(response?.available === false ? getErrorMessage(response) : "No se pudo buscar actualizaciones.");
    }
  };

  const handleDownload = async () => {
    if (!updateApi?.downloadUpdate) return;

    setError("");
    setProgress(0);
    setStatus("download-started");
    setMessage("Descargando actualizacion...");

    const response = await updateApi.downloadUpdate();
    if (!response?.ok) {
      setStatus("error");
      setError(getErrorMessage(response));
      setMessage("No se pudo descargar la actualizacion.");
    }
  };

  const handleInstall = async () => {
    if (!updateApi?.installUpdate) return;

    const result = await Swal.fire({
      icon: "warning",
      title: "Reiniciar e instalar",
      text: "La app se cerrara y volvera a abrir con la nueva version.",
      showCancelButton: true,
      confirmButtonText: "Reiniciar ahora",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!result.isConfirmed) return;

    setStatus("installing");
    setMessage("Cerrando la app para instalar la nueva version...");
    const response = await updateApi.installUpdate();

    if (!response?.ok) {
      setStatus("error");
      setError(getErrorMessage(response));
      setMessage("No se pudo iniciar la instalacion.");
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300 text-xs font-bold uppercase tracking-wide mb-3">
              <span className="material-icons-outlined text-[16px]">system_update_alt</span>
              Versiones
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
              Actualizaciones
            </h1>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-2">
              Revisa, descarga e instala versiones publicadas en GitHub Releases.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/configuracion")}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition text-slate-600 dark:text-slate-300 font-bold text-xs"
          >
            <span className="material-icons-outlined text-[18px]">arrow_back</span>
            Regresar
          </button>
        </header>

        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Version instalada
              </p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-1">
                {versionInfo?.version || "Desconocida"}
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${isUpdaterEnabled ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
              <span className="material-icons-outlined text-[16px]">
                {isUpdaterEnabled ? "check_circle" : "info"}
              </span>
              {isUpdaterEnabled ? "Listo para actualizar" : "Solo disponible en el .exe instalado"}
            </div>
          </div>

          <div className="p-5 md:p-6 space-y-5">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
              <div className="flex items-start gap-3">
                <span className="material-icons-outlined text-blue-500 mt-0.5">
                  {error ? "error_outline" : isDownloaded ? "task_alt" : "cloud_download"}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 dark:text-white">{message}</p>
                  {error && <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>}
                  {hasUpdate && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Nueva version: <span className="font-bold">{updateInfo.version}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {(isDownloading || progress > 0) && (
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                  <span>Progreso</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${Math.round(progress)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCheck}
                disabled={!isUpdaterEnabled || isChecking || isDownloading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-xs uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 dark:hover:bg-slate-200 transition"
              >
                <span className="material-icons-outlined text-[18px]">search</span>
                {isChecking ? "Buscando..." : "Buscar actualizacion"}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={!isUpdaterEnabled || !hasUpdate || isDownloading || isDownloaded}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-black text-xs uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
              >
                <span className="material-icons-outlined text-[18px]">download</span>
                {isDownloading ? "Descargando..." : "Descargar"}
              </button>

              <button
                type="button"
                onClick={handleInstall}
                disabled={!isUpdaterEnabled || !isDownloaded}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-black text-xs uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-700 transition"
              >
                <span className="material-icons-outlined text-[18px]">restart_alt</span>
                Reiniciar e instalar
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AppUpdates;
