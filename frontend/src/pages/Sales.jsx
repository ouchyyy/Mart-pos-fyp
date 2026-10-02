// ============================================================
// Sales.jsx — past sales, one branch or the whole chain
//
// Three sections, top to bottom:
//
//   KPI cards        the numbers an owner asks for
//   Sales by product one row per product, rolled up
//   All sales        every receipt, one row each
//
// The filter bar applies to both tables, so what you see on
// top and what you see below always cover the same period.
// ============================================================

import { useState, useEffect } from 'react';
import {
  getSales,
  getSale,
  cancelSale,
  getSalesByProduct,
} from '../database';
import { money, dateAndTime } from '../money';

import { PageHeader, StatCard, SectionCard } from '../components/Ui';
import {
  SalesIcon,
  WalletIcon,
  ReceiptIcon,
  TrendIcon,
  SearchIcon2,
  ProductsIcon,
  PackageIcon,
} from '../components/Icons';
import Receipt from '../components/Receipt';

export default function Sales({ user, branchId, branches }) {
  const [sales, setSales] = useState([]);
  const [byProduct, setByProduct] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pickedBranch, setPickedBranch] = useState('');
  const [search, setSearch] = useState('');
  const [looking, setLooking] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const isOwner = user.role === 'owner';

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, branchId, pickedBranch]);

  async function load() {
    setLoading(true);
    try {
      const filter = isOwner
        ? pickedBranch === ''
          ? null
          : Number(pickedBranch)
        : branchId;

      const [saleRows, productRows] = await Promise.all([
        getSales(filter, fromDate, toDate),
        getSalesByProduct(filter, fromDate, toDate),
      ]);

      setSales(saleRows);
      setByProduct(productRows);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
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
    if (!reason) return;
    try {
      await cancelSale(sale.id, reason);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // ---------- filters ----------
  function matchesSearch(text, sale) {
    if (text === '') return true;
    const s = text.toLowerCase();
    const invoice = (sale.invoice_no || '').toLowerCase();
    const cashier = sale.profiles
      ? (sale.profiles.full_name || '').toLowerCase()
      : '';
    const branch = sale.branches ? sale.branches.name.toLowerCase() : '';
    return (
      invoice.includes(s) || cashier.includes(s) || branch.includes(s)
    );
  }

  const shownSales = sales.filter((sale) => matchesSearch(search, sale));

  const shownProducts = byProduct.filter((p) => {
    if (search === '') return true;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  // ---------- summary ----------
  let total = 0;
  let discounts = 0;
  let completed = 0;
  for (const sale of sales) {
    if (sale.status === 'completed') {
      total += Number(sale.total);
      discounts +=
        Number(sale.discount || 0) + Number(sale.item_discount || 0);
      completed += 1;
    }
  }
  const average = completed > 0 ? total / completed : 0;
  const cancelled = sales.length - completed;

  const totalUnits = shownProducts.reduce((sum, p) => sum + p.quantity, 0);
  const totalProductMoney = shownProducts.reduce((sum, p) => sum + p.money, 0);

  const hasFilter =
    fromDate !== '' ||
    toDate !== '' ||
    pickedBranch !== '' ||
    search !== '';

  return (
    <div>
      <PageHeader
        breadcrumb="Sales / History"
        title="Sales"
        subtitle={
          isOwner
            ? 'Every sale at every branch, and the option to cancel a mistake.'
            : 'Every sale at this branch.'
        }
      />

      {error && <div className="error">{error}</div>}

      {/* ---------- KPI cards ---------- */}
      <div className="stat-grid">
        <StatCard
          icon={<WalletIcon />}
          tone="blue"
          label="Total takings"
          value={money(total)}
          note={completed + ' completed sales'}
          noteTone="grey"
        />
        <StatCard
          icon={<ReceiptIcon />}
          tone="violet"
          label="Average sale"
          value={money(average)}
          note={fromDate || toDate ? 'In the chosen period' : 'Across all sales'}
          noteTone="grey"
        />
        <StatCard
          icon={<TrendIcon />}
          tone="amber"
          label="Discounts given"
          value={money(discounts)}
          note={discounts > 0 ? 'Money off the till' : 'No discounts given'}
          noteTone={discounts > 0 ? 'amber' : 'green'}
        />
        <StatCard
          icon={<SalesIcon />}
          tone="red"
          label="Cancelled"
          value={cancelled}
          note={cancelled > 0 ? 'Look at the reasons' : 'None cancelled'}
          noteTone={cancelled > 0 ? 'red' : 'green'}
        />
      </div>

      {/* ---------- filter bar (shared by both tables) ---------- */}
      <div className="box" style={{ padding: '16px 22px', marginBottom: 22 }}>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          <div
            className="staff-search"
            style={{ flex: 1, minWidth: 220, maxWidth: 320 }}
          >
            <SearchIcon2 />
            <input
              placeholder="Search product, invoice or staff"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <label style={{ margin: 0, minWidth: 140 }}>
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>

          <label style={{ margin: 0, minWidth: 140 }}>
            <span>To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>

          {isOwner && branches && (
            <label style={{ margin: 0, minWidth: 170 }}>
              <span>Branch</span>
              <select
                value={pickedBranch}
                onChange={(e) => setPickedBranch(e.target.value)}
              >
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {hasFilter && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
                setPickedBranch('');
                setSearch('');
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ============================================================
          Sales by product — the rolled-up view
          ============================================================ */}
      <SectionCard
        icon={<ProductsIcon />}
        title="Sales by product"
        count={
          shownProducts.length +
          ' product' +
          (shownProducts.length === 1 ? '' : 's') +
          ' · ' +
          totalUnits +
          ' units · ' +
          money(totalProductMoney)
        }
        actions={<span className="grey small-text">Biggest earner first</span>}
        padding={0}
      >
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th className="right">Unit price</th>
              <th className="right">Quantity sold</th>
              <th className="right">Sales</th>
              <th className="right">Funds received</th>
            </tr>
          </thead>
          <tbody>
            {shownProducts.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="name-with-photo">
                    <span
                      className="section-card-icon"
                      style={{ width: 30, height: 30 }}
                    >
                      <PackageIcon />
                    </span>
                    <div>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      <div className="grey small-text">
                        {p.sales} transaction{p.sales === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="right number">
                  {money(p.currentPrice)}
                  {p.currentPrice !== p.unitPrice && (
                    <div
                      className="grey small-text"
                      style={{ fontSize: 11 }}
                    >
                      sold at {money(p.unitPrice)}
                    </div>
                  )}
                </td>
                <td className="right number" style={{ fontWeight: 600 }}>
                  {p.quantity}
                </td>
                <td className="right number grey">{p.sales}</td>
                <td
                  className="right number"
                  style={{ fontWeight: 700, letterSpacing: '-0.01em' }}
                >
                  {money(p.money)}
                </td>
              </tr>
            ))}
          </tbody>
          {shownProducts.length > 0 && (
            <tfoot>
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td></td>
                <td className="right number">
                  <strong>{totalUnits}</strong>
                </td>
                <td className="right number">
                  <strong>
                    {shownProducts.reduce((s, p) => s + p.sales, 0)}
                  </strong>
                </td>
                <td className="right number">
                  <strong>{money(totalProductMoney)}</strong>
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {!loading && shownProducts.length === 0 && (
          <div className="empty small-text">
            {search
              ? 'No products match the search.'
              : 'Nothing sold in this period.'}
          </div>
        )}
      </SectionCard>

      {/* ============================================================
          All sales — the receipt-level view
          ============================================================ */}
      <SectionCard
        icon={<SalesIcon />}
        title="All sales"
        count={shownSales.length + ' of ' + sales.length + ' sales'}
        padding={0}
      >
        <table>
          <thead>
            <tr>
              {isOwner && <th>Branch</th>}
              <th>Invoice</th>
              <th>When</th>
              <th>Served by</th>
              <th className="right">Discount</th>
              <th className="right">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shownSales.map((sale) => (
              <tr
                key={sale.id}
                style={{ opacity: sale.status === 'completed' ? 1 : 0.55 }}
              >
                {isOwner && (
                  <td className="small-text">
                    {sale.branches ? sale.branches.name : '-'}
                  </td>
                )}
                <td className="number">
                  {sale.invoice_no}
                  {sale.status !== 'completed' && (
                    <span className="tag warning" style={{ marginLeft: 6 }}>
                      cancelled
                    </span>
                  )}
                </td>
                <td className="small-text grey">
                  {dateAndTime(sale.created_at)}
                </td>
                <td className="small-text">
                  {sale.profiles
                    ? sale.profiles.full_name || 'Unnamed staff'
                    : 'Deleted account'}
                </td>
                <td className="right number">
                  {Number(sale.discount) + Number(sale.item_discount || 0) > 0 ? (
                    <span className="discount-line">
                      -
                      {money(
                        Number(sale.discount) +
                          Number(sale.item_discount || 0)
                      )}
                    </span>
                  ) : (
                    <span className="grey">-</span>
                  )}
                </td>
                <td className="right number">{money(sale.total)}</td>
                <td className="right" style={{ whiteSpace: 'nowrap' }}>
                  <button
                    className="small"
                    onClick={() => showReceipt(sale.id)}
                  >
                    Receipt
                  </button>{' '}
                  {sale.status === 'completed' && isOwner && (
                    <button
                      className="small danger"
                      onClick={() => handleCancel(sale)}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && shownSales.length === 0 && (
          <div className="empty">
            {sales.length === 0
              ? 'No sales in this period.'
              : 'No sales match the filter.'}
          </div>
        )}
      </SectionCard>

      {looking && (
        <Receipt sale={looking} onClose={() => setLooking(null)} />
      )}
    </div>
  );
}
