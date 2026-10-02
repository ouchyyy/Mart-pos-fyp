// ============================================================
// Sales.jsx — every sale, and what actually sold
//
// Two sections:
//
//   Sales by product   rank, times sold, units, share of funds
//   Sales list         every individual sale, with receipts
//
// Both follow the same filter bar — date range, branch (owner
// only) and search. Change the filter, both sections update.
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

  const totalUnitsSold = byProduct.reduce(
    (sum, row) => sum + row.quantity_sold,
    0
  );
  const totalFundsReceived = byProduct.reduce(
    (sum, row) => sum + row.funds_received,
    0
  );

  const hasFilter =
    fromDate !== '' ||
    toDate !== '' ||
    pickedBranch !== '' ||
    search !== '';

  // A small colour for the top three ranks, and grey for the rest.
  function rankTone(index) {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return 'plain';
  }

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
          note={completed + ' completed sales'}
          noteTone="grey"
        />
        <StatCard
          icon={<ReceiptIcon />}
          tone="violet"
          label="Average sale"
          value={money(average)}
          note={
            fromDate || toDate ? 'In the chosen period' : 'Across all sales'
          }
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
      <div
        className="box"
        style={{
          padding: '16px 22px',
          marginBottom: 22,
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

      {/* ============================================================
          SALES BY PRODUCT
          ============================================================ */}
      <SectionCard
        icon={<PackageIcon />}
        title="Sales by product"
        count={
          byProduct.length +
          (byProduct.length === 1
            ? ' product sold · '
            : ' products sold · ') +
          totalUnitsSold +
          ' units · ' +
          money(totalFundsReceived)
        }
        padding={0}
      >
        <table className="sales-table">
          <thead>
            <tr>
              <th style={{ width: 44 }}></th>
              <th>Product</th>
              <th className="right">Times sold</th>
              <th className="right">Unit price</th>
              <th className="right">Quantity sold</th>
              <th className="right">Funds received</th>
            </tr>
          </thead>
          <tbody>
            {shownProducts.map((row, index) => {
              const share =
                totalFundsReceived > 0
                  ? (row.funds_received / totalFundsReceived) * 100
                  : 0;

              return (
                <tr key={row.product_id}>
                  <td>
                    <span className={'rank-badge ' + rankTone(index)}>
                      {index + 1}
                    </span>
                  </td>
                  <td className="sales-product-name">{row.product_name}</td>
                  <td className="right number">{row.sales_count}</td>
                  <td className="right number">{money(row.unit_cost)}</td>
                  <td className="right number">{row.quantity_sold}</td>
                  <td className="right">
                    <div className="funds-cell">
                      <span className="funds-amount number">
                        {money(row.funds_received)}
                      </span>
                      <span className="funds-share grey number">
                        {share.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {shownProducts.length > 0 && (
            <tfoot>
              <tr>
                <td></td>
                <td>
                  <strong>Total</strong>
                </td>
                <td className="right number">
                  <strong>{completed}</strong>
                </td>
                <td></td>
                <td className="right number">
                  <strong>{totalUnitsSold}</strong>
                </td>
                <td className="right number">
                  <strong>{money(totalFundsReceived)}</strong>
                </td>
              </tr>
            </tfoot>
          )}
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
          SALES LIST
          ============================================================ */}
      <SectionCard
        icon={<SalesIcon />}
        title="Sales list"
        count={shownSales.length + ' of ' + sales.length + ' sales'}
        padding={0}
      >
        <table className="sales-table">
          <thead>
            <tr>
              {isOwner && <th>Branch</th>}
              <th>Invoice</th>
              <th>When</th>
              <th>Served by</th>
              <th className="right">Discount</th>
              <th className="right">Total</th>
              <th style={{ width: 180 }}></th>
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
                    {sale.status === 'completed' && isOwner && (
                      <button
                        className="small danger"
                        onClick={() => handleCancel(sale)}
                      >
                        Cancel
                      </button>
                    )}
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
