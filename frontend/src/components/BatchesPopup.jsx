// ============================================================
// BatchesPopup.jsx — the batches one product is made up of
//
// A product shows one number in the list, but that number is
// added up from separate deliveries. This shows them apart, with
// the expiry date of each, in the order they will be sold.
// ============================================================

import { useState, useEffect } from 'react';
import { getBatches } from '../database';
import { money, shortDate, daysUntil } from '../money';

export default function BatchesPopup({ product, onClose }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getBatches(product.id)
      .then((list) => setBatches(list))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [product.id]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <h2>{product.name}</h2>
        <p className="grey small-text" style={{ marginTop: 0 }}>
          {product.stock_quantity} in stock, across {batches.length}{' '}
          {batches.length === 1 ? 'batch' : 'batches'}. The top one is sold first.
        </p>

        {error && <div className="error">{error}</div>}
        {loading && <div className="empty small-text">Loading...</div>}

        {!loading && (
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
                No stock. Add a batch on the Stock page.
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
