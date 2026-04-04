// ===== COMPONENTE HISTORIAL DE VENTAS =====
// Este componente muestra todas las ventas realizadas con filtros y detalles
// Rediseñado con un estilo minimalista y moderno usando Tailwind CSS

import React, { useState, useEffect, useCallback } from "react";
import "./Historial.css";
import { useApi } from "../../hooks/useApi";
import { useDateFilter } from "../../hooks/useDateFilter";
import { useAuth } from "../../hooks/useAuth";
import {
  formatearDinero,
  formatearFechaHora,
  contarProductos,
} from "../../utils";
import { exportToExcel } from "../../utils/exportToExcel";
import { salesService } from "../../services/salesService";
import { productService } from "../../services/productService";
import Modal from "../common/Modal";
import Swal from "sweetalert2";
import { supabase } from "../../supabase";

export const Historial = () => {
  // 1. ESTADOS PRINCIPALES
  const [productos, setProductos] = useState([]); // Lista de productos para mostrar en el modal
  const [ventas, setVentas] = useState([]); // Lista de todas las ventas
  const [ventasFiltradas, setVentasFiltradas] = useState([]); // Ventas después de filtrar
  const [searchTerm, setSearchTerm] = useState(""); // Estado para búsqueda por folio o monto

  // 2. ESTADOS PARA PAGINACIÓN
  const [paginaActual, setPaginaActual] = useState(1); // Página actual
  const ventasPorPagina = 8; // Cantidad de ventas por página

  // 3. ESTADOS PARA EL MODAL DE DETALLES
  const [mostrarModal, setMostrarModal] = useState(false); // Si se muestra el modal
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null); // Venta del modal

  // 4. HOOK PARA FILTRADO POR FECHAS
  const dateFilter = useDateFilter();

  // 5. HOOK PARA MANEJAR LLAMADAS AL BACKEND (Solo para acciones puntuales si se requiere, no para carga inicial)
  const { ejecutarPeticion, limpiarError } = useApi();

  // Estado local de carga para tener control total y evitar bloqueos
  const [loadingData, setLoadingData] = useState(true);
  const [errorData, setErrorData] = useState(null);

  // 6. HOOK PARA VERIFICAR PERMISOS
  const { canAccessReports } = useAuth();

  // 6.b EFECTO PARA SUPRIMIR ERRORES DE ABORTO
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      const errorString = args.join(" ");
      if (
        errorString.includes("AbortError") ||
        errorString.includes("signal is aborted")
      ) {
        return;
      }
      originalError.apply(console, args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  // Ref para verificar si el componente está montado
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 7. FUNCIÓN PARA CARGAR TODAS LAS VENTAS DESDE SUPABASE
  const cargarVentasYProductos = async () => {
    // Usar estado local
    setLoadingData(true);
    setErrorData(null);

    try {
      // Timeout de seguridad por si Supabase se cuelga
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tiempo de espera agotado")), 15000),
      );

      const dataPromise = Promise.all([
        salesService.getSales(1000),
        productService.getProducts(),
      ]);

      const resultados = await Promise.race([dataPromise, timeoutPromise]);

      if (!isMountedRef.current) return;

      const [ventasData, productosData] = resultados;

      // Validar que ventasData sea un array
      const ventasSeguras = Array.isArray(ventasData) ? ventasData : [];

      const ventasTransformadas = ventasSeguras.map((venta) => ({
        id: venta.id,
        total: venta.total,
        createdAt: venta.created_at,
        pin: venta.pin_facturacion,
        items: (venta.sale_items || []).map((item) => ({
          id: item.id,
          productId: item.product_id || null,
          productName: item.product_name || "Producto sin nombre",
          name: item.product_name || "Producto sin nombre",
          barcode: item.barcode || "",
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: item.total || 0,
        })),
        invoice: (venta.invoices || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0] || null,
      }));

      // Validar que productosData sea un array
      const productosSeguros = Array.isArray(productosData)
        ? productosData
        : [];

      setVentas(ventasTransformadas);
      setVentasFiltradas(ventasTransformadas);
      setProductos(productosSeguros);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Error cargando ventas y productos:", error);
      setErrorData(
        "No se pudieron cargar las transacciones. Intenta recargar.",
      );
      setVentas([]);
      setVentasFiltradas([]);
      setProductos([]);
    } finally {
      if (isMountedRef.current) {
        setLoadingData(false);
      }
    }
  };

  // 8. FUNCIÓN PARA LIMPIAR FILTROS
  const limpiarFiltros = () => {
    dateFilter.limpiarFiltros();
    setVentasFiltradas(ventas);
  };

  // 9. FUNCIÓN PARA ABRIR EL MODAL DE DETALLES
  const verDetalles = (venta) => {
    const ventaConNombres = {
      ...venta,
      items: venta.items.map((item) => {
        const prod = productos.find((p) => p.id === item.productId);
        return {
          ...item,
          productName:
            item.productName ||
            item.name ||
            (prod ? prod.name : "Producto sin nombre"),
          barcode: item.barcode || (prod ? prod.barcode : ""),
        };
      }),
    };
    setVentaSeleccionada(ventaConNombres);
    setMostrarModal(true);
  };

  // 10. FUNCIÓN PARA CERRAR EL MODAL
  const cerrarModal = () => {
    setMostrarModal(false);
    setVentaSeleccionada(null);
  };

  const handleCancelInvoice = async (invoiceId) => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Confirmar Cancelación?',
      text: "Se anulará el CFDI ante el SAT. Esta acción es administrativa y no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, CANCELAR CFDI',
      cancelButtonText: 'No'
    });

    if (!isConfirmed) return;

    Swal.fire({
        title: 'Cancelando CFDI...',
        didOpen: () => Swal.showLoading(),
        allowOutsideClick: false
    });

    try {
        const { data, error } = await supabase.functions.invoke('cancelar-cfdi', {
            body: { id: invoiceId, motive: '02' }
        });

        if (error) throw error;

        if (data && data.success) {
            Swal.fire('Éxito', 'La factura ha sido cancelada ante el SAT. La venta vuelve a estar disponible para re-facturar.', 'success');
            cargarVentasYProductos(); // Recargar historial
            cerrarModal();
        } else {
            throw new Error(data?.message || 'Error al procesar la cancelación.');
        }
    } catch (err) {
        console.error("Error al cancelar factura:", err);
        Swal.fire('Error', err.message || 'No se pudo comunicar con el sistema de cancelación.', 'error');
    }
  };

  const handleDownloadPDF = (base64, filename) => {
    if (!base64) return;
    try {
      // Si por alguna razón ya es una URL, abrirla
      if (base64.startsWith('http')) {
        window.open(base64, '_blank');
        return;
      }

      // Convertir Base64 a Blob
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      // Crear URL y descargar
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'factura.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error al descargar PDF:", err);
      Swal.fire('Error', 'No se pudo procesar el archivo PDF.', 'error');
    }
  };

  // 11. FUNCIÓN PARA FILTRAR LAS VENTAS POR FECHAS
  const filtrarPorFecha = useCallback(() => {
    const filtradas = dateFilter.filtrarPorFecha(ventas);
    
    // Aplicar filtro de búsqueda adicional
    const conBusqueda = filtradas.filter(venta => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchFolio = venta.id.toString().includes(term);
      const matchTotal = venta.total.toString().includes(term);
      const matchPin = venta.pin && venta.pin.toLowerCase().includes(term);
      return matchFolio || matchTotal || matchPin;
    });

    setVentasFiltradas(conBusqueda);
    setPaginaActual(1);
  }, [ventas, dateFilter, searchTerm]);

  // 12. CALCULAR VENTAS PARA LA PÁGINA ACTUAL
  const calcularVentasPaginadas = () => {
    const indiceInicio = (paginaActual - 1) * ventasPorPagina;
    const indiceFin = indiceInicio + ventasPorPagina;
    return ventasFiltradas.slice(indiceInicio, indiceFin);
  };

  // 13. CALCULAR TOTAL DE PÁGINAS
  const totalPaginas = Math.ceil(ventasFiltradas.length / ventasPorPagina);

  // 14. FUNCIÓN PARA CAMBIAR DE PÁGINA
  const cambiarPagina = (nuevaPagina) => {
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
      setPaginaActual(nuevaPagina);
    }
  };

  // 15. FUNCIÓN PARA EXPORTAR A EXCEL
  const exportarHistorialExcel = () => {
    if (ventasFiltradas.length === 0) return;

    const datosExportar = ventasFiltradas.map((venta, index) => {
      const nombresProductos = venta.items
        .map((item) => {
          const nombre = item.productName || item.name || "Producto sin nombre";
          const cantidad = item.quantity || 1;
          return cantidad > 1 ? `${nombre} (x${cantidad})` : nombre;
        })
        .join(", ");

      return {
        "N°": index + 1,
        Fecha: formatearFechaHora(venta.createdAt),
        Productos: nombresProductos || "Sin productos registrados",
        Cantidad: contarProductos(venta.items),
        Total: venta.total,
        "Total Formateado": formatearDinero(venta.total),
      };
    });

    const fechaActual = new Date().toISOString().split("T")[0];
    exportToExcel(
      datosExportar,
      `historial_ventas_${fechaActual}`,
      "Historial de Ventas",
    );
  };

  // 16. EFECTOS
  useEffect(() => {
    cargarVentasYProductos();
  }, []);

  useEffect(() => {
    filtrarPorFecha();
  }, [dateFilter.fechaDesde, dateFilter.fechaHasta, ventas, filtrarPorFecha]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark h-full overflow-hidden">
      {/* Header */}
      <header className="p-8 pb-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto w-full flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">
              Registro de Ventas
            </p>
            <h1 className="text-4xl font-black text-primary dark:text-white tracking-tight">
              Auditoría de Historial
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Revisa y gestiona las transacciones realizadas
            </p>
          </div>
          <button
            onClick={() => {
              document.documentElement.classList.toggle("dark");
              localStorage.setItem(
                "theme",
                document.documentElement.classList.contains("dark")
                  ? "dark"
                  : "light",
              );
              // Re-render workaround for native elements
              window.dispatchEvent(new Event("storage"));
            }}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
          >
            <span className="material-icons-outlined text-[18px]">
              dark_mode
            </span>
            <span>Modo Oscuro</span>
          </button>
        </div>
      </header>

      {/* Filters Section */}
      <section className="px-8 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto w-full">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl flex flex-wrap items-end gap-6 shadow-sm">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="relative group">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por Folio, Monto o PIN..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-lg text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 uppercase tracking-widest">
                    Desde
                  </label>
                  <input
                    className="date-input-modern"
                    type="date"
                    value={dateFilter.fechaDesde}
                    onChange={(e) => dateFilter.setFechaDesde(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 uppercase tracking-widest">
                    Hasta
                  </label>
                  <input
                    className="date-input-modern"
                    type="date"
                    value={dateFilter.fechaHasta}
                    onChange={(e) => dateFilter.setFechaHasta(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {canAccessReports && (
                <button
                  className="px-6 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                  onClick={exportarHistorialExcel}
                  disabled={ventasFiltradas.length === 0}
                >
                  <span className="material-icons-outlined text-[18px]">
                    table_view
                  </span>
                  Exportar
                </button>
              )}
              <button
                className="px-6 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                onClick={limpiarFiltros}
                disabled={!dateFilter.hayFiltrosActivos}
              >
                <span className="material-icons-outlined text-[18px]">
                  filter_alt_off
                </span>
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="px-8 pb-4 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col space-y-1">
          {/* Table Header */}
          <div className="flex-shrink-0 flex justify-between items-center px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
            <div className="flex-1">Fecha y Hora</div>
            <div className="flex-1 text-center">Resumen de Venta</div>
            <div className="w-32"></div>
          </div>

          {/* Sales List */}
          {loadingData ? (
            <div className="py-12 text-center text-slate-500 animate-pulse">
              Cargando transacciones...
            </div>
          ) : errorData ? (
            <div className="py-12 text-center text-red-500 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30">
              {errorData}
            </div>
          ) : ventasFiltradas.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="material-icons-outlined text-4xl text-slate-200 mb-2">
                history
              </span>
              <p className="text-slate-400 font-medium">
                No se encontraron ventas en este periodo
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 max-h-[65vh] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800 shadow-sm">
              {calcularVentasPaginadas().map((venta) => (
                <div
                  key={venta.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors px-6 py-5 flex items-center group"
                >
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-primary dark:text-white">
                      {formatearFechaHora(venta.createdAt)}
                    </p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[15px] font-medium text-slate-600 dark:text-slate-300">
                      {contarProductos(venta.items)}{" "}
                      {contarProductos(venta.items) === 1
                        ? "producto"
                        : "productos"}
                      <span className="mx-3 text-slate-300 dark:text-slate-700">
                        |
                      </span>
                      <span className="text-primary dark:text-white font-black">
                        {formatearDinero(venta.total)}
                      </span>
                    </p>
                  </div>
                  <div className="w-32 flex justify-end">
                    <button
                      className="bg-primary dark:bg-white text-white dark:text-primary px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-full hover:opacity-80 transition-all transform active:scale-95"
                      onClick={() => verDetalles(venta)}
                    >
                      Ver Detalles
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {ventasFiltradas.length > 0 && totalPaginas > 1 && (
            <div className="pt-4 pb-2 flex-shrink-0 flex justify-center">
              <nav className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <button
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-20 transition-colors"
                  onClick={() => cambiarPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                >
                  <span className="material-icons-outlined text-[20px]">
                    chevron_left
                  </span>
                </button>

                {[...Array(totalPaginas)].map((_, i) => {
                  const pageNum = i + 1;
                  // Logic to show a limited number of pages if many exist
                  if (totalPaginas > 7) {
                    if (
                      pageNum === 1 ||
                      pageNum === totalPaginas ||
                      (pageNum >= paginaActual - 1 &&
                        pageNum <= paginaActual + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${paginaActual === pageNum ? "bg-primary text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                          onClick={() => cambiarPagina(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === 2 || pageNum === totalPaginas - 1) {
                      return (
                        <span
                          key={pageNum}
                          className="px-1 text-slate-300 font-bold"
                        >
                          ...
                        </span>
                      );
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pageNum}
                      className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${paginaActual === pageNum ? "bg-primary text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                      onClick={() => cambiarPagina(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-20 transition-colors"
                  onClick={() => cambiarPagina(paginaActual + 1)}
                  disabled={paginaActual === totalPaginas}
                >
                  <span className="material-icons-outlined text-[20px]">
                    chevron_right
                  </span>
                </button>
              </nav>
            </div>
          )}
        </div>
      </section>

      {/* Help Button */}
      <button className="fixed bottom-8 right-8 w-12 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg flex items-center justify-center text-slate-400 hover:text-primary dark:hover:text-white transition-all transform hover:scale-110 active:scale-90 group">
        <span className="material-icons-outlined text-[20px] group-hover:rotate-12 transition-transform">
          help_outline
        </span>
      </button>

      {/* Modal de Detalles Estilizado */}
      <Modal
        isOpen={mostrarModal && ventaSeleccionada !== null}
        onClose={cerrarModal}
        raw={true}
        className="w-full max-w-2xl px-4 animate-in"
      >
        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 dark:border-white/5">
            <div className="flex flex-col">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Detalle de Transacción
              </p>
              <h2 className="text-xl font-black text-primary dark:text-white">
                Información de Venta
              </h2>
            </div>
            <button
              className="bg-slate-50 dark:bg-white/5 p-2 rounded-full text-slate-400 hover:text-primary dark:hover:text-white transition-colors"
              onClick={cerrarModal}
            >
              <span className="material-icons-outlined">close</span>
            </button>
          </div>

          <div className="p-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Fecha y Hora
                </p>
                <p className="text-sm font-bold dark:text-white">
                  {ventaSeleccionada &&
                    formatearFechaHora(ventaSeleccionada.createdAt)}
                </p>
              </div>
              <div className="bg-primary dark:bg-white p-4 rounded-xl shadow-lg shadow-black/10 dark:shadow-white/5">
                <p className="text-[9px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">
                  Monto Total
                </p>
                <p className="text-xl font-black text-white dark:text-primary">
                  {ventaSeleccionada &&
                    formatearDinero(ventaSeleccionada.total)}
                </p>
              </div>
            </div>

            {/* Billing Recovery Info (Folio + PIN) */}
            {ventaSeleccionada && (
              <div className="mb-8 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex items-center justify-between">
                <div className="flex gap-8">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">
                      FOLIO / TICKET
                    </p>
                    <p className="text-sm font-black text-slate-900 dark:text-white font-mono tracking-tighter">
                      #{ventaSeleccionada.id}
                    </p>
                  </div>
                  {ventaSeleccionada.pin && (
                    <div className="border-l border-slate-200 dark:border-white/10 pl-8">
                      <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-0.5">
                        PIN DE FACTURACIÓN
                      </p>
                      <p className="text-sm font-black text-blue-900 dark:text-blue-200 font-mono tracking-tighter">
                        {ventaSeleccionada.pin}
                      </p>
                    </div>
                  )}
                </div>
                <div className="h-8 w-8 bg-blue-100 dark:bg-blue-800/50 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-300">
                  <span className="material-icons-outlined text-sm">content_copy</span>
                </div>
              </div>
            )}

            {/* Products List */}
            <div className="space-y-4">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Productos (
                  {ventaSeleccionada &&
                    contarProductos(ventaSeleccionada.items)}
                  )
                </h3>
              </div>

              <div className="bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100/50 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/5">
                    <tr>
                      <th className="px-5 py-3">Artículo</th>
                      <th className="px-5 py-3 text-center">Cant.</th>
                      <th className="px-5 py-3 text-right">Precio</th>
                      <th className="px-5 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {ventaSeleccionada &&
                      ventaSeleccionada.items.map((item, index) => (
                        <tr key={index} className="dark:text-white">
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold">
                                {item.productName || item.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                #{item.barcode || "S/N"}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center font-medium capitalize prose-sm">
                            x{item.quantity}
                          </td>
                          <td className="px-5 py-4 text-right font-medium">
                            {formatearDinero(item.price)}
                          </td>
                          <td className="px-5 py-4 text-right font-black">
                            {formatearDinero(item.price * item.quantity)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Invoice Section for Admin */}
            {ventaSeleccionada && ventaSeleccionada.invoice && (
              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Información de Factura (CFDI)
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">Facturado vía portal de clientes</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                    ventaSeleccionada.invoice.status === 'CANCELADO' 
                      ? 'bg-red-100 dark:bg-red-950/40 text-red-600' 
                      : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600'
                  }`}>
                    {ventaSeleccionada.invoice.status}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                   <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">UUID SAT</span>
                        <span className="font-mono text-xs dark:text-slate-300 truncate block">
                          {ventaSeleccionada.invoice.uuid_cfdi}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Fecha Emisión</span>
                        <span className="dark:text-slate-300">
                           {formatearFechaHora(ventaSeleccionada.invoice.created_at)}
                        </span>
                      </div>
                   </div>

                   <div className="flex gap-4 mt-4">
                      <button 
                        onClick={() => handleDownloadPDF(ventaSeleccionada.invoice.pdf_url, `Factura_${ventaSeleccionada.id}.pdf`)}
                        className="flex-1 text-center py-2 bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"
                      >
                        DESCARGAR PDF
                      </button>
                      {ventaSeleccionada.invoice.status !== 'CANCELADO' && (
                        <button 
                          onClick={() => handleCancelInvoice(ventaSeleccionada.invoice.id)}
                          className="flex-1 py-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors border border-red-200 dark:border-red-900/30"
                        >
                          SOLICITAR CANCELACIÓN
                        </button>
                      )}
                   </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-8 py-6 bg-slate-50 dark:bg-white/5 flex justify-end">
            <button
              className="bg-primary dark:bg-white text-white dark:text-primary px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all active:scale-95"
              onClick={cerrarModal}
            >
              Cerrar Detalles
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
