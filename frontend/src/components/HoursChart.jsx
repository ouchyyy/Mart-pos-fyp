// ============================================================
// HoursChart.jsx — how busy each hour of the day is
//
// Twenty-four thin bars. Too many for a value on each one, so
// hovering shows the number instead and only every third hour
// is labelled.
//
// hours looks like: [{ hour: 0, sales: 0, money: 0 }, ...]
// ============================================================

import { money } from '../money';

export default function HoursChart({ hours }) {
  let busiest = 0;
  for (const hour of hours) {
    if (hour.sales > busiest) {
      busiest = hour.sales;
    }
  }

  if (busiest === 0) {
    return <div className="empty small-text">Nothing to show yet.</div>;
  }

  // A shop is shut for a good part of the night, and 24 bars
  // with eight empty ones wastes half the chart. So we show
  // only from the first hour with a sale to the last.
  let firstBusy = 0;
  let lastBusy = 23;

  for (let i = 0; i < 24; i++) {
    if (hours[i].sales > 0) {
      firstBusy = i;
      break;
    }
  }

  for (let i = 23; i >= 0; i--) {
    if (hours[i].sales > 0) {
      lastBusy = i;
      break;
    }
  }

  // Give it an hour of breathing room on each side.
  const from = Math.max(0, firstBusy - 1);
  const to = Math.min(23, lastBusy + 1);
  const shown = hours.slice(from, to + 1);

  // Turn 14 into "2pm", which is how people say it.
  function clockLabel(hour) {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return hour + 'am';
    return hour - 12 + 'pm';
  }

  return (
    <div className="hours-chart">
      <div className="hours-bars">
        {shown.map((entry) => (
          <div
            className="hours-column"
            key={entry.hour}
            title={
              clockLabel(entry.hour) +
              ': ' +
              entry.sales +
              (entry.sales === 1 ? ' sale, ' : ' sales, ') +
              money(entry.money)
            }
          >
            <div
              className={
                entry.sales === busiest ? 'hours-bar busiest' : 'hours-bar'
              }
              style={{ height: (entry.sales / busiest) * 100 + '%' }}
            />
          </div>
        ))}
      </div>

      <div className="hours-labels">
        {shown.map((entry, index) => (
          <div className="hours-label" key={entry.hour}>
            {index % 3 === 0 ? clockLabel(entry.hour) : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
