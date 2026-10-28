// ============================================================
// Dashboard.jsx — the owner's first screen
// ============================================================

import { useState, useEffect } from 'react';
import {
  getSalesSince,
  getSalesByProduct,
  getSalesProfit,
  getProfitByBranch,
  getSales,
  getExpiringSoon,
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
  CalendarIcon,
} from '../components/Icons';
import RankChart from '../components/RankChart';

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return yyyy + '-' + mm + '-' + dd;
}

export default function Dashboard({ branches, onGo }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Default to today
  const [pickedDate, setPickedDate] = useState(todayString());
  
  const [alerts, setAlerts] = useState([]);
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
  }, [pickedDate]); // Reload when the date changes

  async function load() {
    if (!branches || branches.length === 0) {
      setLoading(false);
      return;
    }

    setError('');

    try {
      const now = new Date();
      const todayStr = todayString();
      const isToday = pickedDate === todayStr;

      // Fetch data for the selected date
      const [salesList, products, profitData, branchProfits] = await Promise.all([
        getSales(null, pickedDate, pickedDate),
        getSalesByProduct(null, pickedDate, pickedDate),
        getSalesProfit(null, pickedDate, pickedDate),
        getProfitByBranch(pickedDate, pickedDate),
      ]);

      const rows = branches.map((b) => {
        const dayB = salesList.filter((s) => s.branch_id === b.id);
        const tDay = dayB.reduce((sum, s) => sum + Number(s.total), 0);

        // "Quiet" logic only applies to today
        let quiet = false;
        if (isToday) {
          const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
          const earlierToday = dayB.some((s) => new Date(s.created_at) < fourHoursAgo);
          const recent = dayB.filter((s) => new Date(s.created_at) >= fourHoursAgo);
          quiet = earlierToday && recent.length === 0 && now.getHours() >= 10;
        }

        return {
          id: b.id,
          name: b.name,
          code: b.code,
          sales: dayB.length,
          takings: tDay,
          profit: branchProfits[b.id]?.profit || 0,
          quiet,
        };
      });

      rows.sort((a, b) => b.takings - a.takings);

      // Only fetch alerts (expiring/quiet) if looking at today
      const found = [];
      if (isToday) {
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayStartTime = todayStart.getTime();

        for (const b of branches) {
          const soon = await getExpiringSoon(b.id);
          const expiringToday = soon.filter((p) => {
            const exp = new Date(p.expiry_date);
            exp.setHours(0, 0, 0, 0);
            return exp.getTime() <= todayStartTime;
          });

          if (expiringToday.length > 0) {
            found.push({
              branchName: b.name,
              message: expiringToday.length + (expiringToday.length === 1 ? ' product expiring today' : ' products expiring today'),
              tone: 'urgent',
            });
          }

          const row = rows.find((r) => r.id === b.id);
          if (row && row.quiet) {
            found.push({ branchName: b.name, message: 'no sales in the last 4 hours', tone: 'quiet' });
          }
        }
      }

      setAlerts(found);
      setBranchRows(rows);
      setByProduct(products);
      setTotalToday(salesList.reduce((s, x) => s + Number(x.total), 0));
      setSalesToday(salesList.length);
      setProfitToday(profitData.profit);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  function pickToday() {
    setPickedDate(todayString());
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

  if (loading && !lastRefresh) return <div className="empty">Loading...</div>;

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--paper)', border: '1px solid var(--line)', padding: '4px 8px', borderRadius: 8 }}>
              <CalendarIcon style={{ width: 16, height: 16, color: 'var(--muted)' }} />
              <input
                type="date"
                value={pickedDate}
                onChange={(e) => setPickedDate(e.target.value)}
                style={{ border: 'none', background: 'transparent', padding: 0, width: 125, fontSize: 14 }}
              />
            </div>
            {pickedDate !== todayString() && (
              <button onClick={pickToday}>Today</button>
            )}
            <button onClick={() => onGo('reports')}><TrendIcon /> Full reports</button>
            <button className="primary" onClick={() => onGo('branches')}><BranchesIcon /> Manage branches</button>
          </div>
        }
      />

      {error && <div className="error">{error}</div>}

      {alerts.length > 0 && (
        <div className="dash-alerts">
          {alerts.map((a, i) => (
            <div key={i} className={'dash-alert ' + (a.tone || '')}>
              <span className="dash-alert-icon"><AlertTriangleIcon /></span>
              <span><strong>{a.branchName}</strong> · {a.message}</span>
            </div>
          ))}
        </div>
      )}

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
          label="Total Sales"
          value={salesToday}
        />

        <StatCard
          icon={<BranchesIcon />}
          tone="teal"
          label="Busiest Branch"
          value={busiest && busiest.takings > 0 ? busiest.name : '—'}
        />
      </div>

      <SectionCard
        icon={<BranchesIcon />}
        title="Branches Performance"
        count={branchRows.length + (branchRows.length === 1 ? ' branch · ' : ' branches · ') + new Date(pickedDate + 'T00:00:00').toLocaleDateString()}
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

      <div className="side-by-side equal" style={{ marginTop: 24 }}>
        <SectionCard icon={<TrendIcon />} title="Top Selling Products" count="By quantity">
          {topSellers.length > 0 ? <RankChart rows={topSellers} /> : <div className="empty small-text">No products sold on this date.</div>}
        </SectionCard>

        <SectionCard icon={<PackageIcon />} title="Revenue by Product" count="All branches" padding={0}>
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
            {byProduct.length === 0 && <div className="empty small-text">Nothing sold on this date.</div>}
          </div>
        </SectionCard>
      </div>

      <div className="grey small-text" style={{ marginTop: 24 }}>
        Updated {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
}
