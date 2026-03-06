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

  // Dashboard state
  const [licenses, setLicenses] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientCode, setNewClientCode] = useState("");
  const [newClientDuration, setNewClientDuration] = useState("30");
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");

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
          id, code, expires_at, created_at, used_by,
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

      const { error } = await supabase.from("invitation_codes").insert([
        {
          code: newClientCode.toUpperCase(),
          expires_at: new Date(
            Date.now() + duration * 24 * 60 * 60 * 1000,
          ).toISOString(),
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

  const handleReactivate = async (id, currentExpiresAt) => {
    const isExpired = new Date(currentExpiresAt) < new Date();
    // Default extend by 30 days
    const newDate = new Date();
    // If not expired yet, extend from current expiry, if expired, start from today
    const baseDate = isExpired ? new Date() : new Date(currentExpiresAt);
    baseDate.setDate(baseDate.getDate() + 30); // add 30 days

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

  // --- DASHBOARD SCREEN ---
  const activeLicenses = licenses.filter(
    (l) => new Date(l.expires_at) > new Date(),
  ).length;
  const expiredLicenses = licenses.filter(
    (l) => new Date(l.expires_at) <= new Date(),
  ).length;

  return (
    <div className="superadmin-dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="superadmin-sidebar">
        <div className="sidebar-logo">
          <img src={logo} alt="Nexum" />
          <span>SuperAdmin</span>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item active">
            <i className="la la-server"></i> Gestión de Licencias
          </button>
          <button className="nav-item" onClick={handleLogout}>
            <i className="la la-sign-out"></i> Cerrar Sesión
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="superadmin-main">
        <header className="superadmin-header">
          <h2>Panel de Control General</h2>
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
              <h3>{activeLicenses}</h3>
              <span>Licencias Activas</span>
            </div>
          </div>
          <div className="metric-card glass-panel error">
            <div className="metric-icon red">
              <i className="la la-times-circle"></i>
            </div>
            <div className="metric-data">
              <h3 className="text-red">{expiredLicenses}</h3>
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
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic) => {
                  const isExpired = new Date(lic.expires_at) < new Date();
                  return (
                    <tr key={lic.id} className={isExpired ? "row-expired" : ""}>
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
                          <span className="expired-badge ml-2">Vencida</span>
                        )}
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
                        <button
                          className={`reactivate-btn ${
                            isExpired ? "gold-pulse" : "outline"
                          }`}
                          onClick={() =>
                            handleReactivate(lic.id, lic.expires_at)
                          }
                        >
                          <i className="la la-sync"></i>{" "}
                          {isExpired ? "Reactivar (30d)" : "Extender (30d)"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="superadmin-modal-overlay">
          <div className="superadmin-modal glass-panel">
            <h3>Generar Nuevo Acceso</h3>
            <p className="sub-text">
              Crea un código de licencia para un cliente nuevo.
            </p>

            <form onSubmit={handleCreateClient}>
              <div className="input-group mt-4">
                <label>Código de Invitación (Ej. CLIENTEX-2026)</label>
                <input
                  type="text"
                  value={newClientCode}
                  onChange={(e) =>
                    setNewClientCode(
                      e.target.value.toUpperCase().replace(/\s/g, "-"),
                    )
                  }
                  required
                  placeholder="NUEVO-CLIENTE"
                />
              </div>
              <div className="input-group">
                <label>Duración Inicial</label>
                <select
                  value={newClientDuration}
                  onChange={(e) => setNewClientDuration(e.target.value)}
                >
                  <option value="30">1 Mes (30 días)</option>
                  <option value="90">3 Meses (90 días)</option>
                  <option value="180">6 Meses (180 días)</option>
                  <option value="365">1 Año (365 días)</option>
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
                  {creating ? "Generando..." : "Generar Licencia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
