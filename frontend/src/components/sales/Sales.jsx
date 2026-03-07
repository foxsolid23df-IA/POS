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
import { useScannerMode } from "../../hooks/useScannerMode";
import { exchangeRateService } from "../../services/exchangeRateService";
import { cashMovementService } from "../../services/cashMovementService";
import { supabase } from "../../supabase";
import { useProducts } from "../../contexts/ProductContext";
import { useSettings } from "../../contexts/SettingsContext";
import "./Sales.css";

export const Sales = () => {
  // HOOKS PERSONALIZADOS
  const { user, cashSession, isSupervising, needsCashFund } = useAuth();
  const { ticketSettings } = useSettings();
  const { cargando, ejecutarPeticion } = useApi();
  const { isMobile, isTouchDevice } = useIsMobile();
  const { isAndroid, scannerMode, scannerInputMode, toggleScannerMode } =
    useScannerMode();

  // USAR CONTEXTO GLOBAL DE PRODUCTOS
  const {
    productos,
    loading: loadingProducts,
    error: errorProducts,
    loadProducts: cargarDatos,
    updateProduct,
  } = useProducts();

  const mostrarError = (mensaje, esAdvertencia = false) => {
    if (
      mensaje.includes("sin stock") ||
      mensaje.includes("No hay más stock") ||
      mensaje.includes("Máximo disponible")
    ) {
      mostrarModalPersonalizado("Stock insuficiente", mensaje, "warning");
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

  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info", // 'info', 'error', 'success', 'warning'
  });

  // REFERENCIAS
  const campoCodigoRef = useRef(null);
  const searchContainerRef = useRef(null);

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

  // HANDLERS PARA BOTONES EXTRA
  const handleAddProductoComun = (e) => {
    e.preventDefault();
    if (!comunForm.descripcion || !comunForm.cantidad || !comunForm.precio) {
      mostrarModalPersonalizado(
        "Error",
        "Todos los campos son obligatorios.",
        "warning",
      );
      return;
    }
    const cant = parseFloat(comunForm.cantidad) || 0;
    const precioObj = parseFloat(comunForm.precio) || 0;

    if (cant <= 0 || precioObj < 0) {
      mostrarModalPersonalizado(
        "Error",
        "Cantidad o precio no válidos.",
        "warning",
      );
      return;
    }

    const nuevoProducto = {
      id: "comun-" + Date.now(),
      name: comunForm.descripcion,
      price: precioObj,
      quantity: cant,
      stock: 99999, // Stock infinito
      barcode: "",
      image: null,
    };

    agregarProducto(nuevoProducto);
    setMostrarModalComun(false);
    setComunForm({ descripcion: "", cantidad: 1, precio: "" });
  };

  const handleAddEntrada = async (e) => {
    e.preventDefault();
    if (!entradaForm.concepto || !entradaForm.cantidad) {
      mostrarModalPersonalizado(
        "Error",
        "Todos los campos son obligatorios.",
        "warning",
      );
      return;
    }
    const amount = parseFloat(entradaForm.cantidad) || 0;
    if (amount <= 0) {
      mostrarModalPersonalizado("Error", "Monto no válido.", "warning");
      return;
    }
    try {
      await cashMovementService.registerMovement(
        "entrada",
        amount,
        entradaForm.concepto,
      );
      mostrarModalPersonalizado(
        "Éxito",
        "Entrada registrada correctamente.",
        "success",
      );
      setMostrarModalEntrada(false);
      setEntradaForm({ concepto: "", cantidad: "" });
    } catch (err) {
      mostrarModalPersonalizado(
        "Error",
        "No se pudo registrar la entrada.",
        "error",
      );
    }
  };

  const handleAddSalida = async (e) => {
    e.preventDefault();
    if (!salidaForm.concepto || !salidaForm.cantidad) {
      mostrarModalPersonalizado(
        "Error",
        "Todos los campos son obligatorios.",
        "warning",
      );
      return;
    }
    const amount = parseFloat(salidaForm.cantidad) || 0;
    if (amount <= 0) {
      mostrarModalPersonalizado("Error", "Monto no válido.", "warning");
      return;
    }
    try {
      await cashMovementService.registerMovement(
        "salida",
        amount,
        salidaForm.concepto,
      );
      mostrarModalPersonalizado(
        "Éxito",
        "Salida (gasto) registrada correctamente.",
        "success",
      );
      setMostrarModalSalida(false);
      setSalidaForm({ concepto: "", cantidad: "" });
    } catch (err) {
      mostrarModalPersonalizado(
        "Error",
        "No se pudo registrar la salida.",
        "error",
      );
    }
  };

  // ESTADOS LOCALES ADICIONALES
  const [codigoEscaneado, setCodigoEscaneado] = useState("");
  const [vendiendo, setVendiendo] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [ventaCompletada, setVentaCompletada] = useState(null);
  const [mostrarCameraScanner, setMostrarCameraScanner] = useState(false);
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [tipoCambio, setTipoCambio] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [indexSugerencia, setIndexSugerencia] = useState(0);
  // ID temporal de transacción estable para el modal de pago
  const [transactionId, setTransactionId] = useState("");
  // Estado para evitar que el primer ENTER abra y el segundo cierre instantáneamente
  const [modalReady, setModalReady] = useState(false);

  // ESTADOS PARA PAGOS MIXTOS
  const [pagosRealizados, setPagosRealizados] = useState([]);
  const [saldoPendiente, setSaldoPendiente] = useState(0);

  // ESTADOS NUEVOS PARA FUNCIONES EXTRA
  const [mostrarModalComun, setMostrarModalComun] = useState(false);
  const [comunForm, setComunForm] = useState({
    descripcion: "",
    cantidad: 1,
    precio: "",
  });

  const [mostrarModalEntrada, setMostrarModalEntrada] = useState(false);
  const [entradaForm, setEntradaForm] = useState({
    concepto: "",
    cantidad: "",
  });

  const [mostrarModalSalida, setMostrarModalSalida] = useState(false);
  const [salidaForm, setSalidaForm] = useState({ concepto: "", cantidad: "" });

  // Cargar tipo de cambio al montar
  useEffect(() => {
    let isMounted = true;

    const loadExchangeRate = async () => {
      try {
        const rate = await exchangeRateService.getActiveRate();
        if (isMounted && rate && rate.is_active) {
          setTipoCambio(parseFloat(rate.rate));
        }
      } catch (error) {
        // Ignorar errores de señales abortadas
        if (
          error?.message?.includes("aborted") ||
          error?.name === "AbortError"
        ) {
          return;
        }
        if (isMounted) {
          console.error("[Sales] Error cargando tipo de cambio:", error);
        }
      }
    };

    loadExchangeRate();

    return () => {
      isMounted = false;
    };
  }, []);

  // DEBUG: Verificar si llegan productos
  useEffect(() => {
    // Solo loguear si hay cambio significativo para no saturar consola
    if (productos.length > 0) {
      console.log("[Sales Component] Productos disponibles:", productos.length);
    }
  }, [productos.length]);

  // SINCRONIZACIÓN CON PANTALLA CLIENTE
  // Cada vez que cambia el carrito, total o sesión, actualizamos la tabla active_carts
  useEffect(() => {
    // Validación estricta: No intentar nada si no hay sesión válida o usuario
    if (!cashSession?.id || cashSession.status !== "open" || !user?.id) {
      return;
    }

    // Debounce: Esperar 500ms antes de enviar a la DB para evitar saturación y AbortErrors
    const syncTimer = setTimeout(() => {
      activeCartService
        .updateCart(carrito, total, cashSession.id)
        .then(() => {
          // Log discreto solo para debug
          // console.log('[Sync] Carrito sincronizado');
        })
        .catch((err) => {
          // Ignorar errores de abort (ya se manejan en el servicio, pero doble check)
          if (
            !err?.message?.includes("aborted") &&
            err?.name !== "AbortError"
          ) {
            console.error("Error sincronizando carrito:", err);
          }
        });
    }, 500);

    // Limpiar timer si el carrito cambia antes de los 500ms
    return () => clearTimeout(syncTimer);
  }, [carrito, total, cashSession, user]);

  // BÚSQUEDA POR NOMBRE Y SKU - Filtrar sugerencias cuando cambia el texto
  useEffect(() => {
    const query = codigoEscaneado.toLowerCase().trim();
    if (query.length >= 2) {
      // Buscar por nombre o por código de barras (SKU)
      const resultados = productos
        .filter(
          (p) =>
            p?.name?.toLowerCase().includes(query) ||
            p?.barcode?.toLowerCase().includes(query),
        )
        .slice(0, 10); // Máximo 10 sugerencias
      setSugerencias(resultados);
      setMostrarSugerencias(resultados.length > 0);
      setIndexSugerencia(0); // Resetear índice al cambiar resultados
    } else {
      setSugerencias([]);
      setMostrarSugerencias(false);
      setIndexSugerencia(0);
    }
  }, [codigoEscaneado, productos]);

  // CERRAR SUGERENCIAS AL HACER CLIC FUERA
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setMostrarSugerencias(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  // SINCRONIZACIÓN CON PANTALLA DEL CLIENTE
  useEffect(() => {
    let isMounted = true;

    const syncCart = async () => {
      if (user && !mostrarModalPago && isMounted) {
        try {
          await activeCartService.updateCart(carrito, total, cashSession?.id);
        } catch (err) {
          // Silenciar errores si el componente se desmontó
          if (isMounted && err.name !== "AbortError") {
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
            sessionId: cashSession?.id,
          });
        } catch (err) {
          // Silenciar errores si el componente se desmontó
          if (isMounted && err.name !== "AbortError") {
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

  // Efecto para calcular el saldo pendiente
  useEffect(() => {
    const pagado = pagosRealizados.reduce((sum, p) => sum + p.amount, 0);
    setSaldoPendiente(total - pagado);
  }, [pagosRealizados, total]);

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

    if (isSupervising) {
      mostrarModalPersonalizado(
        "Modo Supervisión",
        "No se pueden escanear productos mientras la caja esté cerrada.",
        "warning",
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
    enabled: !mostrarModalPago && !modal.isOpen && !mostrarModal,
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
    if (isSupervising) {
      mostrarModalPersonalizado(
        "Modo Supervisión",
        "Esta función está deshabilitada. Por favor abre caja con un perfil de ventas para cobrar.",
        "warning",
      );
      return;
    }
    if (carrito.length === 0) {
      mostrarModalPersonalizado(
        "Carrito vacío",
        "No puedes procesar el pago sin productos en el carrito.",
        "warning",
      );
      return;
    }
    // Generar ID estable para esta sesión de pago
    setTransactionId((Math.floor(Math.random() * 90000) + 10000).toString());
    setMontoRecibido("");
    setMetodoPago("efectivo");
    setPagosRealizados([]);
    setModalReady(false);
    setMostrarModalPago(true);
    // Aumentar el tiempo de seguridad a 500ms para evitar capturas accidentales del primer ENTER
    setTimeout(() => {
      setModalReady(true);
    }, 500);
  };

  const cerrarModalPago = () => {
    setMostrarModalPago(false);
    setModalReady(false);
    setMontoRecibido("");
    setMetodoPago("efectivo");
    setPagosRealizados([]);
  };

  const agregarPago = () => {
    const montoStr = montoRecibidoRef.current || montoRecibido;
    const montoNum = parseFloat(montoStr) || 0;

    if (montoNum <= 0) return;

    let montoAbonado = montoNum;
    let cambio = 0;

    if (metodoPago === "efectivo") {
      // Si el efectivo es más que el saldo pendiente, hay cambio
      if (montoNum > saldoPendiente) {
        montoAbonado = saldoPendiente;
        cambio = montoNum - saldoPendiente;
      }
    } else if (metodoPago === "dolares") {
      const enPesos = montoNum * tipoCambio;
      if (enPesos > saldoPendiente) {
        montoAbonado = saldoPendiente;
        cambio = enPesos - saldoPendiente;
      } else {
        montoAbonado = enPesos;
      }
    } else {
      // Tarjeta o transferencia usualmente son por el monto exacto
      if (montoNum > saldoPendiente) {
        montoAbonado = saldoPendiente;
        // No solemos dar cambio en tarjeta/transferencia, pero si pagan de más...
        cambio = montoNum - saldoPendiente;
      }
    }

    const nuevoPago = {
      id: Date.now(),
      method: metodoPago,
      amount: montoAbonado,
      received: montoNum,
      change: cambio,
      currency: metodoPago === "dolares" ? "USD" : "MXN",
      exchange_rate: metodoPago === "dolares" ? tipoCambio : null,
    };

    setPagosRealizados((prev) => [...prev, nuevoPago]);
    setMontoRecibido("");
  };

  const eliminarPago = (id) => {
    setPagosRealizados((prev) => prev.filter((p) => p.id !== id));
  };

  const manejarTecladoNumerico = (valor) => {
    setMontoRecibido((prev) => {
      if (valor === "backspace") {
        return prev.slice(0, -1);
      } else if (valor === ".") {
        // Permitir punto si no existe ya uno
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
    const valMonto = montoRecibidoRef?.current || montoRecibido;
    if (!valMonto) return 0;
    const monto = parseFloat(valMonto) || 0;

    if (metodoPago === "dolares" && tipoCambio) {
      // Convertir dólares recibidos a pesos
      const totalEnPesos = monto * tipoCambio;
      // Calcular cambio en pesos basado en el saldo que falta por cubrir
      return totalEnPesos - saldoPendiente;
    }

    // Para los demás métodos (tarjeta, transferencia), el cambio se calcula sobre el saldo pendiente
    return monto - saldoPendiente;
  };

  const formatearMontoRecibido = () => {
    return montoRecibido || "0.00";
  };

  const finalizarVenta = async () => {
    let pagosActualizados = [...pagosRealizados];
    let saldoActual = saldoPendiente;

    const montoNum = parseFloat(montoRecibidoRef.current || montoRecibido) || 0;
    const valorEnPesos =
      metodoPago === "dolares" && tipoCambio ? montoNum * tipoCambio : montoNum;

    // Si el monto ingresado cubre el saldo pendiente y no se ha agregado el pago, lo autoagregamos
    if (montoNum > 0 && saldoActual > 0.01 && valorEnPesos >= saldoActual) {
      let montoAbonado = saldoActual;
      let cambio = valorEnPesos - saldoActual;

      const nuevoPago = {
        id: Date.now(),
        method: metodoPago,
        amount: montoAbonado,
        received: montoNum,
        change: cambio,
        currency: metodoPago === "dolares" ? "USD" : "MXN",
        exchange_rate: metodoPago === "dolares" ? tipoCambio : null,
      };

      pagosActualizados.push(nuevoPago);
      saldoActual = 0;
    }

    // Validar que se ha cubierto el saldo
    if (saldoActual > 0.01) {
      mostrarModalPersonalizado(
        "Saldo insuficiente",
        `Aún falta por cubrir ${formatearDinero(
          saldoActual,
        )} para completar el total.`,
        "warning",
      );
      return;
    }

    setVendiendo(true);
    cerrarModalPago();

    try {
      // Preparar datos para Supabase
      const ventaData = {
        user_id: user?.id,
        items: carrito
          .filter((item) => item.quantity > 0)
          .map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            stock: item.stock || 0,
          })),
        total: total,
        payments: pagosActualizados,
        // Mantener campos legacy por compatibilidad
        metodoPago:
          pagosActualizados.length === 1
            ? pagosActualizados[0].method
            : "múltiple",
        currency: "MXN",
        exchange_rate: null,
      };

      // Crear venta en Supabase
      const ventaCreada = await salesService.createSale(ventaData);

      // Actualizar UI inmediatamente para mostrar el ticket
      setVentaCompletada({
        ...ventaCreada,
        productos: [...carrito],
        items: [...carrito],
        payments: [...pagosActualizados],
        metodoPago: ventaData.metodoPago,
        // Campos legacy para ticket
        montoRecibido: total,
        cambio: 0,
      });

      // Vaciar carrito y mostrar modal de éxito YA
      vaciarCarrito();
      setMostrarModal(true);

      // Tareas de fondo (Sync y recarga de inventario) - No bloquean el ticket
      activeCartService
        .clearCart("completed", cashSession?.id)
        .catch(console.error);
      cargarDatos({ forceRefresh: true, silent: true }).catch(console.error);
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
      // Si hay sugerencias visibles, seleccionar la que está marcada (indexSugerencia)
      if (mostrarSugerencias && sugerencias.length > 0) {
        e.preventDefault();
        seleccionarProducto(sugerencias[indexSugerencia]);
        return;
      }

      // Si no, búsqueda manual estándar
      if (codigoEscaneado.trim()) {
        e.preventDefault();
        buscarProductoManual(codigoEscaneado.trim());
        setCodigoEscaneado("");
      } else if (
        carrito.length > 0 &&
        !mostrarModalPago &&
        !modal.isOpen &&
        !mostrarModal
      ) {
        // SI EL INPUT ESTÁ VACÍO Y HAY PRODUCTOS, ABRIR PAGO
        e.preventDefault();
        e.target.blur();
        // Usar un timeout ligeramente mayor para asegurar que el foco se limpie y el estado se estabilice
        setTimeout(() => {
          abrirModalPago();
        }, 150);
      }
    } else if (e.key === "ArrowDown") {
      if (mostrarSugerencias && sugerencias.length > 0) {
        e.preventDefault();
        setIndexSugerencia((prev) => (prev + 1) % sugerencias.length);
      }
    } else if (e.key === "ArrowUp") {
      if (mostrarSugerencias && sugerencias.length > 0) {
        e.preventDefault();
        setIndexSugerencia(
          (prev) => (prev - 1 + sugerencias.length) % sugerencias.length,
        );
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
      if (e.key === "Enter" || e.key === "+") {
        e.preventDefault();
        if (!modalReady) return;

        const montoNum = parseFloat(montoRecibido) || 0;
        const valorEnPesos =
          metodoPago === "dolares" && tipoCambio
            ? montoNum * tipoCambio
            : montoNum;

        // Si el monto cubre el saldo, podemos finalizar directamente
        if (montoNum > 0 && valorEnPesos >= saldoPendiente) {
          finalizarVenta();
          return;
        }

        // Si el monto ingresado es menor al saldo, lo agregamos como un pago parcial
        if (montoNum > 0 && valorEnPesos < saldoPendiente) {
          agregarPago();
          return;
        }

        // Si ya no hay monto a agregar y el saldo está cubierto, finalizar
        if (saldoPendiente <= 0.01) {
          finalizarVenta();
        } else {
          // Si intenta finalizar sin cubrir el saldo o sin monto ingresado
          mostrarModalPersonalizado(
            "Saldo insuficiente",
            `Aún falta por cubrir ${formatearDinero(
              saldoPendiente,
            )} para completar el total.`,
            "warning",
          );
        }
        return;
      }

      // Escape: Cerrar modal
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarModalPago();
        return;
      }

      // Atajos para cambiar método de pago
      if (e.key === "F1") {
        e.preventDefault();
        setMetodoPago("efectivo");
        setMontoRecibido("");
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        setMetodoPago("tarjeta");
        setMontoRecibido("");
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        setMetodoPago("transferencia");
        setMontoRecibido("");
        return;
      }
      if (e.key === "F4" && tipoCambio) {
        e.preventDefault();
        setMetodoPago("dolares");
        setMontoRecibido("");
        return;
      }

      // Números para cualquier método de pago
      if (
        metodoPago === "efectivo" ||
        metodoPago === "dolares" ||
        metodoPago === "tarjeta" ||
        metodoPago === "transferencia"
      ) {
        // Aceptar números normales y del teclado numérico
        if (/^[0-9]$/.test(e.key)) {
          manejarTecladoNumerico(e.key);
        } else if (
          e.key === "." ||
          e.key === "," ||
          e.key === "Decimal" ||
          e.key === "Separator"
        ) {
          manejarTecladoNumerico(".");
        } else if (e.key === "Backspace" || e.key === "Delete") {
          manejarTecladoNumerico("backspace");
        }
      }
    };

    // Usar capture: false para permitir que otros elementos reciban el evento si es necesario.
    // El scanner usa capture: true, por eso lo desactivamos arriba con 'enabled'.
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    mostrarModalPago,
    metodoPago,
    total,
    modalReady,
    tipoCambio,
    montoRecibido,
  ]);

  // MANEJAR ENTER GLOBAL PARA MODALES Y PAGO
  useEffect(() => {
    const handleGlobalEnter = (e) => {
      if (e.key === "Enter") {
        // 1. Si hay modal de error/aviso abierto, cerrarlo
        if (modal.isOpen) {
          e.preventDefault();
          cerrarModalPersonalizado();
          return;
        }

        // 2. Si hay modal de venta completada (ticket), cerrarlo
        if (mostrarModal) {
          e.preventDefault();
          cerrarModal();
          return;
        }

        // 3. Si no hay modales abiertos y el carrito tiene productos, abrir pago
        // Solo si no estamos ya en el modal de pago (finalizarVenta tiene su propio listener)
        if (
          carrito.length > 0 &&
          !mostrarModalPago &&
          !modal.isOpen &&
          !mostrarModal
        ) {
          const activeElement = document.activeElement;
          const isInput =
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA";

          // Si el foco está en un input, dejar que el listener del input decida (manejarEnter)
          // Pero si es el cuerpo de la página u otro elemento no-input, abrir pago directamente
          if (!isInput) {
            e.preventDefault();
            abrirModalPago();
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalEnter);
    return () => window.removeEventListener("keydown", handleGlobalEnter);
  }, [
    modal.isOpen,
    mostrarModal,
    mostrarModalPago,
    carrito.length,
    abrirModalPago,
    cerrarModal,
    cerrarModalPersonalizado,
  ]);

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

  // Función mejorada para imprimir tickets térmicos POS usando el servicio (Válido para Android/Web)
  const imprimirTicketTérmico = (ticketHTML, ventaData) => {
    import("../../services/printerService").then(({ printerService }) => {
      const settings = ticketSettings || { paper_width: "58mm", font_size: 13 };
      const ticketContent = ventaData ? ticketHTML : generarHTMLTicketPago();

      let htmlPrint = `<!DOCTYPE html>
        <html><head><title>Ticket de Venta</title><meta charset="UTF-8">
        <style>
          @media print {
              @page { size: ${
                settings.paper_width === "58mm" ? "58mm" : "80mm"
              } auto; margin: 0; }
              body { margin: 0; padding: 0; width: 100%; background: none !important; }
              .ticket-venta { width: 100% !important; margin: 0 !important; }
          }
          body {
              font-family: ${
                settings.font_family === "Sistema"
                  ? "system-ui, -apple-system, sans-serif"
                  : "monospace"
              };
              font-size: ${settings.font_size || 13}px;
              line-height: 1.2;
              color: black;
          }
          .ticket-venta { padding: 0; box-sizing: border-box; }
          .ticket-header { text-align: center; margin-bottom: 8px; text-transform: uppercase; }
          .ticket-logo { max-width: 100%; height: auto; margin: 0 auto 5px auto; display: block; }
          .ticket-title { font-size: 1.3em; font-weight: bold; margin-bottom: 4px; }
          .ticket-info { font-size: 1em; white-space: pre-line; margin-bottom: 2px; }
          .ticket-datetime { text-align: right; margin-bottom: 6px; font-size: 1em; }
          .ticket-meta { margin-bottom: 8px; text-transform: uppercase; font-size: 1em; }
          .ticket-meta-row { display: flex; justify-content: space-between; }
          .ticket-meta-label { white-space: pre; }
          .ticket-meta-value { text-align: right; }
          .ticket-table-header { display: flex; font-size: 1em; text-transform: uppercase; margin-bottom: 2px; }
          .ticket-col-cant { width: 14%; text-align: left; }
          .ticket-col-desc { width: 62%; text-align: left; }
          .ticket-col-imp { width: 24%; text-align: right; }
          .ticket-divider-eq { margin: 0; line-height: 1; overflow: hidden; white-space: nowrap; margin-bottom: 4px; font-size: 1em; }
          .ticket-items { margin-bottom: 10px; font-size: 1em; }
          .ticket-item { display: flex; text-transform: uppercase; margin-bottom: 4px; align-items: flex-start; }
          .ticket-item-cant { width: 14%; text-align: left; }
          .ticket-item-desc { width: 62%; text-align: left; word-break: break-word; }
          .ticket-item-imp { width: 24%; text-align: right; }
          .ticket-summary { margin-top: 10px; text-align: right; text-transform: uppercase; font-size: 1em; display: flex; flex-direction: column; align-items: flex-end; }
          .ticket-summary-articles { width: 100%; text-align: center; margin-bottom: 8px; }
          .ticket-summary-row { display: flex; justify-content: flex-end; margin-bottom: 2px; width: 100%; }
          .ticket-summary-label { margin-right: 12px; text-align: right; }
          .ticket-summary-value { width: 35%; text-align: right; }
          .ticket-summary-bold { font-weight: bold; font-size: 1.15em; }
          .ticket-footer { text-align: center; font-size: 1em; margin-top: 15px; white-space: pre-line; text-transform: uppercase; }
        </style>
        </head><body>${ticketContent}</body></html>`;

      printerService.printHtmlTicket(htmlPrint);
    });
  };

  // Generar HTML del ticket desde el modal de pago (antes de finalizar)
  const generarHTMLTicketPago = () => {
    const settings = ticketSettings || {
      business_name: "TICKET DE VENTA",
      footer_message: "GRACIAS POR SU COMPRA",
    };

    const dividerString =
      settings.paper_width === "80mm"
        ? "======================================================"
        : "=================================";

    const folio = transactionId ? transactionId.toString() : "N/A";
    const userName = user?.name || "USUARIO CAJERO";
    const totalArticulos = carrito.reduce(
      (acc, p) => acc + (p.quantity || 1),
      0,
    );
    const cambioActivo = Math.max(0, calcularCambio());

    let html = '<div class="ticket-venta">';
    html += '<div class="ticket-header">';
    if (settings.logo_url) {
      html += `<div class="ticket-logo-container"><img src="${settings.logo_url}" class="ticket-logo" alt="Logo"></div>`;
    }
    html += `<div class="ticket-title">${
      settings.business_name || "TICKET DE VENTA"
    }</div>`;
    if (settings.address) {
      html += `<div class="ticket-info">${settings.address}</div>`;
    }
    if (settings.phone) {
      html += `<div class="ticket-info">${settings.phone}</div>`;
    }
    html += "</div>";

    html += `<div class="ticket-datetime">${formatearFechaHora(
      new Date(),
    )}</div>`;

    html += '<div class="ticket-meta">';
    html +=
      '<div class="ticket-meta-row"><span class="ticket-meta-label">CAJERO:</span>';
    html += `<span class="ticket-meta-value">${userName}</span></div>`;
    html +=
      '<div class="ticket-meta-row"><span class="ticket-meta-label">FOLIO:</span>';
    html += `<span class="ticket-meta-value">${folio}</span></div>`;
    html += "</div>";

    html += '<div class="ticket-table-header">';
    html += '<div class="ticket-col-cant">CANT.</div>';
    html += '<div class="ticket-col-desc">DESCRIPCION</div>';
    html += '<div class="ticket-col-imp">IMPORTE</div>';
    html += "</div>";
    html += `<div class="ticket-divider-eq">${dividerString}</div>`;

    html += '<div class="ticket-items">';
    carrito.forEach((item) => {
      html += '<div class="ticket-item">';
      html += `<div class="ticket-item-cant">${item.quantity}</div>`;
      html += `<div class="ticket-item-desc">${item.name}</div>`;
      html += `<div class="ticket-item-imp">${formatearDinero(
        item.price * item.quantity,
      )}</div>`;
      html += "</div>";
    });
    html += "</div>";

    html += '<div class="ticket-summary">';
    html += `<div class="ticket-summary-articles">NO. DE ARTICULOS: ${totalArticulos}</div>`;

    html +=
      '<div class="ticket-summary-row ticket-summary-bold"><span class="ticket-summary-label">TOTAL:</span>';
    html += `<span class="ticket-summary-value">${formatearDinero(
      total,
    )}</span></div>`;

    if (pagosRealizados && pagosRealizados.length > 0) {
      pagosRealizados.forEach((p) => {
        html += '<div class="ticket-summary-row ticket-summary-bold">';
        html += `<span class="ticket-summary-label">PAGO CON (${p.method.toUpperCase()}):</span>`;
        html += `<span class="ticket-summary-value">${formatearDinero(
          p.received || p.amount,
        )}</span></div>`;
      });
    } else {
      const valMonto =
        parseFloat(montoRecibidoRef?.current || montoRecibido) || 0;
      if (valMonto > 0) {
        html +=
          '<div class="ticket-summary-row ticket-summary-bold"><span class="ticket-summary-label">PAGO CON:</span>';
        html += `<span class="ticket-summary-value">${formatearDinero(
          valMonto,
        )}</span></div>`;
      }
    }

    html +=
      '<div class="ticket-summary-row ticket-summary-bold"><span class="ticket-summary-label">SU CAMBIO:</span>';
    html += `<span class="ticket-summary-value">${formatearDinero(
      cambioActivo,
    )}</span></div>`;
    html += "</div>";

    html += `<div class="ticket-footer">${
      settings.footer_message || "GRACIAS POR SU COMPRA"
    }</div>`;
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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center w-full gap-4">
              <div>
                <h1 className="sales-title">AREA DE COBRO</h1>
                <p className="sales-subtitle">
                  Gestiona y procesa tus ventas con precisión
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}#/customer-display?u=${user?.id}&s=${cashSession?.id}`;
                    window.open(url, "_blank", "width=1024,height=768");
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-xl shadow-sm hover:bg-emerald-600 transition-all font-bold text-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    monitor
                  </span>
                  <span className="hidden sm:inline">Pantalla Cliente</span>
                </button>
                <button
                  onClick={() => {
                    console.log("[Sales] Recarga manual solicitada");
                    cargarDatos(true);
                  }}
                  disabled={loadingProducts}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-xl shadow-sm hover:bg-blue-600 transition-all font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Recargar productos"
                >
                  <span
                    className={`material-symbols-outlined text-[18px] ${
                      loadingProducts ? "animate-spin" : ""
                    }`}
                  >
                    refresh
                  </span>
                  <span className="hidden sm:inline">
                    {loadingProducts ? "Cargando..." : "Recargar"}
                  </span>
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
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    dark_mode
                  </span>
                  <span className="hidden sm:inline">Modo Oscuro</span>
                </button>
              </div>
            </div>
          </div>

          {isSupervising && (
            <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 mb-4 rounded-r-xl shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-600">
                  admin_panel_settings
                </span>
                <div>
                  <h3 className="font-bold">Modo Supervisión Activo</h3>
                  <p className="text-sm">
                    La caja está cerrada. Las funciones de venta, cobro y
                    movimientos están deshabilitadas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* BOTONES EXTRA (PRODUCTO COMÚN, ENTRADA, SALIDA) */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <button
              onClick={() => !isSupervising && setMostrarModalComun(true)}
              disabled={isSupervising}
              className={`flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors font-medium text-sm flex-1 md:flex-none justify-center border border-slate-200 dark:border-slate-700 shadow-sm ${
                isSupervising ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Agregar un producto sin registro"
            >
              <span className="material-symbols-outlined text-[18px]">
                add_box
              </span>
              <span>Producto común</span>
            </button>
            <button
              onClick={() => !isSupervising && setMostrarModalSalida(true)}
              disabled={isSupervising}
              className={`flex items-center gap-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 rounded-xl transition-colors font-medium text-sm flex-1 md:flex-none justify-center border border-rose-200 dark:border-rose-800 shadow-sm ${
                isSupervising ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Registrar salida de dinero (Gasto)"
            >
              <span className="material-symbols-outlined text-[18px]">
                output
              </span>
              <span>Salida</span>
            </button>
            <button
              onClick={() => !isSupervising && setMostrarModalEntrada(true)}
              disabled={isSupervising}
              className={`flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl transition-colors font-medium text-sm flex-1 md:flex-none justify-center border border-emerald-200 dark:border-emerald-800 shadow-sm ${
                isSupervising ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title="Registrar entrada de dinero manual"
            >
              <span className="material-symbols-outlined text-[18px]">
                input
              </span>
              <span>Entrada</span>
            </button>
          </div>

          {/* SCANNER Y BÚSQUEDA */}
          <div
            ref={searchContainerRef}
            className="search-section-modern"
            style={{ position: "relative", zIndex: 50 }}
          >
            <div className="search-input-wrapper">
              <div className="search-input-container">
                <div className="search-icon-wrapper">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input
                  ref={campoCodigoRef}
                  type="text"
                  enterKeyHint="search"
                  inputMode={scannerInputMode}
                  placeholder={
                    scannerMode
                      ? "Escáner BT activo - escanee un código..."
                      : "Buscar por nombre o código de..."
                  }
                  value={codigoEscaneado}
                  onChange={manejarCambioCodigo}
                  onKeyDown={manejarEnter}
                  disabled={isSupervising}
                  className={`barcode-input-modern ${
                    scannerMode ? "scanner-mode-active" : ""
                  } ${isSupervising ? "opacity-50 cursor-not-allowed" : ""}`}
                />
              </div>
              <button
                onClick={() => setMostrarCameraScanner(true)}
                className="btn-camera-modern"
                disabled={isSupervising}
                type="button"
                title="Escanear código con cámara"
              >
                <span className="material-symbols-outlined">photo_camera</span>
                <span>Cámara</span>
              </button>
              {/* Toggle Modo Escáner Bluetooth — solo visible en Android */}
              {isAndroid && (
                <button
                  onClick={toggleScannerMode}
                  className={`btn-camera-modern ${
                    scannerMode ? "scanner-mode-btn-active" : ""
                  }`}
                  type="button"
                  title={
                    scannerMode
                      ? "Desactivar modo escáner (mostrar teclado)"
                      : "Activar modo escáner Bluetooth (ocultar teclado)"
                  }
                >
                  <span className="material-symbols-outlined">
                    {scannerMode ? "keyboard" : "barcode_reader"}
                  </span>
                  <span>{scannerMode ? "Teclado" : "Escáner BT"}</span>
                </button>
              )}
            </div>

            {/* LISTA DE SUGERENCIAS */}
            {mostrarSugerencias && (
              <div className="suggestions-dropdown">
                {sugerencias.map((producto, index) => (
                  <div
                    key={producto.id}
                    className={`suggestion-item ${
                      index === indexSugerencia ? "active" : ""
                    }`}
                    onClick={() => seleccionarProducto(producto)}
                    onMouseEnter={() => setIndexSugerencia(index)}
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
                    <div className="item-price-modern">
                      {formatearDinero(item.price)}
                    </div>
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
                    <input
                      type="number"
                      className="quantity-input-modern"
                      value={item.quantity === 0 ? "" : item.quantity}
                      onChange={(e) => {
                        const inputVal = e.target.value;
                        if (inputVal === "") {
                          cambiarCantidad(item.id, 0);
                        } else {
                          const val = parseInt(inputVal);
                          if (!isNaN(val) && val >= 0) {
                            cambiarCantidad(item.id, val);
                          }
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          e.target.blur();
                          if (item.quantity > 0) {
                            setTimeout(() => {
                              abrirModalPago();
                            }, 150);
                          }
                        }
                      }}
                      onBlur={(e) => {
                        if (item.quantity < 1) {
                          cambiarCantidad(item.id, 1);
                        }
                      }}
                      min="1"
                    />
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
                    Total: {formatearDinero(item.price * item.quantity)}
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
              disabled={vendiendo || carrito.length === 0 || isSupervising}
              className={`btn-process-payment ${
                isSupervising ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Procesar Pago
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE PAGO */}
      {mostrarModalPago && (
        <div
          className="payment-modal-overlay modal-overlay"
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
                    #{transactionId}
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

                {/* PAGOS REGISTRADOS - MOVILIZADO AL LADO IZQUIERDO */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                  <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                    Pagos Registrados
                  </h4>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                    {pagosRealizados.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-2">
                        No hay pagos agregados
                      </p>
                    ) : (
                      pagosRealizados.map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-indigo-200"
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                            <span className="capitalize">{p.method}</span>
                            {p.method === "dolares" && (
                              <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 rounded">
                                ({p.received} USD)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">
                              ${formatearDinero(p.amount)}
                            </span>
                            <button
                              onClick={() => eliminarPago(p.id)}
                              className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-1 rounded-md transition-all"
                            >
                              <span className="material-symbols-outlined text-[16px]">
                                close
                              </span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="payment-summary-footer">
                  {/* SALDO PENDIENTE - REUBICADO */}
                  <div className="mb-4 flex justify-between items-center p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Saldo Pendiente:
                    </span>
                    <span className="text-xl font-black">
                      {formatearDinero(Math.max(0, saldoPendiente))}
                    </span>
                  </div>

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
                      className={`payment-method-btn ${
                        metodoPago === "efectivo" ? "active" : ""
                      }`}
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
                      className={`payment-method-btn ${
                        metodoPago === "tarjeta" ? "active" : ""
                      }`}
                      onClick={() => {
                        setMetodoPago("tarjeta");
                        setMontoRecibido("");
                      }}
                    >
                      <span className="material-symbols-outlined">
                        credit_card
                      </span>
                      <span>Tarjeta</span>
                    </button>
                    <button
                      className={`payment-method-btn ${
                        metodoPago === "transferencia" ? "active" : ""
                      }`}
                      onClick={() => {
                        setMetodoPago("transferencia");
                        setMontoRecibido("");
                      }}
                    >
                      <span className="material-symbols-outlined">
                        account_balance
                      </span>
                      <span>Transferencia</span>
                    </button>

                    {tipoCambio && (
                      <button
                        className={`payment-method-btn ${
                          metodoPago === "dolares" ? "active" : ""
                        }`}
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
                        <button
                          className="px-4 py-2 bg-indigo-600 text-white rounded-xl ml-4 font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={agregarPago}
                          disabled={
                            !montoRecibido ||
                            parseFloat(montoRecibido) <= 0 ||
                            (metodoPago === "dolares" && tipoCambio
                              ? parseFloat(montoRecibido) * tipoCambio >=
                                saldoPendiente
                              : parseFloat(montoRecibido) >= saldoPendiente)
                          }
                        >
                          Agregar Pago
                        </button>
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
                        metodoPago === "dolares" ||
                        metodoPago === "tarjeta" ||
                        metodoPago === "transferencia") && (
                        <div className="payment-keypad">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, ".", "backspace"].map(
                            (num) => (
                              <button
                                key={num}
                                className={`payment-key ${
                                  num === "backspace" ? "backspace" : ""
                                }`}
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
                      metodoPago === "dolares" ||
                      metodoPago === "tarjeta" ||
                      metodoPago === "transferencia") && (
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
                      !modalReady ||
                      (saldoPendiente > 0.01 &&
                        (metodoPago === "dolares" && tipoCambio
                          ? (parseFloat(montoRecibido) || 0) * tipoCambio <
                            saldoPendiente
                          : (parseFloat(montoRecibido) || 0) < saldoPendiente))
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
      {/* MODAL PRODUCTO COMÚN */}
      {mostrarModalComun && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in fade-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">
                add_box
              </span>
              Producto Común
            </h3>
            <form onSubmit={handleAddProductoComun} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descripción
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  value={comunForm.descripcion}
                  onChange={(e) =>
                    setComunForm({ ...comunForm, descripcion: e.target.value })
                  }
                  placeholder="Ej. Copias, Servicio, etc."
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={comunForm.cantidad}
                    onChange={(e) =>
                      setComunForm({ ...comunForm, cantidad: e.target.value })
                    }
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Precio Unit.
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                    value={comunForm.precio}
                    onChange={(e) =>
                      setComunForm({ ...comunForm, precio: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarModalComun(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium shadow-sm hover:shadow-md"
                >
                  Aceptar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ENTRADA */}
      {mostrarModalEntrada && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in fade-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">
                input
              </span>
              Entrada de Efectivo
            </h3>
            <form onSubmit={handleAddEntrada} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Concepto / Razón
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  value={entradaForm.concepto}
                  onChange={(e) =>
                    setEntradaForm({ ...entradaForm, concepto: e.target.value })
                  }
                  placeholder="Ej. Cambio extra, Apertura"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Monto (MXN)
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-mono text-lg"
                  value={entradaForm.cantidad}
                  onChange={(e) =>
                    setEntradaForm({ ...entradaForm, cantidad: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarModalEntrada(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SALIDA */}
      {mostrarModalSalida && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in fade-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-rose-500">
                output
              </span>
              Salida / Gasto
            </h3>
            <form onSubmit={handleAddSalida} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Concepto / Motivo
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
                  value={salidaForm.concepto}
                  onChange={(e) =>
                    setSalidaForm({ ...salidaForm, concepto: e.target.value })
                  }
                  placeholder="Ej. Compra de agua, Proveedor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Monto a retirar (MXN)
                </label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white font-mono text-lg"
                  value={salidaForm.cantidad}
                  onChange={(e) =>
                    setSalidaForm({ ...salidaForm, cantidad: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarModalSalida(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>
                  Retirar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
