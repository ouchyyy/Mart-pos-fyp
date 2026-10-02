// ============================================================
// Products.jsx — the product list, and the form to add or edit one
//
// The catalogue is shared by every branch. The one thing that
// changes when you switch branch is the STOCK column — 42 at one
// shop, 0 at another — because stock lives at a branch, not at
// the franchise.
//
// So this page reads from products_for_branch(branchId), the
// same function the till uses, and refetches when the owner
// picks a different branch from the menu dropdown.
// ============================================================

import { useState, useEffect } from 'react';
import {
  getProductsForBranch,
  getCategories,
  addProduct,
  updateProduct,
  hideProduct,
  uploadPicture,
  addBatch,
} from '../database';
import { money, shortDate, daysUntil } from '../money';
import CategoriesPopup from '../components/CategoriesPopup';
import BatchesPopup from '../components/BatchesPopup';

const emptyProduct = {
  name: '',
  image_url: '',
  barcode: '',
  category_id: '',
  cost_price: '',
  selling_price: '',
  low_stock_at: '10',
  expiry_warn_days: '14',
  expiry_date: '',
};

export default function Products({ branchId }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [editing, setEditing] = useState(null);
  const [showCategories, setShowCategories] = useState(false);
  const [showBatchesOf, setShowBatchesOf] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function loadEverything() {
    setLoading(true);
    try {
      setCategories(await getCategories());

      if (branchId) {
        // Per-branch: this branch's stock, this branch's expiry,
        // this branch's clearance prices.
        setProducts(await getProductsForBranch(branchId));
      } else {
        setProducts([]);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleHide(product) {
    const sure = window.confirm('Hide ' + product.name + ' from the shop?');
    if (!sure) return;

    try {
      await hideProduct(product.id);
      loadEverything();
    } catch (err) {
      setError(err.message);
    }
  }

  const shown = products.filter((product) => {
    const matchesName =
      search === '' ||
      product.name.toLowerCase().includes(search.toLowerCase());

    let matchesCategory = true;

    if (categoryId === 'none') {
      matchesCategory = !product.category_id;
    } else if (categoryId !== '') {
      matchesCategory = String(product.category_id) === categoryId;
    }

    return matchesName && matchesCategory;
  });

  function countIn(id) {
    if (id === 'none') {
      return products.filter((product) => !product.category_id).length;
    }
    return products.filter(
      (product) => String(product.category_id) === String(id)
    ).length;
  }

  // The active product count is the number of distinct products.
  // Duplicates cannot happen here — one row per product — but the
  // count of *this branch's* stock is worth showing separately.
  const totalStock = products.reduce(
    (sum, p) => sum + (p.stock_quantity || 0),
    0
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Products</h1>
          <p className="grey small-text" style={{ margin: 0 }}>
            {products.length} product{products.length === 1 ? '' : 's'} in the
            catalogue
            {branchId && (
              <> · {totalStock} unit{totalStock === 1 ? '' : 's'} at this branch</>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, height: 40 }}>
          <button onClick={() => setShowCategories(true)}>Categories</button>
          <button className="primary" onClick={() => setEditing(emptyProduct)}>
            Add product
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="filter-row" style={{ marginTop: 20 }}>
        <input
          placeholder="Search by name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All categories ({products.length})</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({countIn(category.id)})
            </option>
          ))}
          <option value="none">No category ({countIn('none')})</option>
        </select>

        {(search !== '' || categoryId !== '') && (
          <button
            onClick={() => {
              setSearch('');
              setCategoryId('');
            }}
          >
            Clear
          </button>
        )}

        <span className="grey small-text">
          {shown.length} of {products.length}
        </span>
      </div>

      <div className="box" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th className="right">Cost</th>
              <th className="right">Price</th>
              <th className="right">Stock</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="name-with-photo">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt=""
                        className="thumbnail"
                      />
                    ) : (
                      <div className="thumbnail empty-thumbnail">?</div>
                    )}
                    <div>
                      {product.name}
                      <div className="grey small-text number">
                        {product.barcode}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="small-text">{product.category_name || '-'}</td>
                <td className="right number">{money(product.cost_price)}</td>
                <td className="right number">{money(product.selling_price)}</td>
                <td className="right number">
                  {/* The number here is THIS BRANCH's stock, not the
                      franchise total. That is what makes switching
                      branches visibly change the page. */}
                  {product.stock_quantity <= product.low_stock_at ? (
                    <span className="tag warning">{product.stock_quantity}</span>
                  ) : (
                    product.stock_quantity
                  )}
                </td>
                <td className="small-text">
                  {product.expiry_date ? (
                    <>
                      <span className="grey">
                        {shortDate(product.expiry_date)}
                      </span>
                      {daysUntil(product.expiry_date) < 30 && (
                        <span
                          className="tag warning"
                          style={{ marginLeft: 6 }}
                        >
                          {daysUntil(product.expiry_date) < 0
                            ? 'expired'
                            : daysUntil(product.expiry_date) + 'd'}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="grey">-</span>
                  )}
                </td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="small"
                    onClick={() => setShowBatchesOf(product)}
                  >
                    Batches
                  </button>{' '}
                  <button className="small" onClick={() => setEditing(product)}>
                    Edit
                  </button>{' '}
                  <button
                    className="small danger"
                    onClick={() => handleHide(product)}
                  >
                    Hide
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && shown.length === 0 && (
          <div className="empty">
            {products.length === 0
              ? 'No products yet. Press "Add product" to make one.'
              : 'No products match the filter.'}
          </div>
        )}
      </div>

      {showCategories && (
        <CategoriesPopup
          categories={categories}
          onClose={() => setShowCategories(false)}
          onChanged={loadEverything}
        />
      )}

      {showBatchesOf && (
        <BatchesPopup
          product={showBatchesOf}
          branchId={branchId}
          onClose={() => setShowBatchesOf(null)}
        />
      )}

      {editing && (
        <ProductForm
          product={editing}
          categories={categories}
          branchId={branchId}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadEverything();
          }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, categories, branchId, onClose, onSaved }) {
  const isNew = !product.id;

  const [form, setForm] = useState({
    name: product.name || '',
    barcode: product.barcode || '',
    category_id: product.category_id || '',
    cost_price: product.cost_price || '',
    selling_price: product.selling_price || '',
    low_stock_at: product.low_stock_at || 10,
    expiry_warn_days: product.expiry_warn_days || 14,
    expiry_date: product.expiry_date || '',
    image_url: product.image_url || '',
    starting_stock: '0',
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function update(field, value) {
    setForm({ ...form, [field]: value });
  }

  async function handlePicture(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('That picture is bigger than 2MB. Please pick a smaller one.');
      return;
    }

    setError('');
    setUploading(true);

    try {
      const address = await uploadPicture(file);
      update('image_url', address);
    } catch (err) {
      setError(err.message);
    }

    setUploading(false);
  }

  async function save() {
    setError('');
    setBusy(true);

    const details = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || null,
      category_id: form.category_id || null,
      cost_price: Number(form.cost_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      low_stock_at: Number(form.low_stock_at) || 0,
      expiry_warn_days: Number(form.expiry_warn_days) || 14,
      expiry_date: form.expiry_date || null,
      image_url: form.image_url || null,
    };

    try {
      if (isNew) {
        const created = await addProduct(details);

        // Opening stock becomes a real batch, at whichever branch
        // the owner has selected in the menu. That is what makes
        // "Add product with 24 in stock" land somewhere specific.
        const startingStock = Number(form.starting_stock) || 0;

        if (startingStock > 0 && branchId) {
          await addBatch(created.id, branchId, startingStock, {
            cost: details.cost_price,
            expiry: details.expiry_date,
            reason: 'restock',
          });
        }
      } else {
        // Editing never changes stock. Stock has its own page,
        // and every change there leaves a movement record.
        await updateProduct(product.id, details);
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const profit = Number(form.selling_price) - Number(form.cost_price);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="popup" onClick={(e) => e.stopPropagation()}>
        <h2>{isNew ? 'Add product' : 'Edit product'}</h2>

        {error && <div className="error">{error}</div>}

        <label>
          <span>Picture</span>
          {form.image_url && (
            <div className="picture-preview">
              <img src={form.image_url} alt="" />
              <button
                className="small"
                onClick={() => update('image_url', '')}
              >
                Remove
              </button>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handlePicture} />
          {uploading && (
            <span className="grey small-text">Uploading...</span>
          )}
        </label>

        <label>
          <span>Name</span>
          <input
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            autoFocus
          />
        </label>

        <label>
          <span>Barcode</span>
          <input
            value={form.barcode}
            onChange={(e) => update('barcode', e.target.value)}
          />
        </label>

        <label>
          <span>Category</span>
          <select
            value={form.category_id}
            onChange={(e) => update('category_id', e.target.value)}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <div className="two-columns">
          <label>
            <span>Cost price</span>
            <input
              type="number"
              step="0.01"
              value={form.cost_price}
              onChange={(e) => update('cost_price', e.target.value)}
            />
          </label>

          <label>
            <span>Selling price</span>
            <input
              type="number"
              step="0.01"
              value={form.selling_price}
              onChange={(e) => update('selling_price', e.target.value)}
            />
          </label>
        </div>

        {form.cost_price !== '' && form.selling_price !== '' && (
          <p
            className="small-text"
            style={{
              marginTop: -8,
              color: profit < 0 ? 'var(--red)' : 'var(--green)',
            }}
          >
            {profit < 0
              ? 'You would lose ' + money(-profit) + ' on each one'
              : 'Profit ' + money(profit) + ' on each one'}
          </p>
        )}

        <div className="two-columns">
          <label>
            <span>Warn me at</span>
            <input
              type="number"
              value={form.low_stock_at}
              onChange={(e) => update('low_stock_at', e.target.value)}
            />
          </label>

          <label>
            <span>Warn days before expiry</span>
            <input
              type="number"
              value={form.expiry_warn_days}
              onChange={(e) => update('expiry_warn_days', e.target.value)}
            />
          </label>
        </div>

        <p className="small-text grey" style={{ marginTop: -8 }}>
          Tell me when {form.low_stock_at || 0} or fewer are left, and{' '}
          {form.expiry_warn_days || 0} days before it goes off.
        </p>

        <label>
          <span>Expiry date</span>
          <input
            type="date"
            value={form.expiry_date}
            onChange={(e) => update('expiry_date', e.target.value)}
          />
        </label>

        {isNew && (
          <label>
            <span>Stock you have now (at this branch)</span>
            <input
              type="number"
              value={form.starting_stock}
              onChange={(e) => update('starting_stock', e.target.value)}
            />
          </label>
        )}

        <div className="popup-buttons">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={save}
            disabled={busy || form.name.trim() === ''}
          >
            {busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}