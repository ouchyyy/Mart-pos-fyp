// ============================================================
// Dashboard.jsx — the owner's first screen
//
// Shows:
//   1. Alerts (expiring stock, quiet branches)
//   2. High-level KPIs (revenue, sales count, busiest branch)
//   3. Branch-by-branch comparison
//   4. Top selling products (today)
//   5. Revenue breakdown by product (today)
//
// Refreshes itself every 60 seconds.
// ============================================================

import { useState, useEffect } from 'react';
import {
  getSalesSince,
  getExpiringSoon,
  getSalesByProduct,
} from '../database';
import { money } from '../money';

import { PageHeader, StatCard, SectionCard } from '../components/Ui';
import {
  WalletIcon,
  SalesIcon,
  BranchesIcon,
  TrendIcon,
  AlertTriangleIcon,
  PackageIcon,
} from '../components/Icons';
import RankChart from '../components/RankChart';

// Helper to get today's date as a "YYYY-MM-DD" string
function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

export default function Dashboard({ branches, onGo, user }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [alerts, setAlerts] = useState([]);
  const [totalToday, setTotalToday] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [totalYesterday, setTotalYesterday] = useState(0);
  const [salesYesterday, setSalesYesterday] = useState(0);
  const [branchRows, setBranchRows] = useState([]);
  const [byProduct, setByProduct] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function windows() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const yesterdaySameTime = new Date(yesterdayStart);
    yesterdaySameTime.setHours(now.getHours(), now.getMinutes(), 0, 0);

    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    return { now, todayStart, yesterdayStart, yesterdaySameTime, fourHoursAgo };
  }

  async function load() {
    if (!branches || branches.length === 0) {
      setLoading(false);
      return;
    }

    setError('');

    try {
      const { now, todayStart, yesterdayStart, yesterdaySameTime, fourHoursAgo } =
        windows();

      const todayStr = todayString();

      // Fetch today's sales, yesterday's sales, and today's product breakdown
      const [today, sinceYesterday, products] = await Promise.all([
        getSalesSince(null, todayStart.toISOString()),
        getSalesSince(null, yesterdayStart.toISOString()),
        getSalesByProduct(null, todayStr, todayStr),
      ]);

      const yesterday = sinceYesterday.filter(
        (s) => new Date(s.created_at) <= yesterdaySameTime
      );

      // ---------- per-branch numbers ----------
      const rows = branches.map((b) => {
        const todayB = today.filter((s) => s.branch_id === b.id);
        const yesterdayB = yesterday.filter((s) => s.branch_id === b.id);

        const tToday = todayB.reduce((sum, s) => sum + Number(s.total), 0);
        const tYesterday = yesterdayB.reduce((sum, s) => sum + Number(s.total), 0);

        const earlierToday = todayB.some(
          (s) => new Date(s.created_at) < fourHoursAgo
        );
        const recent = todayB.filter(
          (s) => new Date(s.created_at) >= fourHoursAgo
        );
        const quiet =
          earlierToday && recent.length === 0 && now.getHours() >= 10;

        return {
          id: b.id,
          name: b.name,
          code: b.code,
          sales: todayB.length,
          takings: tToday,
          yesterdayTakings: tYesterday,
          change: percentChange(tToday, tYesterday),
          quiet,
        };
      });

      rows.sort((a, b) => b.takings - a.takings);

      // ---------- alerts ----------
      const found = [];
      for (const b of branches) {
        const soon = await getExpiringSoon(b.id);
        const todayStartTime = todayStart.getTime();
        const expiringToday = soon.filter((p) => {
          const exp = new Date(p.expiry_date);
          exp.setHours(0, 0, 0, 0);
          return exp.getTime() <= todayStartTime;
        });

        if (expiringToday.length > 0) {
          found.push({
            branchName: b.name,
            message:
              expiringToday.length +
              (expiringToday.length === 1
                ? ' product expiring today'
                : ' products expiring today'),
            tone: 'urgent',
          });
        }

        const row = rows.find((r) => r.id === b.id);
        if (row && row.quiet) {
          found.push({
            branchName: b.name,
            message: 'no sales in the last 4 hours',
            tone: 'quiet',
          });
        }
      }

      setAlerts(found);
      setBranchRows(rows);
      setByProduct(products);
      setTotalToday(today.reduce((s, x) => s + Number(x.total), 0));
      setSalesToday(today.length);
      setTotalYesterday(yesterday.reduce((s, x) => s + Number(x.total), 0));
      setSalesYesterday(yesterday.length);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  function percentChange(today, yesterday) {
    if (yesterday === 0) return today === 0 ? 'same' : 'new';
    return ((today - yesterday) / yesterday) * 100;
  }

  function changeLabel(change) {
    if (change === 'same' || change === 'new') return change;
    return (change >= 0 ? '+' : '') + change.toFixed(0) + '%';
  }

  function changeTone(change) {
    if (change === 'same' || change === 'new') return 'grey';
    return change >= 0 ? 'green' : 'red';
  }

  if (!branches || branches.length === 0) {
    return (
      <div>
        <PageHeader
          breadcrumb="Overview"
          title="Dashboard"
          subtitle="The whole chain, at a glance."
        />
        <div className="box">
          <p style={{ margin: 0 }}>
            No branches yet. Go to <strong>Branches</strong> and add one, then
            come back here.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="empty">Loading...</div>;
  }

  const chainChange = percentChange(totalToday, totalYesterday);
  const busiest = branchRows.length > 0 ? branchRows[0] : null;
  const greeting = user && user.full_name ? user.full_name : 'there';

  // Top sellers (by quantity)
  const topSellers = [...byProduct]
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, 5)
    .map((p) => ({
      label: p.product_name,
      amount: p.funds_received,
      extra: p.quantity_sold + ' sold',
    }));

  return (
    <div>
      <PageHeader
        breadcrumb="Overview"
        title="Dashboard"
        subtitle={
          'Welcome back, ' + greeting + '. Here is how the chain is doing today.'
        }
        actions={
          <>
            <button onClick={() => onGo('reports')}>
              <TrendIcon /> Full reports
            </button>
            <button className="primary" onClick={() => onGo('branches')}>
              <BranchesIcon /> Manage branches
            </button>
          </>
        }
      />

      {error && <div className="error">{error}</div>}

      {/* ---------- alerts ---------- */}
      {alerts.length > 0 && (
        <div className="dash-alerts">
          {alerts.map((a, i) => (
            <div key={i} className={'dash-alert ' + (a.tone || '')}>
              <span className="dash-alert-icon">
                <AlertTriangleIcon />
              </span>
              <span>
                <strong>{a.branchName}</strong> · {a.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ---------- KPIs ---------- */}
      <div className="stat-grid">
        <StatCard
          icon={<WalletIcon />}
          tone="blue"
          label="Today's Chain Takings"
          value={money(totalToday)}
          note={
            'Yesterday ' +
            money(totalYesterday) +
            '  ' +
            changeLabel(chainChange)
          }
          noteTone={changeTone(chainChange)}
        />

        <StatCard
          icon={<SalesIcon />}
          tone="violet"
          label="Sales Today"
          value={salesToday}
          note={
            'Yesterday ' +
            salesYesterday +
            '  ' +
            changeLabel(percentChange(salesToday, salesYesterday))
          }
          noteTone={changeTone(percentChange(salesToday, salesYesterday))}
        />

        <StatCard
          icon={<BranchesIcon />}
          tone="green"
          label="Busiest Branch"
          value={busiest && busiest.takings > 0 ? busiest.name : '—'}
          note={
            busiest && busiest.takings > 0
              ? money(busiest.takings) + ' today'
              : 'No sales yet'
          }
          noteTone="grey"
        />

        <StatCard
          icon={<TrendIcon />}
          tone="amber"
          label="Average per Branch"
          value={money(branchRows.length > 0 ? totalToday / branchRows.length : 0)}
          note={'Across ' + branchRows.length + ' branches'}
          noteTone="grey"
        />
      </div>

      {/* ---------- branches ---------- */}
      <SectionCard
        icon={<BranchesIcon />}
        title="Branches Performance"
        count={
          branchRows.length +
          (branchRows.length === 1 ? ' branch · today' : ' branches · today')
        }
        padding={0}
      >
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th className="right">Sales</th>
              <th className="right">Takings</th>
              <th className="right">vs yesterday</th>
            </tr>
          </thead>
          <tbody>
            {branchRows.map((row) => (
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
                  {row.quiet && (
                    <span className="tag warning" style={{ marginLeft: 8 }}>
                      quiet
                    </span>
                  )}
                </td>
                <td className="right number">{row.sales}</td>
                <td className="right number">{money(row.takings)}</td>
                <td
                  className="right number"
                  style={{
                    color:
                      changeTone(row.change) === 'green'
                        ? 'var(--green)'
                        : changeTone(row.change) === 'red'
                        ? 'var(--red)'
                        : 'var(--muted)',
                    fontWeight: 600,
                  }}
                >
                  {changeLabel(row.change)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      {/* ---------- product insights (today) ---------- */}
      <div className="side-by-side equal" style={{ marginTop: 24 }}>
        {/* Top Sellers */}
        <SectionCard
          icon={<TrendIcon />}
          title="Top Selling Products"
          count="Today · by quantity"
        >
          {topSellers.length > 0 ? (
            <RankChart rows={topSellers} />
          ) : (
            <div className="empty small-text">No products sold yet today.</div>
          )}
        </SectionCard>

        {/* Revenue by Product */}
        <SectionCard
          icon={<PackageIcon />}
          title="Revenue by Product"
          count="Today · all branches"
          padding={0}
        >
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="right">Qty</th>
                  <th className="right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map((p) => (
                  <tr key={p.product_id}>
                    <td>{p.product_name}</td>
                    <td className="right number">{p.quantity_sold}</td>
                    <td className="right number total-cell">
                      {money(p.funds_received)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {byProduct.length === 0 && (
              <div className="empty small-text">Nothing sold yet today.</div>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grey small-text" style={{ marginTop: 24 }}>
        Updated {lastRefresh.toLocaleTimeString()} · refreshes every minute
      </div>
    </div>
  );
}
