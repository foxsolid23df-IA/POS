import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Silenciar errores de "AbortError" globales (promesas no manejadas por Supabase)
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AbortError' || event.reason?.message?.includes('aborted')) {
    event.preventDefault(); // Evita que aparezca en la consola roja
    // console.debug('Global AbortError suppressed', event.reason);
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)