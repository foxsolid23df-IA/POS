import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { useAuth } from "./useAuth";
import { settingsService } from "../services/settingsService";
import { issuerService } from "../services/issuerService";
import Swal from "sweetalert2";

export const useSalesState = (total, vaciarCarrito) => {
  const { activeStaff } = useAuth();
  
  // Modales
  const [mostrarModalPago, setMostrarModalPago] = useState(false);
  const [mostrarModalComun, setMostrarModalComun] = useState(false);
  const [mostrarModalEntrada, setMostrarModalEntrada] = useState(false);
  const [mostrarModalSalida, setMostrarModalSalida] = useState(false);
  const [mostrarModalEmpaque, setMostrarModalEmpaque] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Pagos
  const [pagosRealizados, setPagosRealizados] = useState([]);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [facturar, setFacturar] = useState(false);
  const [selectedIssuerId, setSelectedIssuerId] = useState("");
  const [issuers, setIssuers] = useState([]);

  // Configuración
  const [settings, setSettings] = useState(null);
  const [modalReady, setModalReady] = useState(false);

  // Formularios
  const [comunForm, setComunForm] = useState({ descripcion: "", precio: "", cantidad: 1 });
  const [entradaForm, setEntradaForm] = useState({ concepto: "", cantidad: "" });
  const [salidaForm, setSalidaForm] = useState({ concepto: "", cantidad: "" });
  const [empaqueForm, setEmpaqueForm] = useState({ piezas: "", precio: "" });
  const [itemEmpaque, setItemEmpaque] = useState(null);
  const [presets, setPresets] = useState([]);
  const [guardarComoPreset, setGuardarComoPreset] = useState(false);

  // Otros
  const [transactionId, setTransactionId] = useState("");
  const [lastSale, setLastSale] = useState(null);

  const taxRateValue = settings?.tax_rate || 16;
  const taxAmount = total * (taxRateValue / 100);
  const totalVenta = total + taxAmount;
  const totalPagado = pagosRealizados.reduce((acc, p) => acc + p.amount, 0);
  const saldoPendiente = totalVenta - totalPagado;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, i] = await Promise.all([
          settingsService.getSettings(),
          issuerService.getIssuers(),
        ]);
        setSettings(s);
        setIssuers(i);
        if (i.length > 0) setSelectedIssuerId(i[0].id);
      } catch (error) {
        console.error("Error al cargar configuración:", error);
      }
    };
    fetchData();
  }, []);

  const abrirModalPago = useCallback(() => {
    if (total <= 0) return;
    setTransactionId(Math.random().toString(36).substr(2, 9).toUpperCase());
    setPagosRealizados([]);
    setMontoRecibido("");
    setMetodoPago("efectivo");
    setFacturar(false);
    setMostrarModalPago(true);
    setModalReady(false);
    setTimeout(() => setModalReady(true), 500);
  }, [total]);

  const cerrarModalPago = () => {
    setMostrarModalPago(false);
  };

  const agregarPago = () => {
    const monto = parseFloat(montoRecibido);
    if (isNaN(monto) || monto <= 0) return;

    let montoFinal = monto;
    let recibidoOriginal = monto;
    let cambio = 0;

    if (metodoPago === "dolares" && settings?.dollar_rate) {
      montoFinal = monto * settings.dollar_rate;
    }

    if (montoFinal > saldoPendiente + 0.01) {
      cambio = montoFinal - saldoPendiente;
      montoFinal = saldoPendiente;
    }

    const nuevoPago = {
      id: Date.now(),
      method: metodoPago,
      amount: montoFinal,
      received: recibidoOriginal,
      change: cambio,
    };

    setPagosRealizados([...pagosRealizados, nuevoPago]);
    setMontoRecibido("");
  };

  const eliminarPago = (id) => {
    setPagosRealizados(pagosRealizados.filter((p) => p.id !== id));
  };

  const manejarTecladoNumerico = (val) => {
    if (val === "backspace") {
      setMontoRecibido((prev) => prev.slice(0, -1));
    } else if (val === "." && montoRecibido.includes(".")) {
      return;
    } else {
      setMontoRecibido((prev) => prev + val);
    }
  };

  const resetVenta = () => {
    vaciarCarrito();
    setPagosRealizados([]);
    setMontoRecibido("");
    setMostrarModalPago(false);
  };

  return {
    mostrarModalPago, setMostrarModalPago,
    mostrarModalComun, setMostrarModalComun,
    mostrarModalEntrada, setMostrarModalEntrada,
    mostrarModalSalida, setMostrarModalSalida,
    mostrarModalEmpaque, setMostrarModalEmpaque,
    showTicketModal, setShowTicketModal,
    pagosRealizados, setPagosRealizados,
    metodoPago, setMetodoPago,
    montoRecibido, setMontoRecibido,
    facturar, setFacturar,
    selectedIssuerId, setSelectedIssuerId,
    issuers,
    settings,
    modalReady,
    comunForm, setComunForm,
    entradaForm, setEntradaForm,
    salidaForm, setSalidaForm,
    empaqueForm, setEmpaqueForm,
    itemEmpaque, setItemEmpaque,
    presets, setPresets,
    guardarComoPreset, setGuardarComoPreset,
    transactionId,
    lastSale, setLastSale,
    taxRateValue, taxAmount, totalVenta, saldoPendiente,
    abrirModalPago, cerrarModalPago,
    agregarPago, eliminarPago,
    manejarTecladoNumerico,
    resetVenta
  };
};
