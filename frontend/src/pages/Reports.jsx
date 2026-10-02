// ============================================================
// Reports.jsx — how the shop is doing
//
// Two shapes, one page:
//
//   "All branches"    the whole chain, combined. Plus a
//                     per-branch breakdown table.
//
//   "<branch name>"   exactly what a branch admin sees —
//                     one shop's cards, charts and warnings.
//
// The owner gets a tab bar to pick between them. Everyone else
// sees only the second shape, for their own branch. Nothing
// changes on their screen.
//
// The owner's tab is independent of the branch dropdown on the
// menu, because Reports is where you compare shops, and the menu
// dropdown is where you "go to" a shop for the day. Mixing the
// two would be confusing.
// ============================================================

import { useState, useEffect } from 'react';
import {
  getSalesSince,
  getBestSellers,
  getSalesByCategory,
  getBusiestHours,
  getPaymentSplit,
  getLowStock,
  getExpiringSoon,
} from '../database';
import { money, shortDate, daysUntil } from '../money';

import RankChart from '../components/RankChart';
import DonutChart from '../components/DonutChart';
import HoursChart from '../components/HoursChart';

export default function Reports({ branchId, user, branches }) {
  // Is this the owner, and do we have a list of branches to tab
  // through? If not, the page behaves as it always did.
  const canPickBranch =
    user && user.role === 'owner' && branches && branches.length > 0;

  // The view the owner has chosen:
  //   'all'    = the whole chain
  //   <bigint> = one branch
  // For an admin, this stays at their own branch and the tabs
  // are not rendered.
  const [view, setView] = useState(canPickBranch ? 'all' : branchId);

  // What we actually ask the database for:
  //   'all'    -> null (no filter, every branch)
  //   <bigint> -> that branch
  const queryBranchId = view === 'all' ? null : view;

  const [sales, setSales] = useState([]);
  const [days, setDays] = useState(1);
  const [bestSellers, setBestSellers] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [byHour, setByHour] = useState([]);
  const [payments, setPayments] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [expiring, setExpiring] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, view]);

  function startOfPeriod() {
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  async function load() {
    // An admin with no branch and no owner mode: nothing to show.
    if (!canPickBranch && !branchId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const since = startOfPeriod();
      const b = queryBranchId;

      setSales(await getSalesSince(b, since));
      setBestSellers(await getBestSellers(b, since));
      setByCategory(await getSalesByCategory(b, since));
      setByHour(await getBusiestHours(b, since));
      setPayments(await getPaymentSplit(b, since));

      // Low stock and expiry warnings only mean something for one
      // shop — "Milk is out" is not a chain-wide fact. In the
      // all-branches view we skip them and tell the reader why.
      if (b) {
        setLowStock(await getLowStock(b));
        setExpiring(await getExpiringSoon(b));
      } else {
        setLowStock([]);
        setExpiring([]);
      }
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  // An admin with no branch assigned: nothing to show.
  if (!canPickBranch && !branchId) {
    return (
      <div>
        <h1>Reports</h1>
        <div className="box">
          <p style={{ margin: 0 }}>
            There is no branch to show yet. Go to <strong>Branches</strong> on
            the menu and add one, then come back here.
          </p>
        </div>
      </div>
    );
  }

  // ---------- aggregate the numbers ----------
  let takings = 0;
  let givenAway = 0;
  for (const sale of sales) {
    takings = takings + Number(sale.total);
    givenAway =
      givenAway + Number(sale.discount || 0) + Number(sale.item_discount || 0);
  }
  const average = sales.length > 0 ? takings / sales.length : 0;

  const periodLabel =
    days === 1 ? 'Today' : days === 7 ? 'Last 7 days' : 'Last 30 days';

  const isAllView = view === 'all';

  // ---------- per-branch breakdown (only in the all view) ----------
  let chainRows = [];
  if (isAllView) {
    const byBranch = {};

    for (const sale of sales) {
      const key = sale.branch_id;
      if (!byBranch[key]) {
        byBranch[key] = { id: key, sales: 0, takings: 0 };
      }
      byBranch[key].sales += 1;
      byBranch[key].takings += Number(sale.total);
    }

    chainRows = branches.map((b) => {
      const row = byBranch[b.id] || { sales: 0, takings: 0 };
      return {
        id: b.id,
        name: b.name,
        code: b.code,
        sales: row.sales,
        takings: row.takings,
        average: row.sales > 0 ? row.takings / row.sales : 0,
      };
    });

    // Best shop first — the one the owner wants to see at the top.
    chainRows.sort((a, b) => b.takings - a.takings);
  }

  const chainBest = chainRows.length > 0 ? chainRows[0] : null;

  // The name to show in the "which report is this" heading.
  const selectedBranch = branches
    ? branches.find((b) => b.id === view)
    : null;
  const reportLabel = isAllView
    ? 'All branches'
    : selectedBranch
    ? selectedBranch.name
    : 'Reports';

  return (
    <div>
      {/* ============================================================
          Header: heading, branch tabs, period buttons
          ============================================================ */}
      <div className="reports-head">
        <h1 style={{ margin: 0 }}>
          Reports
          {canPickBranch && (
            <span
              className="grey"
              style={{ fontSize: 15, fontWeight: 400, marginLeft: 10 }}
            >
              · {reportLabel}
            </span>
          )}
        </h1>

        <div className="period-choice">
          <button className={days === 1 ? 'on' : ''} onClick={() => setDays(1)}>
            Today
          </button>
          <button className={days === 7 ? 'on' : ''} onClick={() => setDays(7)}>
            7 days
          </button>
          <button className={days === 30 ? 'on' : ''} onClick={() => setDays(30)}>
            30 days
          </button>
        </div>
      </div>

      {/* Branch tabs — owner only. */}
      {canPickBranch && (
        <div className="branch-tabs">
          <button
            className={isAllView ? 'on' : ''}
            onClick={() => setView('all')}
          >
            All branches
          </button>

          {branches.map((b) => (
            <button
              key={b.id}
              className={view === b.id ? 'on' : ''}
              onClick={() => setView(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {loading && <div className="empty">Loading...</div>}

      {/* ============================================================
          ALL BRANCHES: chain cards + per-branch table
          ============================================================ */}
      {isAllView && (
        <>
          <div className="cards">
            <div className="card">
              <div className="label">Chain takings · {periodLabel.toLowerCase()}</div>
              <div className="value number">{money(takings)}</div>
            </div>
            <div className="card">
              <div className="label">Chain sales</div>
              <div className="value number">{sales.length}</div>
            </div>
            <div className="card">
              <div className="label">Busiest branch</div>
              <div className="value" style={{ fontSize: 18 }}>
                {chainBest && chainBest.takings > 0 ? chainBest.name : '—'}
              </div>
            </div>
            <div className="card">
              <div className="label">Average per branch</div>
              <div className="value number">
                {money(chainRows.length > 0 ? takings / chainRows.length : 0)}
              </div>
            </div>
          </div>

          <div className="box" style={{ marginBottom: 20 }}>
            <h2>Branches side by side</h2>
            <p className="chart-note">{periodLabel}</p>

            <table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="right">Sales</th>
                  <th className="right">Takings</th>
                  <th className="right">Average sale</th>
                  <th className="right">Share of chain</th>
                </tr>
              </thead>
              <tbody>
                {chainRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {row.name}
                      {row.code && (
                        <span
                          className="grey small-text number"
                          style={{ marginLeft: 6 }}
                        >
                          {row.code}
                        </span>
                      )}
                    </td>
                    <td className="right number">{row.sales}</td>
                    <td className="right number">{money(row.takings)}</td>
                    <td className="right number">{money(row.average)}</td>
                    <td className="right number">
                      {takings > 0
                        ? Math.round((row.takings / takings) * 100) + '%'
                        : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--ink)' }}>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td className="right number">
                    <strong>{sales.length}</strong>
                  </td>
                  <td className="right number">
                    <strong>{money(takings)}</strong>
                  </td>
                  <td className="right number">
                    <strong>
                      {money(sales.length > 0 ? takings / sales.length : 0)}
                    </strong>
                  </td>
                  <td className="right number">
                    <strong>100%</strong>
                  </td>
                </tr>
              </tfoot>
            </table>

            {chainRows.length === 0 && (
              <div className="empty small-text">No branches yet.</div>
            )}
          </div>
        </>
      )}

      {/* ============================================================
          ONE BRANCH: the four cards an admin sees
          ============================================================ */}
      {!isAllView && (
        <div className="cards">
          <div className="card">
            <div className="label">Takings · {periodLabel.toLowerCase()}</div>
            <div className="value number">{money(takings)}</div>
          </div>
          <div className="card">
            <div className="label">Sales</div>
            <div className="value number">{sales.length}</div>
          </div>
          <div className="card">
            <div className="label">Average sale</div>
            <div className="value number">{money(average)}</div>
          </div>
          <div className="card">
            <div className="label">Discounts</div>
            <div
              className="value number"
              style={{ color: givenAway > 0 ? 'var(--red)' : '' }}
            >
              {money(givenAway)}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          Charts — same in both views
          ============================================================ */}
      <div className="side-by-side equal">
        <div className="box">
          <h2>Sales by category</h2>
          <p className="chart-note">
            {periodLabel}
            {isAllView ? ' · all branches' : ''}
          </p>
          <DonutChart
            slices={byCategory.map((row) => ({
              name: row.name,
              money: row.money,
            }))}
          />
        </div>

        <div className="box">
          <h2>Best sellers</h2>
          <p className="chart-note">
            Top 5 · {periodLabel.toLowerCase()}
            {isAllView ? ' · all branches' : ''}
          </p>
          <RankChart
            rows={bestSellers.slice(0, 5).map((row) => ({
              label: row.name,
              amount: row.money,
              extra: row.sold + ' sold',
            }))}
          />
        </div>
      </div>

      <div className="box" style={{ marginTop: 20 }}>
        <h2>Busiest times of day</h2>
        <p className="chart-note">
          {periodLabel}
          {isAllView ? ' · all branches combined' : ''}. This is the one that
          changes how the shop is run — it says when two people are needed on
          the till.
        </p>
        <HoursChart hours={byHour} />
      </div>

      {payments.length > 0 && (
        <div className="box" style={{ marginTop: 20 }}>
          <h2>How customers paid</h2>
          <p className="chart-note">
            {periodLabel}
            {isAllView ? ' · all branches' : ''}
          </p>
          <DonutChart
            slices={payments.map((row) => ({
              name: row.name === 'qr' ? 'QR code' : 'Cash',
              money: row.money,
            }))}
          />
        </div>
      )}

      {/* ============================================================
          Warnings — only in the single-branch view
          ============================================================ */}
      {!isAllView && (
        <div className="side-by-side equal" style={{ marginTop: 20 }}>
          <div className="box" style={{ padding: 0 }}>
            <h2 style={{ padding: '16px 18px 0' }}>Running low</h2>
            <table>
              <tbody>
                {lowStock.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td className="right">
                      <span
                        className={
                          product.stock_quantity === 0
                            ? 'tag out number'
                            : 'tag warning number'
                        }
                      >
                        {product.stock_quantity === 0
                          ? 'out'
                          : product.stock_quantity + ' left'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lowStock.length === 0 && (
              <div className="empty small-text">Everything is stocked up.</div>
            )}
          </div>

          <div className="box" style={{ padding: 0 }}>
            <h2 style={{ padding: '16px 18px 0' }}>Expiring soon</h2>
            <p className="chart-note" style={{ padding: '0 18px' }}>
              Marked down automatically: 50% off inside 14 days, 75% inside 7.
            </p>
            <table>
              <tbody>
                {expiring.map((product) => {
                  const days = daysUntil(product.expiry_date);

                  return (
                    <tr key={product.id}>
                      <td>
                        {product.name}
                        <div className="grey small-text">
                          {shortDate(product.expiry_date)}
                        </div>
                      </td>
                      <td className="right">
                        {product.clearance_percent > 0 && (
                          <div className="clearance-price number">
                            {money(product.price_today)}
                            <span className="was">
                              {' '}
                              {money(product.selling_price)}
                            </span>
                          </div>
                        )}
                        <span className={days < 0 ? 'tag out' : 'tag warning'}>
                          {days < 0 ? 'expired' : days + ' days'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {expiring.length === 0 && (
              <div className="empty small-text">Nothing expiring soon.</div>
            )}
          </div>
        </div>
      )}

      {/* A short note explaining why these are missing in the
          all-branches view — so it reads as a choice, not a bug. */}
      {isAllView && (
        <div className="box" style={{ marginTop: 20 }}>
          <p style={{ margin: 0 }} className="grey small-text">
            Low-stock and expiry warnings are per branch — a product can be out
            at one shop and stocked at another. Pick a branch above to see its
            warnings.
          </p>
        </div>
      )}
    </div>
  );
}