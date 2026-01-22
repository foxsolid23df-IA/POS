import React, { useState, useEffect } from "react";
import "./Suppliers.css";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import Modal from "../common/Modal";

const Suppliers = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalSuppliers = 124;

  // Modal state
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: "",
    email: "",
    phone: "",
    conditions: "Contado",
    balance: "0.00",
  });

  // Conditions management state
  const [availableConditions, setAvailableConditions] = useState([
    "Contado",
    "Net 15",
    "Net 30",
    "Net 60",
  ]);
  const [newConditionInput, setNewConditionInput] = useState("");
  const [showNewConditionInput, setShowNewConditionInput] = useState(false);

  // Datos de ejemplo de proveedores (Generados dinámicamente para pruebas)
  const initialSuppliers = [
    {
      id: "PROV-2401",
      name: "Distribuidora Central",
      initials: "DC",
      email: "juan@distribuidora.com",
      phone: "+52 555 123 4567",
      conditions: "Net 30",
      conditionsType: "blue",
      balance: "$1,200.00",
      status: "Vence en 5 días",
      statusType: "warning",
      productos: "24 artículos",
      ultimaCompra: "15/01/2026",
    },
    {
      id: "PROV-2402",
      name: "Frutas Frescas S.A.",
      initials: "FF",
      email: "ventas@frutas.com",
      phone: "+52 555 987 6543",
      conditions: "Contado",
      conditionsType: "green",
      balance: "$0.00",
      status: "Al corriente",
      statusType: "success",
      productos: "18 artículos",
      ultimaCompra: "12/01/2026",
    },
    {
      id: "PROV-2403",
      name: "Lácteos del Norte",
      initials: "LN",
      email: "contacto@lacteos.com",
      phone: "+52 555 444 3322",
      conditions: "Net 15",
      conditionsType: "blue",
      balance: "$450.00",
      status: "Vence hoy",
      statusType: "danger",
      productos: "15 artículos",
      ultimaCompra: "10/01/2026",
    },
    {
      id: "PROV-2404",
      name: "Carnes Premium",
      initials: "CP",
      email: "admin@carnes.com",
      phone: "+52 555 111 2233",
      conditions: "Net 30",
      conditionsType: "blue",
      balance: "$2,100.00",
      status: "Vence en 12 días",
      statusType: "warning",
      productos: "32 artículos",
      ultimaCompra: "08/01/2026",
    },
    {
      id: "PROV-2405",
      name: "Panificadora El Sol",
      initials: "PS",
      email: "pedidos@elsol.com",
      phone: "+52 555 666 7788",
      conditions: "Contado",
      conditionsType: "green",
      balance: "$120.00",
      status: "Vencido",
      statusType: "danger",
      productos: "9 artículos",
      ultimaCompra: "05/01/2026",
    },
  ];

  const generateMoreSuppliers = () => {
    const more = [];
    for (let i = 6; i <= 50; i++) {
        more.push({
            id: `PROV-${2400 + i}`,
            name: `Proveedor ${i}`,
            initials: `P${i}`,
            email: `proveedor${i}@ejemplo.com`,
            phone: `+52 555 000 ${i.toString().padStart(4, '0')}`,
            conditions: i % 3 === 0 ? "Net 30" : "Contado",
            conditionsType: i % 3 === 0 ? "blue" : "green",
            balance: i % 2 === 0 ? `$${(i * 100).toFixed(2)}` : "$0.00",
            status: i % 2 === 0 ? "Vence pronto" : "Al corriente",
            statusType: i % 2 === 0 ? "warning" : "success",
            productos: `${10 + i} artículos`,
            ultimaCompra: "01/02/2026"
        });
    }
    return [...initialSuppliers, ...more];
  };

  const [suppliers] = useState(generateMoreSuppliers());

  // Filtrar proveedores según búsqueda y filtros
  const filteredSuppliers = suppliers.filter((supplier) => {
    // Filtro de búsqueda
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      supplier.name.toLowerCase().includes(searchLower) ||
      supplier.id.toLowerCase().includes(searchLower) ||
      supplier.email.toLowerCase().includes(searchLower) ||
      supplier.phone.includes(searchTerm) ||
      supplier.productos.toLowerCase().includes(searchLower) ||
      supplier.ultimaCompra.includes(searchTerm);

    if (!matchesSearch) return false;

    // Filtro por estado (Todos, Con Deuda, Activos)
    if (activeFilter === "Con Deuda") {
      return supplier.balance !== "$0.00";
    }
    if (activeFilter === "Activos") {
      return supplier.balance === "$0.00" || supplier.status === "Al corriente";
    }

    return true;
  });

  // Actualizar página cuando cambia la búsqueda o filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeFilter]);

  const displayedSuppliers = filteredSuppliers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const filteredTotal = filteredSuppliers.length;

  const handleExport = () => {
    try {
      // Preparar los datos para el Excel
      const data = filteredSuppliers.map((s) => {
        // Extraer el valor numérico del balance (remover $ y comas)
        const balanceValue =
          parseFloat(s.balance.replace("$", "").replace(",", "")) || 0;

        return {
          ID: s.id,
          Proveedor: s.name,
          Email: s.email,
          Teléfono: s.phone,
          Condiciones: s.conditions,
          Productos: s.productos,
          "Última Compra": s.ultimaCompra,
          "Saldo Pendiente": balanceValue,
          Estado: s.status,
        };
      });

      // Crear un libro de trabajo
      const wb = XLSX.utils.book_new();

      // Crear una hoja de cálculo desde los datos
      const ws = XLSX.utils.json_to_sheet(data);

      // Ajustar el ancho de las columnas
      const columnWidths = [
        { wch: 15 }, // ID
        { wch: 30 }, // Proveedor
        { wch: 30 }, // Email
        { wch: 18 }, // Teléfono
        { wch: 15 }, // Condiciones
        { wch: 15 }, // Productos
        { wch: 15 }, // Última Compra
        { wch: 18 }, // Saldo Pendiente
        { wch: 20 }, // Estado
      ];
      ws["!cols"] = columnWidths;

      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(wb, ws, "Proveedores");

      // Generar el archivo Excel
      const fileName = `proveedores_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      Swal.fire(
        "Éxito",
        "Proveedores exportados correctamente en formato Excel",
        "success",
      );
    } catch (error) {
      console.error("Error al exportar:", error);
      Swal.fire("Error", "No se pudo exportar los proveedores", "error");
    }
  };

  const handleNewSupplier = () => {
    setIsNewSupplierModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsNewSupplierModalOpen(false);
    setNewSupplierForm({
      name: "",
      email: "",
      phone: "",
      conditions: "Contado",
      balance: "0.00",
    });
    setNewConditionInput("");
    setShowNewConditionInput(false);
  };

  const handleFormChange = (field, value) => {
    setNewSupplierForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAddNewCondition = () => {
    if (
      newConditionInput.trim() &&
      !availableConditions.includes(newConditionInput.trim())
    ) {
      setAvailableConditions((prev) => [...prev, newConditionInput.trim()]);
      setNewSupplierForm((prev) => ({
        ...prev,
        conditions: newConditionInput.trim(),
      }));
      setNewConditionInput("");
      setShowNewConditionInput(false);
    }
  };

  const handleDeleteCondition = (conditionToDelete) => {
    if (availableConditions.length > 1) {
      setAvailableConditions((prev) =>
        prev.filter((cond) => cond !== conditionToDelete),
      );
      if (newSupplierForm.conditions === conditionToDelete) {
        setNewSupplierForm((prev) => ({
          ...prev,
          conditions: availableConditions[0],
        }));
      }
    } else {
      Swal.fire("Error", "Debe mantener al menos una condición", "error");
    }
  };

  const handleSubmitSupplier = () => {
    // Basic validation
    if (!newSupplierForm.name.trim()) {
      Swal.fire("Error", "El nombre del proveedor es obligatorio", "error");
      return;
    }
    if (!newSupplierForm.email.trim()) {
      Swal.fire("Error", "El email es obligatorio", "error");
      return;
    }

    // Here you would typically send the data to your backend
    console.log("Nuevo proveedor:", newSupplierForm);
    Swal.fire("Éxito", "Proveedor agregado correctamente", "success");
    handleCloseModal();
  };

  return (
    <div className="suppliers-page">
      {/* Top Navigation Bar */}
      <header className="suppliers-header">
        <div className="suppliers-header-content">
          <div className="flex items-center gap-8">
            {/* Search Bar */}
            <div className="suppliers-search-container">
              <span className="material-symbols-outlined suppliers-search-icon">
                search
              </span>
              <input
                className="suppliers-search-input"
                placeholder="Buscar proveedores..."
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="suppliers-main">
        {/* Page Heading */}
        <div className="suppliers-page-heading">
          <div>
            <nav className="suppliers-breadcrumb">
              <span>Dashboard</span>
              <span>/</span>
              <span className="suppliers-breadcrumb-active">
                Gestión de Proveedores
              </span>
            </nav>
            <h1 className="suppliers-title">Proveedores</h1>
          </div>
          <div className="suppliers-actions">
            <button 
              onClick={() => {
                document.documentElement.classList.toggle('dark');
                localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
              }}
              className="suppliers-btn-mode"
            >
              <span className="material-icons-outlined text-[18px]">dark_mode</span>
              <span>Modo Oscuro</span>
            </button>
            <button className="suppliers-btn-export" onClick={handleExport}>
              <span className="material-symbols-outlined">file_download</span>
              Exportar
            </button>
            <button className="suppliers-btn-new" onClick={handleNewSupplier}>
              <span className="material-symbols-outlined">add</span>
              Nuevo Proveedor
            </button>
          </div>
        </div>

        {/* KPI Stats */}
        <div className="suppliers-kpi-grid">
          <div className="suppliers-kpi-card">
            <p className="suppliers-kpi-label">Total Proveedores</p>
            <div className="suppliers-kpi-value-row">
              <p className="suppliers-kpi-value">42</p>
              <span className="suppliers-kpi-badge suppliers-kpi-badge-success">
                +12%
              </span>
            </div>
            <div className="suppliers-kpi-progress">
              <div
                className="suppliers-kpi-progress-bar suppliers-kpi-progress-primary"
                style={{ width: "65%" }}
              ></div>
            </div>
          </div>

          <div className="suppliers-kpi-card">
            <p className="suppliers-kpi-label">Pedidos en Tránsito</p>
            <div className="suppliers-kpi-value-row">
              <p className="suppliers-kpi-value">8</p>
              <span className="suppliers-kpi-badge suppliers-kpi-badge-neutral">
                0%
              </span>
            </div>
            <div className="suppliers-kpi-progress">
              <div
                className="suppliers-kpi-progress-bar suppliers-kpi-progress-amber"
                style={{ width: "25%" }}
              ></div>
            </div>
          </div>

          <div className="suppliers-kpi-card">
            <p className="suppliers-kpi-label">Cuentas por Pagar (Total)</p>
            <div className="suppliers-kpi-value-row">
              <p className="suppliers-kpi-value">$12,450.00</p>
              <span className="suppliers-kpi-badge suppliers-kpi-badge-danger">
                -5%
              </span>
            </div>
            <div className="suppliers-kpi-progress">
              <div
                className="suppliers-kpi-progress-bar suppliers-kpi-progress-rose"
                style={{ width: "80%" }}
              ></div>
            </div>
          </div>

          <div className="suppliers-kpi-card">
            <p className="suppliers-kpi-label">Próximos Vencimientos</p>
            <div className="suppliers-kpi-value-row">
              <p className="suppliers-kpi-value">3</p>
              <span className="suppliers-kpi-badge suppliers-kpi-badge-success">
                +1%
              </span>
            </div>
            <div className="suppliers-kpi-progress">
              <div
                className="suppliers-kpi-progress-bar suppliers-kpi-progress-emerald"
                style={{ width: "15%" }}
              ></div>
            </div>
          </div>
        </div>

        {/* Table Controls */}
        <div className="suppliers-table-container">
          <div className="suppliers-table-controls">
            <div className="suppliers-filters">
              <button
                className={`suppliers-filter-btn ${activeFilter === "Todos" ? "active" : ""}`}
                onClick={() => setActiveFilter("Todos")}
              >
                Todos
              </button>
              <button
                className={`suppliers-filter-btn ${activeFilter === "Con Deuda" ? "active" : ""}`}
                onClick={() => setActiveFilter("Con Deuda")}
              >
                Con Deuda
              </button>
              <button
                className={`suppliers-filter-btn ${activeFilter === "Activos" ? "active" : ""}`}
                onClick={() => setActiveFilter("Activos")}
              >
                Activos
              </button>
            </div>
          </div>

          {/* Main Table */}
          <div className="suppliers-table-wrapper">
            <table className="suppliers-table">
              <thead>
                <tr className="suppliers-table-header">
                  <th className="suppliers-table-th">Proveedor</th>
                  <th className="suppliers-table-th">Contacto</th>
                  <th className="suppliers-table-th">Condiciones</th>
                  <th className="suppliers-table-th">Productos</th>
                  <th className="suppliers-table-th">Última Compra</th>
                  <th className="suppliers-table-th suppliers-table-th-right">
                    Saldo Pendiente
                  </th>
                  <th className="suppliers-table-th suppliers-table-th-center">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="suppliers-table-body">
                {displayedSuppliers.length > 0 ? (
                  displayedSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="suppliers-table-row">
                      <td className="suppliers-table-td">
                        <div className="suppliers-table-supplier-info">
                          <div className="suppliers-table-avatar">
                            {supplier.initials}
                          </div>
                          <div>
                            <p className="suppliers-table-supplier-name">
                              {supplier.name}
                            </p>
                            <p className="suppliers-table-supplier-id">
                              ID: {supplier.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="suppliers-table-td">
                        <p className="suppliers-table-contact-email">
                          {supplier.email}
                        </p>
                        <p className="suppliers-table-contact-phone">
                          {supplier.phone}
                        </p>
                      </td>
                      <td className="suppliers-table-td">
                        <span
                          className={`suppliers-table-badge suppliers-table-badge-${supplier.conditionsType}`}
                        >
                          {supplier.conditions}
                        </span>
                      </td>
                      <td className="suppliers-table-td">
                        <p className="suppliers-table-products">
                          {supplier.productos}
                        </p>
                      </td>
                      <td className="suppliers-table-td">
                        <p className="suppliers-table-last-purchase">
                          {supplier.ultimaCompra}
                        </p>
                      </td>
                      <td className="suppliers-table-td suppliers-table-td-right">
                        <p
                          className={`suppliers-table-balance ${supplier.balance === "$0.00" ? "suppliers-table-balance-zero" : "suppliers-table-balance-amount"}`}
                        >
                          {supplier.balance}
                        </p>
                        <p className="suppliers-table-status">
                          {supplier.status}
                        </p>
                      </td>
                      <td className="suppliers-table-td">
                        <div className="suppliers-table-actions">
                          <button className="suppliers-table-action-btn">
                            <span className="material-symbols-outlined">
                              edit
                            </span>
                          </button>
                          <button className="suppliers-table-action-btn">
                            <span className="material-symbols-outlined">
                              visibility
                            </span>
                          </button>
                          <button className="suppliers-table-action-btn">
                            <span className="material-symbols-outlined">
                              more_vert
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="7"
                      style={{ textAlign: "center", padding: "32px" }}
                    >
                      <p style={{ color: "#6b7280", fontSize: "14px" }}>
                        No se encontraron proveedores que coincidan con la
                        búsqueda.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="suppliers-pagination">
            <p className="suppliers-pagination-info">
              Mostrando {displayedSuppliers.length} de {filteredTotal}{" "}
              proveedores
              {searchTerm && ` (filtrados de ${totalSuppliers} total)`}
            </p>
            <div className="suppliers-pagination-controls">
              <button
                className="suppliers-pagination-btn"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* New Supplier Modal */}
      <Modal
        isOpen={isNewSupplierModalOpen}
        onClose={handleCloseModal}
        raw={true}
      >
        <div className="supplier-modal-container">
          <div className="supplier-modal-content">
            <div className="supplier-modal-header">
              <h1 className="supplier-modal-title">
                Nuevo Proveedor
              </h1>
              <button
                className="supplier-modal-close"
                onClick={handleCloseModal}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="supplier-modal-body">
              <div className="supplier-input-group">
                <label className="supplier-label">
                  Proveedor
                </label>
                <input
                  className="supplier-input"
                  placeholder="Nombre del proveedor"
                  type="text"
                  value={newSupplierForm.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                />
              </div>

              <div className="supplier-input-group">
                <label className="supplier-label">
                  Contacto
                </label>
                <div className="supplier-form-row">
                  <input
                    className="supplier-input"
                    placeholder="Email del contacto"
                    type="email"
                    value={newSupplierForm.email}
                    onChange={(e) => handleFormChange("email", e.target.value)}
                  />
                  <input
                    className="supplier-input"
                    placeholder="Teléfono"
                    type="tel"
                    value={newSupplierForm.phone}
                    onChange={(e) => handleFormChange("phone", e.target.value)}
                  />
                </div>
              </div>

                <div className="supplier-input-group">
                  <label className="supplier-label">
                    Condiciones
                  </label>
                  <div className="supplier-select-wrapper">
                    <select
                      className="supplier-select"
                      value={newSupplierForm.conditions}
                      onChange={(e) =>
                        handleFormChange("conditions", e.target.value)
                      }
                    >
                      {availableConditions.map((condition) => (
                        <option key={condition} value={condition}>
                          {condition}
                        </option>
                      ))}
                    </select>
                    <div className="supplier-select-icon">
                      <span className="material-symbols-outlined">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>

                <div className="conditions-area">
                  <div className="conditions-tags">
                    {availableConditions.map((condition) => (
                      <div
                        key={condition}
                        className="condition-chip"
                      >
                        <span className="font-display">
                          {condition}
                        </span>
                        <button
                          className="condition-chip-remove"
                          onClick={() => handleDeleteCondition(condition)}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "14px" }}
                          >
                            close
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>

                  {!showNewConditionInput ? (
                    <button
                      className="btn-add-new-condition"
                      onClick={() => setShowNewConditionInput(true)}
                    >
                      <span className="material-symbols-outlined mr-2">add</span>
                      <span className="font-display">
                        Agregar condición
                      </span>
                    </button>
                  ) : (
                    <div className="supplier-input-group animate-in fade-in slide-in-from-top-1 duration-200">
                      <input
                        className="supplier-input"
                        placeholder="Ej: Net 45, 50% anticipo"
                        type="text"
                        value={newConditionInput}
                        onChange={(e) => setNewConditionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddNewCondition();
                          } else if (e.key === "Escape") {
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
                  )}
                </div>

              <div className="supplier-input-group">
                <label className="supplier-label">
                  Saldo Pendiente
                </label>
                <div className="supplier-input-prefix">
                  <span className="supplier-currency-symbol">
                    $
                  </span>
                  <input
                    className="supplier-input supplier-input-with-prefix"
                    type="number"
                    step="0.01"
                    min="0"
                    value={newSupplierForm.balance}
                    onChange={(e) => handleFormChange("balance", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="supplier-modal-footer">
              <button
                className="supplier-btn-cancel"
                onClick={handleCloseModal}
              >
                Cancelar
              </button>
              <button
                className="supplier-btn-submit"
                onClick={handleSubmitSupplier}
              >
                Agregar Proveedor
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Suppliers;
