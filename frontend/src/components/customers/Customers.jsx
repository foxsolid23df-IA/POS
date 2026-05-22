import React, { useState, useEffect } from 'react';
import CustomerRegister from './CustomerRegister';
import { customerService } from '../../services/customerService';
import './Customers.css';

export const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await customerService.getAll();
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.rfc && c.rfc.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <div className="customers-container">
      <header className="customers-header">
        <div className="header-title">
          <span className="material-symbols-outlined">group</span>
          <h1>Clientes</h1>
        </div>
        <button 
          className="btn-add-customer"
          onClick={() => {
            setShowRegister(!showRegister);
            setEditCustomer(null);
          }}
        >
          <span className="material-symbols-outlined">person_add</span>
          {showRegister || editCustomer ? 'Cerrar' : 'Nuevo Cliente'}
        </button>
      </header>

      {(showRegister || editCustomer) && (
        <div className="register-section">
          <CustomerRegister 
            onCustomerAdded={fetchCustomers} 
            editData={editCustomer}
            onCancelEdit={() => setEditCustomer(null)}
          />
        </div>
      )}

      <div className="search-bar">
        <span className="material-symbols-outlined">search</span>
        <input 
          type="text" 
          placeholder="Buscar por nombre, RFC o teléfono..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="customers-list-container">
        {loading ? (
          <div className="loading-state">Cargando clientes...</div>
        ) : filteredCustomers.length > 0 ? (
          <table className="customers-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>RFC</th>
                <th>Teléfono</th>
                <th>Fecha Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id}>
                  <td className="font-bold">{customer.name}</td>
                  <td>{customer.rfc || '---'}</td>
                  <td>{customer.phone || '---'}</td>
                  <td>{new Date(customer.created_at).toLocaleDateString()}</td>
                  <td className="actions">
                    <button
                      className="btn-icon"
                      title="Editar"
                      onClick={() => {
                        setEditCustomer(customer);
                        setShowRegister(false);
                      }}
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button 
                      className="btn-icon delete" 
                      title="Eliminar"
                      onClick={async () => {
                        if (window.confirm(`¿Eliminar cliente ${customer.name}?`)) {
                          await customerService.remove(customer.id);
                          fetchCustomers();
                        }
                      }}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <span className="material-symbols-outlined">person_off</span>
            <p>No se encontraron clientes</p>
          </div>
        )}
      </div>
    </div>
  );
};
