import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import "./PaymentMethodsConfig.css";

const PaymentMethodsConfig = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Para agregar uno nuevo
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodSatCode, setNewMethodSatCode] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Para editar uno existente
  const [editingMethod, setEditingMethod] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null); // ID del método con el menú abierto

  useEffect(() => {
    if (user?.id) {
      fetchPaymentMethods();
    }
  }, [user]);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Si no hay datos, inicializamos con los valores por defecto
      if (!data || data.length === 0) {
        await initializeDefaultMethods();
      } else {
        // Limpiamos duplicados si existen y ordenamos
        const cleaned = processPaymentMethods(data);
        setPaymentMethods(cleaned);
        
        // Elimiamos duplicados de la base de datos si se detectaron
        const idsToKeep = new Set(cleaned.map(m => m.id));
        const duplicates = data.filter(m => !idsToKeep.has(m.id));
        if (duplicates.length > 0) {
          cleanupDuplicates(duplicates.map(m => m.id));
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Función para procesar, limpiar duplicados y ordenar los métodos
  const processPaymentMethods = (methods) => {
    if (!methods || methods.length === 0) return [];
    
    // 1. Eliminar duplicados exactos por nombre (ignorando mayúsculas/minúsculas)
    const seen = new Set();
    const unique = [];
    
    // Primero buscamos el "Efectivo" principal
    const efectivoPrincipal = methods.find(m => m.name.toLowerCase() === "efectivo");
    if (efectivoPrincipal) {
      unique.push(efectivoPrincipal);
      seen.add("efectivo");
    }

    methods.forEach(method => {
      const nameKey = method.name.toLowerCase();
      if (!seen.has(nameKey)) {
        unique.push(method);
        seen.add(nameKey);
      } else if (method.id !== efectivoPrincipal?.id) {
        // Si es un duplicado, podríamos opcionalmente borrarlo de la DB
        console.log("Detectado duplicado de:", method.name);
      }
    });

    // 2. Ordenamos para que Efectivo siempre esté arriba, luego Tarjeta y Transferencia
    return unique.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      
      if (nameA === "efectivo") return -1;
      if (nameB === "efectivo") return 1;
      
      const priority = { "tarjeta": 1, "transferencia": 2 };
      const priorityA = priority[nameA] || 99;
      const priorityB = priority[nameB] || 99;
      
      if (priorityA !== priorityB) return priorityA - priorityB;
    });
  };

  const cleanupDuplicates = async (ids) => {
    try {
      console.log("Eliminando duplicados de la DB:", ids);
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .in("id", ids);
      if (error) console.error("Error al limpiar duplicados:", error);
    } catch (err) {
      console.error(err);
    }
  };

  const initializeDefaultMethods = async () => {
    const defaults = [
      { user_id: user.id, name: "Efectivo", is_active: true, sat_code: "01" },
      { user_id: user.id, name: "Tarjeta", is_active: true, sat_code: "04" },
      { user_id: user.id, name: "Transferencia", is_active: true, sat_code: "03" }
    ];

    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .insert(defaults)
        .select();

      if (error) throw error;
      setPaymentMethods(processPaymentMethods(data));
    } catch (err) {
      console.error("Error al inicializar métodos:", err);
      setError(err.message);
    }
  };

  const handleAddMethod = async (e) => {
    e.preventDefault();
    if (!newMethodName.trim()) return;

    try {
      setIsAdding(true);
      const { data, error } = await supabase
        .from("payment_methods")
        .insert([{ 
          user_id: user.id, 
          name: newMethodName.trim(), 
          is_active: true,
          sat_code: newMethodSatCode.trim() || null
        }])
        .select()
        .single();

      if (error) throw error;

      setPaymentMethods([...paymentMethods, data]);
      setNewMethodName("");
      setNewMethodSatCode("");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      setPaymentMethods(
        paymentMethods.map((m) =>
          m.id === id ? { ...m, is_active: !currentStatus } : m
        )
      );
    } catch (err) {
      console.error(err);
      setError("Error al cambiar estado");
    } finally {
      setActiveMenu(null);
    }
  };

  const handleUpdateMethod = async (e) => {
    e.preventDefault();
    if (!editingMethod.name.trim()) return;

    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({
          name: editingMethod.name.trim(),
          sat_code: editingMethod.sat_code?.trim() || null
        })
        .eq("id", editingMethod.id);

      if (error) throw error;

      setPaymentMethods(
        paymentMethods.map((m) =>
          m.id === editingMethod.id ? { ...m, name: editingMethod.name, sat_code: editingMethod.sat_code } : m
        )
      );
      setEditingMethod(null);
    } catch (err) {
      console.error(err);
      setError("Error al actualizar método de pago");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de eliminar el método de pago "${name}"?`)) return;
    
    // Sólo protegemos el Efectivo como método de sistema que no se puede borrar
    const isProtected = name.toLowerCase() === "efectivo";
    if (isProtected) {
      alert("No puedes eliminar el método de pago 'Efectivo' por ser fundamental para el sistema. Sólo puedes desactivarlo si es necesario.");
      return;
    }

    try {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setPaymentMethods(paymentMethods.filter((m) => m.id !== id));
    } catch (err) {
      console.error(err);
      setError("No se puede eliminar porque existen ventas o cortes vinculados a este método.");
    } finally {
      setActiveMenu(null);
    }
  };

  return (
    <div className="payment-config-container">
      <div className="payment-config-header">
        <button className="back-button" onClick={() => navigate("/configuracion")}>
          <span className="material-symbols-outlined">arrow_back</span>
          Regresar a Configuración
        </button>
        <h2>Formas de Pago</h2>
        <p>Administra los métodos de pago disponibles en el sistema Punto de Venta.</p>
      </div>

      <div className="payment-config-content">
        {error && <div className="error-message">{error}</div>}

        <form className="add-method-form" onSubmit={handleAddMethod}>
          <div className="input-row">
            <div className="input-group">
              <label>Nombre del método</label>
              <input
                type="text"
                placeholder="Ej. Vales de Despensa"
                value={newMethodName}
                onChange={(e) => setNewMethodName(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label>Clave SAT (Opcional)</label>
              <input
                type="text"
                placeholder="Ej. 08"
                value={newMethodSatCode}
                onChange={(e) => setNewMethodSatCode(e.target.value)}
              />
            </div>
            <button type="submit" className="add-btn" disabled={isAdding || !newMethodName.trim()}>
              <span className="material-symbols-outlined">add</span>
              {isAdding ? "Añadiendo..." : "Añadir"}
            </button>
          </div>
        </form>

        <div className="methods-list">
          {loading ? (
            <div className="loading-state">Cargando métodos de pago...</div>
          ) : paymentMethods.length === 0 ? (
            <div className="empty-state">No hay métodos de pago configurados.</div>
          ) : (
            paymentMethods.map((method) => {
              const isBasic = ["efectivo", "tarjeta", "transferencia"].includes(method.name.toLowerCase());

              return (
                <div key={method.id} className={`method-card ${!method.is_active ? "inactive" : ""}`}>
                  <div className="method-info">
                    <span className="material-symbols-outlined method-icon">
                      {method.name.toLowerCase() === "efectivo" ? "payments" :
                       method.name.toLowerCase() === "tarjeta" ? "credit_card" :
                       method.name.toLowerCase() === "transferencia" ? "account_balance" : "wallet"}
                    </span>
                    <span className="method-name">{method.name}</span>
                    {method.sat_code && (
                      <span className="badge-sat" title="Clave SAT">SAT: {method.sat_code}</span>
                    )}
                    {method.name.toLowerCase() === "efectivo" && <span className="badge-system">Sistema</span>}
                  </div>

                  <div className="method-actions">
                    <div className="actions-menu-container">
                      <button 
                        className="menu-trigger-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === method.id ? null : method.id);
                        }}
                      >
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>

                      {activeMenu === method.id && (
                        <>
                          <div className="menu-backdrop" onClick={() => setActiveMenu(null)} />
                          <div className="actions-dropdown">
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => {
                                setEditingMethod({ ...method });
                                setActiveMenu(null);
                              }}
                            >
                              <span className="material-symbols-outlined">edit</span>
                              <div className="item-content">
                                <span className="item-title">Editar</span>
                                <span className="item-desc">Renombrar o clave SAT</span>
                              </div>
                            </button>
                            
                            <button
                              type="button"
                              className="dropdown-item"
                              onClick={() => handleToggleStatus(method.id, method.is_active)}
                            >
                              <span className="material-symbols-outlined">
                                {method.is_active ? "visibility_off" : "visibility"}
                              </span>
                              <div className="item-content">
                                <span className="item-title">{method.is_active ? "Desactivar" : "Activar"}</span>
                                <span className="item-desc">{method.is_active ? "Ocultar en ventas" : "Mostrar en ventas"}</span>
                              </div>
                            </button>

                            <button
                              type="button"
                              className={`dropdown-item delete ${method.name.toLowerCase() === "efectivo" ? "disabled" : ""}`}
                              onClick={() => method.name.toLowerCase() !== "efectivo" && handleDelete(method.id, method.name)}
                              disabled={method.name.toLowerCase() === "efectivo"}
                            >
                              <span className="material-symbols-outlined">delete</span>
                              <div className="item-content">
                                <span className="item-title">Eliminar</span>
                                <span className="item-desc">Borrar permanente</span>
                              </div>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {editingMethod && (
        <div className="modal-overlay">
          <div className="edit-modal">
            <div className="modal-header">
              <h3>Editar Forma de Pago</h3>
              <button 
                className="close-btn" 
                onClick={() => setEditingMethod(null)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleUpdateMethod}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Nombre del método</label>
                  <input
                    type="text"
                    value={editingMethod.name}
                    onChange={(e) => setEditingMethod({ ...editingMethod, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Clave SAT</label>
                  <input
                    type="text"
                    placeholder="Ej. 01, 04, 03..."
                    value={editingMethod.sat_code || ""}
                    onChange={(e) => setEditingMethod({ ...editingMethod, sat_code: e.target.value })}
                  />
                  <small>Clave oficial para el timbrado de facturas</small>
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="cancel-btn" 
                  onClick={() => setEditingMethod(null)}
                >
                  Cancelar
                </button>
                <button type="submit" className="save-btn">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentMethodsConfig;
