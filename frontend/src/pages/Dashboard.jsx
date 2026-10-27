// ============================================================
// Dashboard.jsx — the owner's first screen
//
// Shows:
//   1. High-level KPIs (intake, profit, sales count, busiest)
//   2. Branch-by-branch comparison
//   3. Top selling products (today)
//   4. Revenue breakdown by product (today)
//
// Refreshes itself every 60 seconds.
// ============================================================

import { useState, useEffect } from 'react';
import {
  getSalesSince,
  getSalesByProduct,
  getSalesProfit,
  getProfitByBranch,
} from '../database';
import { money } from '../money';

import { PageHeader, StatCard, SectionCard } from '../components/Ui';
import {
  WalletIcon,
  SalesIcon,
  BranchesIcon,
  TrendIcon,
  PackageIcon,
} from '../components/Icons';
import RankChart from '../components/RankChart';

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

  const [totalToday, setTotalToday] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [profitToday, setProfitToday] = useState(0);
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

    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

    return { now, todayStart, fourHoursAgo };
  }

  async function load() {
    if (!branches || branches.length === 0) {
      setLoading(false);
      return;
    }

    setError('');

    try {
      const { now, todayStart, fourHoursAgo } = windows();
      const todayStr = todayString();

      const [today, products, profitData, branchProfits] = await Promise.all([
        getSalesSince(null, todayStart.toISOString()),
        getSalesByProduct(null, todayStr, todayStr),
        getSalesProfit(null, todayStr, todayStr),
        getProfitByBranch(todayStr, todayStr),
      ]);

      const rows = branches.map((b) => {
        const todayB = today.filter((s) => s.branch_id === b.id);
        const tToday = todayB.reduce((sum, s) => sum + Number(s.total), 0);

        const earlierToday = todayB.some((s) => new Date(s.created_at) < fourHoursAgo);
        const recent = todayB.filter((s) => new Date(s.created_at) >= fourHoursAgo);
        const quiet = earlierToday && recent.length === 0 && now.getHours() >= 10;

        return {
          id: b.id,
          name: b.name,
          code: b.code,
          sales: todayB.length,
          takings: tToday,
          profit: branchProfits[b.id]?.profit || 0,
          quiet,
        };
      });

      rows.sort((a, b) => b.takings - a.takings);

      setBranchRows(rows);
      setByProduct(products);
      setTotalToday(today.reduce((s, x) => s + Number(x.total), 0));
      setSalesToday(today.length);
      setProfitToday(profitData.profit);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  if (!branches || branches.length === 0) {
    return (
      <div>
        <PageHeader breadcrumb="Overview" title="Dashboard" />
        <div className="box">
          <p style={{ margin: 0 }}>No branches yet. Go to <strong>Branches</strong> and add one, then come back here.</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="empty">Loading...</div>;

  const busiest = branchRows.length > 0 ? branchRows[0] : null;

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
        actions={
          <>
            <button onClick={() => onGo('reports')}><TrendIcon /> Full reports</button>
            <button className="primary" onClick={() => onGo('branches')}><BranchesIcon /> Manage branches</button>
          </>
        }
      />

      {error && <div className="error">{error}</div>}

      {/* ---------- KPIs ---------- */}
      <div className="stat-grid">
        <StatCard
          icon={<WalletIcon />}
          tone="blue"
          label="Total Intake"
          value={money(totalToday)}
        />

        <StatCard
          icon={<TrendIcon />}
          tone="green"
          label="Income (Profit)"
          value={money(profitToday)}
        />

        <StatCard
          icon={<SalesIcon />}
          tone="violet"
          label="Sales Today"
          value={salesToday}
        />

        <StatCard
          icon={<BranchesIcon />}
          tone="teal"
          label="Busiest Branch"
          value={busiest && busiest.takings > 0 ? busiest.name : '—'}
        />
      </div>

      {/* ---------- branches ---------- */}
      <SectionCard
        icon={<BranchesIcon />}
        title="Branches Performance"
        count={branchRows.length + (branchRows.length === 1 ? ' branch · today' : ' branches · today')}
        padding={0}
      >
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th className="right">Sales</th>
              <th className="right">Takings</th>
              <th className="right">Profit</th>
            </tr>
          </thead>
          <tbody>
            {branchRows.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.name}
                  {row.code && <span className="grey small-text number" style={{ marginLeft: 6 }}>{row.code}</span>}
                  {row.quiet && <span className="tag warning" style={{ marginLeft: 8 }}>quiet</span>}
                </td>
                <td className="right number">{row.sales}</td>
                <td className="right number">{money(row.takings)}</td>
                <td className="right number" style={{ color: row.profit < 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                  {money(row.profit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      {/* ---------- product insights ---------- */}
      <div className="side-by-side equal" style={{ marginTop: 24 }}>
        <SectionCard icon={<TrendIcon />} title="Top Selling Products" count="Today · by quantity">
          {topSellers.length > 0 ? <RankChart rows={topSellers} /> : <div className="empty small-text">No products sold yet today.</div>}
        </SectionCard>

        <SectionCard icon={<PackageIcon />} title="Revenue by Product" count="Today · all branches" padding={0}>
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
                    <td className="right number total-cell">{money(p.funds_received)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {byProduct.length === 0 && <div className="empty small-text">Nothing sold yet today.</div>}
          </div>
        </SectionCard>
      </div>

      <div className="grey small-text" style={{ marginTop: 24 }}>
        Updated {lastRefresh.toLocaleTimeString()} · refreshes every minute
      </div>
    </div>
  );
}
