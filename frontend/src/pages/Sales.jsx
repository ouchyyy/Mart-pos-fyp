// ============================================================
// Sales.jsx — every sale, and what actually sold
//
// Filtering:
//
//   Quick chips   Today · Yesterday · Last 7 days · Last 30 days
//                 · All time
//   From / To     for a custom range, or just one day by setting
//                 both to the same date
//   Branch        owner only — all branches or one
//   Search        product, invoice number, staff name or branch
//
// Every filter narrows BOTH tables at once: the product summary
// and the invoice list.
// ============================================================

import { useState, useEffect } from 'react';
import { getSales, getSale, getSalesByProduct } from '../database';
import { money, dateAndTime } from '../money';

import { PageHeader, StatCard, SectionCard } from '../components/Ui';
import {
  SalesIcon,
  WalletIcon,
  ReceiptIcon,
  TrendIcon,
  SearchIcon2,
  PackageIcon,
} from '../components/Icons';
import Receipt from '../components/Receipt';

// Today as a "YYYY-MM-DD" string, in the browser's local time.
// `toISOString()` would give UTC and could land us on yesterday.
function todayString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

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

      const [salesList, productList] = await Promise.all([
        getSales(filter, fromDate, toDate),
        getSalesByProduct(filter, fromDate, toDate),
      ]);

      setSales(salesList);
      setByProduct(productList);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  // ---------- quick date presets ----------
  function pickToday() {
    const t = todayString(0);
    setFromDate(t);
    setToDate(t);
  }

  function pickYesterday() {
    const y = todayString(-1);
    setFromDate(y);
    setToDate(y);
  }

  function pickLastWeek() {
    setFromDate(todayString(-6));
    setToDate(todayString(0));
  }

  function pickLastMonth() {
    setFromDate(todayString(-29));
    setToDate(todayString(0));
  }

  function pickAllTime() {
    setFromDate('');
    setToDate('');
  }

  // Which preset is currently active? Drives the `.on` class on
  // the chips so you can see at a glance what range is on.
  function activePreset() {
    if (fromDate === '' && toDate === '') return 'all';
    if (fromDate === todayString(0) && toDate === todayString(0))
      return 'today';
    if (fromDate === todayString(-1) && toDate === todayString(-1))
      return 'yesterday';
    if (fromDate === todayString(-6) && toDate === todayString(0))
      return 'week';
    if (fromDate === todayString(-29) && toDate === todayString(0))
      return 'month';
    return '';
  }

  const preset = activePreset();

  async function showReceipt(id) {
    try {
      setLooking(await getSale(id));
    } catch (err) {
      setError(err.message);
    }
  }

  const shownSales = sales.filter((sale) => {
    if (search === '') return true;
    const text = search.toLowerCase();
    const invoice = (sale.invoice_no || '').toLowerCase();
    const cashier = sale.profiles
      ? (sale.profiles.full_name || '').toLowerCase()
      : '';
    const branch = sale.branches ? sale.branches.name.toLowerCase() : '';
    return (
      invoice.includes(text) || cashier.includes(text) || branch.includes(text)
    );
  });

  const shownProducts = byProduct.filter((row) => {
    if (search === '') return true;
    return row.product_name.toLowerCase().includes(search.toLowerCase());
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

  const hasFilter =
    fromDate !== '' ||
    toDate !== '' ||
    pickedBranch !== '' ||
    search !== '';

  function rankTone(index) {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return 'plain';
  }

  // A short, readable label for what range is on screen.
  const rangeLabel =
    preset === 'today'
      ? 'Today'
      : preset === 'yesterday'
      ? 'Yesterday'
      : preset === 'week'
      ? 'Last 7 days'
      : preset === 'month'
      ? 'Last 30 days'
      : preset === 'all'
      ? 'All time'
      : fromDate === toDate && fromDate !== ''
      ? fromDate
      : fromDate && toDate
      ? fromDate + ' → ' + toDate
      : fromDate
      ? 'From ' + fromDate
      : toDate
      ? 'To ' + toDate
      : 'All time';

  return (
    <div>
      <PageHeader
        breadcrumb="Sales / History"
        title="Sales"
        subtitle={
          isOwner
            ? 'Every sale at every branch, and what actually sold.'
            : 'Every sale at this branch, and what actually sold.'
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
          note={completed + ' completed · ' + rangeLabel}
          noteTone="grey"
        />
        <StatCard
          icon={<ReceiptIcon />}
          tone="violet"
          label="Average sale"
          value={money(average)}
          note={rangeLabel}
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

      {/* ---------- filter bar ---------- */}
      <div className="box" style={{ padding: '16px 22px', marginBottom: 22 }}>
        {/* Quick date chips */}
        <div className="filter-chips" style={{ marginBottom: 14 }}>
          <button
            className={'chip' + (preset === 'today' ? ' on' : '')}
            onClick={pickToday}
          >
            Today
          </button>
          <button
            className={'chip' + (preset === 'yesterday' ? ' on' : '')}
            onClick={pickYesterday}
          >
            Yesterday
          </button>
          <button
            className={'chip' + (preset === 'week' ? ' on' : '')}
            onClick={pickLastWeek}
          >
            Last 7 days
          </button>
          <button
            className={'chip' + (preset === 'month' ? ' on' : '')}
            onClick={pickLastMonth}
          >
            Last 30 days
          </button>
          <button
            className={'chip' + (preset === 'all' ? ' on' : '')}
            onClick={pickAllTime}
          >
            All time
          </button>
        </div>

        {/* Search + custom range + branch */}
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
          SALES BY PRODUCT
          ============================================================ */}
      <SectionCard
        icon={<PackageIcon />}
        title="Sales by product"
        count={rangeLabel}
        padding={0}
      >
        <table className="sales-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}></th>
              <th>Product</th>
              <th className="right">Unit price</th>
              <th className="right">Discount / unit</th>
              <th className="right">Quantity sold</th>
              <th className="right">Funds received</th>
            </tr>
          </thead>
          <tbody>
            {shownProducts.map((row, index) => (
              <tr key={row.product_id}>
                <td>
                  <span className={'rank-badge ' + rankTone(index)}>
                    {index + 1}
                  </span>
                </td>
                <td className="sales-product-name">{row.product_name}</td>
                <td className="right number">{money(row.unit_cost)}</td>
                <td
                  className="right number"
                  style={{
                    color:
                      row.discount_per_unit > 0
                        ? 'var(--red)'
                        : 'var(--muted)',
                    fontWeight: row.discount_per_unit > 0 ? 600 : 400,
                  }}
                >
                  {row.discount_per_unit > 0
                    ? '-' + money(row.discount_per_unit)
                    : money(0)}
                </td>
                <td className="right number">{row.quantity_sold}</td>
                <td className="right number total-cell">
                  {money(row.funds_received)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && shownProducts.length === 0 && (
          <div className="empty">
            {byProduct.length === 0
              ? 'Nothing sold in this period.'
              : 'No products match the filter.'}
          </div>
        )}
      </SectionCard>

      {/* ============================================================
          INVOICE LIST
          ============================================================ */}
      <SectionCard
        icon={<SalesIcon />}
        title="Invoice"
        count={
          shownSales.length +
          ' invoice' +
          (shownSales.length === 1 ? '' : 's') +
          ' · ' +
          rangeLabel
        }
        padding={0}
      >
        <table className="sales-table">
          <thead>
            <tr>
              {isOwner && <th>Branch</th>}
              <th>Invoice</th>
              <th>Time</th>
              <th>Served by</th>
              <th className="right">Discount</th>
              <th className="right">Total</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {shownSales.map((sale) => (
              <tr
                key={sale.id}
                style={{ opacity: sale.status === 'completed' ? 1 : 0.55 }}
              >
                {isOwner && (
                  <td>
                    {sale.branches ? (
                      <span className="branch-tag">
                        {sale.branches.name}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                )}
                <td className="number small-text">{sale.invoice_no}</td>
                <td className="small-text grey">
                  {dateAndTime(sale.created_at)}
                </td>
                <td className="small-text">
                  {sale.profiles
                    ? sale.profiles.full_name || 'Unnamed staff'
                    : 'Deleted account'}
                </td>
                <td className="right number">
                  {Number(sale.discount) + Number(sale.item_discount || 0) >
                  0 ? (
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
                <td className="right number total-cell">
                  {money(sale.total)}
                </td>
                <td className="right">
                  <div className="row-actions">
                    <button
                      className="small"
                      onClick={() => showReceipt(sale.id)}
                    >
                      Receipt
                    </button>
                    {sale.status !== 'completed' && (
                      <span className="tag warning">cancelled</span>
                    )}
                  </div>
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
