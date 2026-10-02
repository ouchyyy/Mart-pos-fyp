// ============================================================
// Stock.jsx — what the shop has right now, AT ONE BRANCH
//
// This page answers "what do we have?". The Movements page
// answers "what happened?". Keeping them apart means this one
// stays short enough to read at a glance.
//
// The branch comes in as a prop. The list of products, the
// batches, and the add/take calls are all for that one branch.
// ============================================================

import { useState, useEffect } from 'react';
import {
  getProductsForBranch,
  addBatch,
  takeStock,
  getBatches,
  updateProduct,
} from '../database';
import { shortDate, daysUntil } from '../money';

export default function Stock({ branchId }) {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);

  const [productId, setProductId] = useState('');
  const [reason, setReason] = useState('restock');
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');
  const [expiry, setExpiry] = useState('');

  const [search, setSearch] = useState('');
  const [editingWarnFor, setEditingWarnFor] = useState(null);
  const [warnValue, setWarnValue] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Show the batches of whichever product is chosen, AT THIS BRANCH.
  useEffect(() => {
    if (productId === '' || !branchId) {
      setBatches([]);
      return;
    }

    getBatches(Number(productId), branchId)
      .then((list) => setBatches(list))
      .catch((err) => setError(err.message));
  }, [productId, branchId]);

  // The warning level is a product setting, not a per-branch one,
  // so it stays on the products table and applies everywhere.
  async function saveWarnLevel(product) {
    try {
      await updateProduct(product.id, { low_stock_at: Number(warnValue) || 0 });
      setEditingWarnFor(null);
      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadProducts() {
    if (!branchId) return;
    try {
      setProducts(await getProductsForBranch(branchId));
    } catch (err) {
      setError(err.message);
    }
  }

  const isAdding = reason === 'restock';

  const chosenProduct = products.find(
    (product) => String(product.id) === String(productId)
  );

  async function save() {
    setError('');
    setMessage('');
    setBusy(true);

    try {
      let stockNow;

      if (isAdding) {
        stockNow = await addBatch(Number(productId), branchId, Number(amount), {
          cost: cost,
          expiry: expiry,
          reason: 'restock',
        });
      } else {
        stockNow = await takeStock(
          Number(productId),
          branchId,
          Number(amount),
          reason
        );
      }

      setMessage(chosenProduct.name + ' now has ' + stockNow + ' at this branch');
      setAmount('');
      setCost('');
      setExpiry('');

      loadProducts();
      setBatches(await getBatches(Number(productId), branchId));
    } catch (err) {
      setError(err.message);
    }

    setBusy(false);
  }

  const canSave = productId !== '' && Number(amount) > 0 && !busy;

  const runningLow = products.filter(
    (product) => product.stock_quantity <= product.low_stock_at
  );

  const outOfStock = runningLow.filter((product) => product.stock_quantity === 0);

  const shownProducts = products.filter((product) => {
    if (search === '') return true;
    return product.name.toLowerCase().includes(search.toLowerCase());
  });

  function stockLevelOf(product) {
    if (product.stock_quantity === 0) return 'out';
    if (product.stock_quantity <= product.low_stock_at) return 'low';
    return 'ok';
  }

  return (
    <div>
      <h1>Stock</h1>

      {runningLow.length > 0 && (
        <div className="warning-banner">
          <div className="warning-counts">
            {outOfStock.length > 0 && (
              <span className="count out">
                <strong>{outOfStock.length}</strong> out of stock
              </span>
            )}
            {runningLow.length - outOfStock.length > 0 && (
              <span className="count low">
                <strong>{runningLow.length - outOfStock.length}</strong> running low
              </span>
            )}
          </div>

          <div className="low-list">
            {runningLow.slice(0, 10).map((product) => {
              const level = stockLevelOf(product);

              return (
                <button
                  key={product.id}
                  className={'low-chip ' + level}
                  onClick={() => {
                    setProductId(String(product.id));
                    setReason('restock');
                  }}
                >
                  {product.name}
                  <span className="number">
                    {product.stock_quantity === 0
                      ? 'none'
                      : product.stock_quantity}
                  </span>
                </button>
              );
            })}
            {runningLow.length > 10 && (
              <span className="grey small-text">
                and {runningLow.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="side-by-side">
        {/* ---------- add or remove stock ---------- */}
        <div className="box" style={{ flex: 'none', width: 340 }}>
          <h2>Change stock</h2>

          {error && <div className="error">{error}</div>}
          {message && <div className="success">{message}</div>}

          <label>
            <span>Product</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Choose a product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>What happened?</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="restock">A delivery arrived</option>
              <option value="expired">Expired or damaged</option>
              <option value="correction">Counting correction</option>
            </select>
          </label>

          <label>
            <span>How many?</span>
            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>

          {isAdding && (
            <div className="two-columns">
              <label>
                <span>Cost each</span>
                <input
                  type="number"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </label>

              <label>
                <span>Expires on</span>
                <input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </label>
            </div>
          )}

          {isAdding && expiry === '' && (
            <p className="small-text grey" style={{ marginTop: -6 }}>
              No expiry date. Leave it blank only for things that do not
              go off, like soap.
            </p>
          )}

          <button className="primary big" onClick={save} disabled={!canSave}>
            {busy ? 'Saving...' : isAdding ? 'Add a batch' : 'Take out of stock'}
          </button>

          {chosenProduct && batches.length > 0 && (
            <>
              <h2 style={{ marginTop: 22 }}>Batches at this branch</h2>
              <table>
                <thead>
                  <tr>
                    <th>Expiry dates</th>
                    <th className="right">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const days = daysUntil(batch.expiry_date);

                    return (
                      <tr key={batch.id}>
                        <td className="small-text">
                          {batch.expiry_date ? (
                            <>
                              {shortDate(batch.expiry_date)}
                              {days !== null && days < 30 && (
                                <span className="tag warning" style={{ marginLeft: 6 }}>
                                  {days < 0 ? 'expired' : days + 'd'}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="grey">no date</span>
                          )}
                        </td>
                        <td className="right number">{batch.quantity_left}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* ---------- everything in stock ---------- */}
        <div className="box" style={{ padding: 0 }}>
          <div className="panel-head">
            <h2 style={{ margin: 0 }}>Everything in stock</h2>
            <input
              className="search-small"
              placeholder="Search products"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="scroll-box" style={{ maxHeight: 520 }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Expiry dates</th>
                  <th className="right">Warn at</th>
                  <th className="right">In stock</th>
                </tr>
              </thead>
              <tbody>
                {shownProducts.map((product) => {
                  const level = stockLevelOf(product);

                  return (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td className="small-text grey">
                        {product.category_name || '-'}
                      </td>
                      <td className="small-text">
                        {product.expiry_date ? (
                          <>
                            <span className="grey">
                              {shortDate(product.expiry_date)}
                            </span>
                            {product.clearance_percent > 0 && (
                              <span className="tag clearance">
                                {product.clearance_percent}% off
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="grey">-</span>
                        )}
                      </td>
                      <td className="right">
                        {editingWarnFor === product.id ? (
                          <div className="warn-edit">
                            <input
                              type="number"
                              min="0"
                              className="number"
                              value={warnValue}
                              autoFocus
                              onChange={(e) => setWarnValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveWarnLevel(product);
                                if (e.key === 'Escape') setEditingWarnFor(null);
                              }}
                            />
                            <button
                              className="small primary"
                              onClick={() => saveWarnLevel(product)}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            className="warn-value number"
                            title="Click to change"
                            onClick={() => {
                              setEditingWarnFor(product.id);
                              setWarnValue(String(product.low_stock_at));
                            }}
                          >
                            {product.low_stock_at}
                          </button>
                        )}
                      </td>
                      <td className="right number">
                        {level === 'out' && <span className="tag out">out</span>}
                        {level === 'low' && (
                          <span className="tag warning">{product.stock_quantity}</span>
                        )}
                        {level === 'ok' && <strong>{product.stock_quantity}</strong>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {shownProducts.length === 0 && (
              <div className="empty small-text">
                {search ? 'Nothing matches that search.' : 'No products yet.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}