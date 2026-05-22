import React, { useState, useEffect } from 'react';
import { Timer, AlertCircle, LogOut, Play } from 'lucide-react';

export const SessionTimeoutModal = ({ onExtend, onLogout, countdownSeconds = 60 }) => {
    const [timeLeft, setTimeLeft] = useState(countdownSeconds);

    useEffect(() => {
        if (timeLeft <= 0) {
            onLogout();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, onLogout]);

    // Calcular progreso para el círculo (opcional, pero se ve premium)
    const progress = (timeLeft / countdownSeconds) * 100;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-scale-in">
                {/* Header con gradiente */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white flex items-center gap-4">
                    <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                        <Timer size={28} className="animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">¡Tu sesión va a expirar!</h3>
                        <p className="text-amber-50 text-sm opacity-90">Has estado inactivo por un tiempo.</p>
                    </div>
                </div>

                <div className="p-8 flex flex-col items-center text-center">
                    {/* Contador visual */}
                    <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="64"
                                cy="64"
                                r="58"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-slate-100 dark:text-slate-800"
                            />
                            <circle
                                cx="64"
                                cy="64"
                                r="58"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray="364.4"
                                strokeDashoffset={364.4 - (364.4 * progress) / 100}
                                className="text-amber-500 transition-all duration-1000 ease-linear"
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute text-4xl font-black text-slate-800 dark:text-white tabular-nums">
                            {timeLeft}
                        </span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-[280px]">
                        Por seguridad, cerraremos tu sesión automáticamente para proteger tus datos.
                    </p>

                    <div className="flex flex-col w-full gap-3">
                        <button
                            onClick={onExtend}
                            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
                        >
                            <Play size={20} fill="currentColor" />
                            Continuar trabajando
                        </button>
                        
                        <button
                            onClick={onLogout}
                            className="w-full py-3 bg-transparent text-slate-500 dark:text-slate-400 font-medium hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} />
                            Cerrar sesión ahora
                        </button>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scale-in {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in { animation: fade-in 0.2s ease-out; }
                .animate-scale-in { animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
            `}} />
        </div>
    );
};
