// ============================================================
// Stock.jsx — what the shop has right now, at ONE branch
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

import { PageHeader, StatCard, SectionCard } from '../components/Ui';
import {
  StockIcon,
  BoxIcon,
  AlertTriangleIcon,
  PlusIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ClockIcon,
  FilterIcon,
  SearchIcon2,
} from '../components/Icons';
import BatchesPopup from '../components/BatchesPopup';

export default function Stock({ branchId }) {
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  
  // Form state
  const [productId, setProductId] = useState('');
  const [reason, setReason] = useState('restock');
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');
  const [expiry, setExpiry] = useState('');

  // UI state
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [editingWarnFor, setEditingWarnFor] = useState(null);
  const [warnValue, setWarnValue] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Batches popup state
  const [showBatchesOf, setShowBatchesOf] = useState(null);

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // Fetch batches for the product selected in the left form
  useEffect(() => {
    if (productId === '' || !branchId) {
      setBatches([]);
      return;
    }
    getBatches(Number(productId), branchId)
      .then((list) => setBatches(list))
      .catch((err) => setError(err.message));
  }, [productId, branchId]);

  async function loadProducts() {
    if (!branchId) return;
    try {
      setProducts(await getProductsForBranch(branchId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveWarnLevel(product) {
    try {
      await updateProduct(product.id, { low_stock_at: Number(warnValue) || 0 });
      setEditingWarnFor(null);
      loadProducts();
    } catch (err) {
      setError(err.message);
    }
  }

  const isAdding = reason === 'restock';
  const chosenProduct = products.find((p) => String(p.id) === String(productId));

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
        stockNow = await takeStock(Number(productId), branchId, Number(amount), reason);
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

  // ---------- summary numbers ----------
  const outOfStock = products.filter((p) => p.stock_quantity === 0);
  const runningLow = products.filter(
    (p) => p.stock_quantity > 0 && p.stock_quantity <= p.low_stock_at
  );
  const totalUnits = products.reduce((sum, p) => sum + (p.stock_quantity || 0), 0);

  // ---------- filters ----------
  function stockLevelOf(product) {
    if (product.stock_quantity === 0) return 'out';
    if (product.stock_quantity <= product.low_stock_at) return 'low';
    return 'ok';
  }

  const shownProducts = products.filter((product) => {
    if (levelFilter && stockLevelOf(product) !== levelFilter) return false;
    if (search === '') return true;
    return product.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div>
      <PageHeader
        breadcrumb="Inventory / Stock"
        title="Stock"
        subtitle="What this branch has on its shelves right now."
      />

      {error && <div className="error">{error}</div>}

      <div className="side-by-side">
        {/* ---------- LEFT: CHANGE STOCK FORM ---------- */}
        <div className="box" style={{ flex: 'none', width: 360 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isAdding ? <ArrowDownIcon /> : <ArrowUpIcon />}
            Change stock
          </h2>

          {message && <div className="success">{message}</div>}

          <label>
            <span>Product</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Choose a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
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
                <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
              </label>
              <label>
                <span>Expires on</span>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
              </label>
            </div>
          )}

          {isAdding && expiry === '' && (
            <p className="small-text grey" style={{ marginTop: -6 }}>
              No expiry date. Leave it blank only for things that do not go off, like soap.
            </p>
          )}

          <button className="primary big" onClick={save} disabled={!canSave}>
            {busy ? 'Saving...' : isAdding ? 'Add a batch' : 'Take out of stock'}
          </button>

          {/* Show current batches below the form */}
          {chosenProduct && batches.length > 0 && (
            <>
              <h2 style={{ marginTop: 26, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClockIcon /> Batches
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>Expiry</th>
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

        {/* ---------- RIGHT: EVERYTHING IN STOCK TABLE ---------- */}
        <SectionCard
          icon={<StockIcon />}
          title="Everything in stock"
          count={shownProducts.length + ' of ' + products.length + ' products'}
          padding={0}
          style={{ flex: 1 }}
        >
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)' }}>
            <div className="filter-chips" style={{ marginBottom: 0, alignItems: 'center' }}>
              <div className="staff-search" style={{ flex: 1, maxWidth: 320, marginRight: 12 }}>
                <SearchIcon2 />
                <input
                  placeholder="Search products"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className={'chip' + (levelFilter === '' ? ' on' : '')} onClick={() => setLevelFilter('')}>All</button>
              <button className={'chip' + (levelFilter === 'ok' ? ' on' : '')} onClick={() => setLevelFilter('ok')}>In stock</button>
              <button className={'chip' + (levelFilter === 'low' ? ' on' : '')} onClick={() => setLevelFilter('low')}>Low</button>
              <button className={'chip' + (levelFilter === 'out' ? ' on' : '')} onClick={() => setLevelFilter('out')}>Out</button>
            </div>
          </div>

          <div className="scroll-box" style={{ maxHeight: 600 }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Expiry</th>
                  <th className="right">Warn at</th>
                  <th className="right">In stock</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shownProducts.map((product) => {
                  const level = stockLevelOf(product);
                  return (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td className="small-text grey">{product.category_name || '-'}</td>
                      <td className="small-text">
                        {product.expiry_date ? (
                          <>
                            <span className="grey">{shortDate(product.expiry_date)}</span>
                            {product.clearance_percent > 0 && (
                              <span className="tag clearance">{product.clearance_percent}% off</span>
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
                            <button className="small primary" onClick={() => saveWarnLevel(product)}>Save</button>
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
                        {level === 'low' && <span className="tag warning">{product.stock_quantity}</span>}
                        {level === 'ok' && <strong>{product.stock_quantity}</strong>}
                      </td>
                      <td className="right">
                        <button className="small" onClick={() => setShowBatchesOf(product)}>
                          Batches
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {shownProducts.length === 0 && (
              <div className="empty small-text">
                {search || levelFilter ? 'Nothing matches the filter.' : 'No products yet.'}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ---------- Batches Popup ---------- */}
      {showBatchesOf && (
        <BatchesPopup
          product={showBatchesOf}
          branchId={branchId}
          onClose={() => setShowBatchesOf(null)}
          onChanged={() => {
            // Refresh the main table when a batch is written off
            loadProducts();
            // If the left form is also on this product, refresh its batches too
            if (productId === String(showBatchesOf.id)) {
              getBatches(Number(showBatchesOf.id), branchId).then(setBatches);
            }
          }}
        />
      )}
    </div>
  );
}
