// ============================================================
// DonutChart.jsx — a ring showing how a total splits up
//
// Made with one CSS trick: conic-gradient draws coloured wedges
// around a circle, and a white circle on top turns the pie into
// a ring. No library, no drawing code.
//
// A ring is the right shape here because the question is "what
// share?", not "how much?". Bars answer size; rings answer share.
//
// slices looks like: [{ name: 'Drinks', money: 42.5 }, ...]
// ============================================================

import { money } from '../money';

// Enough colours for a small shop's categories. After that it
// starts again, which is fine — by then the wedges are tiny.
const COLOURS = [
  '#0b6bcb',
  '#f2b705',
  '#1d7a4c',
  '#c1372b',
  '#7b5cd6',
  '#0f9b9b',
  '#e07b39',
  '#5b6b7a',
];

export default function DonutChart({ slices }) {
  let total = 0;
  for (const slice of slices) {
    total = total + slice.money;
  }

  if (total === 0) {
    return <div className="empty small-text">Nothing to show yet.</div>;
  }

  // Walk round the circle, remembering where the last wedge
  // ended so the next one starts there.
  let degreesSoFar = 0;
  const wedges = [];

  slices.forEach((slice, index) => {
    const degrees = (slice.money / total) * 360;
    const colour = COLOURS[index % COLOURS.length];

    wedges.push(colour + ' ' + degreesSoFar + 'deg ' + (degreesSoFar + degrees) + 'deg');
    degreesSoFar = degreesSoFar + degrees;
  });

  return (
    <div className="donut-wrap">
      <div
        className="donut"
        style={{ background: 'conic-gradient(' + wedges.join(', ') + ')' }}
      >
        <div className="donut-hole">
          <div className="donut-total number">{money(total)}</div>
          <div className="donut-caption">total</div>
        </div>
      </div>

      <div className="donut-key">
        {slices.map((slice, index) => (
          <div className="donut-key-row" key={slice.name}>
            <span
              className="donut-dot"
              style={{ background: COLOURS[index % COLOURS.length] }}
            />
            <span className="donut-name">{slice.name}</span>
            <span className="donut-share grey number">
              {Math.round((slice.money / total) * 100)}%
            </span>
            <span className="donut-money number">{money(slice.money)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
