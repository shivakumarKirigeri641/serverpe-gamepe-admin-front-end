/**
 * src/components/Geography.jsx
 * ---------------------------------------------------------------------------
 * Where players are, and which way each place is moving.
 *
 * Two lists — states (with union territories) and cities — each showing how
 * many people played from there this period, what share of the located players
 * that is, and how it compares with the period before.
 *
 * Three deliberate choices worth knowing about before reading the numbers:
 *
 *   • The comparison is always a WHOLE period back — this week against last
 *     week, not against a rolling seven days. Play is heavily weekend-shaped,
 *     so a rolling comparison would report a collapse every Monday morning.
 *
 *   • The coverage line at the top is not decoration. Location comes from the
 *     IP a board was opened from, and a player who stays in WhatsApp has no
 *     address at all. Without that line these totals look like they disagree
 *     with the dashboard.
 *
 *   • A place that went from one player to two is not "+100% growth". Small
 *     places are shown, but the movers strip ignores anything under three
 *     players, because that is where percentages start lying.
 */

import { useState } from 'react';
import { api, num } from '../lib/api.js';
import { BarRow, Empty, ErrorBox, Loading, usePolling, VIZ } from './ui.jsx';

const PERIODS = [
  { key: 'day', label: 'Day', vs: 'vs the day before' },
  { key: 'week', label: 'Week', vs: 'vs the week before' },
  { key: 'month', label: 'Month', vs: 'vs the month before' },
];

/** The green/red/grey chip carrying the change. */
const Move = ({ row }) => {
  const tone =
    row.direction === 'up'
      ? 'bg-good/12 text-good border-good/25'
      : row.direction === 'down'
        ? 'bg-bad/12 text-bad border-bad/25'
        : 'bg-white/[.05] text-muted border-line';

  const arrow = row.direction === 'up' ? '▲' : row.direction === 'down' ? '▼' : '·';

  return (
    <span
      className={`pill ${tone}`}
      title={`${num(row.playersBefore)} in the previous period → ${num(row.players)} now`}
    >
      {arrow} {row.label}
    </span>
  );
};

/**
 * A tiny inline sparkline — no chart library, just a polyline.
 *
 * Recharts is already loaded on this page, but one <ResponsiveContainer> per
 * table row is a real cost for twelve rows that refresh on a timer. This is
 * forty lines of SVG that never re-measures anything.
 */
const Spark = ({ values = [], colour = '#f5b83d' }) => {
  if (values.length < 2) return <span className="text-faint text-[11px]">—</span>;

  const max = Math.max(...values, 1);
  const w = 74;
  const h = 20;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 3) - 1.5).toFixed(1)}`);

  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={colour}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity=".85"
      />
      <circle
        cx={(w).toFixed(1)}
        cy={(h - (values.at(-1) / max) * (h - 3) - 1.5).toFixed(1)}
        r="2"
        fill={colour}
      />
    </svg>
  );
};

/** One of the two lists. */
const PlaceList = ({ title, note, rows, trends }) => {
  const max = Math.max(...rows.map((r) => r.players), 1);

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <span className="text-[11px] text-faint">{note}</span>
      </div>

      {rows.length === 0 ? (
        <Empty>Nobody has opened a board from a resolvable address yet.</Empty>
      ) : (
        <div className="divide-y divide-line/40">
          {rows.map((r, i) => (
            <div key={r.name} className="py-2.5">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-sm text-ink truncate">{r.name}</span>
                <span className="flex items-center gap-2.5 shrink-0">
                  <Spark values={trends?.[r.name]} colour={VIZ[i % VIZ.length]} />
                  <span className="text-sm font-bold nums w-8 text-right">{num(r.players)}</span>
                  <span className="text-[11px] text-faint w-9 text-right">{r.share}%</span>
                  <Move row={r} />
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((r.players / max) * 100)}%`,
                    background: `linear-gradient(90deg, ${VIZ[i % VIZ.length]}, ${VIZ[i % VIZ.length]}88)`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Geography() {
  const [period, setPeriod] = useState('week');

  const { data, error, loading } = usePolling(
    () => api.get(`/geography?period=${period}`),
    60_000,     // geography moves on the scale of days; polling it fast is waste
    [period],
  );

  if (loading && !data) return <Loading label="Working out where everyone is…" />;
  if (error && !data) return <ErrorBox error={error} />;

  const g = data;
  const vs = PERIODS.find((p) => p.key === period)?.vs ?? '';
  const anyMovers = g.movers.rising.length > 0 || g.movers.falling.length > 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-ink">Where players are</h2>
          <p className="text-[11px] text-faint mt-0.5">
            {num(g.total.players)} located this {period} · {vs}
          </p>
        </div>

        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                period === p.key
                  ? 'bg-brand/15 text-gold border-brand/35'
                  : 'text-muted border-line hover:text-ink'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* The headline movement, and then what drove it. */}
      <div className="card p-4 mb-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-extrabold text-gold nums">{num(g.total.players)}</span>
          <Move row={g.total} />
          <span className="text-xs text-muted">players opened a board {vs}</span>
        </div>

        {anyMovers && (
          <div className="flex flex-wrap gap-2 mt-3">
            {g.movers.rising.map((m) => (
              <span key={m.name} className="pill bg-good/10 text-good border-good/25">
                ▲ {m.name} {m.label === 'new' ? 'new' : m.label} ({m.change > 0 ? '+' : ''}{m.change})
              </span>
            ))}
            {g.movers.falling.map((m) => (
              <span key={m.name} className="pill bg-bad/10 text-bad border-bad/25">
                ▼ {m.name} {m.label} ({m.change})
              </span>
            ))}
          </div>
        )}

        {/* Says out loud why these totals are smaller than the dashboard's. */}
        <p className="text-[11px] text-faint mt-3 leading-relaxed">
          {num(g.coverage.located)} of {num(g.coverage.played)} players who played this {period} could
          be placed ({g.coverage.percentLocated}%). Location is resolved from the IP the board was
          opened from — a player who stays inside WhatsApp has no address for us to read, and on
          mobile data the address is the carrier gateway, so treat the city as a hint and the state
          as the number worth acting on.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <PlaceList
          title="State / union territory"
          note="players · share · change"
          rows={g.states}
          trends={g.trends.states}
        />
        <PlaceList
          title="City"
          note="players · share · change"
          rows={g.cities}
          trends={g.trends.cities}
        />
      </div>
    </div>
  );
}
