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
  const [isAdding, setIsAdding] = useState(false);

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
        setPaymentMethods(data);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultMethods = async () => {
    const defaults = [
      { user_id: user.id, name: "Efectivo", is_active: true },
      { user_id: user.id, name: "Tarjeta", is_active: true },
      { user_id: user.id, name: "Transferencia", is_active: true }
    ];

    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .insert(defaults)
        .select();

      if (error) throw error;
      setPaymentMethods(data);
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
        .insert([{ user_id: user.id, name: newMethodName.trim(), is_active: true }])
        .select()
        .single();

      if (error) throw error;

      setPaymentMethods([...paymentMethods, data]);
      setNewMethodName("");
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
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`¿Estás seguro de eliminar el método de pago "${name}"?`)) return;
    
    // Las protecciones básicas para no eliminar efectivo o tarjeta
    const isBasic = ["efectivo", "tarjeta", "transferencia"].includes(name.toLowerCase());
    if (isBasic) {
      alert("No puedes eliminar un método de pago del sistema base. Sólo puedes desactivarlo.");
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
          <div className="input-group">
            <input
              type="text"
              placeholder="Nueva forma de pago (Ej. Vales de Despensa)"
              value={newMethodName}
              onChange={(e) => setNewMethodName(e.target.value)}
              required
            />
            <button type="submit" disabled={isAdding || !newMethodName.trim()}>
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
                    {isBasic && <span className="badge-system">Sistema</span>}
                  </div>

                  <div className="method-actions">
                    <button
                      type="button"
                      className={`toggle-btn ${method.is_active ? "active" : ""}`}
                      onClick={() => handleToggleStatus(method.id, method.is_active)}
                      title={method.is_active ? "Desactivar" : "Activar"}
                    >
                      <span className="material-symbols-outlined">
                        {method.is_active ? "toggle_on" : "toggle_off"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDelete(method.id, method.name)}
                      disabled={isBasic}
                      title={isBasic ? "No se puede eliminar" : "Eliminar método"}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodsConfig;
