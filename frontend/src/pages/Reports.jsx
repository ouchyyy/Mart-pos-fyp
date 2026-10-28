// ============================================================
// Reports.jsx — analytics and charts
// ============================================================

import { useState, useEffect } from 'react';
import {
  getSalesSince,
  getSalesByProduct,
  getSalesByCategory,
  getBusiestHours,
  getPaymentSplit,
  getLowStock,
  getExpiringSoon,
} from '../database';
import { money, shortDate, daysUntil } from '../money';

import { PageHeader, StatCard, SectionCard } from '../components/Ui';
import {
  SalesIcon,
  WalletIcon,
  TrendIcon,
  TagIcon,
  PackageIcon,
} from '../components/Icons';

import RankChart from '../components/RankChart';
import DonutChart from '../components/DonutChart';
import HoursChart from '../components/HoursChart';

export default function Reports({ branchId, user, branches }) {
  const canPickBranch = user && user.role === 'owner' && branches && branches.length > 0;
  const [view, setView] = useState(canPickBranch ? 'all' : branchId);
  const queryBranchId = view === 'all' ? null : view;

  const [sales, setSales] = useState([]);
  const [byProduct, setByProduct] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [byHour, setByHour] = useState([]);
  const [payments, setPayments] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [expiring, setExpiring] = useState([]);
  
  const [days, setDays] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, view]);

  function startOfPeriod() {
    // Defensive check to prevent "Invalid time value" crashes
    const d = Number(days) || 1;
    const start = new Date();
    start.setDate(start.getDate() - (d - 1));
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }

  async function load() {
    if (!canPickBranch && !branchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    try {
      const since = startOfPeriod();
      const b = queryBranchId;

      const [
        salesData, 
        productData, 
        categoryData, 
        hourData, 
        paymentData
      ] = await Promise.all([
        getSalesSince(b, since),
        getSalesByProduct(b, since, null),
        getSalesByCategory(b, since),
        getBusiestHours(b, since),
        getPaymentSplit(b, since),
      ]);

      setSales(salesData);
      setByProduct(productData);
      setByCategory(categoryData);
      setByHour(hourData);
      setPayments(paymentData);

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

  if (!canPickBranch && !branchId) {
    return (
      <div>
        <PageHeader breadcrumb="Analytics" title="Reports" />
        <div className="box"><p>There is no branch to show yet. Go to Branches and add one.</p></div>
      </div>
    );
  }

  let takings = 0;
  let givenAway = 0;
  let totalProfit = 0;

  for (const sale of sales) {
    takings += Number(sale.total);
    givenAway += Number(sale.discount || 0) + Number(sale.item_discount || 0);
  }

  for (const p of byProduct) {
    totalProfit += p.total_profit;
  }

  const periodLabel = days === 1 ? 'Today' : days === 7 ? 'Last 7 days' : 'Last 30 days';
  const isAllView = view === 'all';

  const topSellers = [...byProduct]
    .sort((a, b) => b.quantity_sold - a.quantity_sold)
    .slice(0, 5)
    .map((p) => ({
      label: p.product_name,
      amount: p.funds_received,
      extra: p.quantity_sold + ' sold',
    }));

  const topProfit = [...byProduct]
    .sort((a, b) => b.total_profit - a.total_profit)
    .slice(0, 5)
    .map((p) => ({
      label: p.product_name,
      amount: p.total_profit,
      extra: p.quantity_sold + ' sold',
    }));

  const selectedBranch = branches ? branches.find((b) => b.id === view) : null;
  const reportLabel = isAllView ? 'All branches' : selectedBranch ? selectedBranch.name : 'Reports';

  return (
    <div>
      <PageHeader
        breadcrumb="Analytics / Reports"
        title="Reports"
        subtitle={canPickBranch ? `Viewing: ${reportLabel}` : 'Store performance analytics.'}
        actions={
          <div className="period-choice">
            <button className={days === 1 ? 'on' : ''} onClick={() => setDays(1)}>Today</button>
            <button className={days === 7 ? 'on' : ''} onClick={() => setDays(7)}>7 days</button>
            <button className={days === 30 ? 'on' : ''} onClick={() => setDays(30)}>30 days</button>
          </div>
        }
      />

      {canPickBranch && (
        <div className="branch-tabs">
          <button className={isAllView ? 'on' : ''} onClick={() => setView('all')}>All branches</button>
          {branches.map((b) => (
            <button key={b.id} className={view === b.id ? 'on' : ''} onClick={() => setView(b.id)}>{b.name}</button>
          ))}
        </div>
      )}

      {error && <div className="error">{error}</div>}
      {loading && <div className="empty">Loading...</div>}

      {/* KPI Cards */}
      <div className="stat-grid">
        <StatCard
          icon={<WalletIcon />}
          tone="blue"
          label={`Takings · ${periodLabel}`}
          value={money(takings)}
        />
        <StatCard
          icon={<SalesIcon />}
          tone="violet"
          label="Sales"
          value={sales.length}
        />
        <StatCard
          icon={<TrendIcon />}
          tone="green"
          label="Profit"
          value={money(totalProfit)}
        />
        <StatCard
          icon={<TagIcon />}
          tone="amber"
          label="Discounts"
          value={money(givenAway)}
        />
      </div>

      {/* Row 1: Category & Best Sellers */}
      <div className="side-by-side equal">
        <SectionCard icon={<PackageIcon />} title="Sales by category">
          <p className="chart-note">{periodLabel} {isAllView ? '· all branches' : ''}</p>
          <DonutChart slices={byCategory.map((r) => ({ name: r.name, money: r.money }))} />
        </SectionCard>

        <SectionCard icon={<TrendIcon />} title="Best sellers">
          <p className="chart-note">Top 5 · {periodLabel.toLowerCase()}</p>
          <RankChart rows={topSellers} />
        </SectionCard>
      </div>

      {/* Row 2: Busiest Times & Most Profitable */}
      <div className="side-by-side equal" style={{ marginTop: 20 }}>
        <SectionCard icon={<TrendIcon />} title="Busiest times of day">
          <p className="chart-note">
            {periodLabel} {isAllView ? '· all branches' : ''}. Peak hours.
          </p>
          <HoursChart hours={byHour} />
        </SectionCard>

        <SectionCard icon={<WalletIcon />} title="Most Profitable Products">
          <p className="chart-note">Top 5 by profit · {periodLabel.toLowerCase()}</p>
          {topProfit.length > 0 ? (
            <RankChart rows={topProfit} />
          ) : (
            <div className="empty small-text">No profit data yet.</div>
          )}
        </SectionCard>
      </div>

      {/* Row 3: Payments */}
      {payments.length > 0 && (
        <SectionCard icon={<SalesIcon />} title="How customers paid" style={{ marginTop: 20 }}>
          <p className="chart-note">{periodLabel} {isAllView ? '· all branches' : ''}</p>
          <DonutChart slices={payments.map((r) => ({ name: r.name === 'qr' ? 'QR code' : 'Cash', money: r.money }))} />
        </SectionCard>
      )}
    </div>
  );
}
