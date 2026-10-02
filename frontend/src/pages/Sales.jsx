// ============================================================
// Sales.jsx — a list of past sales, and cancelling one
// ============================================================

import { useState, useEffect } from 'react';
import { getSales, getSale, cancelSale } from '../database';
import { money, dateAndTime } from '../money';
import Receipt from '../components/Receipt';

export default function Sales({ user }) {
  const [sales, setSales] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [looking, setLooking] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [fromDate, toDate]);

  async function load() {
    try {
      setSales(await getSales(fromDate, toDate));
    } catch (err) {
      setError(err.message);
    }
  }

  async function showReceipt(id) {
    try {
      setLooking(await getSale(id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancel(sale) {
    const reason = window.prompt('Why is this sale being cancelled?');

    // window.prompt gives back null if they press Cancel.
    if (!reason) {
      return;
    }

    try {
      await cancelSale(sale.id, reason);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // Add up only the sales that were not cancelled.
  let total = 0;
  for (const sale of sales) {
    if (sale.status === 'completed') {
      total = total + Number(sale.total);
    }
  }

  return (
    <div>
      <h1>Sales</h1>

      {error && <div className="error">{error}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
        <label style={{ margin: 0 }}>
          <span>From</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label style={{ margin: 0 }}>
          <span>To</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <div className="box" style={{ padding: '8px 14px' }}>
          <span className="grey small-text">Total </span>
          <strong className="number">{money(total)}</strong>
        </div>
      </div>

      <div className="box" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>When</th>
              <th>Served by</th>
              <th className="right">Discount</th>
              <th className="right">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} style={{ opacity: sale.status === 'completed' ? 1 : 0.5 }}>
                <td className="number">
                  {sale.invoice_no}
                  {sale.status !== 'completed' && (
                    <span className="tag warning" style={{ marginLeft: 6 }}>
                      cancelled
                    </span>
                  )}
                </td>
                <td className="small-text grey">{dateAndTime(sale.created_at)}</td>
                <td className="small-text">
                  {/* Who rang this sale up. If the profile has no
                      name yet we say so plainly rather than showing
                      a dash, which looks like missing data. */}
                  {sale.profiles
                    ? sale.profiles.full_name || 'Unnamed staff'
                    : 'Deleted account'}
                </td>
                <td className="right number">
                  {/* Both kinds shown together — the customer only
                      cares how much came off, not which sort it was. */}
                  {Number(sale.discount) + Number(sale.item_discount || 0) > 0 ? (
                    <span className="discount-line">
                      -{money(Number(sale.discount) + Number(sale.item_discount || 0))}
                    </span>
                  ) : (
                    <span className="grey">-</span>
                  )}
                </td>
                <td className="right number">{money(sale.total)}</td>
                <td className="right">
                  <button className="small" onClick={() => showReceipt(sale.id)}>
                    Receipt
                  </button>{' '}
                  {sale.status === 'completed' && user.role === 'admin' && (
                    <button className="small danger" onClick={() => handleCancel(sale)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sales.length === 0 && <div className="empty">No sales in this period.</div>}
      </div>

      {looking && <Receipt sale={looking} onClose={() => setLooking(null)} />}
    </div>
  );
}
