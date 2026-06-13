import React, { useState, useEffect, useRef } from "react";
import "./Inventory.css";
import { productService } from "../../services/productService";
import CameraScanner from "../common/CameraScanner";
import { validarCodigoBarras } from "../../utils";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import BulkImportModal from "./BulkImportModal";
import EntradasModal from "./EntradasModal";
import { useProducts } from "../../contexts/ProductContext";
import { useAuth } from "../../hooks/useAuth";

import {
  FiPlus,
  FiSearch,
  FiEdit2,
  FiTrash2,
  FiX,
  FiSave,
  FiUploadCloud,
  FiImage,
  FiFilter,
  FiDownload,
  FiMoreVertical,
  FiAlertTriangle,
} from "react-icons/fi";

const Inventory = () => {
  const {
    productos: products,
    loading,
    loadProducts: fetchProducts,
  } = useProducts();

  const { user } = useAuth();
  const inventoryMode = user?.inventory_mode || "comprehensive";
  const isSimplified = inventoryMode === "simplified";

  const [searchTerm, setSearchTerm] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Mass Selection State
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Actions Menu State
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Filters State
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [filters, setFilters] = useState({
    category: "all",
    stockStatus: "all", // all, low, medium, high
    minPrice: "",
    maxPrice: "",
  });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showEntradasModal, setShowEntradasModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productEditTab, setProductEditTab] = useState("datos");
  const [generalProfitMargin, setGeneralProfitMargin] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    barcode: "",
    price: "",
    box_units: "",
    box_price: "",
    box_special_price: "",
    box_special_from_qty: "",
    box_barcode: "",
    sell_by_box_only: false,
    cost_price: "",
    wholesale_price: "",
    stock: "",
    min_stock: "",
    image: "",
    category: "",
    notes: "",
    unit: "PZA",
    iva: "",
    special_price: "",
    special_price_2: "",
    suggested_price: "",
    wholesale_from_qty: "",
    special_from_qty: "",
    wholesale_unit: "",
    brand: "",
    supplier: "",
  });

  // Image Upload State
  const [previewImage, setPreviewImage] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Camera Scanner State
  const [mostrarCameraScanner, setMostrarCameraScanner] = useState(false);

  // Categories Management State
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [customCategories, setCustomCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Low Stock Alert State
  const [showLowStockAlert, setShowLowStockAlert] = useState(false);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  // Actualizar productos bajos de inventario cuando los productos cambian
  useEffect(() => {
    const lowStock = products.filter((p) => p.stock <= (p.min_stock || 0));
    setLowStockProducts(lowStock);
  }, [products]);

  // Cargar categorías personalizadas desde localStorage
  useEffect(() => {
    const savedCategories = localStorage.getItem("customCategories");
    if (savedCategories) {
      try {
        setCustomCategories(JSON.parse(savedCategories));
      } catch (error) {
        console.error("Error al cargar categorías personalizadas:", error);
      }
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = type === "checkbox" ? checked : value;

    if (["price", "wholesale_price", "special_price", "special_price_2"].includes(name)) {
      setGeneralProfitMargin("");
    }

    setFormData((prev) => {
      const nextData = {
        ...prev,
        [name]: nextValue,
      };

      if (name === "price" || name === "box_units") {
        return {
          ...nextData,
          box_price: getBoxPriceFromPiecePrice(nextData.price, nextData.box_units),
        };
      }

      return nextData;
    });
  };

  const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const roundMoney = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "";
    return (Math.round(parsed * 100) / 100).toString();
  };

  const formatMoney = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return "$0.00";
    return parsed.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const normalizeCostMultiplier = (costMultiplier = 1) => {
    const parsed = toNumber(costMultiplier);
    return parsed > 0 ? parsed : 0;
  };

  const getMarginPercent = (priceValue, costMultiplier = 1) => {
    const cost = toNumber(formData.cost_price) * normalizeCostMultiplier(costMultiplier);
    const price = toNumber(priceValue);
    if (cost <= 0 || price <= 0) return "";
    return (Math.round(((price - cost) / cost) * 10000) / 100).toString();
  };

  const getProfitAmount = (priceValue, costMultiplier = 1) => {
    const cost = toNumber(formData.cost_price) * normalizeCostMultiplier(costMultiplier);
    const price = toNumber(priceValue);
    if (cost <= 0 || price <= 0) return null;
    return price - cost;
  };

  const handleMarginChange = (priceField, marginValue, costMultiplier = 1) => {
    const cost = toNumber(formData.cost_price) * normalizeCostMultiplier(costMultiplier);
    const margin = parseFloat(marginValue);
    const nextPrice =
      cost > 0 && Number.isFinite(margin)
        ? roundMoney(cost * (1 + margin / 100))
        : "";

    if (priceField !== "box_price") {
      setGeneralProfitMargin("");
    }

    setFormData((prev) => {
      const nextData = {
        ...prev,
        [priceField]: nextPrice,
      };

      if (priceField === "price") {
        return {
          ...nextData,
          box_price: getBoxPriceFromPiecePrice(nextPrice, prev.box_units),
        };
      }

      return nextData;
    });
  };

  const handleProfitPriceChange = (priceField, value) => {
    setGeneralProfitMargin("");

    setFormData((prev) => {
      const nextData = {
        ...prev,
        [priceField]: value,
      };

      if (priceField === "price") {
        return {
          ...nextData,
          box_price: getBoxPriceFromPiecePrice(value, prev.box_units),
        };
      }

      return nextData;
    });
  };

  const getPriceFromMargin = (costValue, marginValue) => {
    const cost = toNumber(costValue);
    const margin = parseFloat(marginValue);
    if (cost <= 0 || !Number.isFinite(margin)) return "";
    return roundMoney(cost * (1 + margin / 100));
  };

  const getBoxPriceFromPiecePrice = (piecePriceValue, boxUnitsValue) => {
    const piecePrice = toNumber(piecePriceValue);
    const boxUnits = toNumber(boxUnitsValue);
    if (piecePrice <= 0 || boxUnits <= 0) return "";
    return roundMoney(piecePrice * boxUnits);
  };

  useEffect(() => {
    if (generalProfitMargin === "") return;

    const margin = parseFloat(generalProfitMargin);
    if (!Number.isFinite(margin)) return;

    setFormData((prev) => {
      const nextPiecePrice = getPriceFromMargin(prev.cost_price, margin);
      const nextBoxPrice = getBoxPriceFromPiecePrice(nextPiecePrice, prev.box_units);

      return {
        ...prev,
        price: nextPiecePrice,
        wholesale_price: nextPiecePrice,
        special_price: nextPiecePrice,
        special_price_2: nextPiecePrice,
        box_price: nextBoxPrice,
      };
    });
  }, [generalProfitMargin, formData.cost_price, formData.box_units]);

  useEffect(() => {
    setFormData((prev) => {
      const nextBoxPrice = getBoxPriceFromPiecePrice(prev.price, prev.box_units);
      if (prev.box_price === nextBoxPrice) return prev;
      return {
        ...prev,
        box_price: nextBoxPrice,
      };
    });
  }, [formData.price, formData.box_units]);

  const profitPriceRows = [
    { label: "Menudeo", field: "price", value: formData.price, costMultiplier: 1 },
    { label: "Mayoreo", field: "wholesale_price", value: formData.wholesale_price, costMultiplier: 1 },
    { label: "Especial 1", field: "special_price", value: formData.special_price, costMultiplier: 1 },
    { label: "Especial 2", field: "special_price_2", value: formData.special_price_2, costMultiplier: 1 },
    {
      label: "Caja",
      field: "box_price",
      value: formData.box_price,
      costMultiplier: toNumber(formData.box_units),
      detail: `${toNumber(formData.box_units) || 0} pzas`,
    },
  ];

  const formatLastPurchase = (product) => {
    if (!product?.last_purchase_at) return "Sin compras";
    const date = new Date(product.last_purchase_at);
    if (Number.isNaN(date.getTime())) return "Sin compras";
    return date.toLocaleDateString("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      barcode: "",
      price: "",
      box_units: "",
      box_price: "",
      box_special_price: "",
      box_special_from_qty: "",
      box_barcode: "",
      sell_by_box_only: false,
      cost_price: "",
      wholesale_price: "",
      stock: "",
      min_stock: "",
      image: "",
      category: "",
      notes: "",
      unit: "PZA",
      iva: "",
      special_price: "",
      special_price_2: "",
      suggested_price: "",
      wholesale_from_qty: "",
      special_from_qty: "",
      wholesale_unit: "",
      brand: "",
      supplier: "",
    });
    setPreviewImage(null);
    setEditingProduct(null);
    setProductEditTab("datos");
    setGeneralProfitMargin("");
  };

  const handleOpenModal = (product = null) => {
    setProductEditTab("datos");
    setGeneralProfitMargin("");
    if (product) {
      setEditingProduct(product);
      // Obtener categoría del producto o inferirla del nombre
      const productCategory =
        product.category || getCategory(product.name).name;
      setFormData({
        name: product.name,
        barcode: product.barcode || "",
        price: product.price,
        box_units: product.box_units || "",
        box_price: product.box_price || "",
        box_special_price: product.box_special_price || "",
        box_special_from_qty: product.box_special_from_qty || "",
        box_barcode: product.box_barcode || "",
        sell_by_box_only: product.sell_by_box_only === true,
        cost_price: product.cost_price || "",
        wholesale_price: product.wholesale_price || "",
        stock: product.stock,
        min_stock: product.min_stock || "",
        image: product.image_url || "",
        category: productCategory,
        notes: product.notes || "",
        unit: product.unit || "PZA",
        iva: product.iva || "",
        special_price: product.special_price || "",
        special_price_2: product.special_price_2 || "",
        suggested_price: product.suggested_price || "",
        wholesale_from_qty: product.wholesale_from_qty || "",
        special_from_qty: product.special_from_qty || "",
        wholesale_unit: product.wholesale_unit || "",
        brand: product.brand || "",
        supplier: product.supplier || "",
      });
      setPreviewImage(product.image_url || null);
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const processImage = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      Swal.fire("Error", "El archivo debe ser una imagen", "error");
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      Swal.fire("Error", "La imagen no debe superar los 2MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      // Basic optimization: if string is too long, we might warn, but for now we trust the limit
      setPreviewImage(base64String);
      setFormData((prev) => ({ ...prev, image: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImage(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      processImage(e.target.files[0]);
    }
  };

  const removeImage = (e) => {
    e.stopPropagation();
    setPreviewImage(null);
    setFormData((prev) => ({ ...prev, image: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const productName = formData.name?.trim();
    const effectiveCategory =
      formData.category?.trim() ||
      (productName ? getCategory(productName).name : "") ||
      "General";

    if (
      !productName ||
      !formData.price ||
      formData.stock === "" ||
      formData.stock === null ||
      formData.stock === undefined
    ) {
      Swal.fire(
        "Error",
        "Por favor completa todos los campos obligatorios",
        "warning",
      );
      return;
    }

    const boxUnits = parseInt(formData.box_units || 0);
    const boxPrice = parseFloat(formData.box_price || 0);
    const boxSpecialPrice = parseFloat(formData.box_special_price || 0);
    const boxSpecialFromQty = parseFloat(formData.box_special_from_qty || 0);

    if (formData.sell_by_box_only && (!(boxUnits > 1) || !(boxPrice > 0))) {
      Swal.fire(
        "Falta configuracion de caja",
        "Para vender solo por caja, captura piezas por caja y precio caja.",
        "warning",
      );
      return;
    }

    if ((boxSpecialPrice > 0 || boxSpecialFromQty > 0) && (!(boxSpecialPrice > 0) || !(boxSpecialFromQty > 0))) {
      Swal.fire(
        "Falta regla de precio especial",
        "Para precio especial por caja, captura el precio especial y desde cuantas cajas aplica.",
        "warning",
      );
      return;
    }

    try {
      // Si no se selecciono categoria, se guarda la detectada por nombre.
      const productData = {
        name: productName,
        barcode: formData.barcode,
        price: parseFloat(formData.price),
        box_units: boxUnits || null,
        box_price: boxPrice || null,
        box_special_price: boxSpecialPrice || null,
        box_special_from_qty: boxSpecialFromQty || null,
        box_barcode: formData.box_barcode || "",
        sell_by_box_only: formData.sell_by_box_only === true,
        cost_price: parseFloat(formData.cost_price || 0),
        wholesale_price: parseFloat(formData.wholesale_price || 0),
        stock: parseInt(formData.stock),
        min_stock: parseInt(formData.min_stock || 0),
        image: formData.image,
        category: effectiveCategory,
        notes: formData.notes || "",
        unit: formData.unit || "PZA",
        iva: parseFloat(formData.iva || 0),
        special_price: parseFloat(formData.special_price || 0),
        special_price_2: parseFloat(formData.special_price_2 || 0),
        suggested_price: parseFloat(formData.suggested_price || 0),
        wholesale_from_qty: parseFloat(formData.wholesale_from_qty || 0) || null,
        special_from_qty: parseFloat(formData.special_from_qty || 0) || null,
        wholesale_unit: formData.wholesale_unit || "",
        brand: formData.brand || "",
        supplier: formData.supplier || "",
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, productData);
        Swal.fire(
          "Actualizado",
          "Producto actualizado correctamente",
          "success",
        );
      } else {
        await productService.createProduct(productData);
        Swal.fire("Creado", "Producto creado correctamente", "success");
      }

      handleCloseModal();
      fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      const errorMessage =
        error?.message ||
        error?.details ||
        error?.hint ||
        "Error al guardar el producto";
      Swal.fire("Error", errorMessage, "error");
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: "No podrás revertir esto",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await productService.deleteProduct(id);
        Swal.fire("Eliminado", "Producto eliminado", "success");
        fetchProducts();
      } catch (error) {
        console.error("Error deleting product:", error);
        Swal.fire("Error", "No se pudo eliminar el producto", "error");
      }
    }
  };

  // Manejar escaneo de cámara
  const manejarEscaneoCamara = (codigo) => {
    const codigoLimpio = codigo.trim();

    if (!codigoLimpio) return;

    // Validar formato de código de barras
    if (!validarCodigoBarras(codigoLimpio)) {
      Swal.fire({
        icon: "error",
        title: "Código inválido",
        text: "El código escaneado no tiene un formato válido.",
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }

    // Actualizar el campo de código de barras en el formulario
    setFormData((prev) => ({
      ...prev,
      barcode: codigoLimpio,
    }));

    // Mostrar confirmación
    Swal.fire({
      icon: "success",
      title: "Código escaneado",
      text: `Código de barras: ${codigoLimpio}`,
      timer: 1500,
      showConfirmButton: false,
    });
  };

  // Función para determinar categoría basada en el nombre del producto
  const getCategory = (productName) => {
    const name = productName.toLowerCase();
    if (
      name.includes("leche") ||
      name.includes("queso") ||
      name.includes("yogur") ||
      name.includes("lácteo")
    ) {
      return { name: "Lácteos", color: "blue" };
    }
    if (
      name.includes("pan") ||
      name.includes("tortilla") ||
      name.includes("panadería")
    ) {
      return { name: "Panadería", color: "amber" };
    }
    if (
      name.includes("bebida") ||
      name.includes("refresco") ||
      name.includes("agua") ||
      name.includes("jugo") ||
      name.includes("coca") ||
      name.includes("pepsi")
    ) {
      return { name: "Bebidas", color: "purple" };
    }
    if (
      name.includes("fruta") ||
      name.includes("verdura") ||
      name.includes("aguacate") ||
      name.includes("manzana") ||
      name.includes("plátano")
    ) {
      return { name: "Frutas", color: "green" };
    }
    if (
      name.includes("limpieza") ||
      name.includes("jabón") ||
      name.includes("detergente") ||
      name.includes("shampoo")
    ) {
      return { name: "Limpieza", color: "gray" };
    }
    return { name: "General", color: "gray" };
  };

  // Función para generar SKU basado en barcode o ID
  const getSKU = (product) => {
    if (product.barcode) {
      return product.barcode;
    }
    // Si no hay barcode, generar SKU desde ID y categoría
    const categoryCode = getCategory(product.name)
      .name.substring(0, 3)
      .toUpperCase();
    return `${categoryCode}-${product.id.toString().padStart(5, "0")}`;
  };

  // Función para obtener descripción corta del producto
  const getDescription = (product) => {
    // Intentar extraer información del nombre o usar valores por defecto
    const name = product.name.toLowerCase();
    if (
      name.includes("1 litro") ||
      name.includes("1l") ||
      name.includes("litro")
    )
      return "1 Litro • Tetrapak";
    if (name.includes("600ml") || name.includes("600 ml"))
      return "600ml • Botella";
    if (name.includes("grande")) return "Grande • Blanco";
    if (name.includes("kg") || name.includes("kilogramo")) return "Kg • Fresco";
    if (name.includes("400g") || name.includes("400 g")) return "400g • Barra";
    return "Unidad";
  };

  // Función para obtener estado de stock
  const getStockStatus = (stock) => {
    if (stock < 5) return { color: "red", pulse: true };
    if (stock < 15) return { color: "yellow", pulse: false };
    return { color: "emerald", pulse: false };
  };

  // Aplicar filtros y búsqueda
  const filteredProducts = products.filter((product) => {
    // Filtro de búsqueda
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode && product.barcode.includes(searchTerm)) ||
      getSKU(product).toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Filtro de categoría
    if (filters.category !== "all") {
      const productCategory =
        product.category || getCategory(product.name).name;
      if (productCategory !== filters.category) return false;
    }

    // Filtro de stock
    if (filters.stockStatus !== "all") {
      if (filters.stockStatus === "low" && product.stock >= 5) return false;
      if (
        filters.stockStatus === "medium" &&
        (product.stock < 5 || product.stock >= 15)
      )
        return false;
      if (filters.stockStatus === "high" && product.stock < 15) return false;
    }

    // Filtro de precio mínimo
    if (filters.minPrice && product.price < parseFloat(filters.minPrice))
      return false;

    // Filtro de precio máximo
    if (filters.maxPrice && product.price > parseFloat(filters.maxPrice))
      return false;

    // Filtro de productos seleccionados
    if (showOnlySelected && !selectedProductIds.includes(product.id))
      return false;

    return true;
  });

  // Obtener categorías únicas (predefinidas + personalizadas + de productos existentes)
  const predefinedCategories = [
    "Lácteos",
    "Panadería",
    "Bebidas",
    "Frutas",
    "Limpieza",
    "General",
  ];
  const existingCategories = products.map(
    (p) => p.category || getCategory(p.name).name,
  );
  const allCategories = [
    ...predefinedCategories,
    ...customCategories,
    ...existingCategories,
  ];
  const uniqueCategories = Array.from(new Set(allCategories)).sort();

  // Funciones para gestionar categorías personalizadas
  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim();

    if (!trimmedName) {
      Swal.fire(
        "Error",
        "Por favor ingresa un nombre para la categoría",
        "warning",
      );
      return;
    }

    if (uniqueCategories.includes(trimmedName)) {
      Swal.fire("Error", "Esta categoría ya existe", "warning");
      return;
    }

    const updatedCategories = [...customCategories, trimmedName];
    setCustomCategories(updatedCategories);
    localStorage.setItem("customCategories", JSON.stringify(updatedCategories));
    setNewCategoryName("");
    Swal.fire("Éxito", "Categoría agregada correctamente", "success");
  };

  const handleDeleteCategory = (categoryName) => {
    // No permitir eliminar categorías predefinidas
    if (predefinedCategories.includes(categoryName)) {
      Swal.fire(
        "Error",
        "No se pueden eliminar las categorías predefinidas del sistema",
        "warning",
      );
      return;
    }

    Swal.fire({
      title: "¿Estás seguro?",
      text: `¿Deseas eliminar la categoría "${categoryName}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        const updatedCategories = customCategories.filter(
          (cat) => cat !== categoryName,
        );
        setCustomCategories(updatedCategories);
        localStorage.setItem(
          "customCategories",
          JSON.stringify(updatedCategories),
        );

        // Si algún producto tenía esta categoría, limpiarla
        Swal.fire("Éxito", "Categoría eliminada correctamente", "success");
      }
    });
  };

  // Paginación
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  // Cerrar menú de acciones al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".actions-menu-container")) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Handlers for selection
  const handleSelectProduct = (productId) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allPaginatedIds = paginatedProducts.map((p) => p.id);
      setSelectedProductIds((prev) => {
        const uniqueIds = new Set([...prev, ...allPaginatedIds]);
        return Array.from(uniqueIds);
      });
    } else {
      const allPaginatedIds = paginatedProducts.map((p) => p.id);
      setSelectedProductIds((prev) =>
        prev.filter((id) => !allPaginatedIds.includes(id)),
      );
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.length === 0) return;

    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: `Se eliminarán ${selectedProductIds.length} productos seleccionados. Esta acción no se puede deshacer.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await productService.bulkDeleteProducts(selectedProductIds);
        setSelectedProductIds([]);
        await fetchProducts();
        Swal.fire(
          "Eliminados",
          "Los productos han sido eliminados.",
          "success",
        );
      } catch (error) {
        console.error("Error al eliminar productos:", error);
        Swal.fire("Error", "No se pudieron eliminar los productos.", "error");
      }
    }
  };

  // Resetear página cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Detectar categoría automáticamente cuando se escribe el nombre
  useEffect(() => {
    if (formData.name && !formData.category && showModal) {
      const detectedCategory = getCategory(formData.name).name;
      // Solo auto-seleccionar si no hay categoría ya seleccionada
      setFormData((prev) => ({
        ...prev,
        category: detectedCategory,
      }));
    }
  }, [formData.name, showModal]);

  // Función para exportar reporte de mermas
  const handleExportMermas = () => {
    try {
      const productosConMerma = products.filter((p) => parseInt(p.merma) > 0);

      if (productosConMerma.length === 0) {
        Swal.fire(
          "Atención",
          "No hay mermas registradas para exportar",
          "info",
        );
        return;
      }

      const data = productosConMerma.map((p) => {
        const rMerma = parseInt(p.merma);
        const rCosto = parseFloat(p.cost_price || 0);
        const rPrecio = parseFloat(p.price || 0);
        const productCategory = p.category || getCategory(p.name).name;

        return {
          Producto: p.name,
          Categoría: productCategory,
          SKU: getSKU(p),
          "Cant. Merma": rMerma,
          "Costo Unit.": rCosto,
          "Pérdida (Costo)": rMerma * rCosto,
          "Pérdida (Venta)": rMerma * rPrecio,
          "Código de Barras": p.barcode || "",
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);

      const columnWidths = [
        { wch: 30 }, // Producto
        { wch: 15 }, // Categoría
        { wch: 15 }, // SKU
        { wch: 12 }, // Cant. Merma
        { wch: 12 }, // Costo Unit.
        { wch: 15 }, // Pérdida (Costo)
        { wch: 15 }, // Pérdida (Venta)
        { wch: 20 }, // Código de Barras
      ];
      ws["!cols"] = columnWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Reporte Mermas");

      const fileName = `reporte_mermas_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, fileName);

      Swal.fire(
        "Éxito",
        "Reporte de mermas exportado correctamente",
        "success",
      );
    } catch (error) {
      console.error("Error al exportar mermas:", error);
      Swal.fire("Error", "No se pudo exportar el reporte de mermas", "error");
    }
  };

  // Función para exportar reporte de inventario completo
  const handleExportInventory = () => {
    try {
      if (products.length === 0) {
        Swal.fire(
          "Atención",
          "No hay productos en el inventario para exportar",
          "info",
        );
        return;
      }

      const data = products.map((p) => {
        const productCategory = p.category || getCategory(p.name).name;

        const row = {
          Producto: p.name,
          Categoría: productCategory,
          SKU: getSKU(p),
          "Código de Barras": p.barcode || "",
          Existencia: p.stock,
          Unidad: p.unit || "PZA",
          "Precio Venta": parseFloat(p.price || 0),
        };

        if (!isSimplified) {
          row["Precio Costo"] = parseFloat(p.cost_price || 0);
          row["Precio Mayoreo"] = parseFloat(p.wholesale_price || 0);
          row["Precio Especial"] = parseFloat(p.special_price || 0);
          row["Precio Especial 2"] = parseFloat(p.special_price_2 || 0);
          row["Precio Sugerido"] = parseFloat(p.suggested_price || 0);
          row["Mayoreo desde"] = p.wholesale_from_qty || "";
          row["Especial desde"] = p.special_from_qty || "";
          row["Pzas por Caja"] = p.box_units || "";
          row["Precio Caja"] = p.box_price ? parseFloat(p.box_price) : "";
          row["Precio Especial Caja"] = p.box_special_price ? parseFloat(p.box_special_price) : "";
          row["Especial Caja desde"] = p.box_special_from_qty || "";
          row["Solo Caja"] = p.sell_by_box_only ? "SI" : "NO";
          row["Código Caja"] = p.box_barcode || "";
          row["Marca"] = p.brand || "";
          row["Proveedor"] = p.supplier || "";
          row["Notas"] = p.notes || "";
          row["IVA %"] = parseFloat(p.iva || 0);
          row["Merma"] = parseInt(p.merma || 0);
        }

        return row;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);

      // Auto-ajustar anchos de columna (aproximado)
      const columnWidths = [
        { wch: 35 }, // Producto
        { wch: 15 }, // Categoría
        { wch: 15 }, // SKU
        { wch: 20 }, // Código de Barras
        { wch: 12 }, // Existencia
        { wch: 10 }, // Unidad
        { wch: 15 }, // Precio Venta
      ];

      if (!isSimplified) {
        columnWidths.push(
          { wch: 15 }, // Precio Costo
          { wch: 15 }, // Precio Mayoreo
          { wch: 15 }, // Precio Especial
          { wch: 15 }, // Precio Especial 2
          { wch: 15 }, // Precio Sugerido
          { wch: 15 }, // Mayoreo desde
          { wch: 15 }, // Especial desde
          { wch: 12 }, // Pzas por Caja
          { wch: 15 }, // Precio Caja
          { wch: 20 }, // Código Caja
          { wch: 15 }, // Marca
          { wch: 20 }, // Proveedor
          { wch: 30 }, // Notas
          { wch: 10 }, // IVA %
          { wch: 10 }, // Merma
        );
      }

      ws["!cols"] = columnWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Inventario Completo");

      const fileName = `reporte_inventario_${
        new Date().toISOString().split("T")[0]
      }.xlsx`;
      XLSX.writeFile(wb, fileName);

      Swal.fire(
        "Éxito",
        "Reporte de inventario exportado correctamente",
        "success",
      );
    } catch (error) {
      console.error("Error al exportar inventario:", error);
      Swal.fire(
        "Error",
        "No se pudo exportar el reporte de inventario",
        "error",
      );
    }
  };


  // Funciones de filtros
  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
    setCurrentPage(1); // Reset a la primera página al cambiar filtros
  };

  const handleClearFilters = () => {
    setFilters({
      category: "all",
      stockStatus: "all",
      minPrice: "",
      maxPrice: "",
    });
    setCurrentPage(1);
  };

  // Contar productos filtrados por categoría para mostrar en el modal
  const getFilterCount = () => {
    let count = 0;
    if (filters.category !== "all") count++;
    if (filters.stockStatus !== "all") count++;
    if (filters.minPrice) count++;
    if (filters.maxPrice) count++;
    return count;
  };



  return (
    <div className="inventory-page">
      <header className="inventory-header bg-white dark:bg-gradient-to-r dark:from-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-lg">
        <div>
          <h1 className="inventory-title text-slate-900 dark:text-slate-50">
            Inventario
          </h1>
          <p className="inventory-subtitle text-slate-600 dark:text-slate-400">
            Gestiona el catálogo de productos y existencias
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
          }}
          className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
        >
          <span className="material-symbols-outlined text-[18px]">
            dark_mode
          </span>
          <span className="hidden sm:inline">Modo Oscuro</span>
        </button>
      </header>

      <div className="inventory-content">
        <div className="search-controls">
          <div className="search-container">
            <span className="material-symbols-outlined search-icon">
              search
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por nombre, SKU o categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="control-buttons">
            {lowStockProducts.length > 0 && (
              <button
                className="control-btn warning relative pulse-warning"
                onClick={() => setShowLowStockAlert(true)}
                title="Ver productos con inventario bajo"
              >
                <FiAlertTriangle className="btn-icon" />
                Alertas
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white dark:border-slate-900">
                  {lowStockProducts.length}
                </span>
              </button>
            )}
            <button
              className={`control-btn ${
                getFilterCount() > 0 ? "has-filters" : ""
              }`}
              onClick={() => setShowFiltersModal(true)}
            >
              <FiFilter className="btn-icon" />
              Filtros
              {getFilterCount() > 0 && (
                <span className="filter-badge">{getFilterCount()}</span>
              )}
            </button>

            <button className="control-btn" onClick={handleExportMermas}>
              <FiAlertTriangle className="btn-icon text-red-500" />
              Reporte Mermas
            </button>
            <button
              className="control-btn"
              onClick={() => setShowImportModal(true)}
            >
              <FiUploadCloud className="btn-icon" />
              Importar Excel
            </button>
            <button className="control-btn" onClick={handleExportInventory}>
              <FiDownload className="btn-icon text-emerald-500" />
              Reporte Inventario
            </button>
            <button
              className="control-btn"
              onClick={() => setShowEntradasModal(true)}
            >
              <span
                className="material-symbols-outlined btn-icon text-sm"
                style={{ marginRight: "6px", fontSize: "18px" }}
              >
                inventory_2
              </span>
              Entradas
            </button>
            <button
              className="control-btn primary"
              onClick={() => handleOpenModal()}
            >
              <FiPlus className="btn-icon" />
              Agregar Producto
            </button>
          </div>
        </div>

        {selectedProductIds.length > 0 && (
          <div className="bulk-actions-bar animate-fade-in">
            <div className="selection-info">
              <span className="selection-count">
                {selectedProductIds.length} productos seleccionados
              </span>
              <button
                className="clear-selection-btn"
                onClick={() => setSelectedProductIds([])}
              >
                Limpiar selección
              </button>
            </div>
            <div className="bulk-buttons">
              <button
                className={`bulk-btn filter ${
                  showOnlySelected ? "active" : ""
                }`}
                onClick={() => setShowOnlySelected(!showOnlySelected)}
              >
                <FiFilter className="btn-icon" />
                {showOnlySelected ? "Mostrar todos" : "Ver seleccionados"}
              </button>
              <button className="bulk-btn delete" onClick={handleBulkDelete}>
                <FiTrash2 className="btn-icon" />
                Eliminar seleccionados
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Cargando inventario...</div>
        ) : (
          <div className="table-container">
            <table className="products-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      onChange={handleSelectAll}
                      checked={
                        paginatedProducts.length > 0 &&
                        paginatedProducts.every((p) =>
                          selectedProductIds.includes(p.id),
                        )
                      }
                    />
                  </th>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>SKU</th>
                  {!isSimplified && <th>Costo</th>}
                  <th>Venta</th>
                  {!isSimplified && <th>Pzas/Caja</th>}
                  {!isSimplified && <th>Precio Caja</th>}
                  {!isSimplified && <th>Código Caja</th>}
                  {!isSimplified && <th>Mayoreo</th>}
                  {!isSimplified && <th>P. Especial</th>}
                  {!isSimplified && <th>P. Especial 2</th>}
                  {!isSimplified && <th>P. Sugerido</th>}
                  {!isSimplified && <th>Mayoreo Desde</th>}
                  {!isSimplified && <th>Especial Desde</th>}
                  <th>Existencia</th>
                  {!isSimplified && <th>Unidad</th>}
                  {!isSimplified && <th>IVA %</th>}
                  {!isSimplified && <th>Und. Mayoreo</th>}
                  {!isSimplified && <th>Marca</th>}
                  {!isSimplified && <th>Proveedor</th>}
                  {!isSimplified && <th>Notas</th>}
                  <th className="merma-col" style={{ color: "#ef4444" }}>
                    Merma
                  </th>
                  <th className="actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.length > 0 ? (
                  paginatedProducts.map((product) => {
                    const productCategoryName =
                      product.category || getCategory(product.name).name;
                    const category = getCategory(product.name);
                    // Usar el color de la categoría guardada si existe, sino usar el inferido
                    const categoryColor = product.category
                      ? uniqueCategories.includes(product.category)
                        ? getCategory(product.name).color
                        : category.color
                      : category.color;
                    const stockStatus = getStockStatus(product.stock);
                    const sku = getSKU(product);
                    const description = getDescription(product);
                    const isMenuOpen = activeMenuId === product.id;

                    return (
                      <tr key={product.id} className="table-row">
                        <td className="checkbox-col">
                          <input
                            type="checkbox"
                            className="table-checkbox"
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => handleSelectProduct(product.id)}
                          />
                        </td>
                        <td>
                          <div className="product-cell">
                            <div className="product-image-wrapper">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="product-thumb"
                                />
                              ) : (
                                <div className="product-icon-placeholder">
                                  <span className="material-symbols-outlined">
                                    image
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="product-info">
                              <div className="product-name">{product.name}</div>
                              <div className="product-description">
                                {description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`category-badge category-${categoryColor}`}
                          >
                            {productCategoryName}
                          </span>
                        </td>
                        <td className="sku-cell">{sku}</td>
                        {!isSimplified && (
                          <td className="price-cell text-slate-500">
                            ${parseFloat(product.cost_price || 0).toFixed(2)}
                          </td>
                        )}
                        <td className="price-cell font-medium">
                          ${parseFloat(product.price || 0).toFixed(2)}
                        </td>
                        {!isSimplified && (
                          <td className="unit-cell">{product.box_units || "—"}</td>
                        )}
                        {!isSimplified && (
                          <td className="price-cell text-slate-500">
                            {product.box_price
                              ? `$${parseFloat(product.box_price || 0).toFixed(2)}`
                              : "—"}
                          </td>
                        )}
                        {!isSimplified && (
                          <td className="sku-cell">{product.box_barcode || "—"}</td>
                        )}
                        {!isSimplified && (
                          <td className="price-cell text-slate-500">
                            $
                            {parseFloat(product.wholesale_price || 0).toFixed(
                              2,
                            )}
                          </td>
                        )}
                        {!isSimplified && (
                          <td className="price-cell text-slate-500">
                            ${parseFloat(product.special_price || 0).toFixed(2)}
                          </td>
                        )}
                        {!isSimplified && (
                          <td className="price-cell text-slate-500">
                            ${parseFloat(product.special_price_2 || 0).toFixed(2)}
                          </td>
                        )}
                        {!isSimplified && (
                          <td className="price-cell text-slate-500">
                            $
                            {parseFloat(product.suggested_price || 0).toFixed(
                              2,
                            )}
                          </td>
                        )}
                        {!isSimplified && (
                          <td className="unit-cell">{product.wholesale_from_qty || "â€”"}</td>
                        )}
                        {!isSimplified && (
                          <td className="unit-cell">{product.special_from_qty || "â€”"}</td>
                        )}
                        <td>
                          <div className="stock-cell">
                            <div
                              className={`stock-dot stock-${
                                stockStatus.color
                              } ${stockStatus.pulse ? "pulse" : ""}`}
                            ></div>
                            <span>
                              {product.stock}{" "}
                              {product.unit ||
                                (product.name.toLowerCase().includes("kg")
                                  ? "kg"
                                  : "un.")}
                            </span>
                          </div>
                        </td>
                        {!isSimplified && (
                          <td className="unit-cell">{product.unit || "PZA"}</td>
                        )}
                        {!isSimplified && (
                          <td
                            className="iva-cell"
                            style={{ textAlign: "center" }}
                          >
                            {parseFloat(product.iva || 0)}%
                          </td>
                        )}
                        {!isSimplified && (
                          <td className="text-slate-500">
                            {product.wholesale_unit || "—"}
                          </td>
                        )}
                        {!isSimplified && (
                          <td className="text-slate-500">
                            {product.brand || "—"}
                          </td>
                        )}
                        {!isSimplified && (
                          <td className="text-slate-500">
                            {product.supplier || "—"}
                          </td>
                        )}
                        {!isSimplified && (
                          <td
                            className="notes-cell"
                            title={product.notes || ""}
                          >
                            {product.notes
                              ? product.notes.length > 20
                                ? product.notes.substring(0, 20) + "…"
                                : product.notes
                              : "—"}
                          </td>
                        )}
                        <td
                          className="merma-cell"
                          style={{
                            color: "#ef4444",
                            textAlign: "center",
                            fontWeight: "500",
                          }}
                        >
                          {product.merma || 0}
                        </td>
                        <td className="actions-col">
                          <div className="actions-menu-container">
                            <button
                              className="actions-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(isMenuOpen ? null : product.id);
                              }}
                            >
                              <FiMoreVertical />
                            </button>
                            {isMenuOpen && (
                              <div className="actions-dropdown">
                                <button
                                  className="dropdown-item"
                                  onClick={() => {
                                    handleOpenModal(product);
                                    setActiveMenuId(null);
                                  }}
                                >
                                  <FiEdit2 />
                                  Editar
                                </button>
                                <button
                                  className="dropdown-item danger"
                                  onClick={() => {
                                    handleDelete(product.id);
                                    setActiveMenuId(null);
                                  }}
                                >
                                  <FiTrash2 />
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="18" className="empty-state-cell">
                      <div className="empty-state">
                        <p>No se encontraron productos</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div className="pagination-container">
            <div className="pagination-info">
              Mostrando <span className="font-medium">{startIndex + 1}</span> a{" "}
              <span className="font-medium">
                {Math.min(endIndex, filteredProducts.length)}
              </span>{" "}
              de <span className="font-medium">{filteredProducts.length}</span>{" "}
              resultados
            </div>
            <div className="pagination-buttons">
              <button
                className="pagination-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>
              <button
                className="pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="new-product-modal-overlay" onClick={handleCloseModal}>
          <div
            className="new-product-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="new-product-close-btn"
              onClick={handleCloseModal}
            >
              <svg
                fill="none"
                height="20"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <line x1="18" x2="6" y1="6" y2="18"></line>
                <line x1="6" x2="18" y1="6" y2="18"></line>
              </svg>
            </button>

            <div className="new-product-modal-header">
              <h2 className="new-product-title">
                {editingProduct ? "Editar Producto" : "Nuevo Producto"}
              </h2>
            </div>

            <div className="new-product-modal-body">
              {/* Image Upload Area */}
              <div
                className={`new-product-image-upload ${
                  dragActive ? "drag-active" : ""
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />

                {previewImage ? (
                  <div className="new-product-image-preview-wrapper">
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="new-product-image-preview"
                    />
                    <button
                      type="button"
                      className="new-product-remove-image-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeImage(e);
                      }}
                    >
                      <FiX />
                    </button>
                  </div>
                ) : (
                  <div className="new-product-upload-placeholder">
                    <div className="new-product-upload-icon-wrapper">
                      <svg
                        className="new-product-upload-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                        ></path>
                      </svg>
                    </div>
                    <div className="new-product-upload-text">
                      <p className="new-product-upload-text-main">
                        Arrastra una imagen o haz clic para subir
                      </p>
                      <p className="new-product-upload-text-sub">
                        JPG, PNG (Max 2MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <form
                id="new-product-form"
                onSubmit={handleSubmit}
                className="new-product-form"
              >
                {!isSimplified && (
                  <div className="product-edit-tabs" role="tablist" aria-label="Secciones del producto">
                    <button
                      type="button"
                      className={`product-edit-tab ${productEditTab === "datos" ? "active" : ""}`}
                      onClick={() => setProductEditTab("datos")}
                    >
                      Datos y precios
                    </button>
                    <button
                      type="button"
                      className={`product-edit-tab ${productEditTab === "ganancia" ? "active" : ""}`}
                      onClick={() => setProductEditTab("ganancia")}
                    >
                      Ganancia
                    </button>
                  </div>
                )}

                {(isSimplified || productEditTab === "datos") && (
                <div className="new-product-form-grid product-tab-panel">
                  {/* Nombre del Producto */}
                  <div className="new-product-form-group col-span-12 md-col-span-8">
                    <label className="new-product-label" htmlFor="product-name">
                      Nombre del Producto{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="product-name"
                      className="new-product-input"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="Ej. Coca Cola 600ml"
                      required
                    />
                  </div>

                  {/* Categoría */}
                  <div className="new-product-form-group col-span-12 md-col-span-4">
                    <div className="new-product-category-header">
                      <label className="new-product-label" htmlFor="category">
                        Categoría <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        className="new-product-manage-categories-btn"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowCategoriesModal(true);
                        }}
                        title="Gestionar categorías"
                      >
                        <svg
                          className="new-product-manage-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          ></path>
                        </svg>
                      </button>
                    </div>
                    <div className="new-product-select-wrapper">
                      <select
                        id="category"
                        className="new-product-select"
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Seleccionar</option>
                        {predefinedCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        {customCategories.length > 0 && (
                          <optgroup label="Categorías Personalizadas">
                            {customCategories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {existingCategories.filter(
                          (cat) =>
                            !predefinedCategories.includes(cat) &&
                            !customCategories.includes(cat),
                        ).length > 0 && (
                          <optgroup label="Otras">
                            {existingCategories
                              .filter(
                                (cat) =>
                                  !predefinedCategories.includes(cat) &&
                                  !customCategories.includes(cat),
                              )
                              .map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                          </optgroup>
                        )}
                      </select>
                      <div className="new-product-select-arrow">
                        <svg
                          className="new-product-select-arrow-icon"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M19 9l-7 7-7-7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                          ></path>
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Código de Barras */}
                  <div className="new-product-form-group col-span-12 md-col-span-8">
                    <div className="new-product-barcode-group">
                      <div className="new-product-barcode-input-wrapper">
                        <label className="new-product-label" htmlFor="barcode">
                          Código de Barras
                        </label>
                        <input
                          id="barcode"
                          className="new-product-input"
                          type="text"
                          name="barcode"
                          value={formData.barcode}
                          onChange={handleInputChange}
                          placeholder="Escanear código..."
                        />
                      </div>
                      <div className="new-product-camera-btn-wrapper">
                        <button
                          type="button"
                          className="new-product-camera-btn"
                          onClick={() => setMostrarCameraScanner(true)}
                          title="Escanear código con cámara"
                        >
                          <svg
                            className="new-product-camera-icon"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            ></path>
                            <path
                              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                            ></path>
                          </svg>
                          Cámara
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Precios Group */}
                  <div className="new-product-form-group col-span-12">
                    <label className="new-product-label">
                      {isSimplified ? "Precio" : "Configuración de Precios"}
                    </label>
                    <div className="grid grid-cols-12 gap-4">
                      {isSimplified ? (
                        /* Venta Simplificado */
                        <div className="col-span-12">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Precio de Venta <span className="text-red-500">*</span>
                          </label>
                          <div className="new-product-price-wrapper">
                            <span className="new-product-price-symbol">$</span>
                            <input
                              className="new-product-input new-product-price-input"
                              type="number"
                              name="price"
                              value={formData.price}
                              onChange={handleInputChange}
                              placeholder="0.00"
                              step="0.01"
                              required
                            />
                          </div>
                        </div>
                      ) : (
                        /* Modo Completo - Grid Multicolumna de Precios */
                        <>
                          {/* Fila 1: Costo, Venta, Especial 2 */}
                          <div className="col-span-12 md:col-span-4">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Precio Costo
                            </label>
                            <div className="new-product-price-wrapper">
                              <span className="new-product-price-symbol">$</span>
                              <input
                                className="new-product-input new-product-price-input"
                                type="number"
                                name="cost_price"
                                value={formData.cost_price}
                                onChange={handleInputChange}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>

                          <div className="col-span-12 md:col-span-4">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Precio Venta (Menudeo) <span className="text-red-500">*</span>
                            </label>
                            <div className="new-product-price-wrapper">
                              <span className="new-product-price-symbol">$</span>
                              <input
                                className="new-product-input new-product-price-input"
                                type="number"
                                name="price"
                                value={formData.price}
                                onChange={handleInputChange}
                                placeholder="0.00"
                                step="0.01"
                                required
                                min="0"
                              />
                            </div>
                          </div>

                          <div className="col-span-12 md:col-span-4">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Precio Especial 2
                            </label>
                            <div className="new-product-price-wrapper">
                              <span className="new-product-price-symbol">$</span>
                              <input
                                className="new-product-input new-product-price-input"
                                type="number"
                                name="special_price_2"
                                value={formData.special_price_2}
                                onChange={handleInputChange}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>

                          {/* Fila 2: Mayoreo, Cantidad Mayoreo, Especial 1, Cantidad Especial 1 */}
                          <div className="col-span-12 md:col-span-3">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Precio Mayoreo
                            </label>
                            <div className="new-product-price-wrapper">
                              <span className="new-product-price-symbol">$</span>
                              <input
                                className="new-product-input new-product-price-input"
                                type="number"
                                name="wholesale_price"
                                value={formData.wholesale_price}
                                onChange={handleInputChange}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>

                          <div className="col-span-12 md:col-span-3">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Cant. Mín. Mayoreo (PZA)
                            </label>
                            <input
                              className="new-product-input"
                              type="number"
                              name="wholesale_from_qty"
                              value={formData.wholesale_from_qty}
                              onChange={handleInputChange}
                              placeholder="Ej. 20.00"
                              min="0"
                              step="0.01"
                            />
                          </div>

                          <div className="col-span-12 md:col-span-3">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Precio Especial 1
                            </label>
                            <div className="new-product-price-wrapper">
                              <span className="new-product-price-symbol">$</span>
                              <input
                                className="new-product-input new-product-price-input"
                                type="number"
                                name="special_price"
                                value={formData.special_price}
                                onChange={handleInputChange}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                              />
                            </div>
                          </div>

                          <div className="col-span-12 md:col-span-3">
                            <label className="text-xs text-gray-500 mb-1 block">
                              Cant. Mín. Especial 1 (PZA)
                            </label>
                            <input
                              className="new-product-input"
                              type="number"
                              name="special_from_qty"
                              value={formData.special_from_qty}
                              onChange={handleInputChange}
                              placeholder="Ej. 48.00"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {!isSimplified && (
                    <div className="new-product-form-group col-span-12">
                      <label className="new-product-label">Empaque por caja</label>
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Piezas por caja
                          </label>
                          <input
                            className="new-product-input"
                            type="number"
                            name="box_units"
                            value={formData.box_units}
                            onChange={handleInputChange}
                            placeholder="Ej. 24"
                            min="2"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Precio caja
                          </label>
                          <div className="new-product-price-wrapper">
                            <span className="new-product-price-symbol">$</span>
                            <input
                              className="new-product-input new-product-price-input"
                              type="number"
                              name="box_price"
                              value={formData.box_price}
                              onChange={handleInputChange}
                              placeholder="0.00"
                              step="0.01"
                            />
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Código caja
                          </label>
                          <input
                            className="new-product-input"
                            type="text"
                            name="box_barcode"
                            value={formData.box_barcode}
                            onChange={handleInputChange}
                            placeholder="Código alterno para caja"
                          />
                        </div>
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Precio especial por caja
                          </label>
                          <div className="new-product-price-wrapper">
                            <span className="new-product-price-symbol">$</span>
                            <input
                              className="new-product-input new-product-price-input"
                              type="number"
                              name="box_special_price"
                              value={formData.box_special_price}
                              onChange={handleInputChange}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </div>
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Aplica desde cajas
                          </label>
                          <input
                            className="new-product-input"
                            type="number"
                            name="box_special_from_qty"
                            value={formData.box_special_from_qty}
                            onChange={handleInputChange}
                            placeholder="Ej. 8"
                            min="0"
                            step="1"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {!isSimplified && (
                    <div className="new-product-form-group col-span-12">
                      <label className="inline-flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          name="sell_by_box_only"
                          checked={formData.sell_by_box_only}
                          onChange={handleInputChange}
                          className="mt-1 h-4 w-4"
                        />
                        <span>
                          <span className="block font-semibold text-gray-900">
                            Solo vender por caja
                          </span>
                          <span className="block text-xs text-gray-500">
                            En ventas no se mostrara ni permitira agregar este producto por pieza.
                          </span>
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Stock Group */}
                  <div className="new-product-form-group col-span-12">
                    <label className="new-product-label">Inventario</label>
                    <div className="grid grid-cols-12 gap-4">
                      {/* Stock Actual */}
                      <div
                        className={`col-span-12 ${
                          isSimplified ? "md:col-span-12" : "md:col-span-6"
                        }`}
                      >
                        <label className="text-xs text-gray-500 mb-1 block">
                          Existencia Actual{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="stock"
                          className="new-product-input"
                          type="number"
                          name="stock"
                          value={formData.stock}
                          onChange={handleInputChange}
                          placeholder="0"
                          required
                        />
                      </div>

                      {/* Stock Minimo */}
                      {!isSimplified && (
                        <div className="col-span-12 md:col-span-6">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Inventario Mínimo
                          </label>
                          <input
                            className="new-product-input"
                            type="number"
                            name="min_stock"
                            value={formData.min_stock}
                            onChange={handleInputChange}
                            placeholder="5"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Advanced Fields - Solo modo avanzado */}
                  {!isSimplified && (
                    <div className="new-product-form-group col-span-12">
                      <label className="new-product-label">
                        Información Avanzada
                      </label>
                      <div className="grid grid-cols-12 gap-4">
                        {/* Unidad */}
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Unidad
                          </label>
                          <div className="new-product-select-wrapper">
                            <select
                              className="new-product-select"
                              name="unit"
                              value={formData.unit}
                              onChange={handleInputChange}
                            >
                              <option value="PZA">PZA (Pieza)</option>
                              <option value="KG">KG (Kilogramo)</option>
                              <option value="L">L (Litro)</option>
                              <option value="M">M (Metro)</option>
                              <option value="CAJA">CAJA</option>
                              <option value="PAQ">PAQ (Paquete)</option>
                              <option value="TRAMO">TRAMO</option>
                              <option value="ROLLO">ROLLO</option>
                              <option value="JGO">JGO (Juego)</option>
                              <option value="BOLSA">BOLSA</option>
                            </select>
                            <div className="new-product-select-arrow">
                              <svg
                                className="new-product-select-arrow-icon"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  d="M19 9l-7 7-7-7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                ></path>
                              </svg>
                            </div>
                          </div>
                        </div>

                        {/* IVA */}
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            IVA %
                          </label>
                          <div className="new-product-price-wrapper">
                            <span className="new-product-price-symbol">%</span>
                            <input
                              className="new-product-input new-product-price-input"
                              type="number"
                              name="iva"
                              value={formData.iva}
                              onChange={handleInputChange}
                              placeholder="16"
                              step="0.01"
                              min="0"
                              max="100"
                            />
                          </div>
                        </div>

                        {/* Precio Sugerido */}
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Precio Sugerido
                          </label>
                          <div className="new-product-price-wrapper">
                            <span className="new-product-price-symbol">$</span>
                            <input
                              className="new-product-input new-product-price-input"
                              type="number"
                              name="suggested_price"
                              value={formData.suggested_price}
                              onChange={handleInputChange}
                              placeholder="0.00"
                              step="0.01"
                            />
                          </div>
                        </div>

                        {/* Unidad Mayoreo */}
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Unidad Mayoreo
                          </label>
                          <input
                            className="new-product-input"
                            type="text"
                            name="wholesale_unit"
                            value={formData.wholesale_unit}
                            onChange={handleInputChange}
                            placeholder="Ej. Caja de 24"
                          />
                        </div>

                        {/* Marca */}
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Marca
                          </label>
                          <input
                            className="new-product-input"
                            type="text"
                            name="brand"
                            value={formData.brand}
                            onChange={handleInputChange}
                            placeholder="Ej. Coca-Cola"
                          />
                        </div>

                        {/* Proveedor */}
                        <div className="col-span-12 md:col-span-4">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Proveedor
                          </label>
                          <input
                            className="new-product-input"
                            type="text"
                            name="supplier"
                            value={formData.supplier}
                            onChange={handleInputChange}
                            placeholder="Ej. Distribuidora ACME"
                          />
                        </div>

                        {/* Notas */}
                        <div className="col-span-12">
                          <label className="text-xs text-gray-500 mb-1 block">
                            Notas
                          </label>
                          <textarea
                            className="new-product-input"
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            placeholder="Notas adicionales del producto..."
                            rows="2"
                            style={{ resize: "vertical", minHeight: "60px" }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {!isSimplified && productEditTab === "ganancia" && (
                  <div className="product-tab-panel price-sheet profit-sheet">
                    <div className="profit-sheet-summary">
                      <div>
                        <span className="profit-sheet-label">Costo base por pieza</span>
                        <div className="new-product-price-wrapper profit-sheet-cost">
                          <span className="new-product-price-symbol">$</span>
                          <input
                            className="new-product-input new-product-price-input"
                            type="number"
                            name="cost_price"
                            value={formData.cost_price}
                            onChange={handleInputChange}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </div>
                      </div>
                      <div>
                        <span className="profit-sheet-label">Última compra</span>
                        <strong className="profit-sheet-value">
                          {formatLastPurchase(editingProduct)}
                        </strong>
                      </div>
                      <div>
                        <span className="profit-sheet-label">Ganancia general</span>
                        <div className="price-sheet-percent profit-sheet-general-margin">
                          <input
                            className="new-product-input"
                            type="number"
                            value={generalProfitMargin}
                            onChange={(e) => setGeneralProfitMargin(e.target.value)}
                            placeholder="15.00"
                            step="0.01"
                            disabled={toNumber(formData.cost_price) <= 0}
                          />
                          <span>%</span>
                        </div>
                      </div>
                    </div>

                    <p className="price-sheet-muted">
                      El porcentaje se calcula sobre costo. También puedes escribir el porcentaje y el sistema recalcula el precio.
                    </p>

                    <div className="price-sheet-main">
                      <div className="price-sheet-header">
                        <span>Precio</span>
                        <span>Importe</span>
                        <span>Ganancia %</span>
                        <span>Utilidad</span>
                      </div>

                      {profitPriceRows.map((row) => {
                        const profitAmount = getProfitAmount(row.value, row.costMultiplier);
                        const marginPercent = getMarginPercent(row.value, row.costMultiplier);
                        const hasCostBasis = toNumber(formData.cost_price) > 0 && normalizeCostMultiplier(row.costMultiplier) > 0;
                        const hasPrice = toNumber(row.value) > 0;
                        const isBoxRow = row.field === "box_price";

                        return (
                          <div className="price-sheet-row" key={row.field}>
                            <label>
                              {row.label}
                              {row.detail && <span className="profit-sheet-detail">{row.detail}</span>}
                            </label>
                            <div className="new-product-price-wrapper">
                              <span className="new-product-price-symbol">$</span>
                              <input
                                className="new-product-input new-product-price-input"
                                type="number"
                                name={row.field}
                                value={row.value}
                                onChange={
                                  isBoxRow
                                    ? undefined
                                    : (e) => handleProfitPriceChange(row.field, e.target.value)
                                }
                                readOnly={isBoxRow}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                title={isBoxRow ? "Automatico: menudeo por piezas de caja" : undefined}
                              />
                            </div>
                            <div className="price-sheet-percent">
                              <input
                                className="new-product-input"
                                type="number"
                                value={marginPercent}
                                onChange={(e) => handleMarginChange(row.field, e.target.value, row.costMultiplier)}
                                placeholder="0.00"
                                step="0.01"
                                disabled={isBoxRow || !hasCostBasis}
                                title={isBoxRow ? "Calculado automaticamente desde el precio de caja" : undefined}
                              />
                              <span>%</span>
                            </div>
                            <span className={`profit-sheet-profit ${profitAmount < 0 ? "negative" : ""}`}>
                              {!hasCostBasis
                                ? row.field === "box_price" && normalizeCostMultiplier(row.costMultiplier) <= 0
                                  ? "Configura caja"
                                  : "Agrega costo"
                                : !hasPrice
                                  ? "Sin precio"
                                  : formatMoney(profitAmount)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="new-product-modal-footer">
              <button
                type="button"
                className="new-product-btn-cancel"
                onClick={handleCloseModal}
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="new-product-form"
                className="new-product-btn-save"
              >
                <svg
                  className="new-product-save-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  ></path>
                </svg>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Scanner de Cámara */}
      <CameraScanner
        isOpen={mostrarCameraScanner}
        onClose={() => setMostrarCameraScanner(false)}
        onScan={manejarEscaneoCamara}
      />

      {/* Modal de Gestión de Categorías */}
      {showCategoriesModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCategoriesModal(false)}
        >
          <div
            className="categories-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="categories-modal-header">
              <h2>Gestionar Categorías</h2>
              <button
                className="close-btn"
                onClick={() => setShowCategoriesModal(false)}
              >
                <FiX />
              </button>
            </div>
            <div className="categories-modal-content">
              {/* Agregar nueva categoría */}
              <div className="categories-add-section">
                <label className="categories-label">
                  Agregar Nueva Categoría
                </label>
                <div className="categories-input-group">
                  <input
                    type="text"
                    className="categories-input"
                    placeholder="Nombre de la categoría..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="categories-add-btn"
                    onClick={handleAddCategory}
                  >
                    <FiPlus />
                    Agregar
                  </button>
                </div>
              </div>

              {/* Lista de categorías predefinidas */}
              <div className="categories-section">
                <h3 className="categories-section-title">
                  Categorías del Sistema
                </h3>
                <div className="categories-list">
                  {predefinedCategories.map((cat) => (
                    <div key={cat} className="categories-item predefined">
                      <span className="categories-item-name">{cat}</span>
                      <span className="categories-item-badge">Sistema</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista de categorías personalizadas */}
              {customCategories.length > 0 && (
                <div className="categories-section">
                  <h3 className="categories-section-title">
                    Mis Categorías Personalizadas
                  </h3>
                  <div className="categories-list">
                    {customCategories.map((cat) => (
                      <div key={cat} className="categories-item custom">
                        <span className="categories-item-name">{cat}</span>
                        <button
                          type="button"
                          className="categories-delete-btn"
                          onClick={() => handleDeleteCategory(cat)}
                          title="Eliminar categoría"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {customCategories.length === 0 && (
                <div className="categories-empty">
                  <p>No has creado categorías personalizadas aún.</p>
                  <p className="categories-empty-hint">
                    Agrega una categoría usando el campo de arriba.
                  </p>
                </div>
              )}
            </div>
            <div className="categories-modal-footer">
              <button
                type="button"
                className="categories-close-btn"
                onClick={() => setShowCategoriesModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Filtros */}
      {showFiltersModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowFiltersModal(false)}
        >
          <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filters-modal-header">
              <h2>Filtros</h2>
              <button
                className="close-btn"
                onClick={() => setShowFiltersModal(false)}
              >
                <FiX />
              </button>
            </div>
            <div className="filters-modal-content">
              {/* Filtro por Categoría */}
              <div className="filter-group">
                <label className="filter-label">Categoría</label>
                <select
                  className="filter-select"
                  value={filters.category}
                  onChange={(e) =>
                    handleFilterChange("category", e.target.value)
                  }
                >
                  <option value="all">Todas las categorías</option>
                  {predefinedCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  {customCategories.length > 0 && (
                    <optgroup label="Categorías Personalizadas">
                      {customCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {existingCategories.filter(
                    (cat) =>
                      !predefinedCategories.includes(cat) &&
                      !customCategories.includes(cat),
                  ).length > 0 && (
                    <optgroup label="Otras">
                      {existingCategories
                        .filter(
                          (cat) =>
                            !predefinedCategories.includes(cat) &&
                            !customCategories.includes(cat),
                        )
                        .map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Filtro por Estado de Stock */}
              <div className="filter-group">
                <label className="filter-label">Estado de Stock</label>
                <select
                  className="filter-select"
                  value={filters.stockStatus}
                  onChange={(e) =>
                    handleFilterChange("stockStatus", e.target.value)
                  }
                >
                  <option value="all">Todos</option>
                  <option value="low">Bajo (menos de 5)</option>
                  <option value="medium">Medio (5-14)</option>
                  <option value="high">Alto (15 o más)</option>
                </select>
              </div>

              {/* Filtro por Rango de Precio */}
              <div className="filter-group">
                <label className="filter-label">Rango de Precio</label>
                <div className="price-range">
                  <input
                    type="number"
                    className="filter-input"
                    placeholder="Precio mínimo"
                    value={filters.minPrice}
                    onChange={(e) =>
                      handleFilterChange("minPrice", e.target.value)
                    }
                    step="0.01"
                    min="0"
                  />
                  <span className="price-separator">-</span>
                  <input
                    type="number"
                    className="filter-input"
                    placeholder="Precio máximo"
                    value={filters.maxPrice}
                    onChange={(e) =>
                      handleFilterChange("maxPrice", e.target.value)
                    }
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              {/* Botones de acción */}
              <div className="filters-modal-actions">
                <button
                  type="button"
                  className="filter-clear-btn"
                  onClick={handleClearFilters}
                >
                  Limpiar Filtros
                </button>
                <button
                  type="button"
                  className="filter-apply-btn"
                  onClick={() => setShowFiltersModal(false)}
                >
                  Aplicar Filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showImportModal && (
        <BulkImportModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            fetchProducts();
            // Optionally refresh categories if needed
          }}
          currentProducts={products}
          getCategory={getCategory}
          getSKU={getSKU}
        />
      )}

      {/* Modal de Alertas de Inventario */}
      {showLowStockAlert && (
        <div
          className="modal-overlay"
          onClick={() => setShowLowStockAlert(false)}
        >
          <div
            className="inventario-alerta-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inventario-alerta-header">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg">
                  <FiAlertTriangle className="text-xl" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">
                    Productos bajos en inventario
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Hay {lowStockProducts.length} productos con existencia igual
                    o menor a su mínimo sugerido.
                  </p>
                </div>
              </div>
              <button
                className="close-btn"
                onClick={() => setShowLowStockAlert(false)}
              >
                <FiX />
              </button>
            </div>
            <div className="inventario-alerta-content py-0 px-0">
              <div className="overflow-x-auto min-h-[300px] max-h-[60vh]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80 backdrop-blur-sm z-10 text-xs uppercase font-bold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-700">
                        SKU
                      </th>
                      <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-700">
                        Producto
                      </th>
                      <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-700">
                        Departamento
                      </th>
                      <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-700 text-right">
                        Precio Venta
                      </th>
                      <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-700 text-center">
                        Inv Mínimo
                      </th>
                      <th className="py-3 px-4 border-b border-slate-200 dark:border-slate-700 text-center">
                        Inventario
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                    {lowStockProducts.map((p) => {
                      const isCritical = p.stock === 0;
                      return (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                            {getSKU(p)}
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-2">
                              {isCritical && (
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0 animate-pulse"></span>
                              )}
                              <span
                                className="truncate max-w-[200px]"
                                title={p.name}
                              >
                                {p.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {p.category || getCategory(p.name).name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                            ${p.price.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 dark:text-slate-400">
                            {p.min_stock || 0}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center min-w-[30px] px-2 py-1 rounded-md text-xs font-bold ${
                                isCritical
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
                              }`}
                            >
                              {p.stock}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="inventario-alerta-footer flex justify-end gap-3 p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl">
              <button
                type="button"
                className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                onClick={() => setShowLowStockAlert(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <EntradasModal
        show={showEntradasModal}
        onClose={() => setShowEntradasModal(false)}
        onSuccess={() => fetchProducts()}
      />
    </div>
  );
};

export { Inventory };
