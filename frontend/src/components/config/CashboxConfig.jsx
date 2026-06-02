import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { supabase } from "../../supabase";
import { useAuth } from "../../hooks/useAuth";

const CashboxConfig = () => {
  const navigate = useNavigate();
  const { user, fetchProfile } = useAuth();
  const [mode, setMode] = useState(user?.cashbox_mode || "terminal");
  const [saving, setSaving] = useState(false);

  const handleSave = async (nextMode) => {
    if (!user?.id || saving) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({ cashbox_mode: nextMode })
        .eq("id", user.id);

      if (error) throw error;

      setMode(nextMode);
      await fetchProfile(user.id, true);

      Swal.fire({
        icon: "success",
        title: "Configuracion guardada",
        text:
          nextMode === "shared_cashbox"
            ? "Las terminales usaran una sola caja y un solo corte."
            : "Cada terminal volvera a manejar su propia caja.",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error guardando modo de caja:", error);
      Swal.fire("Error", "No se pudo guardar la configuracion de caja", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-primary"
          onClick={() => navigate("/configuracion")}
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Regresar a Configuracion
        </button>

        <header className="mb-6">
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Configuracion de Caja
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Define si cada terminal cierra por separado o si varias PCs comparten una sola caja fisica.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("terminal")}
            className={`text-left p-5 rounded-xl border-2 bg-white dark:bg-slate-800 transition-all ${
              mode === "terminal"
                ? "border-primary shadow-md"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-primary">
                point_of_sale
              </span>
              <h2 className="font-black text-slate-900 dark:text-white">
                Caja por Terminal
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cada PC abre su propio fondo y hace su propio corte. Es el comportamiento actual.
            </p>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave("shared_cashbox")}
            className={`text-left p-5 rounded-xl border-2 bg-white dark:bg-slate-800 transition-all ${
              mode === "shared_cashbox"
                ? "border-emerald-500 shadow-md"
                : "border-slate-200 dark:border-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-emerald-600">
                hub
              </span>
              <h2 className="font-black text-slate-900 dark:text-white">
                Una Sola Caja
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              PC A y PC B venden en la misma caja. Se abre un solo fondo y el corte suma todas las terminales.
            </p>
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          Cierra cualquier caja abierta antes de cambiar este modo para evitar cortes mezclados entre esquemas.
        </div>
      </div>
    </div>
  );
};

export default CashboxConfig;
