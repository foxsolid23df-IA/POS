import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import "./SuperAdminPortal.css";
import logo from "../../assets/logo.png";

export const SuperAdminPortal = () => {
  const [session, setSession] = useState(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Navigation state
  const [activeTab, setActiveTab] = useState("licenses"); // licenses, admins, preferences

  // Dashboard / Licenses state
  const [licenses, setLicenses] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientCode, setNewClientCode] = useState("");
  const [newClientDuration, setNewClientDuration] = useState("30");
  const [newClientLicenseType, setNewClientLicenseType] = useState("monocaja");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");

  // Edit License state
  const [showEditLicenseModal, setShowEditLicenseModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState(null);
  const [editLicenseType, setEditLicenseType] = useState("monocaja");
  const [updatingLicense, setUpdatingLicense] = useState(false);
  const [editLicenseError, setEditLicenseError] = useState("");

  // Administrators state
  const [admins, setAdmins] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [adminActionError, setAdminActionError] = useState("");

  // Preferences state
  const [newMasterPassword, setNewMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [pwsError, setPwsError] = useState("");
  const [pwsSuccess, setPwsSuccess] = useState("");

  useEffect(() => {
    checkSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) verifySuperAdmin();
    });
    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setSession(session);
    if (session) {
      await verifySuperAdmin();
    } else {
      setLoading(false);
    }
  };

  const verifySuperAdmin = async () => {
    try {
      const { data, error } = await supabase.rpc("is_super_admin");
      if (error) throw error;
      if (data) {
        setIsSuperAdmin(true);
        loadLicenses();
        loadAdmins();
      } else {
        setIsSuperAdmin(false);
      }
    } catch (error) {
      console.error("Error verifying super admin:", error);
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const loadLicenses = async () => {
    try {
      const { data, error } = await supabase
        .from("invitation_codes")
        .select(
          `
          id, code, expires_at, created_at, used_by, license_type,
          profiles (store_name, full_name)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching licenses:", error);
        return;
      }
      setLicenses(data || []);
    } catch (error) {
      console.error("Error in loadLicenses:", error);
    }
  };

  const loadAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from("super_admins")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAdmins(data || []);
    } catch (error) {
      console.error("Error loading admins:", error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err) {
      setLoginError(
        err.message === "Invalid login credentials"
          ? "Credenciales incorrectas"
          : err.message,
      );
      setLoading(false);
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setCreating(true);
    setActionError("");
    try {
      if (!newClientCode) throw new Error("Ingrese un nombre para el código");
      const duration = parseInt(newClientDuration);
      const maxRegisters = newClientLicenseType === "monocaja" ? 1 : 999;

      const { error } = await supabase.from("invitation_codes").insert([
        {
          code: newClientCode.toUpperCase(),
          expires_at: new Date(
            Date.now() + duration * 24 * 60 * 60 * 1000,
          ).toISOString(),
          license_type: newClientLicenseType,
          max_registers: maxRegisters,
        },
      ]);

      if (error) throw error;
      setShowCreateModal(false);
      setNewClientCode("");
      loadLicenses();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditLicense = (lic) => {
    setEditingLicense(lic);
    setEditLicenseType(lic.license_type || "monocaja");
    setEditLicenseError("");
    setShowEditLicenseModal(true);
  };

  const handleUpdateLicense = async (e) => {
    e.preventDefault();
    setUpdatingLicense(true);
    setEditLicenseError("");

    try {
      const maxRegisters = editLicenseType === "monocaja" ? 1 : 999;

      // 1. Actualizar el código de invitación
      const { error: codeError } = await supabase
        .from("invitation_codes")
        .update({ license_type: editLicenseType, max_registers: maxRegisters })
        .eq("id", editingLicense.id);

      if (codeError) throw codeError;
      // 2. Si el código ya fue usado por un cliente, también actualizar su perfil!
      if (editingLicense.used_by) {
        const { error: profileError } = await supabase.rpc(
          "admin_update_license",
          {
            p_profile_id: editingLicense.used_by,
            p_license_type: editLicenseType,
            p_max_registers: maxRegisters,
          }
        );

        if (profileError) throw profileError;
      }

      setShowEditLicenseModal(false);
      setEditingLicense(null);
      loadLicenses(); // Refrescar la tabla
      alert("Licencia actualizada correctamente.");
    } catch (err) {
      setEditLicenseError(err.message);
    } finally {
      setUpdatingLicense(false);
    }
  };

  const handleReactivate = async (id, currentExpiresAt) => {
    const isExpired = new Date(currentExpiresAt) < new Date();
    const baseDate = isExpired ? new Date() : new Date(currentExpiresAt);
    baseDate.setDate(baseDate.getDate() + 30);

    try {
      const { error } = await supabase
        .from("invitation_codes")
        .update({ expires_at: baseDate.toISOString() })
        .eq("id", id);

      if (error) throw error;
      loadLicenses();
    } catch (err) {
      alert("Error al reactivar: " + err.message);
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    setCreatingAdmin(true);
    setAdminActionError("");
    try {
      if (newAdminPassword.length < 6)
        throw new Error("La contraseña debe tener al menos 6 caracteres");

      // 1. Add to super_admins table FIRST (while current admin has permission)
      const { error: dbError } = await supabase
        .from("super_admins")
        .insert([{ email: newAdminEmail }]);

      if (dbError) throw dbError;

      // 2. SignUp the new admin
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newAdminEmail,
        password: newAdminPassword,
      });

      if (authError) {
        // Rollback DB entry if Auth fails
        await supabase.from("super_admins").delete().eq("email", newAdminEmail);
        throw authError;
      }

      setShowAdminModal(false);
      setNewAdminEmail("");
      setNewAdminPassword("");
      loadAdmins();
      alert("Administrador creado exitosamente.");
    } catch (err) {
      setAdminActionError(err.message);
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwsError("");
    setPwsSuccess("");

    if (newMasterPassword !== confirmPassword) {
      setPwsError("Las contraseñas no coinciden");
      return;
    }

    if (newMasterPassword.length < 6) {
      setPwsError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newMasterPassword,
      });
      if (error) throw error;
      setPwsSuccess("Contraseña actualizada correctamente.");
      setNewMasterPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwsError(err.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsSuperAdmin(false);
  };

  if (loading) {
    return (
      <div className="superadmin-loading">
        Verificando acceso de seguridad...
      </div>
    );
  }

  // --- LOGIN SCREEN ---
  if (!session || !isSuperAdmin) {
    return (
      <div className="superadmin-login-container">
        <div className="superadmin-bg-elements"></div>
        <div className="superadmin-login-card glass-panel">
          <div className="superadmin-logo-wrapper">
            <img src={logo} alt="Nexum POS" className="superadmin-logo" />
          </div>
          <h1 className="superadmin-title">Portal SuperAdmin</h1>
          <p className="superadmin-subtitle">
            Acceso restringido de alta seguridad
          </p>

          <form onSubmit={handleLogin} className="superadmin-form">
            <div className="input-group">
              <label>Correo Electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="superadmin@ejemplo.com"
              />
            </div>
            <div className="input-group">
              <label>Contraseña Maestra</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
            {loginError && <div className="superadmin-error">{loginError}</div>}

            <button
              type="submit"
              className="superadmin-btn primary-gold"
              disabled={loading}
            >
              <span className="btn-glow"></span>
              {loading ? "Verificando..." : "Acceder al Portal"}
            </button>
          </form>

          {session && !isSuperAdmin && (
            <div className="superadmin-warning mt-4 text-center">
              <p>Tu cuenta actual no tiene privilegios de SuperAdmin.</p>
              <button onClick={handleLogout} className="superadmin-logot-link">
                Cerrar sesión actual
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="superadmin-dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="superadmin-sidebar">
        <div className="sidebar-logo">
          <img src={logo} alt="Nexum" />
          <span>SuperAdmin</span>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === "licenses" ? "active" : ""}`}
            onClick={() => setActiveTab("licenses")}
          >
            <i className="la la-server"></i> Gestión de Licencias
          </button>
          <button
            className={`nav-item ${activeTab === "admins" ? "active" : ""}`}
            onClick={() => setActiveTab("admins")}
          >
            <i className="la la-user-shield"></i> Administradores
          </button>
          <button
            className={`nav-item ${
              activeTab === "preferences" ? "active" : ""
            }`}
            onClick={() => setActiveTab("preferences")}
          >
            <i className="la la-cog"></i> Preferencias
          </button>
          <div className="sidebar-spacer"></div>
          <button className="nav-item logout-nav" onClick={handleLogout}>
            <i className="la la-sign-out"></i> Cerrar Sesión
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="superadmin-main">
        {activeTab === "licenses" && (
          <>
            <header className="superadmin-header">
              <h2>Gestión de Licencias</h2>
              <button
                className="superadmin-btn default-blue"
                onClick={() => setShowCreateModal(true)}
              >
                <i className="la la-plus"></i> Nuevo Cliente
              </button>
            </header>

            {/* Metrics */}
            <div className="superadmin-metrics">
              <div className="metric-card glass-panel">
                <div className="metric-icon gold">
                  <i className="la la-users"></i>
                </div>
                <div className="metric-data">
                  <h3>{licenses.length}</h3>
                  <span>Total de Clientes</span>
                </div>
              </div>
              <div className="metric-card glass-panel">
                <div className="metric-icon blue">
                  <i className="la la-check-circle"></i>
                </div>
                <div className="metric-data">
                  <h3>
                    {
                      licenses.filter(
                        (l) => new Date(l.expires_at) > new Date(),
                      ).length
                    }
                  </h3>
                  <span>Licencias Activas</span>
                </div>
              </div>
              <div className="metric-card glass-panel error">
                <div className="metric-icon red">
                  <i className="la la-times-circle"></i>
                </div>
                <div className="metric-data">
                  <h3 className="text-red">
                    {
                      licenses.filter(
                        (l) => new Date(l.expires_at) <= new Date(),
                      ).length
                    }
                  </h3>
                  <span>Licencias Vencidas</span>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="superadmin-table-container glass-panel">
              <div className="table-header">
                <h3>Directorio de Licencias</h3>
              </div>
              <div className="table-wrapper">
                <table className="super-table">
                  <thead>
                    <tr>
                      <th>Código de Cliente</th>
                      <th>Tienda / Dueño</th>
                      <th>Fecha de Expiración</th>
                      <th>Licencia</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((lic) => {
                      const isExpired = new Date(lic.expires_at) < new Date();
                      return (
                        <tr
                          key={lic.id}
                          className={isExpired ? "row-expired" : ""}
                        >
                          <td className="code-cell">{lic.code}</td>
                          <td>
                            {lic.profiles ? (
                              <>
                                <strong>{lic.profiles.store_name}</strong>
                                <br />
                                <span className="text-sm sub-text">
                                  {lic.profiles.full_name}
                                </span>
                              </>
                            ) : (
                              <span className="sub-text italic">
                                Sin registrar aún
                              </span>
                            )}
                          </td>
                          <td>
                            {new Date(lic.expires_at).toLocaleDateString()}
                            {isExpired && (
                              <span className="expired-badge ml-2">
                                Vencida
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                lic.license_type === "monocaja"
                                  ? "badge-blue"
                                  : "badge-gold"
                              }`}
                            >
                              {lic.license_type === "multicajas"
                                ? "Multicajas"
                                : "Monocaja"}
                            </span>
                          </td>
                          <td>
                            <div
                              className={`status-indicator ${
                                isExpired ? "inactive" : "active"
                              }`}
                            ></div>
                            {isExpired ? "Inactiva" : "Activa"}
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                gap: "8px",
                                alignItems: "center",
                              }}
                            >
                              <button
                                className={`reactivate-btn ${
                                  isExpired ? "gold-pulse" : "outline"
                                }`}
                                onClick={() =>
                                  handleReactivate(lic.id, lic.expires_at)
                                }
                              >
                                <i className="la la-sync"></i>{" "}
                                {isExpired
                                  ? "Reactivar (30d)"
                                  : "Extender (30d)"}
                              </button>
                              <button
                                className="reactivate-btn outline"
                                title="Cambiar Licencia"
                                onClick={() => handleOpenEditLicense(lic)}
                                style={{ padding: "8px" }}
                              >
                                <i className="la la-edit"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === "admins" && (
          <>
            <header className="superadmin-header">
              <h2>Administradores del Portal</h2>
              <button
                className="superadmin-btn default-blue"
                onClick={() => setShowAdminModal(true)}
              >
                <i className="la la-user-plus"></i> Invitar Administrador
              </button>
            </header>

            <div className="superadmin-table-container glass-panel">
              <div className="table-wrapper">
                <table className="super-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Fecha de Alta</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((adm) => (
                      <tr key={adm.id}>
                        <td>{adm.email}</td>
                        <td>{new Date(adm.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="status-indicator active"></div>
                          Autorizado
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === "preferences" && (
          <div className="preferences-view">
            <header className="superadmin-header">
              <h2>Preferencias de Cuenta</h2>
            </header>

            <div className="preferences-grid">
              <div className="preferences-card glass-panel">
                <h3>Seguridad de la Cuenta</h3>
                <p className="sub-text">
                  Actualiza tu contraseña maestra para acceder al portal.
                </p>

                <form onSubmit={handleUpdatePassword} className="mt-6">
                  <div className="input-group">
                    <label>Nueva Contraseña</label>
                    <input
                      type="password"
                      value={newMasterPassword}
                      onChange={(e) => setNewMasterPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label>Confirmar Contraseña</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita la contraseña"
                      required
                    />
                  </div>

                  {pwsError && (
                    <div className="superadmin-error">{pwsError}</div>
                  )}
                  {pwsSuccess && (
                    <div className="superadmin-success">{pwsSuccess}</div>
                  )}

                  <button
                    type="submit"
                    className="superadmin-btn primary-gold"
                    disabled={updatingPassword}
                  >
                    {updatingPassword
                      ? "Guardando..."
                      : "Actualizar Contraseña"}
                  </button>
                </form>
              </div>

              <div className="preferences-card glass-panel info-card">
                <h3>Información de Sesión</h3>
                <div className="session-info-item">
                  <label>Email Actual:</label>
                  <span>{session?.user?.email}</span>
                </div>
                <div className="session-info-item">
                  <label>Rol:</label>
                  <span className="badge-gold">Super Administrador</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* License Modal */}
      {showCreateModal && (
        <div className="superadmin-modal-overlay">
          <div className="superadmin-modal glass-panel">
            <h3>Generar Nuevo Acceso</h3>
            <p className="sub-text">
              Crea un código de invitación para un cliente nuevo.
            </p>
            <form onSubmit={handleCreateClient}>
              <div className="input-group mt-4">
                <label>Código (Ej. CLIENTEX-2026)</label>
                <input
                  type="text"
                  value={newClientCode}
                  onChange={(e) =>
                    setNewClientCode(
                      e.target.value.toUpperCase().replace(/\s/g, "-"),
                    )
                  }
                  required
                />
              </div>
              <div className="input-group">
                <label>Duración</label>
                <select
                  value={newClientDuration}
                  onChange={(e) => setNewClientDuration(e.target.value)}
                >
                  <option value="30">1 Mes</option>
                  <option value="90">3 Meses</option>
                  <option value="180">6 Meses</option>
                  <option value="365">1 Año</option>
                </select>
              </div>
              <div className="input-group">
                <label>Tipo de Licencia</label>
                <select
                  value={newClientLicenseType}
                  onChange={(e) => setNewClientLicenseType(e.target.value)}
                >
                  <option value="monocaja">Monocaja (1 Caja)</option>
                  <option value="multicajas">Multicajas (Ilimitado)</option>
                </select>
              </div>
              {actionError && (
                <div className="superadmin-error">{actionError}</div>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="superadmin-btn outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="superadmin-btn primary-gold"
                  disabled={creating}
                >
                  {creating ? "Generando..." : "Generar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Modal */}
      {showAdminModal && (
        <div className="superadmin-modal-overlay">
          <div className="superadmin-modal glass-panel">
            <h3>Invitar Administrador</h3>
            <p className="sub-text">
              Crea una cuenta de acceso al portal sin registrar tienda.
            </p>
            <form onSubmit={handleCreateAdmin}>
              <div className="input-group mt-4">
                <label>Email del Nuevo Admin</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Contraseña Temporal</label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  required
                />
              </div>
              {adminActionError && (
                <div className="superadmin-error">{adminActionError}</div>
              )}
              <div className="modal-actions">
                <button
                  type="button"
                  className="superadmin-btn outline"
                  onClick={() => setShowAdminModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="superadmin-btn primary-gold"
                  disabled={creatingAdmin}
                >
                  {creatingAdmin ? "Creando..." : "Crear Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit License Modal */}
      {showEditLicenseModal && editingLicense && (
        <div className="superadmin-modal-overlay">
          <div className="superadmin-modal glass-panel">
            <h3>Cambiar Tipo de Licencia</h3>
            <p className="sub-text">
              Actualiza la licencia para:{" "}
              <strong>
                {editingLicense.profiles?.store_name || editingLicense.code}
              </strong>
              .
            </p>
            <form onSubmit={handleUpdateLicense}>
              <div className="input-group mt-4">
                <label>Tipo de Licencia</label>
                <select
                  value={editLicenseType}
                  onChange={(e) => setEditLicenseType(e.target.value)}
                >
                  <option value="monocaja">Monocaja (1 Caja)</option>
                  <option value="multicajas">Multicajas (Ilimitado)</option>
                </select>
              </div>

              <div
                className="setup-info"
                style={{
                  backgroundColor: "#ebf5ff",
                  color: "#1e40af",
                  border: "1px solid #bfdbfe",
                  padding: "16px",
                  borderRadius: "10px",
                  marginTop: "16px",
                  fontSize: "13px",
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "20px", color: "#3b82f6" }}
                >
                  info
                </span>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  Este cambio es <strong>inmediato</strong>. Al guardar, se
                  actualizarán los límites de cajas para el comercio,
                  permitiéndoles o restringiéndoles nuevas terminales sin cerrar
                  sesión.
                </p>
              </div>

              {editLicenseError && (
                <div className="superadmin-error">{editLicenseError}</div>
              )}
              <div className="modal-actions mt-4">
                <button
                  type="button"
                  className="superadmin-btn outline"
                  onClick={() => setShowEditLicenseModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="superadmin-btn primary-gold"
                  disabled={updatingLicense}
                >
                  {updatingLicense ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
