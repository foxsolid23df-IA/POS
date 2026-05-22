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
import { packPresetService } from "../../services/packPresetService";
import { CashMovementModal } from "./CashMovementModal";
import { CashFundModal } from "../auth/CashFundModal";
import { supabase } from "../../supabase";
import { useProducts } from "../../contexts/ProductContext";
import { useSettings } from "../../contexts/SettingsContext";
import { SessionReportModal } from "./SessionReportModal";
import SearchSection from "./SearchSection";
import CartSidebar from "./CartSidebar";

import { SalesHeader } from "./SalesHeader";
import { QuickActions } from "./QuickActions";
import ProductGrid from "./ProductGrid";
import "./Sales.css";
import PaymentModal from "./PaymentModal";
import ProductAddModal from "./ProductAddModal";

export const Sales = () => {
  // HOOKS PERSONALIZADOS
  const {
    user,
    cashSession,
    isSupervising,
    needsCashFund,
    checkCashSession,
    storeName,
  } = useAuth();
  const [mostrarModalFondo, setMostrarModalFondo] = useState(false);
  const { ticketSettings } = useSettings();
  const { cargando, ejecutarPeticion } = useApi();
  const { isMobile, isTouchDevice } = useIsMobile();
  const {
    isAndroid,
    isAvailable,
    scannerMode,
    scannerInputMode,
    toggleScannerMode,
  } = useScannerMode();

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
    cambiarUnidadVenta,
    alternarUnidadUltimaLinea,
    quitarProducto,
    vaciarCarrito,
    total,
    activeCartItemId,
    setActiveCartItemId,
    convertirAPaquete,
    convertirCarritoAPaquete,
    validateCartStockWithRPC
  } = useCart(mostrarError, user?.allow_negative_stock);

  // ESTADOS PARA EMPAQUE AL VUELO
  const [mostrarModalEmpaque, setMostrarModalEmpaque] = useState(false);
  const [itemEmpaque, setItemEmpaque] = useState(null);
  const [empaqueForm, setEmpaqueForm] = useState({
    piezas: "",
    precio: "",
  });
  const [presets, setPresets] = useState([]);
  const [cargandoPresets, setCargandoPresets] = useState(false);
  const [guardarComoPreset, setGuardarComoPreset] = useState(false);

  const [mostrarModalPaqueteTodo, setMostrarModalPaqueteTodo] = useState(false);
  const [paqueteTodoForm, setPaqueteTodoForm] = useState({
    nombre: "PAQUETE PERSONALIZADO",
    precio: "",
  });

  const abrirModalEmpaque = async (item) => {
    setItemEmpaque(item);
    setEmpaqueForm({
      piezas: item.conversion_factor || 1,
      precio: item.price || 0,
    });
    setGuardarComoPreset(false);
    setMostrarModalEmpaque(true);

    // Cargar presets para este producto
    setCargandoPresets(true);
    try {
      const data = await packPresetService.getPresetsByProductId(item.id);
      setPresets(data);
    } catch (error) {
      console.error("[Sales] Error al cargar presets:", error);
    } finally {
      setCargandoPresets(false);
    }
  };

  const handleConfirmarEmpaque = async (e) => {
    e.preventDefault();
    if (itemEmpaque) {
      // Si el usuario marcó guardar como preset, lo creamos en segundo plano
      if (guardarComoPreset) {
        try {
          await packPresetService.createPreset({
            product_id: itemEmpaque.id,
            units: empaqueForm.piezas,
            price: empaqueForm.precio,
            label: `${empaqueForm.piezas} Pzas`
          });
        } catch (error) {
          console.error("[Sales] Error al guardar preset:", error);
        }
      }

      convertirAPaquete(
        itemEmpaque.id,
        empaqueForm.piezas,
        empaqueForm.precio,
      );
      setMostrarModalEmpaque(false);
      setItemEmpaque(null);
    }
  };

  const handleSelectPreset = (preset) => {
    setEmpaqueForm({
      piezas: preset.units,
      precio: preset.price
    });
  };

  const handleDeletePreset = async (e, presetId) => {
    e.stopPropagation();
    try {
      await packPresetService.deletePreset(presetId);
      setPresets(prev => prev.filter(p => p.id !== presetId));
    } catch (error) {
      console.error("[Sales] Error al eliminar preset:", error);
    }
  };

  const handleConfirmarPaqueteTodo = (e) => {
    e.preventDefault();
    if (carrito.length > 0) {
      convertirCarritoAPaquete(paqueteTodoForm.nombre, paqueteTodoForm.precio);
      setMostrarModalPaqueteTodo(false);
    }
  };

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

    const cantidad = parseFloat(comunForm.cantidad);
    const precio = parseFloat(comunForm.precio);

    if (isNaN(cantidad) || cantidad <= 0 || isNaN(precio) || precio < 0) {
      mostrarModalPersonalizado(
        "Error",
        "Cantidad y Precio deben ser números válidos.",
        "warning",
      );
      return;
    }

    const itemComun = {
      id: `COMUN-${Date.now()}`,
      name: comunForm.descripcion.toUpperCase(),
      price: precio,
      quantity: cantidad,
      stock: 999999, // Producto común no tiene límite de stock manual
      image: null,
      is_common: true,
    };

    agregarProducto(itemComun, undefined, true);
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
  const [activeCategory, setActiveCategory] = useState(null);
  
  const getCategoryIcon = (category) => {
    const icons = {
      "Herramientas": "🔧",
      "Fijaciones": "🔩",
      "Electricidad": "⚡",
      "Pintura": "🎨",
      "Plomería": "🚰",
      "Madera": "🪵",
      "Automotriz": "🚗",
      "Jardín": "🌱",
      "Iluminación": "💡",
      "Ferretería": "🔨",
      "Accesorios": "🧰",
      "Materiales": "🧱"
    };
    return icons[category] || "📦";
  };

  // Categorías para accesos rápidos
  const categories = [
    "Herramientas", "Fijaciones", "Electricidad", "Pintura",
    "Plomería", "Madera", "Automotriz", "Jardín",
    "Iluminación", "Ferretería", "Accesorios", "Materiales"
  ];
  
  // ID temporal de transacción estable para el modal de pago
  const [transactionId, setTransactionId] = useState("");
  // Estado para evitar que el primer ENTER abra y el segundo cierre instantáneamente
  const [modalReady, setModalReady] = useState(false);
  const [facturar, setFacturar] = useState(false);
  const [issuers, setIssuers] = useState([]);
  const [selectedIssuerId, setSelectedIssuerId] = useState("");
  const [stockDisplayMode, setStockDisplayMode] = useState("mixed"); // 'pieces', 'mixed', 'boxes'
  const [showTableDetails, setShowTableDetails] = useState(true); // Controla la visibilidad de detalles extra en la tabla
  const [mostrarModalAddProduct, setMostrarModalAddProduct] = useState(false);
  const [productoParaModal, setProductoParaModal] = useState(null);

  // ESTADOS PARA COLUMNAS PERSONALIZABLES Y REDIMENSIONABLES
  const [columnasVisibles, setColumnasVisibles] = useState({
    idx: true,
    code: true,
    desc: true,
    price: true,
    qty: true,
    unit: true,
    total: true,
    actions: true
  });
  const [mostrarConfigColumnas, setMostrarConfigColumnas] = useState(false);
  const [anchosColumnas, setAnchosColumnas] = useState({
    idx: 40,
    code: 110,
    desc: 300,
    price: 90,
    qty: 110,
    unit: 100,
    total: 110,
    actions: 45
  });
  
  const colConfigRef = useRef(null);
  const resizerRef = useRef({ isResizing: false, column: null, startX: 0, startWidth: 0 });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colConfigRef.current && !colConfigRef.current.contains(e.target)) {
        setMostrarConfigColumnas(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const startResizing = (e, column) => {
    e.preventDefault();
    resizerRef.current = {
      isResizing: true,
      column,
      startX: e.pageX,
      startWidth: anchosColumnas[column]
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };

  const handleMouseMove = (e) => {
    if (!resizerRef.current.isResizing) return;
    const delta = e.pageX - resizerRef.current.startX;
    const newWidth = Math.max(columnasVisibles[resizerRef.current.column] ? 40 : 0, resizerRef.current.startWidth + delta);
    setAnchosColumnas(prev => ({ ...prev, [resizerRef.current.column]: newWidth }));
  };

  const toggleTableDetails = () => {
    setShowTableDetails(!showTableDetails);
  };

  const stopResizing = () => {
    resizerRef.current.isResizing = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  };

  const toggleColumna = (key) => {
    setColumnasVisibles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleStockDisplayMode = () => {
    setStockDisplayMode((prev) => {
      if (prev === "mixed") return "pieces";
      if (prev === "pieces") return "boxes";
      return "mixed";
    });
  };

  useEffect(() => {
    if (facturar && issuers.length === 0) {
      const fetchIssuers = async () => {
        const { data } = await supabase
          .from("billing_issuers")
          .select("id, rfc, razon_social")
          .order("created_at", { ascending: false });
        if (data) {
          setIssuers(data);
          if (data.length > 0) setSelectedIssuerId(data[0].id);
        }
      };
      fetchIssuers();
    }
  }, [facturar, issuers.length]);

  const taxRateValue =
    user?.tax_enabled !== false ? parseFloat(user?.tax_percentage) || 0 : 0;
  
  // Si el usuario tiene marcado que sus precios ya incluyen IVA, el total con impuesto es el mismo total.
  // Si no, el total con impuesto es el total original más el porcentaje de impuesto.
  const totalConImpuesto = user?.tax_included !== false 
    ? total 
    : total * (1 + taxRateValue / 100);
    
  const totalVenta = facturar ? totalConImpuesto : total;
  
  // Calculamos el monto de impuesto para el desglose
  let taxAmount = 0;
  if (facturar && taxRateValue > 0) {
    if (user?.tax_included !== false) {
      // IVA incluido: Extraemos el IVA del total
      taxAmount = totalVenta - (totalVenta / (1 + taxRateValue / 100));
    } else {
      // IVA no incluido: El IVA es la diferencia entre el total con impuesto y el original
      taxAmount = totalVenta - total;
    }
  }

  const tieneCajaConfigurada = (producto) =>
    parseInt(producto?.box_units || 0) > 1 &&
    parseFloat(producto?.box_price || 0) > 0;

  const prepararProductoCarrito = (producto, unidad = "PZA") => ({
    ...producto,
    image: producto.image_url || producto.image,
    unit_price: parseFloat(producto.price || 0),
    unit_sold: tieneCajaConfigurada(producto) && unidad === "CAJA" ? "CAJA" : "PZA",
  });

  const formatStockDisplay = (item) => {
    const stockPzas = item.stock || 0;
    const factor = item.conversion_factor || item.box_units || 1;
    
    if (stockDisplayMode === "pieces") {
      return `${stockPzas} pzs`;
    }
    
    if (stockDisplayMode === "boxes" && factor > 1) {
      const boxes = Math.floor(stockPzas / factor);
      const rem = stockPzas % factor;
      return rem > 0 ? `${boxes} cjs + ${rem} pzs` : `${boxes} cjs`;
    }
    
    if (stockDisplayMode === "mixed" && factor > 1) {
      const boxes = Math.floor(stockPzas / factor);
      return `${stockPzas} pzs (${boxes} cjs)`;
    }
    
    return `${stockPzas} pzs`;
  };

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
  const [mostrarModalReporte, setMostrarModalReporte] = useState(false);

  // Determinar si hay algún modal abierto para ocultar elementos de fondo
  const isAnyModalOpen = 
    mostrarModalAddProduct || 
    mostrarModalPago || 
    mostrarModalComun || 
    mostrarModalEntrada || 
    mostrarModalSalida || 
    mostrarModalEmpaque || 
    mostrarModalFondo || 
    mostrarModalReporte || 
    mostrarModalPaqueteTodo || 
    modal.isOpen;

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
        .updateCart(carrito, totalVenta, cashSession.id)
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
  }, [carrito, totalVenta, cashSession, user]);

  // BÚSQUEDA POR NOMBRE Y SKU - Filtrar sugerencias cuando cambia el texto
  useEffect(() => {
    const query = codigoEscaneado.toLowerCase().trim();
    if (query.length >= 2) {
      // Buscar por nombre o por código de barras (SKU)
      const resultados = productos
        .filter(
          (p) =>
            p?.name?.toLowerCase().includes(query) ||
            p?.barcode?.toLowerCase().includes(query) ||
            p?.box_barcode?.toLowerCase().includes(query),
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
          await activeCartService.updateCart(
            carrito,
            totalVenta,
            cashSession?.id,
          );
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
  }, [carrito, totalVenta, user, cashSession, mostrarModalPago]);

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
            total: totalVenta,
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
  }, [metodoPago, montoRecibido, mostrarModalPago, user, totalVenta]);

  // Efecto para calcular el saldo pendiente
  useEffect(() => {
    const taxRateValue =
      user?.tax_enabled !== false ? parseFloat(user?.tax_percentage) || 0 : 0;
    const totalFinal = facturar ? total * (1 + taxRateValue / 100) : total;
    const pagado = pagosRealizados.reduce((sum, p) => sum + p.amount, 0);
    setSaldoPendiente(totalFinal - pagado);
  }, [pagosRealizados, total, facturar, user]);

  // Seleccionar producto de las sugerencias
  const seleccionarProducto = (producto) => {
    setProductoParaModal(producto);
    setMostrarModalAddProduct(true);
    setCodigoEscaneado("");
    setSugerencias([]);
    setMostrarSugerencias(false);
  };

  const handleModalAdd = (pzaQty, cajaQty) => {
    const producto = productoParaModal;
    if (!producto) return;
    if (pzaQty > 0) {
      agregarProducto({ ...producto, quantity: pzaQty, image: producto.image_url || producto.image }, 'PZA', true);
    }
    if (cajaQty > 0) {
      agregarProducto({ ...producto, quantity: cajaQty, image: producto.image_url || producto.image }, 'CAJA', true);
    }
    cerrarModalAddProduct();
  };

  const cerrarModalAddProduct = () => {
    setMostrarModalAddProduct(false);
    setProductoParaModal(null);
    setTimeout(() => campoCodigoRef.current?.focus(), 50);
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
    const productoLocal = productos.find(
      (p) => p.barcode === codigo || p.box_barcode === codigo,
    );
    if (productoLocal) {
      const unidadEscaneada =
        productoLocal.box_barcode === codigo && tieneCajaConfigurada(productoLocal)
          ? "CAJA"
          : "PZA";
      const productoConImagen = prepararProductoCarrito(
        productoLocal,
        unidadEscaneada,
      );
      agregarProducto(productoConImagen, undefined, true);
      return;
    }

    try {
      await ejecutarPeticion(async (signal) => {
        const producto = await buscarProductoPorCodigo(codigo, signal);
        agregarProducto(prepararProductoCarrito(producto, "PZA"), undefined, true);
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
      const productoLocal = productos.find(
        (p) => p.barcode === codigo || p.box_barcode === codigo,
      );
      if (productoLocal) {
        const unidadEscaneada =
          productoLocal.box_barcode === codigo && tieneCajaConfigurada(productoLocal)
            ? "CAJA"
            : "PZA";
        agregarProducto(prepararProductoCarrito(productoLocal, unidadEscaneada), undefined, true);
        return;
      }

      await ejecutarPeticion(async (signal) => {
        const producto = await buscarProductoPorCodigo(codigo, signal);
        agregarProducto(prepararProductoCarrito(producto, "PZA"), undefined, true);
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
    setTransactionId((Math.floor(Math.random() * 90000) + 10000).toString());
    setMostrarModalPago(true);
  };

  const cerrarModalPago = () => {
    setMostrarModalPago(false);
  };

  const generarCotizacion = () => {
    if (isSupervising) {
      mostrarModalPersonalizado(
        "Modo Supervisión",
        "No puedes generar cotizaciones en modo supervisión.",
        "warning",
      );
      return;
    }
    if (carrito.length === 0) {
      mostrarModalPersonalizado(
        "Carrito vacío",
        "No hay productos para cotizar.",
        "warning",
      );
      return;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(1000 + Math.random() * 9000);
    const folio = `COT-${yyyy}${mm}${dd}-${random}`;

    const cotizacionTotal = total;
    const currentTaxRate =
      user?.tax_enabled !== false
        ? parseFloat(user?.tax_percentage) || 0
        : 0;
    let cotizacionSubtotal = cotizacionTotal;
    let cotizacionTax = 0;

    if (currentTaxRate > 0) {
      if (user?.tax_included !== false) {
        cotizacionSubtotal =
          cotizacionTotal / (1 + currentTaxRate / 100);
        cotizacionTax = cotizacionTotal - cotizacionSubtotal;
      } else {
        cotizacionSubtotal = cotizacionTotal;
        cotizacionTax =
          cotizacionTotal * (currentTaxRate / 100);
      }
    }

    const cotizacion = {
      id: folio,
      folio,
      productos: [...carrito],
      items: [...carrito],
      total: cotizacionTotal,
      subtotal: cotizacionSubtotal,
      tax_amount: cotizacionTax,
      tax_percentage: currentTaxRate,
      isCotizacion: true,
      createdAt: now.toISOString(),
      cashier_name: user?.full_name || "USUARIO CAJERO",
      users: { name: user?.full_name || "USUARIO CAJERO" },
    };

    vaciarCarrito();
    setVentaCompletada(cotizacion);
    setMostrarModal(true);
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
        // Si ya hay punto decimal, solo permitir hasta 2 decimales
        if (prev.includes(".")) {
          const parts = prev.split(".");
          if (parts[1] && parts[1].length >= 2) {
            return prev; // Ya tiene 2 decimales, no agregar más
          }
        }
        // Agregar dígito libremente (sin auto-insertar punto)
        return prev + valor;
      }
    });
  };

  const calcularCambio = () => {
    // Usar directamente el estado montoRecibido en lugar de la ref
    const monto = parseFloat(montoRecibido) || 0;

    if (metodoPago === "dolares" && tipoCambio) {
      // Convertir dólares recibidos a pesos
      const totalEnPesos = monto * tipoCambio;
      // Calcular cambio en pesos basado en el saldo que falta por cubrir
      return Math.max(0, totalEnPesos - saldoPendiente);
    }

    // Para los demás métodos (efectivo, tarjeta, transferencia), el cambio se calcula sobre el saldo pendiente
    return Math.max(0, monto - saldoPendiente);
  };

  const formatearMontoRecibido = () => {
    return montoRecibido || "0.00";
  };

  const finalizarVenta = async (datosPago = null) => {
    let pagosActualizados;
    let shouldFacturar;
    let selectedIssuer;

    if (datosPago) {
      pagosActualizados = datosPago.pagos;
      shouldFacturar = datosPago.facturar;
      selectedIssuer = datosPago.issuerId;
    } else {
      pagosActualizados = [...pagosRealizados];
      shouldFacturar = facturar;
      selectedIssuer = selectedIssuerId;

      let saldoActual = saldoPendiente;
      const montoNum = parseFloat(montoRecibidoRef.current || montoRecibido) || 0;
      const valorEnPesos =
        metodoPago === "dolares" && tipoCambio ? montoNum * tipoCambio : montoNum;

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
    }

    setVendiendo(true);
    
    const validation = await validateCartStockWithRPC();
    if (!validation.valid) {
      setVendiendo(false);
      return;
    }

    cerrarModalPago();

    try {
      const currentTaxRate = shouldFacturar ? taxRateValue : 0;
      const ventaTotal = shouldFacturar ? totalConImpuesto : total;
      let subtotal = total;
      let taxAmount = 0;

      if (shouldFacturar && currentTaxRate > 0) {
        if (user?.tax_included !== false) {
          // IVA incluido: el total ya tiene el impuesto, calculamos hacia atrás
          subtotal = ventaTotal / (1 + currentTaxRate / 100);
          taxAmount = ventaTotal - subtotal;
        } else {
          // IVA no incluido: el total es el subtotal, sumamos el impuesto
          subtotal = total;
          taxAmount = ventaTotal - subtotal;
        }
      }

      const ventaData = {
        user_id: user?.id,
        items: carrito
          .filter((item) => item.quantity > 0)
          .map((item) => ({
            id: item.id,
            product_id: item.product_id || item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            stock: item.stock || 0,
            unit_sold: item.unit_sold || "PZA",
            conversion_factor: item.conversion_factor || item.stock_multiplier || 1,
            base_quantity:
              item.base_quantity ||
              item.quantity * (item.stock_multiplier || item.conversion_factor || 1),
          })),
        total: ventaTotal,
        subtotal: subtotal,
        tax_amount: taxAmount,
        tax_percentage: currentTaxRate,
        payments: pagosActualizados,
        metodoPago:
          pagosActualizados.length === 1
            ? pagosActualizados[0].method
            : "múltiple",
        currency: "MXN",
        exchange_rate: null,
        billing_issuer_id: shouldFacturar ? selectedIssuer : null,
        affect_inventory: user?.affect_inventory !== undefined ? user?.affect_inventory : true
      };

      // Crear venta en Supabase
      const ventaCreada = await salesService.createSale(ventaData);

      // Calcular el cambio real y monto total recibido
      const totalChange = pagosActualizados.reduce(
        (sum, p) => sum + p.change,
        0,
      );
      const totalReceivedPesos = pagosActualizados.reduce((sum, p) => {
        return (
          sum +
          (p.currency === "USD" && p.exchange_rate
            ? p.received * p.exchange_rate
            : p.received)
        );
      }, 0);

      const totalFinal = datosPago
        ? (datosPago.facturar ? totalConImpuesto : total)
        : totalVenta;

      setVentaCompletada({
        ...ventaCreada,
        productos: [...carrito],
        items: [...carrito],
        payments: [...pagosActualizados],
        metodoPago: ventaData.metodoPago,
        montoRecibido: totalReceivedPesos,
        cambio: totalChange,
        total: totalFinal,
        subtotal: subtotal,
        tax_amount: taxAmount,
        tax_percentage: currentTaxRate,
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
        error.message || "No se pudo completar la venta. Por favor, intenta nuevamente.",
        "error",
      );
    }

    setVendiendo(false);
  };
  const handlePaymentComplete = async (datosPago) => {
    console.log("[Sales] Payment complete data received:", datosPago);
    try {
      await finalizarVenta(datosPago);
    } catch (error) {
      console.error("[Sales] Error finishing sale from modal:", error);
    }
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
    // Si el listener nativo ya lo manejó, salir
    if (e.defaultPrevented) return;

    // Navegación en sugerencias
    if (sugerencias.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndexSugerencia((prev) => (prev < sugerencias.length - 1 ? prev + 1 : 0));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndexSugerencia((prev) => (prev > 0 ? prev - 1 : sugerencias.length - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (indexSugerencia >= 0 && indexSugerencia < sugerencias.length) {
          seleccionarProducto(sugerencias[indexSugerencia]);
          setCodigoEscaneado("");
          return;
        }
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMostrarSugerencias(false);
        setIndexSugerencia(0);
        return;
      }
    }

    if (e.key === "Enter" && sugerencias.length === 0) {
      if (codigoEscaneado.trim()) {
        e.preventDefault();
        const productoLocal = productos.find(
          p => p.barcode === codigoEscaneado.trim() || p.box_barcode === codigoEscaneado.trim()
        );
        if (productoLocal) {
          seleccionarProducto(productoLocal);
        } else {
          buscarProductoManual(codigoEscaneado.trim());
        }
        setCodigoEscaneado("");
      } else if (
        carrito.length > 0 &&
        !mostrarModalPago &&
        !modal.isOpen &&
        !mostrarModal
      ) {
        e.preventDefault();
        e.target.blur();
        setTimeout(() => {
          abrirModalPago();
        }, 150);
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

  // Keyboard handling moved to PaymentModal component

  // MANEJAR ENTER GLOBAL PARA MODALES Y PAGO
  useEffect(() => {
    const handleGlobalEnter = (e) => {
      // Modales activos previenen atajos globales
      if (mostrarModalPago || modal.isOpen || mostrarModal || mostrarModalAddProduct) {
        if (e.key === "Enter") {
          if (modal.isOpen) {
            e.preventDefault();
            cerrarModalPersonalizado();
            return;
          }
          if (mostrarModal) {
            e.preventDefault();
            cerrarModal();
            return;
          }
        }
        return;
      }

      const activeElement = document.activeElement;
      const isInput =
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA";

      // F10: Recargar
      if (e.key === "F10") {
        e.preventDefault();
        window.location.reload();
        return;
      }

      // F7: Reporte
      if (e.key === "F7") {
        e.preventDefault();
        setMostrarModalReporte(true);
        return;
      }

      // F12: Abrir modal de pago
      if (e.key === "F12" && carrito.length > 0) {
        e.preventDefault();
        abrirModalPago();
        return;
      }

      // F2 o Flecha derecha (fuera de input): Alternar Unidad (PZA/CAJA)
      if (e.key === "F2" || (!isInput && e.key === "ArrowRight")) {
        if (carrito.length > 0) {
          e.preventDefault();
          alternarUnidadUltimaLinea();
        }
        return;
      }

      // F3 o Alt + C: Empaque al Vuelo
      if (e.key === "F3" || (e.altKey && (e.key === "c" || e.key === "C"))) {
        if (carrito.length > 0) {
          e.preventDefault();
          const lastItem =
            carrito.find((line) => line.id === activeCartItemId) ||
            carrito[carrito.length - 1];
          if (lastItem) {
            abrirModalEmpaque(lastItem);
          }
        }
        return;
      }

      // F4 o p o + o * (fuera de input): Empacar Todo (Bulk Pack)
      if (
        e.key === "F4" ||
        (!isInput && (e.key.toLowerCase() === "p" || e.key === "+" || e.key === "*"))
      ) {
        if (carrito.length > 0) {
          e.preventDefault();
          setMostrarModalPaqueteTodo(true);
        }
        return;
      }

      // Atajos de teclado que sólo funcionan cuando no se está en un input
      if (!isInput) {
        // f: Finalizar venta
        if (e.key.toLowerCase() === "f" && carrito.length > 0) {
          e.preventDefault();
          abrirModalPago();
          return;
        }

        // x: Vaciar carrito
        if (e.key.toLowerCase() === "x" && carrito.length > 0) {
          e.preventDefault();
          vaciarCarrito();
          return;
        }

        // - o Delete: Quitar producto seleccionado
        if ((e.key === "-" || e.key === "Delete") && carrito.length > 0) {
          e.preventDefault();
          const targetId = activeCartItemId || carrito[carrito.length - 1].id;
          quitarProducto(targetId);
          return;
        }

        // Navegación con flechas arriba/abajo
        if ((e.key === "ArrowUp" || e.key === "ArrowDown") && carrito.length > 0) {
          e.preventDefault();
          const currentIndex = carrito.findIndex(
            (item) => item.id === activeCartItemId,
          );
          let nextIndex;

          if (e.key === "ArrowUp") {
            if (currentIndex === -1) nextIndex = carrito.length - 1;
            else nextIndex = Math.max(0, currentIndex - 1);
          } else {
            if (currentIndex === -1) nextIndex = 0;
            else nextIndex = Math.min(carrito.length - 1, currentIndex + 1);
          }

          if (carrito[nextIndex]) {
            setActiveCartItemId(carrito[nextIndex].id);
          }
          return;
        }
      }

      // Enter Global para Abrir Pago
      if (e.key === "Enter" && !isInput && carrito.length > 0) {
        e.preventDefault();
        abrirModalPago();
      }
    };

    window.addEventListener("keydown", handleGlobalEnter);
    return () => window.removeEventListener("keydown", handleGlobalEnter);
  }, [
    modal.isOpen,
    mostrarModal,
    mostrarModalPago,
    mostrarModalAddProduct,
    carrito,
    activeCartItemId,
    alternarUnidadUltimaLinea,
    cambiarUnidadVenta,
    abrirModalPago,
    abrirModalEmpaque,
    cerrarModal,
    cerrarModalPersonalizado,
    setMostrarModalReporte,
    vaciarCarrito,
    quitarProducto,
    setActiveCartItemId,
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
        p.box_barcode === codigoLimpio ||
        p.barcode === codigoLimpio.replace(/^0+/, ""), // Sin ceros iniciales
    );

    if (productoLocal) {
      const unidadEscaneada =
        productoLocal.box_barcode === codigoLimpio &&
        tieneCajaConfigurada(productoLocal)
          ? "CAJA"
          : "PZA";
      const productoConImagen = prepararProductoCarrito(
        productoLocal,
        unidadEscaneada,
      );
      agregarProducto(productoConImagen, undefined, true);
      mostrarModalPersonalizado(
        "Producto agregado",
        `${productoLocal.name} añadido al carrito (${unidadEscaneada})`,
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
          agregarProducto(productoConImagen, undefined, true);
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

    // SUBTOTAL E IVA (Si está habilitado)
    const taxEnabled = user?.tax_enabled !== false;
    const taxRate = taxEnabled ? parseFloat(user?.tax_percentage) || 0 : 0;

    if (taxRate > 0) {
      const subtotalVal = total / (1 + taxRate / 100);
      const taxVal = total - subtotalVal;

      html +=
        '<div class="ticket-summary-row"><span class="ticket-summary-label">SUBTOTAL:</span>';
      html += `<span class="ticket-summary-value">${formatearDinero(
        subtotalVal,
      )}</span></div>`;

      html += `<div class="ticket-summary-row"><span class="ticket-summary-label">IVA (${taxRate}%):</span>`;
      html += `<span class="ticket-summary-value">${formatearDinero(
        taxVal,
      )}</span></div>`;
    }

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
    }<br>FACTURACIÓN EN:<br>https://facturacion.nexumpos.com</div>`;
    html += "</div>";

    return html;
  };

  return (
    <div className="sales-view">
      <SalesHeader onOpenReportModal={() => setMostrarModalReporte(true)} />

      {isSupervising && (
        <div className="bg-gradient-to-r from-amber-100 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/40 border-l-4 border-amber-500 dark:border-amber-400 text-amber-900 dark:text-amber-100 p-4 mb-4 rounded-r-xl shadow-md dark:shadow-lg flex items-center justify-between mx-4 mt-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">
              admin_panel_settings
            </span>
            <div>
              <h3 className="font-bold text-amber-900 dark:text-amber-50">
                Modo Supervisión Activo
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200">
                La caja está cerrada. Las funciones de venta, cobro y
                movimientos están deshabilitadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* BOTONES EXTRA (PRODUCTO COMÚN, ENTRADA, SALIDA) */}
      <div className="px-4 mt-2" style={{ visibility: isAnyModalOpen ? 'hidden' : 'visible', pointerEvents: isAnyModalOpen ? 'none' : 'auto' }}>
        <QuickActions 
          isSupervising={isSupervising}
          onOpenComun={() => setMostrarModalComun(true)}
          onOpenSalida={() => setMostrarModalSalida(true)}
          onOpenEntrada={() => setMostrarModalEntrada(true)}
          setMostrarCameraScanner={setMostrarCameraScanner}
          toggleScannerMode={toggleScannerMode}
          isScannerAvailable={isAvailable}
          scannerMode={scannerMode}
        />
      </div>

      <div className="sales-content-wrapper">
        <div className="sales-products-panel">

          {/* ── ZONA A: BÚSQUEDA ── */}
          <div className="search-zone" style={{ visibility: isAnyModalOpen ? 'hidden' : 'visible', pointerEvents: isAnyModalOpen ? 'none' : 'auto' }}>
            <SearchSection
              searchContainerRef={searchContainerRef}
              campoCodigoRef={campoCodigoRef}
              scannerInputMode={scannerInputMode}
              scannerMode={scannerMode}
              codigoEscaneado={codigoEscaneado}
              manejarCambioCodigo={manejarCambioCodigo}
              manejarEnter={manejarEnter}
              isSupervising={isSupervising}
            >
              {codigoEscaneado.trim().length > 0 && (
                <div className="search-results-list">
                  {sugerencias.length > 0 ? (
                    sugerencias.map((producto, index) => (
                      <div
                        key={producto.id}
                        className={`search-result-item ${
                          index === indexSugerencia ? "active" : ""
                        }`}
                        onClick={() => seleccionarProducto(producto)}
                        onMouseEnter={() => setIndexSugerencia(index)}
                      >
                        <div className="result-info">
                          <span className="result-name">{producto.name}</span>
                          <span className="result-sku">{producto.barcode || ''}</span>
                        </div>
                        <div className="result-meta">
                          <span className="result-price">{formatearDinero(producto.price)}</span>
                          {(producto.stock || 0) > 0 && (
                            <span className="result-stock">● {producto.stock} pzas</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="search-no-results">Sin resultados para "{codigoEscaneado}"</p>
                  )}
                </div>
              )}
            </SearchSection>
          </div>

          {/* ── ZONA B: LISTA DE VENTA ACTUAL ── */}
          <div className="sale-items-zone">
            {carrito.length === 0 ? (
              <div className="pos-empty-table">
                <div className="pos-empty-icon">
                  <span className="material-symbols-outlined">shopping_cart_checkout</span>
                </div>
                <h3>Venta Vacía</h3>
                <p>Escanea un código o busca productos para comenzar</p>
              </div>
            ) : (
              <>
                <div className="sales-area-header">
                  <div className="header-info">
                    <h2 className="sales-title">Venta Actual</h2>
                    <p className="sales-subtitle">Detalle de productos agregados al carrito</p>
                  </div>
                  <div className="header-actions" ref={colConfigRef}>
                    <button 
                      className="btn-col-config"
                      onClick={() => setMostrarConfigColumnas(!mostrarConfigColumnas)}
                      title="Configurar Columnas"
                    >
                      <span className="material-symbols-outlined">view_column</span>
                    </button>

                    {mostrarConfigColumnas && (
                      <div className="col-config-dropdown">
                        <h4>Columnas Visibles</h4>
                        <div className="col-config-list">
                          {Object.keys(columnasVisibles).map(col => (
                            <label key={col} className="col-config-item">
                              <input 
                                type="checkbox" 
                                checked={columnasVisibles[col]} 
                                onChange={() => toggleColumna(col)}
                              />
                              <span>{col.toUpperCase()}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="pos-professional-table">
                {/* Header con columnas dinámicas */}
                 <div className="pos-table-header">
                   {columnasVisibles.idx && (
                     <div className="pos-col pos-col-idx resizable-th" style={{ width: `${anchosColumnas.idx}px` }}>
                       # <div className="resizer" onMouseDown={(e) => startResizing(e, 'idx')} />
                     </div>
                   )}
                   {columnasVisibles.code && (
                     <div className="pos-col pos-col-code resizable-th" style={{ width: `${anchosColumnas.code}px` }}>
                       CÓDIGO <div className="resizer" onMouseDown={(e) => startResizing(e, 'code')} />
                     </div>
                   )}
                   {columnasVisibles.desc && (
                     <div className="pos-col pos-col-desc resizable-th" style={{ flex: anchosColumnas.desc === 0 ? 1 : 'none', width: anchosColumnas.desc > 0 ? `${anchosColumnas.desc}px` : 'auto' }}>
                       DESCRIPCIÓN DEL PRODUCTO <div className="resizer" onMouseDown={(e) => startResizing(e, 'desc')} />
                     </div>
                   )}
                   {columnasVisibles.price && (
                     <div className="pos-col pos-col-price resizable-th" style={{ width: `${anchosColumnas.price}px` }}>
                       PRECIO <div className="resizer" onMouseDown={(e) => startResizing(e, 'price')} />
                     </div>
                   )}
                   {columnasVisibles.qty && (
                     <div className="pos-col pos-col-qty resizable-th" style={{ width: `${anchosColumnas.qty}px` }}>
                       CANT. <div className="resizer" onMouseDown={(e) => startResizing(e, 'qty')} />
                     </div>
                   )}
                   {columnasVisibles.unit && (
                     <div className="pos-col pos-col-unit resizable-th" style={{ width: `${anchosColumnas.unit}px` }}>
                       CAJA/PAQ. <div className="resizer" onMouseDown={(e) => startResizing(e, 'unit')} />
                     </div>
                   )}
                   {columnasVisibles.total && (
                     <div className="pos-col pos-col-total resizable-th" style={{ width: `${anchosColumnas.total}px` }}>
                       IMPORTE <div className="resizer" onMouseDown={(e) => startResizing(e, 'total')} />
                     </div>
                   )}
                   {columnasVisibles.actions && (
                     <div className="pos-col pos-col-actions" style={{ width: `${anchosColumnas.actions}px` }}>
                       🗑
                     </div>
                   )}
                 </div>

                <div className="pos-table-body">
                  {carrito.map((item, index) => {
                    const tieneCaja = tieneCajaConfigurada(item);
                    const esCaja = item.unit_sold === 'CAJA';

                    return (
                      <div
                        key={item.id}
                        className={`pos-row ${activeCartItemId === item.id ? 'active-row' : ''}`}
                        onClick={() => setActiveCartItemId(item.id)}
                      >
                         {/* 1. Index */}
                         {columnasVisibles.idx && (
                           <div className="pos-col pos-col-idx" style={{ width: `${anchosColumnas.idx}px` }}>{index + 1}</div>
                         )}

                         {/* 2. Código */}
                         {columnasVisibles.code && (
                           <div className={`pos-col pos-col-code ${!showTableDetails ? 'compact' : ''}`} style={{ width: `${anchosColumnas.code}px` }}>
                             {showTableDetails ? (item.barcode || item.id?.split('::')[0] || '---') : ''}
                           </div>
                         )}

                         {/* 3. Descripción */}
                         {columnasVisibles.desc && (
                           <div className="pos-col pos-col-desc" style={{ flex: anchosColumnas.desc === 0 ? 1 : 'none', width: anchosColumnas.desc > 0 ? `${anchosColumnas.desc}px` : 'auto' }}>
                             <div className="pos-desc-container">
                               <span className="pos-product-name">
                                 {item.name}
                                 {item.is_custom_pack && <span className="pack-badge">PACK</span>}
                               </span>
                               {showTableDetails && (
                                 <span className="pos-product-meta">
                                   Stock: {formatStockDisplay(item)}
                                 </span>
                               )}
                             </div>
                           </div>
                         )}

                         {/* 4. Precio */}
                         {columnasVisibles.price && (
                           <div className={`pos-col pos-col-price ${!showTableDetails ? 'compact' : ''}`} style={{ width: `${anchosColumnas.price}px` }}>
                             {formatearDinero(item.price)}
                           </div>
                         )}

                         {/* 5. Cantidad */}
                         {columnasVisibles.qty && (
                           <div className="pos-col pos-col-qty" style={{ width: `${anchosColumnas.qty}px` }}>
                             <div className="qty-picker">
                               <button onClick={(e) => { e.stopPropagation(); cambiarCantidad(item.id, -1, true); }}>
                                 <span className="material-symbols-outlined">remove</span>
                               </button>
                               <span>{item.quantity}</span>
                               <button onClick={(e) => { e.stopPropagation(); cambiarCantidad(item.id, 1, true); }}>
                                 <span className="material-symbols-outlined">add</span>
                               </button>
                             </div>
                           </div>
                         )}

                         {/* 6. Unidad */}
                         {columnasVisibles.unit && (
                           <div className="pos-col pos-col-unit" style={{ width: `${anchosColumnas.unit}px` }}>
                             {tieneCaja ? (
                               <button
                                 className={`unit-toggle-btn ${esCaja ? 'active' : ''}`}
                                 onClick={(e) => { e.stopPropagation(); cambiarUnidadVenta(item.id, esCaja ? 'PZA' : 'CAJA'); }}
                               >
                                 {esCaja ? 'CAJA' : 'PZA'}
                               </button>
                             ) : (
                               <span className="unit-label">PZA</span>
                             )}
                           </div>
                         )}

                         {/* 7. Total */}
                         {columnasVisibles.total && (
                           <div className="pos-col pos-col-total" style={{ width: `${anchosColumnas.total}px` }}>
                             {formatearDinero(item.quantity * item.price)}
                           </div>
                         )}

                         {/* 8. Acciones */}
                         {columnasVisibles.actions && (
                           <div className="pos-col pos-col-actions" style={{ width: `${anchosColumnas.actions}px` }}>
                             <button
                               className="btn-remove"
                               onClick={(e) => { e.stopPropagation(); quitarProducto(item.id); }}
                             >
                               <span className="material-symbols-outlined">delete</span>
                             </button>
                           </div>
                         )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          </div>

          {/* INDICADOR DE CARGA */}
          {cargando && <div className="notification info">Procesando...</div>}

          {/* INDICADOR DE ESCANEADO */}
          {isScanning && (
            <div className="notification info">Escaneando código...</div>
          )}


        </div>

          {/* CARRITO LATERAL */}
          <CartSidebar
            carrito={carrito}
            activeCartItemId={activeCartItemId}
            setActiveCartItemId={setActiveCartItemId}
            stockDisplayMode={stockDisplayMode}
            toggleStockDisplayMode={toggleStockDisplayMode}
            showTableDetails={showTableDetails}
            toggleTableDetails={toggleTableDetails}
            cambiarCantidad={cambiarCantidad}
            quitarProducto={quitarProducto}
            cambiarUnidadVenta={cambiarUnidadVenta}
            abrirModalEmpaque={abrirModalEmpaque}
            tieneCajaConfigurada={tieneCajaConfigurada}
            formatStockDisplay={formatStockDisplay}
            formatearDinero={formatearDinero}
            user={user}
            total={total}
            isSupervising={isSupervising}
            vendiendo={vendiendo}
            setMostrarModalFondo={setMostrarModalFondo}
            setMostrarModalPaqueteTodo={setMostrarModalPaqueteTodo}
            abrirModalPago={abrirModalPago}
            onCotizar={generarCotizacion}
          />
      </div>

      {/* MODAL FONDO INICIAL */}
      {mostrarModalFondo && (
        <CashFundModal
          staffName={user?.full_name || "Operador"}
          staffId={user?.id}
          onSessionCreated={() => {
            setMostrarModalFondo(false);
            checkCashSession();
          }}
        />
      )}

      {/* MODAL AGREGAR PRODUCTO (PZA / CAJA) */}
      {mostrarModalAddProduct && productoParaModal && (
        <ProductAddModal
          product={productoParaModal}
          onClose={cerrarModalAddProduct}
          onAdd={handleModalAdd}
          formatearDinero={formatearDinero}
          hasBoxConfig={tieneCajaConfigurada(productoParaModal)}
          boxUnits={parseInt(productoParaModal.box_units || 0)}
          boxPrice={parseFloat(productoParaModal.box_price || 0)}
        />
      )}

      <PaymentModal
        isOpen={mostrarModalPago}
        onClose={cerrarModalPago}
        onComplete={handlePaymentComplete}
        total={total}
        taxRate={taxRateValue}
        tipoCambio={tipoCambio}
        issuers={issuers}
        selectedIssuerId={selectedIssuerId}
        setSelectedIssuerId={setSelectedIssuerId}
        user={user}
        transactionId={transactionId}
      />


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
      {isAvailable && (
        <CameraScanner
          isOpen={mostrarCameraScanner}
          onClose={() => setMostrarCameraScanner(false)}
          onScan={manejarEscaneoCamara}
        />
      )}
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

      {/* MODAL EMPAQUE AL VUELO (ITEM) */}
      {mostrarModalEmpaque && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in fade-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">
                inventory_2
              </span>
              Empaque al Vuelo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {itemEmpaque?.name}
            </p>

            <div className="overflow-y-auto pr-1 flex-1 space-y-4">
              {/* Presets Guardados */}
              {presets.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Configuraciones Guardadas
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((preset) => (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`group relative p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col ${
                          Number(empaqueForm.piezas) === Number(preset.units) && Number(empaqueForm.precio) === Number(preset.price)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800'
                        }`}
                      >
                        <span className="text-lg font-bold text-slate-800 dark:text-white">
                          {preset.units} <span className="text-[10px] font-normal">Pzas</span>
                        </span>
                        <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                          {formatearDinero(preset.price)}
                        </span>
                        <button
                          onClick={(e) => handleDeletePreset(e, preset.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleConfirmarEmpaque} className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Piezas por Caja
                    </label>
                    <input
                      type="number"
                      required
                      autoFocus
                      min="1"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-bold"
                      value={empaqueForm.piezas}
                      onChange={(e) =>
                        setEmpaqueForm({ ...empaqueForm, piezas: e.target.value })
                      }
                      placeholder="12"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      Precio Total (MXN)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-mono font-bold"
                      value={empaqueForm.precio}
                      onChange={(e) =>
                        setEmpaqueForm({ ...empaqueForm, precio: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    guardarComoPreset ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={guardarComoPreset}
                      onChange={(e) => setGuardarComoPreset(e.target.checked)}
                    />
                    {guardarComoPreset && (
                      <span className="material-symbols-outlined text-[14px] text-white font-bold">check</span>
                    )}
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200">
                    Recordar esta configuración para este producto
                  </span>
                </label>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setMostrarModalEmpaque(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">
                      check
                    </span>
                    Confirmar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EMPACAR TODO EL CARRITO */}
      {mostrarModalPaqueteTodo && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in fade-in duration-200">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500">
                box
              </span>
              Empacar Todo el Carrito
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Convierte todos los productos actuales en un solo paquete cerrado.
            </p>
            <form onSubmit={handleConfirmarPaqueteTodo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nombre del Paquete
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  value={paqueteTodoForm.nombre}
                  onChange={(e) =>
                    setPaqueteTodoForm({
                      ...paqueteTodoForm,
                      nombre: e.target.value,
                    })
                  }
                  placeholder="Ej. CANASTA DE REGALO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Precio Total del Paquete (MXN)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border-none ring-1 ring-slate-200 dark:ring-slate-700 focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-mono text-lg"
                  value={paqueteTodoForm.precio}
                  onChange={(e) =>
                    setPaqueteTodoForm({
                      ...paqueteTodoForm,
                      precio: e.target.value,
                    })
                  }
                  placeholder="0.00"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Total sugerido (suma del carrito):{" "}
                  {formatearDinero(total)}
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setMostrarModalPaqueteTodo(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>
                  Crear Paquete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {mostrarModalReporte && (
        <SessionReportModal onClose={() => setMostrarModalReporte(false)} />
      )}
    </div>
  );
};

export default Sales;
