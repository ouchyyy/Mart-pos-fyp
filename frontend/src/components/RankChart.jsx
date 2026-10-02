// ============================================================
// RankChart.jsx — a ranked list drawn as bars lying on their side
//
// Sideways is the right shape for a "best sellers" list: product
// names are long, and vertical bars would either squash the names
// or turn them on their side to be read with a tilted head.
//
// rows looks like: [{ label: 'Coffee', amount: 42.5, extra: '12 sold' }, ...]
// ============================================================

import { money } from '../money';

export default function RankChart({ rows }) {
  if (rows.length === 0) {
    return <div className="empty small-text">Nothing to show yet.</div>;
  }

  let biggest = 0;
  for (const row of rows) {
    if (row.amount > biggest) {
      biggest = row.amount;
    }
  }

  return (
    <div className="rank-chart">
      {rows.map((row, index) => (
        <div className="rank-row" key={row.label}>
          <div className="rank-place">{index + 1}</div>

          <div className="rank-body">
            <div className="rank-top">
              <span className="rank-name">{row.label}</span>
              <span className="rank-amount number">
                {money(row.amount)}
                {row.extra && <span className="grey"> · {row.extra}</span>}
              </span>
            </div>

            <div className="rank-track">
              <div
                className="rank-fill"
                style={{ width: (row.amount / biggest) * 100 + '%' }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
