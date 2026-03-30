import { useNavigate } from "react-router-dom";

export const UserManager = () => {
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const fingerprintInputRef = React.useRef(null);

  const defaultPermissions = {
    cajero: {
      pos: true,
      inventory: false,
      reports: false,
      reset_cash: false,
      logout: false,
      cut: true,
      block: true,
      require_check_in: false,
    },
    gerente: {
      pos: true,
      inventory: true,
      reports: true,
      reset_cash: true,
      logout: true,
      cut: true,
      block: true,
      require_check_in: false,
    },
    admin: {
      pos: true,
      inventory: true,
      reports: true,
      reset_cash: true,
      logout: true,
      cut: true,
      block: true,
      require_check_in: false,
    },
  };

  const [formData, setFormData] = useState({
    name: "",
    last_name: "",
    role: "cajero",
    pin: "",
    auth_method: "pin",
    fingerprint_data: "",
    permissions: defaultPermissions.cajero,
  });

  useEffect(() => {
    if (isCapturing && fingerprintInputRef.current) {
      fingerprintInputRef.current.focus();
    }
  }, [isCapturing]);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const data = await staffService.getStaff();
      setStaff(data);
    } catch (error) {
      console.error("Error al cargar empleados:", error);
      Swal.fire("Error", "No se pudieron cargar los empleados", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      last_name: "",
      role: "cajero",
      pin: "",
      auth_method: "pin",
      fingerprint_data: "",
      permissions: defaultPermissions.cajero,
    });
    setEditingStaff(null);
    setIsCapturing(false);
  };

  const handleOpenModal = (staffMember = null) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({
        name: staffMember.name,
        last_name: staffMember.last_name || "",
        role: staffMember.role,
        pin: staffMember.pin,
        auth_method: staffMember.auth_method || "pin",
        fingerprint_data: staffMember.fingerprint_data || "",
        permissions:
          staffMember.permissions ||
          defaultPermissions[staffMember.role || "cajero"],
      });
    } else {
      resetForm();
    }
    setShowModal(true);
    setIsCapturing(false);
  };

  const handleFingerprintScan = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.target.value.length > 5) {
        let scannedCode = e.target.value;
        setFormData((prev) => ({ ...prev, fingerprint_data: scannedCode }));
        setIsCapturing(false);
        Swal.fire({
          title: "¡Huella Capturada!",
          text: "La firma de huella ha sido leída correctamente. No olvides guardar el empleado.",
          icon: "success",
          timer: 2500,
          showConfirmButton: false,
        });
      }
      e.target.value = "";
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.pin) {
      Swal.fire("Error", "Nombre y PIN son obligatorios", "warning");
      return;
    }

    if (formData.pin.length < 4 || formData.pin.length > 6) {
      Swal.fire("Error", "El PIN debe tener entre 4 y 6 dígitos", "warning");
      return;
    }

    try {
      // Validar PIN duplicado
      const isDuplicate = await staffService.checkPinDuplicate(
        formData.pin,
        editingStaff?.id,
      );

      if (isDuplicate) {
        Swal.fire({
          title: "PIN Duplicado",
          text: "Este PIN ya está siendo usado por otro empleado. Por razones de seguridad, cada empleado debe tener un PIN único.",
          icon: "error",
        });
        return;
      }

      if (editingStaff) {
        await staffService.updateStaff(editingStaff.id, formData);
        Swal.fire(
          "Actualizado",
          "Empleado actualizado correctamente",
          "success",
        );
      } else {
        await staffService.createStaff(formData);
        Swal.fire("Creado", "Empleado creado correctamente", "success");
      }
      handleCloseModal();
      loadStaff();
    } catch (error) {
      console.error("Error al guardar:", error);

      // Manejar específicamente el error de PIN duplicado (código 23505 de Postgres)
      if (error.code === "23505" || error.message?.includes("duplicate key")) {
        Swal.fire({
          title: "¡PIN ya en uso!",
          html: `El PIN <strong>${formData.pin}</strong> ya está registrado para otro empleado.<br><br>Por favor, asigna un código diferente para mantener la seguridad.`,
          icon: "warning",
          confirmButtonColor: "#3085d6",
        });
      } else {
        Swal.fire({
          title: "Error de Guardado",
          text:
            "No pudimos registrar los cambios: " +
            (error.message || "Error de conexión"),
          icon: "error",
        });
      }
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: "¿Eliminar empleado?",
      text: `Se eliminará a "${name}" del sistema`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await staffService.deleteStaff(id);
        Swal.fire("Eliminado", "Empleado eliminado", "success");
        loadStaff();
      } catch (error) {
        console.error("Error al eliminar:", error);
        Swal.fire("Error", "No se pudo eliminar el empleado", "error");
      }
    }
  };

  const toggleActive = async (staffMember) => {
    try {
      await staffService.updateStaff(staffMember.id, {
        ...staffMember,
        active: !staffMember.active,
      });
      loadStaff();
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  };

  const getRoleBadge = (role) => {
    const roles = {
      admin: { icon: "⭐", label: "Administrador", class: "role-admin" },
      gerente: { icon: "👔", label: "Gerente", class: "role-gerente" },
      cajero: { icon: "🛒", label: "Cajero", class: "role-cajero" },
    };
    return roles[role] || roles.cajero;
  };

  if (loading)
    return <div className="loading-state">Cargando empleados...</div>;

  return (
    <div className="user-manager-container">
      <header className="manager-header">
        <div>
          <div className="header-badge">Control de Personal</div>
          <h2>Gestión de Usuarios</h2>
          <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>
            Administra los accesos y roles del sistema
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/configuracion")}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
          >
            <span className="material-icons-outlined text-[18px]">arrow_back</span>
            <span>Regresar</span>
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
            <span className="material-icons-outlined text-[18px]">
              dark_mode
            </span>
            <span>Modo Oscuro</span>
          </button>
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            + Nuevo Empleado
          </button>
        </div>
      </header>

      <div className="user-list-card">
        {staff.length === 0 ? (
          <div className="empty-state">
            <p>No hay empleados registrados</p>
            <small>Haz clic en "Nuevo Empleado" para agregar uno</small>
          </div>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>PIN</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const roleBadge = getRoleBadge(s.role);
                return (
                  <tr key={s.id}>
                    <td>
                      {s.name} {s.last_name}
                    </td>
                    <td>
                      <span className={`role-badge ${roleBadge.class}`}>
                        {roleBadge.icon} {roleBadge.label}
                      </span>
                    </td>
                    <td>
                      <code className="pin-display">****</code>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${s.active ? "active" : "inactive"}`}
                        onClick={() => toggleActive(s)}
                        style={{ cursor: "pointer" }}
                      >
                        {s.active ? "✓ Activo" : "✗ Inactivo"}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        className="btn-edit"
                        onClick={() => handleOpenModal(s)}
                      >
                        Editar
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(s.id, s.name)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingStaff ? "Editar Empleado" : "Nuevo Empleado"}</h3>
            <form onSubmit={handleSubmit}>
              <div
                className="form-group-row"
                style={{ display: "flex", gap: "1rem" }}
              >
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Nombre *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Juan"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Apellido</label>
                  <input
                    type="text"
                    placeholder="Ej: Pérez"
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                  />
                </div>
              </div>
              <div
                className="form-group-row"
                style={{ display: "flex", gap: "1rem" }}
              >
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setFormData({
                        ...formData,
                        role: newRole,
                        permissions: defaultPermissions[newRole],
                      });
                    }}
                  >
                    <option value="cajero">🛒 Cajero (Solo ventas)</option>
                    <option value="gerente">
                      👔 Gerente (Ventas + Reportes)
                    </option>
                    <option value="admin">
                      ⭐ Administrador (Acceso total)
                    </option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Método de Acceso</label>
                  <select
                    value={formData.auth_method}
                    onChange={(e) =>
                      setFormData({ ...formData, auth_method: e.target.value })
                    }
                  >
                    <option value="pin">Solo PIN</option>
                    <option value="fingerprint">Solo Huella</option>
                    <option value="both">PIN o Huella</option>
                  </select>
                </div>
              </div>
              <div
                className="form-group-row"
                style={{ display: "flex", gap: "1rem" }}
              >
                <div className="form-group" style={{ flex: 1 }}>
                  <label>PIN de acceso * (4-6 dígitos)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    maxLength="6"
                    placeholder="Ej: 1234"
                    value={formData.pin}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pin: e.target.value.replace(/\D/g, ""),
                      })
                    }
                  />
                </div>
                {(formData.auth_method === "fingerprint" ||
                  formData.auth_method === "both") && (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Huella Biométrica</label>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                        height: "42px",
                      }}
                    >
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setIsCapturing(true)}
                        style={{
                          backgroundColor: isCapturing
                            ? "#f59e0b"
                            : "var(--dm-bg-secondary)",
                          color: isCapturing
                            ? "white"
                            : "var(--dm-text-primary)",
                          borderColor: isCapturing
                            ? "#f59e0b"
                            : "var(--dm-border)",
                          flex: 1,
                          height: "100%",
                          transition: "all 0.3s ease",
                        }}
                      >
                        {isCapturing
                          ? "Esperando huella..."
                          : formData.fingerprint_data
                            ? "Re-capturar Huella"
                            : "Registrar Huella"}
                      </button>
                      {formData.fingerprint_data && !isCapturing && (
                        <span
                          style={{
                            color: "#3b82f6",
                            fontSize: "1.2rem",
                            display: "flex",
                          }}
                          title="Huella Registrada"
                        >
                          <span className="material-icons-outlined">
                            check_circle
                          </span>
                        </span>
                      )}
                      <input
                        type="password"
                        ref={fingerprintInputRef}
                        style={{
                          position: "absolute",
                          opacity: 0,
                          height: 0,
                          width: 0,
                          padding: 0,
                          border: "none",
                        }}
                        onKeyDown={handleFingerprintScan}
                        onBlur={() => {
                          if (isCapturing) fingerprintInputRef.current?.focus();
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div
                className="permissions-section"
                style={{
                  marginTop: "1.5rem",
                  borderTop: "1px solid var(--dm-border)",
                  paddingTop: "1rem",
                }}
              >
                <h4
                  style={{
                    marginBottom: "1rem",
                    color: "var(--dm-text-primary)",
                  }}
                >
                  Permisos del Sistema
                </h4>
                <div
                  className="permissions-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.8rem",
                  }}
                >
                  {Object.entries({
                    pos: "Punto de Venta",
                    inventory: "Inventario",
                    reports: "Reportes",
                    reset_cash: "Reiniciar Caja",
                    logout: "Cerrar Sesión",
                    cut: "Corte de Caja",
                    block: "Bloquear Pantalla",
                    require_check_in: "🔒 Requiere Entrada (Reloj)",
                  }).map(([key, label]) => (
                    <div
                      key={key}
                      className="permission-toggle"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        id={`perm-${key}`}
                        checked={!!formData.permissions?.[key]}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            permissions: {
                              ...formData.permissions,
                              [key]: e.target.checked,
                            },
                          });
                        }}
                      />
                      <label
                        htmlFor={`perm-${key}`}
                        style={{
                          cursor: "pointer",
                          margin: 0,
                          color: "var(--dm-text-primary)",
                          textTransform: "none",
                          letterSpacing: "normal",
                        }}
                      >
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  {editingStaff ? "Guardar Cambios" : "Crear Empleado"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
