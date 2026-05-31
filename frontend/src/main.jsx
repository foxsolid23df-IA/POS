import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/common/ErrorBoundary.jsx'

// Silenciar errores de "AbortError" globales (promesas no manejadas por Supabase)
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.name === 'AbortError' || event.reason?.message?.includes('aborted')) {
    event.preventDefault(); // Evita que aparezca en la consola roja
    // console.debug('Global AbortError suppressed', event.reason);
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((error) => {
      console.warn('[PWA] No se pudo registrar el service worker:', error);
    });
  });
}
