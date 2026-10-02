// ============================================================
// Dashboard.jsx — the owner's first screen
//
// Three questions, in the order an owner asks them:
//
//   1. Is anything wrong?          -> the alert strip
//   2. Are we doing okay?          -> today vs yesterday
//   3. Which shop needs me?        -> the branch table
//
// Everything else is one click away at the bottom. This page is
// a triage screen, not a report — if a number does not change
// what the owner does next, it does not belong here.
//
// Refreshes itself every 60 seconds, so a screen left open on
// the office wall stays current without anybody touching it.
// ============================================================

import { useState, useEffect } from 'react';
import { getSalesSince, getExpiringSoon } from '../database';
import { money } from '../money';

export default function Dashboard({ branches, onGo }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [alerts, setAlerts] = useState([]);
  const [totalToday, setTotalToday] = useState(0);
  const [salesToday, setSalesToday] = useState(0);
  const [totalYesterday, setTotalYesterday] = useState(0);
  const [salesYesterday, setSalesYesterday] = useState(0);
  const [branchRows, setBranchRows] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The window we compare against:
  //
  //   today      from midnight this morning to now
  //   yesterday  from midnight yesterday to the SAME time
  //              yesterday, so we compare like with like
  //
  // Comparing a full day to a part day would be meaningless by
  // mid-morning and obviously wrong by noon.
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

      // Every sale today, at any branch. The RLS rule allows an
      // owner to pass null here, and refuses the same call for
      // anyone else.
      const today = await getSalesSince(null, todayStart.toISOString());

      // Every sale since midnight yesterday, then cut down to the
      // same time of day. We could ask the database for the
      // exact range but this is one round trip instead of two.
      const sinceYesterday = await getSalesSince(
        null,
        yesterdayStart.toISOString()
      );
      const yesterday = sinceYesterday.filter(
        (s) => new Date(s.created_at) <= yesterdaySameTime
      );

      // ---------- per-branch numbers ----------
      const rows = branches.map((b) => {
        const todayB = today.filter((s) => s.branch_id === b.id);
        const yesterdayB = yesterday.filter((s) => s.branch_id === b.id);

        const tToday = todayB.reduce((sum, s) => sum + Number(s.total), 0);
        const tYesterday = yesterdayB.reduce((sum, s) => sum + Number(s.total), 0);

        // "Quiet" means: had sales earlier today (so the shop is
        // open), but none in the last four hours (so something
        // may be wrong — till forgotten, till broken, closed
        // early). Only checked after 10am, so a branch that has
        // simply not opened yet does not raise a false alarm.
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
          quiet: quiet,
        };
      });

      rows.sort((a, b) => b.takings - a.takings);

      // ---------- alerts ----------
      const found = [];

      for (const b of branches) {
        // Expiring today. We fetch each branch's list of soon-to-
        // expire products, then count only those whose expiry is
        // exactly today. Yesterday's expired stock still shows up
        // here, which is what we want — that is the worse case.
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

  // The two ways a percentage can be missing. Returning a string
  // instead of a number keeps the render simple.
  function percentChange(today, yesterday) {
    if (yesterday === 0) {
      return today === 0 ? 'same' : 'new';
    }
    return ((today - yesterday) / yesterday) * 100;
  }

  function changeLabel(change) {
    if (change === 'same' || change === 'new') return change;
    return (change >= 0 ? '+' : '') + change.toFixed(0) + '%';
  }

  function changeTone(change) {
    if (change === 'same' || change === 'new') return 'grey';
    return change >= 0 ? 'var(--green)' : 'var(--red)';
  }

  // ---------- render ----------
  if (!branches || branches.length === 0) {
    return (
      <div>
        <h1>Dashboard</h1>
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

  return (
    <div>
      {/* ============================================================
          Header
          ============================================================ */}
      <div className="reports-head">
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <span className="grey small-text">
          Updated {lastRefresh.toLocaleTimeString()}
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      {/* ============================================================
          1. Alerts — only when there is something to say
          ============================================================ */}
      {alerts.length > 0 && (
        <div className="dash-alerts">
          {alerts.map((a, i) => (
            <div key={i} className={'dash-alert ' + (a.tone || '')}>
              <span className="dash-alert-icon">!</span>
              <span>
                <strong>{a.branchName}</strong> · {a.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================
          2. Today's takings, in one number
          ============================================================ */}
      <div className="dash-hero">
        <div className="dash-hero-main">
          <div className="label">Today's chain takings</div>
          <div className="amount number">{money(totalToday)}</div>
          <div className="compare">
            Yesterday at this time:&nbsp;
            <span className="number">{money(totalYesterday)}</span>
            <span
              className="dash-change number"
              style={{ color: changeTone(chainChange) }}
            >
              {changeLabel(chainChange)}
            </span>
          </div>
        </div>

        <div className="dash-hero-side">
          <div className="dash-side-row">
            <span className="grey">Sales today</span>
            <strong className="number">{salesToday}</strong>
          </div>
          <div className="dash-side-row">
            <span className="grey">Sales yesterday</span>
            <strong className="number">{salesYesterday}</strong>
          </div>
          <div className="dash-side-row">
            <span className="grey">Busiest branch</span>
            <strong>{busiest && busiest.takings > 0 ? busiest.name : '—'}</strong>
          </div>
        </div>
      </div>

      {/* ============================================================
          3. Branches side by side
          ============================================================ */}
      <div className="box" style={{ padding: 0 }}>
        <div className="panel-head">
          <h2 style={{ margin: 0 }}>Branches</h2>
          <span className="grey small-text">Today, compared with yesterday</span>
        </div>

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
                    color: changeTone(row.change),
                    fontWeight: 600,
                  }}
                >
                  {changeLabel(row.change)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============================================================
          4. Where to go next
          ============================================================ */}
      <div className="dash-links">
        <button onClick={() => onGo('reports')}>
          Full reports <span className="arrow">→</span>
        </button>
        <button onClick={() => onGo('stock')}>
          Check stock <span className="arrow">→</span>
        </button>
        <button onClick={() => onGo('sales')}>
          Look at sales <span className="arrow">→</span>
        </button>
        <button onClick={() => onGo('branches')}>
          Manage branches <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}