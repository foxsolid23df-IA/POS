import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "./ConfiguracionHub.css";

export const ConfiguracionHub = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const configOptions = [
    {
      id: "usuarios",
      title: "Usuarios",
      description: "Gestionar empleados, roles y accesos al sistema",
      icon: "manage_accounts",
      path: "/usuarios",
      adminOnly: true,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      id: "asistencia",
      title: "Asistencia",
      description: "Control de entradas, salidas y reportes del personal",
      icon: "schedule",
      path: "/asistencia",
      adminOnly: true,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      id: "mantenimiento",
      title: "Mantenimiento",
      description: "Respaldo y mantenimiento de base de datos",
      icon: "settings_suggest",
      path: "/mantenimiento",
      adminOnly: true,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      id: "dolares",
      title: "Tipos de Cambio",
      description: "Ajustar la tasa de cambio aplicable a transacciones",
      icon: "currency_exchange",
      path: "/configuracion-dolares",
      adminOnly: false,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      id: "ticket",
      title: "Configuración de Ticket",
      description: "Ajustar encabezado, pie de página e impresora de tickets",
      icon: "receipt_long",
      path: "/config-ticket",
      adminOnly: true,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      id: "taxes",
      title: "Impuestos",
      description: "Ajustar el porcentaje de impuestos aplicable a ventas",
      icon: "request_quote",
      path: "/config-impuestos",
      adminOnly: true,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
    {
      id: "payments",
      title: "Formas de Pago",
      description: "Administrar métodos de pago disponibles en el sistema",
      icon: "payments",
      path: "/config-pagos",
      adminOnly: true,
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10",
    },
    {
      id: "billing_issuers",
      title: "Emisores Fiscales",
      description: "Configuración de RFC, CSD y datos de facturación",
      icon: "account_balance",
      path: "/config-emisores",
      adminOnly: true,
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
    },
  ];

  // Filtramos las opciones según el rol del usuario
  const visibleOptions = configOptions.filter((opt) =>
    opt.adminOnly ? isAdmin : true
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="material-icons-outlined text-primary text-2xl">
                settings
              </span>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                Configuración del Sistema
              </h1>
              <p className="text-sm md:text-base text-slate-500 dark:text-slate-400">
                Ajustes globales y herramientas de administración
              </p>
            </div>
          </div>
        </header>

        <main>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {visibleOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => navigate(option.path)}
                className="group relative flex flex-col items-start p-6 text-left 
                  bg-white dark:bg-slate-800 
                  border border-slate-200 dark:border-slate-700 
                  rounded-2xl shadow-sm hover:shadow-md 
                  hover:border-primary/30 dark:hover:border-primary/50
                  transition-all duration-300 overflow-hidden"
              >
                {/* Fondo iluminado en el hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                <div className="flex items-start justify-between w-full mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${option.bgColor} ${option.color} group-hover:scale-110 transition-transform duration-300`}
                  >
                    <span className="material-icons-outlined text-[28px]">
                      {option.icon}
                    </span>
                  </div>
                  <span className="material-icons-outlined text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transform duration-300">
                    arrow_forward
                  </span>
                </div>

                <div className="z-10 relative">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2 group-hover:text-primary transition-colors">
                    {option.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {option.description}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {visibleOptions.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="material-icons-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">
                lock
              </span>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                Sin accesos de configuración
              </h3>
              <p className="text-slate-500 dark:text-slate-400">
                Tu rol actual no tiene permisos para acceder a opciones de configuración.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
