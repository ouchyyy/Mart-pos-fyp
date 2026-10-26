// ============================================================
// BatchesPopup.jsx — the batches one product is made up of
//
// A product shows one number in the list, but that number is
// added up from separate deliveries. This shows them apart, with
// the expiry date of each, in the order they will be sold.
//
// It needs both a product ID and a branch ID. If either is
// missing (for example, a new admin who has not been assigned a
// branch yet), it shows a message instead of querying.
// ============================================================

import { useState, useEffect } from 'react';
import { getBatches } from '../database';
import { money, shortDate, daysUntil } from '../money';

export default function BatchesPopup({ product, branchId, onClose }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!product || !product.id) {
      setError('Missing product information.');
      setLoading(false);
      return;
    }

    if (!branchId) {
      setError('Missing branch information. Please select a branch from the menu.');
      setLoading(false);
      return;
    }

    setLoading(true);
    getBatches(product.id, branchId)
      .then((list) => setBatches(list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [product?.id, branchId]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>{product?.name || 'Batches'}</h2>
        <p className="grey small-text" style={{ marginTop: 0 }}>
          {product?.stock_quantity || 0} in stock at this branch, across {batches.length}{' '}
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
