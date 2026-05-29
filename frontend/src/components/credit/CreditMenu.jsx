import React, { useState, useEffect } from 'react';
import { creditService } from '../../services/creditService';
import { CustomerCreditCard } from './CustomerCreditCard';
import { RegisterPaymentModal } from './RegisterPaymentModal';
import { formatearDinero } from '../../utils/formatters';
import './Credit.css';

export const CreditMenu = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await creditService.getCreditSummary();
      setSummary(data);
    } catch (err) {
      console.error('Error loading credit summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredCustomers = summary?.customers?.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <>
      {selectedCustomer ? (
        <CustomerCreditCard
          customerId={selectedCustomer}
          onBack={() => { setSelectedCustomer(null); loadData(); }}
          onPayment={(customer) => {
            setPaymentCustomer(customer);
            setShowPaymentModal(true);
          }}
          onRefresh={loadData}
        />
      ) : (
        <div className="credit-menu">
          <div className="credit-header">
            <div className="credit-header-left">
              <div>
                <h1>Créditos y Cuentas por Cobrar</h1>
                <p className="credit-subtitle">Gestión de cobranza y saldos</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="credit-loading">Cargando...</div>
          ) : (
            <>
              <div className="credit-summary-cards">
                <div className="credit-card summary-card total-outstanding">
                  <span className="material-symbols-outlined card-icon">payments</span>
                  <div className="card-body">
                    <span className="card-value">{formatearDinero(summary?.totalOutstanding || 0)}</span>
                    <span className="card-label">Total Pendiente</span>
                  </div>
                </div>
                <div className="credit-card summary-card total-overdue">
                  <span className="material-symbols-outlined card-icon">warning</span>
                  <div className="card-body">
                    <span className="card-value">{formatearDinero(summary?.totalOverdue || 0)}</span>
                    <span className="card-label">Vencido</span>
                  </div>
                </div>
                <div className="credit-card summary-card active-customers">
                  <span className="material-symbols-outlined card-icon">people</span>
                  <div className="card-body">
                    <span className="card-value">{summary?.customers?.length || 0}</span>
                    <span className="card-label">Clientes con Crédito</span>
                  </div>
                </div>
                <div className="credit-card summary-card overdue-count">
                  <span className="material-symbols-outlined card-icon">schedule</span>
                  <div className="card-body">
                    <span className="card-value">{summary?.overdueCustomers?.length || 0}</span>
                    <span className="card-label">Clientes Vencidos</span>
                  </div>
                </div>
              </div>

              <div className="credit-toolbar">
                <div className="credit-search">
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="credit-table-container">
                <table className="credit-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Teléfono</th>
                      <th>Límite</th>
                      <th>Saldo Actual</th>
                      <th>Disponible</th>
                      <th>Estatus</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => {
                      const limit = parseFloat(c.credit_limit || 0);
                      const balance = parseFloat(c.credit_balance || 0);
                      const available = limit - balance;
                      const usagePct = limit > 0 ? (balance / limit) * 100 : 0;
                      const isOverdue = summary?.overdueCustomers?.some(o => o.customer.id === c.id);

                      return (
                        <tr key={c.id} className={c.credit_hold ? 'row-blocked' : ''}>
                          <td className="td-name">
                            <span className="customer-name">{c.name}</span>
                            {c.rfc && <span className="customer-rfc">{c.rfc}</span>}
                          </td>
                          <td>{c.phone || '---'}</td>
                          <td className="td-money">{formatearDinero(limit)}</td>
                          <td className="td-money">{formatearDinero(balance)}</td>
                          <td className="td-money">{formatearDinero(Math.max(0, available))}</td>
                          <td>
                            <span className={`status-badge ${c.credit_hold ? 'blocked' : isOverdue ? 'overdue' : usagePct > 80 ? 'warning' : 'ok'}`}>
                              {c.credit_hold ? 'BLOQUEADO' : isOverdue ? 'VENCIDO' : usagePct > 80 ? 'ALTO' : 'AL CORRIENTE'}
                            </span>
                          </td>
                          <td className="td-actions">
                            <button className="btn-icon" title="Ver detalle" onClick={() => setSelectedCustomer(c.id)}>
                              <span className="material-symbols-outlined">visibility</span>
                            </button>
                            <button className="btn-icon" title="Registrar abono" onClick={() => { setPaymentCustomer(c); setShowPaymentModal(true); }}>
                              <span className="material-symbols-outlined">payments</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredCustomers.length === 0 && (
                  <div className="credit-empty">
                    <span className="material-symbols-outlined">person_off</span>
                    <p>No hay clientes con crédito</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {showPaymentModal && paymentCustomer && (
        <RegisterPaymentModal
          customer={paymentCustomer}
          onClose={() => { setShowPaymentModal(false); setPaymentCustomer(null); }}
          onSuccess={() => { setShowPaymentModal(false); setPaymentCustomer(null); loadData(); }}
        />
      )}
    </>
  );
};

export default CreditMenu;
