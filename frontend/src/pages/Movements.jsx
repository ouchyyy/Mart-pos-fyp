// ============================================================
// Movements.jsx — every stock change, split by direction
//
//   mode="in"    stock that came IN  (deliveries, positive corrections)
//   mode="out"   stock that went OUT (sales, expired, negative corrections)
//
// One component, two pages. The filter is three lines; everything
// else is the same shape for both — search box, table, count.
// ============================================================

import { useState, useEffect } from 'react';
import { getStockHistory } from '../database';
import { dateAndTime } from '../money';

import { PageHeader, SectionCard } from '../components/Ui';
import { ArrowDownIcon, ArrowUpIcon } from '../components/Icons';

export default function Movements({ branchId, mode = 'in' }) {
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (!branchId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    getStockHistory(branchId)
      .then((rows) => setHistory(rows))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [branchId]);

  const isIn = mode === 'in';

  // The direction filter — this is what makes the two pages
  // different from each other.
  //
  //   Stock in   change > 0   every delivery, positive correction,
  //                            cancelled sale being put back
  //   Stock out  change < 0   every sale, expired write-off,
  //                            negative correction
  const directed = history.filter((row) =>
    isIn ? row.change > 0 : row.change < 0
  );

  function matchesSearch(row) {
    if (search === '') return true;
    const text = search.toLowerCase();
    const name = row.products ? row.products.name.toLowerCase() : '';
    return name.includes(text) || row.reason.toLowerCase().includes(text);
  }

  const shown = directed.filter(matchesSearch);

  const totalUnits = shown.reduce(
    (sum, row) => sum + Math.abs(row.change),
    0
  );

  const title = isIn ? 'Stock in' : 'Stock out';
  const subtitle = isIn
    ? 'Every delivery and correction that added stock at this branch.'
    : 'Every sale, write-off and correction that removed stock at this branch.';

  return (
    <div>
      <PageHeader
        breadcrumb="Inventory / Movements"
        title={title}
        subtitle={subtitle}
      />

      {error && <div className="error">{error}</div>}
      {loading && <div className="empty">Loading...</div>}

      <SectionCard
        icon={isIn ? <ArrowDownIcon /> : <ArrowUpIcon />}
        title={title}
        count={
          shown.length +
          (shown.length === 1 ? ' movement · ' : ' movements · ') +
          totalUnits +
          ' units'
        }
      >
        <div style={{ marginBottom: 16 }}>
          <input
            className="search-small"
            placeholder="Search product or reason"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Product</th>
              <th>Reason</th>
              <th>By</th>
              <th className="right">Change</th>
              <th className="right">After</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td className="small-text grey">
                  {dateAndTime(row.created_at)}
                </td>
                <td>{row.products ? row.products.name : '-'}</td>
                <td className="small-text">{row.reason}</td>
                <td className="small-text">
                  {row.profiles
                    ? row.profiles.full_name || 'Unnamed staff'
                    : '-'}
                </td>
                <td
                  className="right number"
                  style={{
                    color: isIn ? 'var(--green)' : 'var(--red)',
                    fontWeight: 600,
                  }}
                >
                  {row.change > 0 ? '+' : ''}
                  {row.change}
                </td>
                <td className="right number">{row.stock_after}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!loading && shown.length === 0 && (
          <div className="empty small-text">
            {search
              ? 'Nothing matches that search.'
              : isIn
              ? 'No stock has come in yet at this branch.'
              : 'No stock has gone out yet at this branch.'}
          </div>
        )}
      </SectionCard>
    </div>
  );
}