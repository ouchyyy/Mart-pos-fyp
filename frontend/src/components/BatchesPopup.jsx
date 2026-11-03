// ============================================================
// BatchesPopup.jsx — the batches one product is made up of
// ============================================================

import { useState, useEffect } from 'react';
import { getBatches, takeStock } from '../database';
import { money, shortDate, daysUntil } from '../money';

export default function BatchesPopup({ product, branchId, onClose, onChanged }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, branchId]);

  async function loadBatches() {
    setLoading(true);
    try {
      const list = await getBatches(product.id, branchId);
      setBatches(list);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function writeOff(batch) {
    const sure = window.confirm(
      `Write off ${batch.quantity_left} units of ${product.name}? This will remove them from stock.`
    );
    if (!sure) return;

    setBusyId(batch.id);
    setError('');

    try {
      await takeStock(product.id, branchId, batch.quantity_left, 'expired', 'Batch expired');
      await loadBatches();
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.message);
    }
    setBusyId(null);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <h2>{product.name}</h2>
        <p className="grey small-text" style={{ marginTop: 0 }}>
          {product.stock_quantity} in stock at this branch, across {batches.length}{' '}
          {batches.length === 1 ? 'batch' : 'batches'}. The top one is sold first.
        </p>

        {error && <div className="error">{error}</div>}
        {loading && <div className="empty small-text">Loading...</div>}

        {!loading && !error && (
          <div className="box" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Arrived</th>
                  <th>Batch</th>
                  <th>Expires</th>
                  <th className="right">Cost</th>
                  <th className="right">Left</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const days = daysUntil(batch.expiry_date);

                  return (
                    <tr key={batch.id}>
                      <td className="small-text grey">{shortDate(batch.received_at)}</td>
                      <td className="small-text">{batch.batch_no || '-'}</td>
                      <td className="small-text">
                        {batch.expiry_date ? (
                          <>
                            {shortDate(batch.expiry_date)}
                            {days !== null && days < 30 && (
                              <span className="tag warning" style={{ marginLeft: 6 }}>
                                {days < 0 ? 'expired' : days + ' days'}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="grey">no date</span>
                        )}
                      </td>
                      <td className="right number">{money(batch.cost_price)}</td>
                      <td className="right number">
                        {batch.quantity_left} of {batch.quantity_received}
                      </td>
                      <td className="right">
                        <button
                          className="small danger"
                          onClick={() => writeOff(batch)}
                          disabled={busyId === batch.id}
                        >
                          {busyId === batch.id ? '...' : 'Write off'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {batches.length === 0 && (
              <div className="empty small-text">
                No stock at this branch. Add a batch on the Stock page.
              </div>
            )}
          </div>
        )}

        <div className="popup-buttons">
          <button className="primary" onClick={onClose} style={{ flex: 1 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
