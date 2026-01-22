// ===== COMPONENTE PUNTO DE VENTA OPTIMIZADO =====
import React, { useState, useEffect, useRef } from "react";
import TicketVenta from "./TicketVenta";
import CameraScanner from "../common/CameraScanner";
import { formatearDinero, validarCodigoBarras } from "../../utils";
import { buscarProductoPorCodigo } from "../../utils/api";
import { productService } from "../../services/productService";
import { salesService } from "../../services/salesService";
import { activeCartService } from "../../services/activeCartService";
import { useApi } from "../../hooks/useApi";
import { useCart } from "../../hooks/useCart";
import { useAuth } from "../../hooks/useAuth";
import { useGlobalScanner } from "../../hooks/scanner";
import { useIsMobile } from "../../hooks/useIsMobile";
import { exchangeRateService } from "../../services/exchangeRateService";
import { supabase } from "../../supabase";
import "./Sales.css";

export const Sales = () => {
  // HOOKS PERSONALIZADOS
  const { user, cashSession } = useAuth();
  const { cargando, ejecutarPeticion } = useApi();
  const { isMobile, isTouchDevice } = useIsMobile();
  const mostrarError = (mensaje, esAdvertencia = false) => {
    if (mensaje.includes("sin stock") || mensaje.includes("No hay más stock")) {
      mostrarModalPersonalizado("Sin stock disponible", mensaje, "warning");
    } else if (esAdvertencia) {
      mostrarModalPersonalizado("Advertencia", mensaje, "warning");
    } else {
      mostrarModalPersonalizado("Producto no encontrado", mensaje, "error");
    }
  };
  const {
    carrito,
    agregarProducto,
    cambiarCantidad,
    quitarProducto,
    vaciarCarrito,
    total,
  } = useCart(mostrarError);

  // SUPRIMIR ERRORES DE ABORTO EN CONSOLA
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      // Filtrar errores de AbortError y "signal is aborted"
      const errorString = args.join(' ');
      if (
        errorString.includes('AbortError') ||
        errorString.includes('signal is aborted') ||
        errorString.includes('aborted without reason') ||
        errorString.includes('updating active cart')
      ) {
        // Silenciar estos errores
        return;
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  // ESTADOS LOCALES
  const [codigoEscaneado, setCodigoEscaneado] = useState("");
  const [vendiendo, setVendiendo] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState(null);
  const [mostrarCameraScanner, setMostrarCameraScanner] = useState(false);

  // ESTADOS PARA MODAL DE PAGO
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [metodoPago, setMetodoPago] = useState("efectivo"); // 'efectivo', 'tarjeta', 'transferencia', 'dolares'
  const [montoRecibido, setMontoRecibido] = useState("");
  const [tipoCambio, setTipoCambio] = useState(null);

  // ESTADOS PARA BÚSQUEDA POR NOMBRE
  const [productos, setProductos] = useState([]);
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [errorProducts, setErrorProducts] = useState(null);

  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info", // 'info', 'error', 'success', 'warning'
  });

  // REFERENCIAS
  const campoCodigoRef = useRef(null);

  // FUNCIONES PARA EL MODAL DE ERRORES
  const mostrarModalPersonalizado = (title, message, type = "info") => {
    setModal({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const cerrarModalPersonalizado = () => {
    setModal({
      isOpen: false,
      title: "",
      message: "",
      type: "info",
    });
  };

  // Ref para verificar si el componente está montado
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // CARGAR PRODUCTOS Y TIPO DE CAMBIO
  const cargarDatos = React.useCallback(async (force = false) => {
    // Solo actualizar el estado si el componente está montado
    if (!isMountedRef.current) return;

    try {
      setLoadingProducts(true);
      setErrorProducts(null);

      const [prods, rate] = await Promise.all([
        productService.getProducts({ forceRefresh: force }),
        exchangeRateService.getActiveRate(),
      ]);

      // Verificar si el componente sigue montado usando la ref
      if (!isMountedRef.current) return;

      // Asegurar que prods es un array
      const safeProds = Array.isArray(prods) ? prods : [];
      setProductos(safeProds);

      if (rate && rate.is_active) {
        setTipoCambio(parseFloat(rate.rate));
      }

      // Limpiar error si la carga fue exitosa
      setErrorProducts(null);
    } catch (error) {
      if (!isMountedRef.current) return;

      console.error("Error cargando datos iniciales:", error);
      setErrorProducts(
        "No se pudieron cargar los productos. Por favor verifica tu conexión.",
      );
      setProductos([]);
    } finally {
      if (isMountedRef.current) {
        setLoadingProducts(false);
      }
    }
  }, []);

  // Cargar datos cuando el componente se monta
  useEffect(() => {
    // Resetear estados al montar
    setLoadingProducts(true);
    setErrorProducts(null);

    // Cargar datos
    cargarDatos();

    // Cleanup al desmontar
    return () => {
      // Cancelar cualquier operación pendiente
      isMountedRef.current = false;
    };
  }, []); // Solo ejecutar al montar/desmontar

  // Recargar productos cuando el componente se vuelve visible (regresa de otro módulo)
  useEffect(() => {
    let lastLoadTime = Date.now();

    const handleVisibilityChange = () => {
      // Si el componente está visible y han pasado más de 30 segundos desde la última carga
      if (!document.hidden && isMountedRef.current) {
        const timeSinceLastLoad = Date.now() - lastLoadTime;
        // Si han pasado más de 30 segundos, recargar
        if (timeSinceLastLoad > 30000) {
          console.log('[Sales] Recargando productos después de volver al módulo');
          cargarDatos();
          lastLoadTime = Date.now();
        }
      }
    };

    // Escuchar cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [cargarDatos]);

  // SINCRONIZACIÓN EN TIEMPO REAL (MULTICAJA)
  useEffect(() => {
    const channel = supabase
      .channel("sales-products-sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => {
          // Actualizar el producto en el estado local
          const updatedProduct = payload.new;

          // Actualizar también la caché del servicio
          productService.updateCache(updatedProduct);

          setProductos((prevProductos) => {
            if (!Array.isArray(prevProductos)) return [];
            return prevProductos.map((p) =>
              p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p,
            );
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // BÚSQUEDA POR NOMBRE - Filtrar sugerencias cuando cambia el texto
  useEffect(() => {
    if (codigoEscaneado.length >= 2 && !/^\d+$/.test(codigoEscaneado)) {
      // Si tiene 2+ caracteres y NO es solo números, buscar por nombre
      const resultados = productos
        .filter((p) =>
          p.name.toLowerCase().includes(codigoEscaneado.toLowerCase()),
        )
        .slice(0, 5); // Máximo 5 sugerencias
      setSugerencias(resultados);
      setMostrarSugerencias(resultados.length > 0);
    } else {
      setSugerencias([]);
      setMostrarSugerencias(false);
    }
  }, [codigoEscaneado, productos]);

  // SINCRONIZACIÓN CON PANTALLA DEL CLIENTE
  useEffect(() => {
    let isMounted = true;

    const syncCart = async () => {
      if (user && !mostrarModalPago && isMounted) {
        try {
          await activeCartService.updateCart(carrito, total, cashSession?.id);
        } catch (err) {
          // Silenciar errores si el componente se desmontó
          if (isMounted && err.name !== 'AbortError') {
            console.error("Error sincronizando carrito:", err);
          }
        }
      }
    };

    syncCart();

    return () => {
      isMounted = false;
    };
  }, [carrito, total, user, cashSession, mostrarModalPago]);

  // Sincronizar info de pago cuando cambia
  useEffect(() => {
    let isMounted = true;

    const syncPayment = async () => {
      if (user && mostrarModalPago && isMounted) {
        try {
          await activeCartService.updatePaymentInfo({
            method: metodoPago,
            received: parseFloat(montoRecibido) || 0,
            change: calcularCambio(),
            status: "processing",
          });
        } catch (err) {
          // Silenciar errores si el componente se desmontó
          if (isMounted && err.name !== 'AbortError') {
            console.error("Error sincronizando pago:", err);
          }
        }
      }
    };

    syncPayment();

    return () => {
      isMounted = false;
    };
  }, [metodoPago, montoRecibido, mostrarModalPago, user, total]);

  // Seleccionar producto de las sugerencias
  const seleccionarProducto = (producto) => {
    // Mapear image_url a image para compatibilidad con el carrito
    const productoConImagen = {
      ...producto,
      image: producto.image_url,
    };
    agregarProducto(productoConImagen);
    setCodigoEscaneado("");
    setSugerencias([]);
    setMostrarSugerencias(false);
  };

  // HOOK SCANNER
  const manejarCodigoEscaneado = async (codigo) => {
    if (!validarCodigoBarras(codigo)) {
      mostrarModalPersonalizado(
        "Código inválido",
        "El código escaneado no tiene un formato válido.",
        "error",
      );
      return;
    }

    // Buscar en productos locales primero
    const productoLocal = productos.find((p) => p.barcode === codigo);
    if (productoLocal) {
      const productoConImagen = {
        ...productoLocal,
        image: productoLocal.image_url,
      };
      agregarProducto(productoConImagen);
      return;
    }

    try {
      await ejecutarPeticion(async (signal) => {
        const producto = await buscarProductoPorCodigo(codigo, signal);
        agregarProducto(producto);
      });
    } catch (error) {
      if (error.message && error.message.includes("404")) {
        mostrarModalPersonalizado(
          "Producto no encontrado",
          `No se encontró un producto con el código escaneado: ${codigo}`,
          "error",
        );
      } else {
        mostrarModalPersonalizado(
          "Error",
          "Ocurrió un error al buscar el producto. Intenta nuevamente.",
          "error",
        );
      }
    }
  };

  const { isScanning } = useGlobalScanner(manejarCodigoEscaneado, {
    minLength: 8,
    timeout: 100,
    enabled: true,
    preventOnModal: true,
  });

  // FUNCIONES
  const buscarProductoManual = async (codigo) => {
    if (!validarCodigoBarras(codigo)) {
      mostrarModalPersonalizado(
        "Código inválido",
        "El código ingresado no tiene un formato válido. Por favor, verifica el código e intenta nuevamente.",
        "error",
      );
      return;
    }

    try {
      await ejecutarPeticion(async (signal) => {
        const producto = await buscarProductoPorCodigo(codigo, signal);
        agregarProducto(producto);
        // Producto agregado exitosamente - no necesitamos notificación ya que se ve en el carrito
      });
    } catch (error) {
      // Manejar error de producto no encontrado
      if (error.message && error.message.includes("404")) {
        mostrarModalPersonalizado(
          "Producto no encontrado",
          `No se encontró un producto con el código ingresado: ${codigo}`,
          "error",
        );
      } else {
        // Los errores de stock se manejan en el hook useCart
        // Otros errores generales
        mostrarModalPersonalizado(
          "Error",
          "Ocurrió un error al buscar el producto. Intenta nuevamente.",
          "error",
        );
      }
    }
  };

  // FUNCIONES PARA MODAL DE PAGO
  const abrirModalPago = () => {
    if (carrito.length === 0) {
      mostrarModalPersonalizado(
        "Carrito vacío",
        "No puedes procesar el pago sin productos en el carrito.",
        "warning",
      );
      return;
    }
    setMontoRecibido("");
    setMetodoPago("efectivo");
    setMostrarModalPago(true);
  };

  const cerrarModalPago = () => {
    setMostrarModalPago(false);
    setMontoRecibido("");
    setMetodoPago("efectivo");
  };

  const manejarTecladoNumerico = (valor) => {
    setMontoRecibido((prev) => {
      if (valor === "backspace") {
        return prev.slice(0, -1);
      } else if (valor === ".") {
        if (!prev.includes(".")) {
          return prev + ".";
        }
        return prev;
      } else {
        return prev + valor;
      }
    });
  };

  const calcularCambio = () => {
    if (!montoRecibido) return 0;
    const monto = parseFloat(montoRecibido) || 0;

    if (metodoPago === "dolares" && tipoCambio) {
      // Convertir dólares recibidos a pesos
      const totalEnPesos = monto * tipoCambio;
      // Calcular cambio en pesos
      return totalEnPesos - total;
    }

    if (metodoPago !== "efectivo" && metodoPago !== "dolares") return 0;

    return monto - total;
  };

  const formatearMontoRecibido = () => {
    if (metodoPago === "efectivo" || metodoPago === "dolares") {
      if (!montoRecibido) return "0.00";
      const monto = parseFloat(montoRecibido) || 0;
      return monto.toFixed(2);
    } else {
      return total.toFixed(2);
    }
  };

  const finalizarVenta = async () => {
    if (carrito.length === 0) {
      mostrarModalPersonalizado(
        "Carrito vacío",
        "No puedes finalizar una venta sin productos en el carrito.",
        "warning",
      );
      return;
    }

    // Validar monto recibido si es efectivo
    if (metodoPago === "efectivo") {
      const monto = parseFloat(montoRecibido) || 0;
      if (monto < total) {
        mostrarModalPersonalizado(
          "Monto insuficiente",
          `El monto recibido (${formatearDinero(monto)}) es menor al total (${formatearDinero(total)}).`,
          "warning",
        );
        return;
      }
    }

    // Validar monto si es dólares
    if (metodoPago === "dolares") {
      const monto = parseFloat(montoRecibido) || 0;
      const totalEnPesos = monto * tipoCambio;
      if (!monto || totalEnPesos < total - 0.1) {
        // Pequeña tolerancia
        mostrarModalPersonalizado(
          "Monto insuficiente",
          `El pago en dólares (${monto} USD = $${totalEnPesos.toFixed(2)} MXN) no cubre el total de ${formatearDinero(total)}.`,
          "error",
        );
        return;
      }
    }

    setVendiendo(true);
    cerrarModalPago();

    try {
      // Preparar datos para Supabase
      const ventaData = {
        items: carrito.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          stock: item.stock || 0,
        })),
        total: total,
        metodoPago: metodoPago,
        currency: metodoPago === "dolares" ? "USD" : "MXN",
        exchange_rate: metodoPago === "dolares" ? tipoCambio : null,
        amount_usd: metodoPago === "dolares" ? parseFloat(montoRecibido) : null,
        montoRecibido:
          metodoPago === "efectivo" || metodoPago === "dolares"
            ? parseFloat(montoRecibido) || 0
            : total,
        cambio: calcularCambio(),
      };

      // Crear venta en Supabase
      const ventaCreada = await salesService.createSale(ventaData);

      // Actualizar activeCartService para marcar como completado
      try {
        await activeCartService.clearCart('completed');
      } catch (e) {
        console.error(e);
      }

      setVentaCompletada({
        ...ventaCreada,
        productos: carrito,
        items: carrito, // Backup por si ticket usa items
        metodoPago: metodoPago,
        montoRecibido: ventaData.montoRecibido,
        cambio: ventaData.cambio,
        currency: ventaData.currency,
        exchange_rate: ventaData.exchange_rate,
      });

      // Recargar productos para actualizar stock
      const productosActualizados = await productService.getProducts({ forceRefresh: true });
      setProductos(productosActualizados);

      vaciarCarrito();
      setMostrarModal(true);
    } catch (error) {
      console.error("Error al crear venta:", error);
      mostrarModalPersonalizado(
        "Error al procesar venta",
        "No se pudo completar la venta. Por favor, intenta nuevamente.",
        "error",
      );
    }

    setVendiendo(false);
  };

  const manejarCambioCodigo = (e) => {
    setCodigoEscaneado(e.target.value);
  };

  // Ref para el monto, permitiendo acceso en el listener sin reiniciar el efecto
  const montoRecibidoRef = useRef(montoRecibido);
  useEffect(() => {
    montoRecibidoRef.current = montoRecibido;
  }, [montoRecibido]);

  const manejarEnter = (e) => {
    if (e.key === "Enter") {
      // Si hay sugerencias visibles, seleccionar la primera
      if (mostrarSugerencias && sugerencias.length > 0) {
        seleccionarProducto(sugerencias[0]);
        return;
      }

      // Si no, búsqueda manual estándar
      if (codigoEscaneado.trim()) {
        buscarProductoManual(codigoEscaneado.trim());
        setCodigoEscaneado("");
      }
    }
  };

  const manejarFocus = () => {
    if (campoCodigoRef.current) {
      campoCodigoRef.current.focus();
    }
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setVentaCompletada(null);
  };

  // MANEJAR TECLADO FÍSICO EN MODAL DE PAGO
  useEffect(() => {
    if (!mostrarModalPago) return;

    const handleKeyDown = (e) => {
      // Enter: Finalizar venta
      if (e.key === "Enter") {
        e.preventDefault();
        // Usamos la ref para obtener el valor más reciente sin depender del ciclo de render
        const montoActual = parseFloat(montoRecibidoRef.current) || 0;

        // Validación rápida antes de intentar finalizar
        if (metodoPago === "efectivo" && montoActual < total) {
          mostrarModalPersonalizado(
            "Monto insuficiente",
            `El monto recibido ($${montoActual.toFixed(2)}) es menor al total.`,
            "warning",
          );
          return;
        }

        // Dispara la finalización (finalizarVenta usará el estado actual del render,
        // pero como estamos en un evento, deberíamos asegurarnos de llamarlo correctamente)
        // Nota: finalizarVenta usa el state `montoRecibido`, que debería estar sincronizado
        // por el re-render de React, pero por seguridad forzamos el chequeo.
        finalizarVenta();
        return;
      }

      // Escape: Cerrar modal
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarModalPago();
        return;
      }

      // Números para pago en efectivo
      if (metodoPago === "efectivo") {
        if (/^[0-9]$/.test(e.key)) {
          manejarTecladoNumerico(e.key);
        } else if (e.key === "." || e.key === ",") {
          manejarTecladoNumerico(".");
        } else if (e.key === "Backspace") {
          manejarTecladoNumerico("backspace");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // Quitamos 'montoRecibido' de las dependencias para que no se recree el listener al escribir
  }, [mostrarModalPago, metodoPago, total]);

  // MANEJAR ESCANEO POR CÁMARA
  const manejarEscaneoCamara = async (codigo) => {
    // Limpiar el código (remover espacios)
    const codigoLimpio = codigo.trim();

    if (!codigoLimpio) return;

    // Validar formato de código de barras
    if (!validarCodigoBarras(codigoLimpio)) {
      mostrarModalPersonalizado(
        "Código inválido",
        "El código escaneado no tiene un formato válido.",
        "error",
      );
      return;
    }

    // Buscar primero en productos locales
    const productoLocal = productos.find(
      (p) =>
        p.barcode === codigoLimpio ||
        p.barcode === codigoLimpio.replace(/^0+/, ""), // Sin ceros iniciales
    );

    if (productoLocal) {
      const productoConImagen = {
        ...productoLocal,
        image: productoLocal.image_url,
      };
      agregarProducto(productoConImagen);
      mostrarModalPersonalizado(
        "Producto agregado",
        `${productoLocal.name} añadido al carrito`,
        "success",
      );
      return;
    }

    // Si no se encuentra localmente, buscar en el servidor
    try {
      await ejecutarPeticion(async () => {
        const producto = await productService.getProductByBarcode(codigoLimpio);
        if (producto) {
          const productoConImagen = { ...producto, image: producto.image_url };
          agregarProducto(productoConImagen);
          mostrarModalPersonalizado(
            "Producto agregado",
            `${producto.name} añadido al carrito`,
            "success",
          );
        } else {
          mostrarModalPersonalizado(
            "Producto no encontrado",
            `No se encontró un producto con el código: ${codigoLimpio}`,
            "error",
          );
        }
      });
    } catch (error) {
      mostrarModalPersonalizado(
        "Producto no encontrado",
        `No se encontró un producto con el código escaneado: ${codigoLimpio}`,
        "error",
      );
    }
  };

  // Referencia para el ticket
  const ticketRef = useRef(null);

  // Imprimir el ticket usando el nuevo componente
  const imprimirTicket = () => {
    if (!ticketRef.current) return;
    imprimirTicketTérmico(ticketRef.current.innerHTML, ventaCompletada);
  };

  // Función mejorada para imprimir tickets térmicos POS
  const imprimirTicketTérmico = (ticketHTML, ventaData) => {
    const printWindow = window.open("", "_blank", "width=400,height=600");

    const ticketContent = ventaData ? ticketHTML : generarHTMLTicketPago();

    printWindow.document.write("<!DOCTYPE html>");
    printWindow.document.write(
      '<html><head><title>Ticket de Venta</title><meta charset="UTF-8">',
    );
    printWindow.document.write(`
            <style>
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 8mm;
                        width: 64mm;
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 10pt;
                        line-height: 1.2;
                    }
                    * {
                        box-sizing: border-box;
                    }
                }
                @media screen {
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        padding: 20px;
                        max-width: 300px;
                        margin: 0 auto;
                        font-size: 12px;
                    }
                }
                .ticket-container {
                    width: 100%;
                    text-align: center;
                }
                .ticket-header {
                    text-align: center;
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px dashed #000;
                }
                .ticket-title {
                    font-size: 14pt;
                    font-weight: bold;
                    margin-bottom: 4px;
                }
                .ticket-fecha {
                    font-size: 9pt;
                }
                .ticket-linea {
                    border-top: 1px dashed #000;
                    margin: 8px 0;
                }
                .ticket-producto {
                    margin-bottom: 6px;
                    text-align: left;
                }
                .ticket-producto-nombre {
                    font-weight: bold;
                    margin-bottom: 2px;
                }
                .ticket-producto-detalle {
                    display: flex;
                    justify-content: space-between;
                    font-size: 9pt;
                }
                .ticket-total {
                    font-size: 12pt;
                    font-weight: bold;
                    text-align: right;
                    margin-top: 10px;
                    padding-top: 8px;
                    border-top: 1px dashed #000;
                }
                .ticket-footer {
                    text-align: center;
                    font-size: 9pt;
                    margin-top: 12px;
                    padding-top: 8px;
                    border-top: 1px dashed #000;
                }
                .ticket-method {
                    font-size: 9pt;
                    margin-top: 4px;
                }
                .ticket-change {
                    font-size: 9pt;
                    margin-top: 4px;
                }
            </style>
        `);
    printWindow.document.write("</head><body>");
    printWindow.document.write(ticketContent);
    printWindow.document.write("</body></html>");
    printWindow.document.close();

    // Esperar a que el contenido se cargue antes de imprimir
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // No cerrar automáticamente para permitir selección de impresora
    }, 250);
  };

  // Generar HTML del ticket desde el modal de pago (antes de finalizar)
  const generarHTMLTicketPago = () => {
    const fecha = new Date().toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    let html = '<div class="ticket-container">';
    html += '<div class="ticket-header">';
    html += '<div class="ticket-title">TICKET DE VENTA</div>';
    html += `<div class="ticket-fecha">${fecha}</div>`;
    html += "</div>";
    html += '<div class="ticket-linea"></div>';

    // Productos
    carrito.forEach((item) => {
      html += '<div class="ticket-producto">';
      html += `<div class="ticket-producto-nombre">${item.name}</div>`;
      html += '<div class="ticket-producto-detalle">';
      html += `<span>Cant: ${item.quantity} x ${formatearDinero(item.price)}</span>`;
      html += `<span>${formatearDinero(item.price * item.quantity)}</span>`;
      html += "</div></div>";
    });

    html += '<div class="ticket-linea"></div>';

    // Totales
    html += '<div class="ticket-total">';
    html += `<div>Subtotal: ${formatearDinero(total)}</div>`;
    html += `<div>Total: ${formatearDinero(total)}</div>`;

    // Método de pago y cambio
    if (metodoPago) {
      const metodoTexto =
        metodoPago === "efectivo"
          ? "Efectivo"
          : metodoPago === "tarjeta"
            ? "Tarjeta"
            : "Transferencia";
      html += `<div class="ticket-method">Método: ${metodoTexto}</div>`;

      if (metodoPago === "efectivo" && montoRecibido) {
        const monto = parseFloat(montoRecibido) || 0;
        const cambio = calcularCambio();
        html += `<div class="ticket-method">Recibido: ${formatearDinero(monto)}</div>`;
        if (cambio > 0) {
          html += `<div class="ticket-change">Cambio: ${formatearDinero(cambio)}</div>`;
        }
      }
    }

    html += "</div>";
    html += '<div class="ticket-footer">¡Gracias por su compra!</div>';
    html += "</div>";

    return html;
  };

  // Función para imprimir desde el modal de pago
  const imprimirTicketPago = () => {
    const ticketHTML = generarHTMLTicketPago();
    imprimirTicketTérmico(ticketHTML, null);
  };

  return (
    <div className="sales-view">
      <div className="sales-content-wrapper">
        <div className="sales-main-area">
          <div className="sales-area-header">
            <div className="flex justify-between items-center w-full">
              <div>
                <h1 className="sales-title">AREA DE COBRO</h1>
                <p className="sales-subtitle">
                  Gestiona y procesa tus ventas con precisión
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}#/customer-display?u=${user?.id}`;
                    window.open(url, "_blank", "width=1024,height=768");
                  }}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl shadow-sm hover:bg-emerald-600 transition-all font-bold text-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    monitor
                  </span>
                  <span>Pantalla Cliente</span>
                </button>
                <button
                  onClick={() => {
                    document.documentElement.classList.toggle("dark");
                    localStorage.setItem(
                      "theme",
                      document.documentElement.classList.contains("dark")
                        ? "dark"
                        : "light",
                    );
                  }}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    dark_mode
                  </span>
                  <span>Modo Oscuro</span>
                </button>
              </div>
            </div>
          </div>

          {/* SCANNER Y BÚSQUEDA */}
          <div
            className="search-section-modern"
            style={{ position: "relative" }}
          >
            <div className="search-input-wrapper">
              <div className="search-input-container">
                <div className="search-icon-wrapper">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input
                  ref={campoCodigoRef}
                  type="text"
                  placeholder="Buscar por nombre o código de..."
                  value={codigoEscaneado}
                  onChange={manejarCambioCodigo}
                  onKeyDown={manejarEnter}
                  onBlur={() =>
                    setTimeout(() => setMostrarSugerencias(false), 200)
                  }
                  className="barcode-input-modern"
                />
              </div>
              <button
                onClick={() => setMostrarCameraScanner(true)}
                className="btn-camera-modern"
                type="button"
                title="Escanear código con cámara"
              >
                <span className="material-symbols-outlined">photo_camera</span>
                <span>Cámara</span>
              </button>
            </div>

            {/* LISTA DE SUGERENCIAS */}
            {mostrarSugerencias && (
              <div className="suggestions-dropdown">
                {sugerencias.map((producto) => (
                  <div
                    key={producto.id}
                    className="suggestion-item"
                    onClick={() => seleccionarProducto(producto)}
                  >
                    <div className="suggestion-image">
                      {producto.image_url ? (
                        <img src={producto.image_url} alt={producto.name} />
                      ) : (
                        <div className="no-img">📦</div>
                      )}
                    </div>
                    <div className="suggestion-info">
                      <span className="suggestion-name">{producto.name}</span>
                      <span className="suggestion-price">
                        {formatearDinero(producto.price)}
                      </span>
                    </div>
                    <span className="suggestion-stock">
                      Stock: {producto.stock}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ESTADO VACÍO O CARGANDO */}
          {loadingProducts ? (
            <div className="empty-scan-area">
              <div className="empty-scan-icon spin">
                <span className="material-symbols-outlined">sync</span>
              </div>
              <h3 className="empty-scan-title">Cargando productos...</h3>
              <p className="empty-scan-text">Por favor espera un momento.</p>
            </div>
          ) : errorProducts ? (
            <div className="empty-scan-area error">
              <div className="empty-scan-icon text-red-500">
                <span className="material-symbols-outlined">error</span>
              </div>
              <h3 className="empty-scan-title text-red-500">Error de carga</h3>
              <p className="empty-scan-text">{errorProducts}</p>
              <button
                onClick={() => cargarDatos(true)}
                className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : (
            !cargando &&
            !isScanning &&
            carrito.length === 0 && (
              <div className="empty-scan-area">
                <div className="empty-scan-icon">
                  <span className="material-symbols-outlined">
                    qr_code_scanner
                  </span>
                </div>
                <h3 className="empty-scan-title">Listo para escanear</h3>
                <p className="empty-scan-text">
                  Usa la búsqueda o el botón de cámara para agregar productos a
                  la venta.
                </p>
              </div>
            )
          )}

          {/* INDICADOR DE CARGA */}
          {cargando && <div className="notification info">Procesando...</div>}

          {/* INDICADOR DE ESCANEADO */}
          {isScanning && (
            <div className="notification info">Escaneando código...</div>
          )}
        </div>

        {/* CARRITO LATERAL */}
        <div className="cart-sidebar">
          <div className="cart-sidebar-header">
            <h2 className="cart-sidebar-title">Carrito de Compras</h2>
          </div>

          {carrito.length === 0 ? (
            <div className="empty-cart-modern">
              <div className="empty-cart-icon">
                <span className="material-symbols-outlined">
                  shopping_cart_off
                </span>
              </div>
              <p className="empty-cart-text">El carrito está vacío</p>
              <p className="empty-cart-subtext">
                Agrega productos para comenzar
              </p>
            </div>
          ) : (
            <div className="cart-items-modern">
              {carrito.map((item) => (
                <div key={item.id} className="cart-item-modern">
                  <div className="item-image-modern">
                    {item.image ? (
                      <img src={item.image} alt={item.name} />
                    ) : (
                      <div className="item-image-placeholder">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          ></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <path d="M21 15l-5-5L5 21"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="item-info-modern">
                    <h3 className="item-name-modern">{item.name}</h3>
                    <p className="item-price-modern">
                      {formatearDinero(item.price)}
                    </p>
                  </div>
                  <div className="quantity-controls-modern">
                    <button
                      className="qty-btn-modern"
                      onClick={() =>
                        cambiarCantidad(item.id, item.quantity - 1)
                      }
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span className="quantity-modern">{item.quantity}</span>
                    <button
                      className="qty-btn-modern"
                      onClick={() =>
                        cambiarCantidad(item.id, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                  <div className="item-total-modern">
                    {formatearDinero(item.price * item.quantity)}
                  </div>
                  <button
                    className="remove-btn-modern"
                    onClick={() => quitarProducto(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TOTAL Y FINALIZAR */}
          <div className="cart-footer-modern">
            <div className="cart-summary-modern">
              <div className="summary-row">
                <span className="summary-label">Subtotal</span>
                <span className="summary-value">{formatearDinero(total)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Impuestos</span>
                <span className="summary-value">$0.00</span>
              </div>
              <div className="summary-row summary-total">
                <span className="summary-label">Total</span>
                <span className="summary-value">{formatearDinero(total)}</span>
              </div>
            </div>
            <button
              onClick={abrirModalPago}
              disabled={vendiendo || carrito.length === 0}
              className="btn-process-payment"
            >
              Procesar Pago
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE PAGO */}
      {mostrarModalPago && (
        <div
          className="payment-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrarModalPago();
          }}
        >
          <div
            className="payment-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="payment-modal-close" onClick={cerrarModalPago}>
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="payment-modal-content">
              {/* LADO IZQUIERDO - RESUMEN */}
              <div className="payment-summary-section">
                <div className="payment-summary-header">
                  <h3 className="payment-summary-title">
                    <span className="material-symbols-outlined">
                      receipt_long
                    </span>
                    Resumen
                  </h3>
                  <span className="payment-transaction-id">
                    #{Math.floor(Math.random() * 90000) + 10000}
                  </span>
                </div>

                <div className="payment-items-list">
                  {carrito.map((item) => (
                    <div key={item.id} className="payment-item-row">
                      <div className="payment-item-info">
                        <p className="payment-item-name">
                          {item.name} (x{item.quantity})
                        </p>
                        <p className="payment-item-category">
                          ${formatearDinero(item.price)} c/u
                        </p>
                      </div>
                      <span className="payment-item-price">
                        {formatearDinero(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="payment-summary-footer">
                  <div className="payment-summary-totals">
                    <div className="payment-summary-row">
                      <span>Subtotal</span>
                      <span>{formatearDinero(total)}</span>
                    </div>
                    <div className="payment-summary-row">
                      <span>Impuestos (16%)</span>
                      <span>$0.00</span>
                    </div>
                  </div>
                  <div className="payment-total-final">
                    <span className="payment-total-label">Total</span>
                    <span className="payment-total-amount">
                      {formatearDinero(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* LADO DERECHO - MÉTODO DE PAGO */}
              <div className="payment-method-section">
                <div className="payment-method-content">
                  <h3 className="payment-method-title">MÉTODO DE PAGO</h3>

                  <div className="payment-method-buttons">
                    <button
                      className={`payment-method-btn ${metodoPago === "efectivo" ? "active" : ""}`}
                      onClick={() => {
                        setMetodoPago("efectivo");
                        setMontoRecibido("");
                      }}
                    >
                      <span className="material-symbols-outlined">
                        payments
                      </span>
                      <span>Efectivo</span>
                    </button>
                    <button
                      className={`payment-method-btn ${metodoPago === "tarjeta" ? "active" : ""}`}
                      onClick={() => {
                        setMetodoPago("tarjeta");
                        setMontoRecibido(total.toFixed(2));
                      }}
                    >
                      <span className="material-symbols-outlined">
                        credit_card
                      </span>
                      <span>Tarjeta</span>
                    </button>
                    <button
                      className={`payment-method-btn ${metodoPago === "transferencia" ? "active" : ""}`}
                      onClick={() => {
                        setMetodoPago("transferencia");
                        setMontoRecibido(total.toFixed(2));
                      }}
                    >
                      <span className="material-symbols-outlined">
                        account_balance
                      </span>
                      <span>Transferencia</span>
                    </button>

                    {tipoCambio && (
                      <button
                        className={`payment-method-btn ${metodoPago === "dolares" ? "active" : ""}`}
                        onClick={() => {
                          setMetodoPago("dolares");
                          setMontoRecibido("");
                        }}
                      >
                        <span className="material-symbols-outlined">
                          currency_exchange
                        </span>
                        <span>Dólares</span>
                      </button>
                    )}
                  </div>

                  <div className="payment-amount-section">
                    <div className="payment-amount-input-section">
                      <label className="payment-amount-label">
                        {metodoPago === "dolares"
                          ? "MONTO RECIBIDO (USD)"
                          : "MONTO RECIBIDO"}
                      </label>
                      <div className="payment-amount-display">
                        <span className="payment-amount-value">
                          {metodoPago === "dolares" ? "$" : "$"}
                          {formatearMontoRecibido()}
                        </span>
                      </div>

                      {metodoPago === "dolares" && (
                        <div className="text-center mt-2 text-sm text-slate-500 font-bold">
                          Tipo de cambio: ${tipoCambio} MXN
                          <div className="text-emerald-600 mt-1">
                            Total a cubrir: ${(total / tipoCambio).toFixed(2)}{" "}
                            USD
                          </div>
                        </div>
                      )}

                      {(metodoPago === "efectivo" ||
                        metodoPago === "dolares") && (
                          <div className="payment-keypad">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, ".", "backspace"].map(
                              (num) => (
                                <button
                                  key={num}
                                  className={`payment-key ${num === "backspace" ? "backspace" : ""}`}
                                  onClick={() => manejarTecladoNumerico(num)}
                                >
                                  {num === "backspace" ? (
                                    <span className="material-symbols-outlined">
                                      backspace
                                    </span>
                                  ) : (
                                    num
                                  )}
                                </button>
                              ),
                            )}
                          </div>
                        )}
                    </div>

                    {(metodoPago === "efectivo" ||
                      metodoPago === "dolares") && (
                        <div className="payment-change-section">
                          <div className="payment-change-box">
                            <p className="payment-change-label">CAMBIO</p>
                            <p className="payment-change-amount">
                              {formatearDinero(Math.max(0, calcularCambio()))}
                            </p>
                          </div>
                          <div className="payment-receipt-actions">
                            <button
                              className="payment-receipt-btn"
                              onClick={imprimirTicketPago}
                            >
                              <span className="material-symbols-outlined">
                                print
                              </span>
                              Imprimir Ticket
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                <div className="payment-modal-actions">
                  <button
                    className="payment-finalize-btn"
                    onClick={finalizarVenta}
                    disabled={
                      metodoPago === "efectivo" &&
                      (!montoRecibido || parseFloat(montoRecibido) < total)
                    }
                  >
                    Finalizar Venta
                  </button>
                  <button
                    className="payment-cancel-btn"
                    onClick={cerrarModalPago}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VENTA COMPLETADA */}
      {mostrarModal && ventaCompletada && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-ticket-container">
              <TicketVenta venta={ventaCompletada} ref={ticketRef} />
              <div className="modal-footer modal-footer-ticket">
                <button
                  className="btn-imprimir-ticket"
                  onClick={imprimirTicket}
                >
                  Imprimir ticket
                </button>
                <button className="btn-cerrar-modal" onClick={cerrarModal}>
                  Continuar Vendiendo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERSONALIZADO PARA ERRORES */}
      {modal.isOpen && (
        <div className="modal-overlay" onClick={cerrarModalPersonalizado}>
          <div
            className={`modal-content ${modal.type}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={cerrarModalPersonalizado}
            >
              ×
            </button>
            <div className={`modal-title ${modal.type}`}>{modal.title}</div>
            <div className="modal-message">{modal.message}</div>
            <div className="modal-footer">
              <button
                className="btn-modal-ok"
                onClick={cerrarModalPersonalizado}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SCANNER DE CÁMARA */}
      <CameraScanner
        isOpen={mostrarCameraScanner}
        onClose={() => setMostrarCameraScanner(false)}
        onScan={manejarEscaneoCamara}
      />
    </div>
  );
};
