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

export default function Stock({ branchId }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [editingWarnFor, setEditingWarnFor] = useState(null);
  const [warnValue, setWarnValue] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // State for the popup
  const [showBatchPopup, setShowBatchPopup] = useState(false);
  const [defaultProductId, setDefaultProductId] = useState('');

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function loadProducts() {
    if (!branchId) return;
    setLoading(true);
    try {
      setProducts(await getProductsForBranch(branchId));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
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

  function openAddPopup(productId = '') {
    setDefaultProductId(productId);
    setShowBatchPopup(true);
  }

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

  const lowOrOut = [...outOfStock, ...runningLow];

  return (
    <div>
      <PageHeader
        breadcrumb="Inventory / Stock"
        title="Stock"
        subtitle="What this branch has on its shelves right now."
        actions={
          <button className="primary" onClick={() => openAddPopup()}>
            <PlusIcon /> Add a batch
          </button>
        }
      />

      {error && <div className="error">{error}</div>}

      {/* ---------- summary cards ---------- */}
      <div className="stat-grid">
        <StatCard
          icon={<AlertTriangleIcon />}
          tone="red"
          label="Out of stock"
          value={outOfStock.length}
          note={outOfStock.length === 0 ? 'Every product has stock' : 'Needs restocking today'}
          noteTone={outOfStock.length > 0 ? 'red' : 'green'}
        />
        <StatCard
          icon={<FilterIcon />}
          tone="amber"
          label="Running low"
          value={runningLow.length}
          note={runningLow.length === 0 ? 'All above the warning level' : 'At or below the warn level'}
          noteTone={runningLow.length > 0 ? 'amber' : 'green'}
        />
        <StatCard
          icon={<BoxIcon />}
          tone="blue"
          label="Total units"
          value={totalUnits}
          note={products.length + ' products in the catalogue'}
          noteTone="grey"
        />
      </div>

      {/* ---------- warning banner ---------- */}
      {lowOrOut.length > 0 && (
        <SectionCard
          icon={<AlertTriangleIcon />}
          title="Needs attention"
          count={
            outOfStock.length > 0 && runningLow.length > 0
              ? outOfStock.length + ' out · ' + runningLow.length + ' running low'
              : outOfStock.length > 0
              ? outOfStock.length + ' out of stock'
              : runningLow.length + ' running low'
          }
        >
          <div className="low-list" style={{ marginTop: 0 }}>
            {lowOrOut.slice(0, 20).map((product) => {
              const level = stockLevelOf(product);
              return (
                <button
                  key={product.id}
                  className={'low-chip ' + level}
                  onClick={() => openAddPopup(product.id)}
                >
                  {product.name}
                  <span className="number">
                    {product.stock_quantity === 0 ? 'none' : product.stock_quantity}
                  </span>
                </button>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ---------- the stock table ---------- */}
      <SectionCard
        icon={<StockIcon />}
        title="Everything in stock"
        count={shownProducts.length + ' of ' + products.length + ' products'}
        padding={0}
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
                      <button className="small" onClick={() => openAddPopup(product.id)}>
                        Restock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && shownProducts.length === 0 && (
            <div className="empty small-text">
              {search || levelFilter ? 'Nothing matches the filter.' : 'No products yet.'}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ---------- the batch popup ---------- */}
      {showBatchPopup && (
        <BatchPopup
          branchId={branchId}
          products={products}
          defaultProductId={defaultProductId}
          onClose={() => setShowBatchPopup(false)}
          onSaved={() => {
            setShowBatchPopup(false);
            loadProducts();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   The Add / Change Stock Popup
   ------------------------------------------------------------ */
function BatchPopup({ branchId, products, defaultProductId, onClose, onSaved }) {
  const [productId, setProductId] = useState(defaultProductId || '');
  const [reason, setReason] = useState('restock');
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');
  const [expiry, setExpiry] = useState('');
  
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdding = reason === 'restock';
  const chosenProduct = products.find((p) => String(p.id) === String(productId));

  // Fetch batches when the product changes
  useEffect(() => {
    if (!productId) {
      setBatches([]);
      return;
    }
    getBatches(Number(productId), branchId)
      .then((list) => setBatches(list))
      .catch((err) => setError(err.message));
  }, [productId, branchId]);

  async function save() {
    setError('');
    setBusy(true);

    try {
      if (isAdding) {
        await addBatch(Number(productId), branchId, Number(amount), {
          cost: cost,
          expiry: expiry,
          reason: 'restock',
        });
      } else {
        await takeStock(Number(productId), branchId, Number(amount), reason);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const canSave = productId !== '' && Number(amount) > 0 && !busy;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdding ? <ArrowDownIcon /> : <ArrowUpIcon />} Change stock
        </h2>

        {error && <div className="error">{error}</div>}

        <label>
          <span>Product</span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Choose a product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.stock_quantity} in stock)</option>
            ))}
          </select>
        </label>

        <label>
          <span>What happened?</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="restock">A delivery arrived (Add)</option>
            <option value="expired">Expired or damaged (Remove)</option>
            <option value="correction">Counting correction (Remove)</option>
          </select>
        </label>

        <label>
          <span>How many?</span>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
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

        {chosenProduct && batches.length > 0 && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--page)', borderRadius: 8 }}>
            <div className="small-text grey" style={{ marginBottom: 8, fontWeight: 600 }}>Current batches at this branch:</div>
            {batches.map((b) => (
              <div key={b.id} className="small-text" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{b.expiry_date ? shortDate(b.expiry_date) : 'No date'}</span>
                <span>{b.quantity_left} left</span>
              </div>
            ))}
          </div>
        )}

        <div className="popup-buttons">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save} disabled={!canSave}>
            {busy ? 'Saving...' : isAdding ? 'Add a batch' : 'Take out of stock'}
          </button>
        </div>
      </div>
    </div>
  );
}
