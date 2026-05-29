import React, { useState, useEffect } from 'react';
import { creditService } from '../../services/creditService';
import { formatearDinero, formatearFecha } from '../../utils/formatters';
import './Credit.css';

export const CustomerCreditCard = ({ customerId, onBack, onPayment, onRefresh }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await creditService.getCustomerCreditDetail(customerId);
        setData(result);
      } catch (err) {
        console.error('Error loading customer credit detail:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [customerId]);

  if (loading) return <div className="credit-loading">Cargando detalle...</div>;
  if (!data) return <div className="credit-loading">Error al cargar datos</div>;

  const { customer, sales, payments } = data;
  const limit = parseFloat(customer.credit_limit || 0);
  const balance = parseFloat(customer.credit_balance || 0);
  const usagePct = limit > 0 ? (balance / limit) * 100 : 0;

  return (
    <div className="credit-menu">
      <div className="credit-header">
        <div className="credit-header-left">
          <button className="btn-back" onClick={onBack}>
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1>{customer.name}</h1>
            <p className="credit-subtitle">{customer.rfc ? `RFC: ${customer.rfc}` : ''} {customer.phone ? `• Tel: ${customer.phone}` : ''}</p>
          </div>
        </div>
        <div className="credit-header-actions">
          <button className="cta-btn" onClick={() => onPayment(customer)}>
            <span className="material-symbols-outlined">payments</span>
            Registrar Abono
          </button>
        </div>
      </div>

      <div className="credit-bar-section">
        <div className="bar-info">
          <span>Límite de crédito: <strong>{formatearDinero(limit)}</strong></span>
          <span>Saldo actual: <strong>{formatearDinero(balance)}</strong></span>
          <span>Disponible: <strong>{formatearDinero(Math.max(0, limit - balance))}</strong></span>
          <span>Términos: <strong>{customer.payment_terms || 'contado'}</strong></span>
        </div>
        <div className="credit-progress-bar">
          <div
            className={`credit-progress-fill ${usagePct > 80 ? 'danger' : usagePct > 60 ? 'warning' : 'ok'}`}
            style={{ width: `${Math.min(usagePct, 100)}%` }}
          />
        </div>
        <span className="bar-pct">{usagePct.toFixed(0)}% usado</span>
      </div>

      <div className="credit-two-columns">
        <div className="credit-column">
          <h3>
            <span className="material-symbols-outlined">receipt_long</span>
            Ventas a Crédito
          </h3>
          <div className="credit-sublist">
            {sales.length === 0 ? (
              <div className="empty-list">Sin ventas a crédito</div>
            ) : (
              <table className="credit-inner-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Folio</th>
                    <th>Total</th>
                    <th>Pagado</th>
                    <th>Saldo</th>
                    <th>Vence</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id}>
                      <td>{formatearFecha(s.created_at)}</td>
                      <td>V-{s.id}</td>
                      <td className="td-money">{formatearDinero(s.total)}</td>
                      <td className="td-money">{formatearDinero(s.paid_amount || 0)}</td>
                      <td className="td-money">{formatearDinero(s.balance || 0)}</td>
                      <td>{s.due_date ? formatearFecha(s.due_date) : '---'}</td>
                      <td>
                        <span className={`status-badge ${s.credit_status === 'pagado' ? 'ok' : s.credit_status === 'vencido' ? 'overdue' : 'warning'}`}>
                          {s.credit_status?.toUpperCase() || 'PENDIENTE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="credit-column">
          <h3>
            <span className="material-symbols-outlined">history</span>
            Historial de Abonos
          </h3>
          <div className="credit-sublist">
            {payments.length === 0 ? (
              <div className="empty-list">Sin abonos registrados</div>
            ) : (
              <table className="credit-inner-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th>Referencia</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td>{formatearFecha(p.created_at)}</td>
                      <td className="td-money td-positive">{formatearDinero(p.amount)}</td>
                      <td>{p.payment_method}</td>
                      <td>{p.reference || '---'}</td>
                      <td className="td-notes">{p.notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {customer.credit_notes && (
        <div className="credit-notes-box">
          <span className="material-symbols-outlined">notes</span>
          <span>{customer.credit_notes}</span>
        </div>
      )}
    </div>
  );
};

export default CustomerCreditCard;
