import React, { useEffect, useMemo, useState } from "react";
import "./Suppliers.css";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import Modal from "../common/Modal";
import { supplierService } from "../../services/supplierService";

const itemsPerPage = 5;
const defaultConditions = ["Contado", "Net 15", "Net 30", "Net 60"];

const money = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "PR";

const formatDate = (value) => {
  if (!value) return "Sin compras";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin compras";
  return date.toLocaleDateString("es-MX");
};

const mapSupplier = (supplier) => {
  const balance = parseFloat(supplier.balance || 0);
  const terms = supplier.payment_terms || "Contado";

  return {
    ...supplier,
    initials: getInitials(supplier.name),
    conditions: terms,
    conditionsType: terms.toLowerCase() === "contado" ? "green" : "blue",
    balanceValue: balance,
    balanceText: money.format(balance),
    status: balance > 0 ? "Pendiente" : "Al corriente",
    statusType: balance > 0 ? "warning" : "success",
    productos: "0 articulos",
    ultimaCompra: formatDate(supplier.last_purchase_at || supplier.updated_at || supplier.created_at),
  };
};

const Suppliers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: "",
    email: "",
    phone: "",
    conditions: "Contado",
    balance: "0.00",
  });
  const [modalMode, setModalMode] = useState("create");
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [availableConditions, setAvailableConditions] = useState(defaultConditions);
  const [newConditionInput, setNewConditionInput] = useState("");
  const [showNewConditionInput, setShowNewConditionInput] = useState(false);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const data = await supplierService.getAll();
      setSuppliers(data.map(mapSupplier));
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
      Swal.fire("Error", "No se pudieron cargar los proveedores de esta tienda", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter]);

  const filteredSuppliers = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesSearch =
        !searchLower ||
        supplier.name?.toLowerCase().includes(searchLower) ||
        supplier.id?.toLowerCase().includes(searchLower) ||
        supplier.email?.toLowerCase().includes(searchLower) ||
        supplier.phone?.includes(searchTerm) ||
        supplier.productos?.toLowerCase().includes(searchLower) ||
        supplier.ultimaCompra?.includes(searchTerm);

      if (!matchesSearch) return false;
      if (activeFilter === "Con Deuda") return supplier.balanceValue > 0;
      if (activeFilter === "Activos") return supplier.status === "Al corriente";
      return true;
    });
  }, [activeFilter, searchTerm, suppliers]);

  const displayedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / itemsPerPage));
  const payableTotal = suppliers.reduce((sum, supplier) => sum + supplier.balanceValue, 0);
  const suppliersWithDebt = suppliers.filter((supplier) => supplier.balanceValue > 0).length;

  const resetForm = () => {
    setNewSupplierForm({
      name: "",
      email: "",
      phone: "",
      conditions: "Contado",
      balance: "0.00",
    });
    setNewConditionInput("");
    setShowNewConditionInput(false);
    setModalMode("create");
    setSelectedSupplier(null);
  };

  const handleExport = () => {
    try {
      const data = filteredSuppliers.map((supplier) => ({
        ID: supplier.id,
        Proveedor: supplier.name,
        Email: supplier.email || "",
        Telefono: supplier.phone || "",
        Condiciones: supplier.conditions,
        Productos: supplier.productos,
        "Ultima Compra": supplier.ultimaCompra,
        "Saldo Pendiente": supplier.balanceValue,
        Estado: supplier.status,
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      worksheet["!cols"] = [
        { wch: 36 },
        { wch: 30 },
        { wch: 30 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 },
        { wch: 20 },
      ];
      XLSX.utils.book_append_sheet(workbook, worksheet, "Proveedores");
      XLSX.writeFile(workbook, `proveedores_${new Date().toISOString().split("T")[0]}.xlsx`);
      Swal.fire("Exito", "Proveedores exportados correctamente", "success");
    } catch (error) {
      console.error("Error al exportar:", error);
      Swal.fire("Error", "No se pudo exportar proveedores", "error");
    }
  };

  const handleNewSupplier = () => {
    setModalMode("create");
    resetForm();
    setIsNewSupplierModalOpen(true);
  };

  const fillForm = (supplier, mode) => {
    setModalMode(mode);
    setSelectedSupplier(supplier);
    setNewSupplierForm({
      name: supplier.name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      conditions: supplier.conditions || "Contado",
      balance: String(supplier.balanceValue || 0),
    });
    setIsNewSupplierModalOpen(true);
  };

  const handleDeleteSupplier = (supplier) => {
    Swal.fire({
      title: "Eliminar proveedor",
      text: `Deseas eliminar a ${supplier.name}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Si, eliminar",
      cancelButtonText: "Cancelar",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      try {
        await supplierService.remove(supplier.id);
        await loadSuppliers();
        Swal.fire("Eliminado", "El proveedor fue eliminado correctamente", "success");
      } catch (error) {
        console.error("Error al eliminar proveedor:", error);
        Swal.fire("Error", "No se pudo eliminar el proveedor", "error");
      }
    });
  };

  const handleCloseModal = () => {
    setIsNewSupplierModalOpen(false);
    resetForm();
  };

  const handleFormChange = (field, value) => {
    setNewSupplierForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddNewCondition = () => {
    const condition = newConditionInput.trim();
    if (!condition || availableConditions.includes(condition)) return;
    setAvailableConditions((prev) => [...prev, condition]);
    setNewSupplierForm((prev) => ({ ...prev, conditions: condition }));
    setNewConditionInput("");
    setShowNewConditionInput(false);
  };

  const handleDeleteCondition = (conditionToDelete) => {
    if (availableConditions.length <= 1) {
      Swal.fire("Error", "Debe mantener al menos una condicion", "error");
      return;
    }

    const nextConditions = availableConditions.filter((condition) => condition !== conditionToDelete);
    setAvailableConditions(nextConditions);
    if (newSupplierForm.conditions === conditionToDelete) {
      setNewSupplierForm((prev) => ({ ...prev, conditions: nextConditions[0] }));
    }
  };

  const handleSubmitSupplier = async () => {
    if (!newSupplierForm.name.trim()) {
      Swal.fire("Error", "El nombre del proveedor es obligatorio", "error");
      return;
    }

    try {
      const payload = {
        name: newSupplierForm.name,
        email: newSupplierForm.email,
        phone: newSupplierForm.phone,
        payment_terms: newSupplierForm.conditions,
        balance: newSupplierForm.balance,
      };

      if (modalMode === "create") {
        await supplierService.create(payload);
      } else {
        await supplierService.update(selectedSupplier.id, payload);
      }

      await loadSuppliers();
      Swal.fire(
        "Exito",
        `Proveedor ${modalMode === "create" ? "agregado" : "actualizado"} correctamente`,
        "success",
      );
      handleCloseModal();
    } catch (error) {
      console.error("Error al guardar proveedor:", error);
      Swal.fire("Error", "No se pudo guardar el proveedor", "error");
    }
  };

  return (
    <div className="suppliers-page">
      <header className="suppliers-header">
        <div className="suppliers-header-content">
          <div className="flex items-center gap-8">
            <div className="suppliers-search-container">
              <span className="material-symbols-outlined suppliers-search-icon">search</span>
              <input
                className="suppliers-search-input"
                placeholder="Buscar proveedores..."
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="suppliers-main">
        <div className="suppliers-page-heading flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="w-full md:w-auto">
            <nav className="suppliers-breadcrumb">
              <span>Dashboard</span>
              <span>/</span>
              <span className="suppliers-breadcrumb-active">Gestion de Proveedores</span>
            </nav>
            <h1 className="suppliers-title">Proveedores</h1>
          </div>
          <div className="suppliers-actions flex flex-wrap items-center gap-2 md:gap-3">
            <button className="suppliers-btn-export text-xs md:text-sm px-3 md:px-4" onClick={handleExport}>
              <span className="material-symbols-outlined">file_download</span>
              Exportar
            </button>
            <button className="suppliers-btn-new text-xs md:text-sm px-4 md:px-6" onClick={handleNewSupplier}>
              <span className="material-symbols-outlined">add</span>
              <span className="hidden sm:inline">Nuevo Proveedor</span>
              <span className="sm:hidden">Nuevo</span>
            </button>
          </div>
        </div>

        <div className="suppliers-kpi-grid">
          <div className="suppliers-kpi-card">
            <p className="suppliers-kpi-label">Total Proveedores</p>
            <div className="suppliers-kpi-value-row">
              <p className="suppliers-kpi-value">{suppliers.length}</p>
              <span className="suppliers-kpi-badge suppliers-kpi-badge-neutral">Tienda</span>
            </div>
            <div className="suppliers-kpi-progress">
              <div className="suppliers-kpi-progress-bar suppliers-kpi-progress-primary" style={{ width: "65%" }} />
            </div>
          </div>

          <div className="suppliers-kpi-card">
            <p className="suppliers-kpi-label">Pedidos en Transito</p>
            <div className="suppliers-kpi-value-row">
              <p className="suppliers-kpi-value">0</p>
              <span className="suppliers-kpi-badge suppliers-kpi-badge-neutral">Sin datos</span>
            </div>
            <div className="suppliers-kpi-progress">
              <div className="suppliers-kpi-progress-bar suppliers-kpi-progress-amber" style={{ width: "0%" }} />
            </div>
          </div>

          <div className="suppliers-kpi-card">
            <p className="suppliers-kpi-label">Cuentas por Pagar</p>
            <div className="suppliers-kpi-value-row">
              <p className="suppliers-kpi-value">{money.format(payableTotal)}</p>
              <span className="suppliers-kpi-badge suppliers-kpi-badge-danger">{suppliersWithDebt}</span>
            </div>
            <div className="suppliers-kpi-progress">
              <div className="suppliers-kpi-progress-bar suppliers-kpi-progress-rose" style={{ width: suppliersWithDebt ? "55%" : "0%" }} />
            </div>
          </div>

          <div className="suppliers-kpi-card">
            <p className="suppliers-kpi-label">Proximos Vencimientos</p>
            <div className="suppliers-kpi-value-row">
              <p className="suppliers-kpi-value">0</p>
              <span className="suppliers-kpi-badge suppliers-kpi-badge-success">OK</span>
            </div>
            <div className="suppliers-kpi-progress">
              <div className="suppliers-kpi-progress-bar suppliers-kpi-progress-emerald" style={{ width: "0%" }} />
            </div>
          </div>
        </div>

        <div className="suppliers-table-container">
          <div className="suppliers-table-controls">
            <div className="suppliers-filters">
              {["Todos", "Con Deuda", "Activos"].map((filter) => (
                <button
                  key={filter}
                  className={`suppliers-filter-btn ${activeFilter === filter ? "active" : ""}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="suppliers-table-wrapper">
            <table className="suppliers-table">
              <thead>
                <tr className="suppliers-table-header">
                  <th className="suppliers-table-th">Proveedor</th>
                  <th className="suppliers-table-th">Contacto</th>
                  <th className="suppliers-table-th">Condiciones</th>
                  <th className="suppliers-table-th">Productos</th>
                  <th className="suppliers-table-th">Ultima Compra</th>
                  <th className="suppliers-table-th suppliers-table-th-right">Saldo Pendiente</th>
                  <th className="suppliers-table-th suppliers-table-th-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="suppliers-table-body">
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "32px", color: "#6b7280" }}>
                      Cargando proveedores...
                    </td>
                  </tr>
                ) : displayedSuppliers.length > 0 ? (
                  displayedSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="suppliers-table-row">
                      <td className="suppliers-table-td">
                        <div className="suppliers-table-supplier-info">
                          <div className="suppliers-table-avatar">{supplier.initials}</div>
                          <div>
                            <p className="suppliers-table-supplier-name">{supplier.name}</p>
                            <p className="suppliers-table-supplier-id">ID: {supplier.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="suppliers-table-td">
                        <p className="suppliers-table-contact-email">{supplier.email || "Sin email"}</p>
                        <p className="suppliers-table-contact-phone">{supplier.phone || "Sin telefono"}</p>
                      </td>
                      <td className="suppliers-table-td">
                        <span className={`suppliers-table-badge suppliers-table-badge-${supplier.conditionsType}`}>
                          {supplier.conditions}
                        </span>
                      </td>
                      <td className="suppliers-table-td">
                        <p className="suppliers-table-products">{supplier.productos}</p>
                      </td>
                      <td className="suppliers-table-td">
                        <p className="suppliers-table-last-purchase">{supplier.ultimaCompra}</p>
                      </td>
                      <td className="suppliers-table-td suppliers-table-td-right">
                        <p className={`suppliers-table-balance ${supplier.balanceValue === 0 ? "suppliers-table-balance-zero" : "suppliers-table-balance-amount"}`}>
                          {supplier.balanceText}
                        </p>
                        <p className="suppliers-table-status">{supplier.status}</p>
                      </td>
                      <td className="suppliers-table-td">
                        <div className="suppliers-table-actions">
                          <button className="suppliers-table-action-btn" onClick={() => fillForm(supplier, "edit")} title="Editar">
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button className="suppliers-table-action-btn" onClick={() => fillForm(supplier, "view")} title="Ver detalles">
                            <span className="material-symbols-outlined">visibility</span>
                          </button>
                          <button className="suppliers-table-action-btn" onClick={() => handleDeleteSupplier(supplier)} title="Eliminar">
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "32px", color: "#6b7280" }}>
                      No se encontraron proveedores de esta tienda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="suppliers-pagination">
            <p className="suppliers-pagination-info">
              Mostrando {displayedSuppliers.length} de {filteredSuppliers.length} proveedores
              {searchTerm && ` (filtrados de ${suppliers.length} total)`}
            </p>
            <div className="suppliers-pagination-controls">
              <button
                className="suppliers-pagination-btn"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  className={`suppliers-pagination-btn ${currentPage === page ? "active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ))}
              <button
                className="suppliers-pagination-btn"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      <Modal isOpen={isNewSupplierModalOpen} onClose={handleCloseModal} raw={true} className="w-full max-w-2xl px-4">
        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/5">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {modalMode === "create" ? "Nuevo Proveedor" : modalMode === "edit" ? "Editar Proveedor" : "Detalles del Proveedor"}
            </h1>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" onClick={handleCloseModal}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="p-6 space-y-6 text-left">
            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Proveedor</label>
              <input
                className={`w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-md focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none text-sm dark:text-white transition-all font-display ${modalMode === "view" ? "opacity-70 cursor-not-allowed" : ""}`}
                placeholder="Nombre del proveedor"
                type="text"
                value={newSupplierForm.name}
                onChange={(event) => handleFormChange("name", event.target.value)}
                readOnly={modalMode === "view"}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Contacto</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  className={`w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-md focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none text-sm dark:text-white transition-all font-display ${modalMode === "view" ? "opacity-70 cursor-not-allowed" : ""}`}
                  placeholder="Email del contacto"
                  type="email"
                  value={newSupplierForm.email}
                  onChange={(event) => handleFormChange("email", event.target.value)}
                  readOnly={modalMode === "view"}
                />
                <input
                  className={`w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-md focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none text-sm dark:text-white transition-all font-display ${modalMode === "view" ? "opacity-70 cursor-not-allowed" : ""}`}
                  placeholder="Telefono"
                  type="tel"
                  value={newSupplierForm.phone}
                  onChange={(event) => handleFormChange("phone", event.target.value)}
                  readOnly={modalMode === "view"}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Condiciones</label>
                <div className="relative">
                  <select
                    className={`w-full px-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-md appearance-none focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none text-sm dark:text-white transition-all font-display ${modalMode === "view" ? "opacity-70 cursor-not-allowed" : ""}`}
                    value={newSupplierForm.conditions}
                    onChange={(event) => handleFormChange("conditions", event.target.value)}
                    disabled={modalMode === "view"}
                  >
                    {availableConditions.map((condition) => (
                      <option key={condition} value={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-gray-400">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-lg space-y-4">
                {modalMode !== "view" && (
                  <div className="flex flex-wrap gap-2">
                    {availableConditions.map((condition) => (
                      <div key={condition} className="inline-flex items-center px-2 py-1 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-md group">
                        <span className="text-xs text-gray-600 dark:text-gray-300 font-display">{condition}</span>
                        <button className="ml-2 text-gray-400 hover:text-red-500 transition-colors" onClick={() => handleDeleteCondition(condition)}>
                          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {modalMode !== "view" && !showNewConditionInput ? (
                  <button
                    className="w-full flex items-center justify-center py-3 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg text-gray-500 hover:border-gray-400 dark:hover:border-white/30 hover:text-gray-700 dark:hover:text-gray-200 transition-all group"
                    onClick={() => setShowNewConditionInput(true)}
                  >
                    <span className="material-symbols-outlined mr-2">add</span>
                    <span className="text-sm font-display">Agregar condicion</span>
                  </button>
                ) : modalMode !== "view" ? (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <input
                      className="w-full px-4 py-3 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none text-sm dark:text-white transition-all font-display"
                      placeholder="Ej: Net 45, 50% anticipo"
                      type="text"
                      value={newConditionInput}
                      onChange={(event) => setNewConditionInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleAddNewCondition();
                        }
                        if (event.key === "Escape") {
                          setShowNewConditionInput(false);
                          setNewConditionInput("");
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        className="px-4 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors font-display"
                        onClick={() => {
                          setShowNewConditionInput(false);
                          setNewConditionInput("");
                        }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="px-4 py-1.5 text-xs font-bold text-white bg-black dark:bg-white dark:text-black rounded-md transition-transform active:scale-95 disabled:opacity-50 font-display"
                        onClick={handleAddNewCondition}
                        disabled={!newConditionInput.trim()}
                      >
                        Confirmar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">Saldo Pendiente</label>
              <div className="relative">
                <span className="absolute left-3 inset-y-0 flex items-center text-gray-400 text-sm">$</span>
                <input
                  className={`w-full pl-7 pr-3 py-2 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-md focus:ring-2 focus:ring-black dark:focus:ring-white focus:border-transparent outline-none text-sm dark:text-white transition-all font-display ${modalMode === "view" ? "opacity-70 cursor-not-allowed" : ""}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={newSupplierForm.balance}
                  onChange={(event) => handleFormChange("balance", event.target.value)}
                  readOnly={modalMode === "view"}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end px-6 py-4 bg-gray-50/50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5 gap-3">
            <button className="px-6 py-2.5 text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-black transition-all active:scale-95 font-display" onClick={handleCloseModal}>
              Cancelar
            </button>
            {modalMode !== "view" && (
              <button className="px-6 py-2.5 text-sm font-bold text-white bg-black hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200 rounded-lg transition-all shadow-lg active:scale-95 font-display" onClick={handleSubmitSupplier}>
                {modalMode === "create" ? "Agregar Proveedor" : "Guardar Cambios"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Suppliers;
