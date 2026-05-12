import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el estado para que el siguiente renderizado muestre la interfaz de repuesto
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // También puedes registrar el error en un servicio de informe de errores
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Puedes renderizar cualquier interfaz de repuesto
      return (
        <div style={{
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
          color: '#111827',
          fontFamily: 'sans-serif'
        }}>
          <h2 style={{ marginBottom: '1rem' }}>Algo salió mal.</h2>
          <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
            La aplicación encontró un error inesperado.
          </p>
          <div style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            maxWidth: '90%',
            overflow: 'auto',
            textAlign: 'left'
          }}>
            <code style={{ fontSize: '0.875rem', color: '#b91c1c' }}>
              {this.state.error && this.state.error.toString()}
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Recargar aplicación
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
