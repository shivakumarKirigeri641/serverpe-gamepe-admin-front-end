/**
 * src/components/LiveCharts.jsx
 * ---------------------------------------------------------------------------
 * The moving picture: hosts, players, games and numbers over the last few
 * minutes, redrawn every second.
 *
 * ── Where the history comes from ────────────────────────────────────────────
 *
 * Not from the database. Nothing stores a per-second snapshot of "how many
 * players were in a game", and adding a table that writes a row every second
 * for a chart nobody may be looking at would be a poor trade — it is write
 * load and disk forever, to answer a question that only matters while someone
 * is watching.
 *
 * So the window is assembled in the browser instead. Every poll appends one
 * sample; the buffer keeps the most recent MAX_POINTS and drops the rest. The
 * cost is that the history belongs to this tab: open the page and you start
 * with an empty chart that fills in over the next two minutes, and a reload
 * starts again. That is the honest trade for a live view, and the charts say
 * so rather than pretending to be a record.
 *
 * ── Why these four ─────────────────────────────────────────────────────────
 *
 * Each answers a question you cannot answer from a single number:
 *
 *   People       — is the platform filling up or emptying out?
 *   Rooms        — are games starting, or are hosts stuck waiting for players?
 *   Numbers      — is the draw scheduler actually calling numbers?
 *   Connections  — are boards holding their stream, or flapping?
 *
 * A count on its own tells you the level. The shape tells you the direction,
 * which is the only thing worth staring at a live screen for.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { num } from '../lib/api.js';
import { ChartTooltip, GradientDefs, Legend, axisProps, gridProps, VIZ } from './ui.jsx';

/** Two minutes at one sample a second. Long enough to see a trend, short
 *  enough that the x-axis stays readable on a laptop. */
const MAX_POINTS = 120;

/**
 * Appends each new sample to a bounded rolling buffer.
 *
 * Keyed on the identity of the counts object, which is the one thing that
 * changes exactly once per poll: usePolling parses fresh JSON every second, so
 * a new object means new data, while any other re-render hands back the same
 * object and appends nothing.
 *
 * A timestamp out of the payload would be wrong in both directions - it stops
 * changing while the platform is quiet, freezing the chart, and a Date.now()
 * fallback changes on every render, double-counting samples.
 */
function useRolling(sample, key) {
  const [points, setPoints] = useState([]);
  const last = useRef(null);

  useEffect(() => {
    if (!key || key === last.current) return;
    last.current = key;

    setPoints((prev) => {
      const next = prev.concat({
        t: new Date().toLocaleTimeString('en-IN', { hour12: false, timeStyle: 'medium' }).slice(0, 8),
        ...sample,
      });
      return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next;
    });
    // sample is rebuilt from key on every render; listing it as a dependency
    // would defeat the whole point of keying on identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return points;
}

/** One chart, with its own frame and legend. */
const Plot = ({ title, hint, children, series }) => (
  <div className="card p-4">
    <div className="flex items-baseline justify-between gap-3 mb-1">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <span className="text-[11px] text-faint">{hint}</span>
    </div>
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
    {series && <Legend items={series} />}
  </div>
);

/**
 * @param {object} counts the `counts` block from /live
 * @param {number} watchers total open board streams, summed from the rooms
 * Identity of `counts` is what advances the buffer - see useRolling.
 */
export default function LiveCharts({ counts, watchers }) {
  const points = useRolling(
    {
      hosts: Number(counts.hosts_live) || 0,
      inGame: Number(counts.players_in_game) || 0,
      waiting: Number(counts.players_waiting) || 0,
      active: Number(counts.active_5m) || 0,
      running: Number(counts.games_running) || 0,
      lobby: Number(counts.games_in_lobby) || 0,
      perMinute: Number(counts.drawn_last_minute) || 0,
      due: Number(counts.draws_due_now) || 0,
      watchers: Number(watchers) || 0,
    },
    counts,
  );

  // Below three points a line chart is a dot and a rumour. Say what is
  // happening instead of drawing something misleading.
  if (points.length < 3) {
    return (
      <div className="card p-8 text-center mb-6">
        <div className="text-sm text-muted">Building the live view…</div>
        <div className="text-[11px] text-faint mt-1">
          These charts are drawn from what happens while this page is open, so they
          fill in over the next couple of minutes.
        </div>
      </div>
    );
  }

  // A shared axis for every chart, so they are read the same way.
  const x = { dataKey: 't', ...axisProps, minTickGap: 46, interval: 'preserveStartEnd' };
  // 34px clipped the leading digit off any two-digit tick - "12" rendered as
  // "2", which on a monitoring chart is not a cosmetic problem.
  const y = { allowDecimals: false, ...axisProps, width: 44 };
  const tip = <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,.14)' }} />;

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-bold text-ink">The last {Math.round(points.length)} seconds</h2>
        <span className="text-[11px] text-faint">
          built while this page is open — a reload starts it over
        </span>
      </div>

      <div className="grid lg:grid-cols-2 gap-3">
        <Plot
          title="People"
          hint="players seated, waiting, and recently active"
          series={[
            { label: 'In a game', color: VIZ[0] },
            { label: 'Waiting in a lobby', color: VIZ[2] },
            { label: 'Active (5 min)', color: VIZ[3] },
          ]}
        >
          <AreaChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <GradientDefs ids={[{ id: 'lc-in', color: VIZ[0], from: 0.4 }]} />
            <CartesianGrid {...gridProps} />
            <XAxis {...x} />
            <YAxis {...y} />
            {tip}
            <Area type="monotone" dataKey="inGame" name="In a game" stroke={VIZ[0]}
              strokeWidth={2.4} fill="url(#fill-lc-in)" isAnimationActive={false} dot={false} />
            <Area type="monotone" dataKey="waiting" name="Waiting in a lobby" stroke={VIZ[2]}
              strokeWidth={2} fill="transparent" isAnimationActive={false} dot={false} />
            <Area type="monotone" dataKey="active" name="Active (5 min)" stroke={VIZ[3]}
              strokeWidth={1.6} strokeDasharray="4 3" fill="transparent"
              isAnimationActive={false} dot={false} />
          </AreaChart>
        </Plot>

        <Plot
          title="Hosts and rooms"
          hint="a gap that stays open means rooms are not starting"
          series={[
            { label: 'Hosts live', color: VIZ[1] },
            { label: 'Games running', color: VIZ[0] },
            { label: 'Waiting to start', color: VIZ[5] },
          ]}
        >
          <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid {...gridProps} />
            <XAxis {...x} />
            <YAxis {...y} />
            {tip}
            <Line type="monotone" dataKey="hosts" name="Hosts live" stroke={VIZ[1]}
              strokeWidth={2.4} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="running" name="Games running" stroke={VIZ[0]}
              strokeWidth={2.4} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="lobby" name="Waiting to start" stroke={VIZ[5]}
              strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </Plot>

        <Plot
          title="Numbers going out"
          hint="'due now' above zero for more than a moment means draws are late"
          series={[
            { label: 'Called in the last minute', color: VIZ[2] },
            { label: 'Draws overdue', color: '#fb7185' },
          ]}
        >
          <LineChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid {...gridProps} />
            <XAxis {...x} />
            <YAxis {...y} />
            {tip}
            <Line type="monotone" dataKey="perMinute" name="Called in the last minute"
              stroke={VIZ[2]} strokeWidth={2.4} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="due" name="Draws overdue" stroke="#fb7185"
              strokeWidth={2.4} dot={false} isAnimationActive={false} />
          </LineChart>
        </Plot>

        <Plot
          title="Boards connected"
          hint="open live streams — should track players in a game"
          series={[
            { label: 'Streams open', color: VIZ[4] },
            { label: 'Players in a game', color: VIZ[0] },
          ]}
        >
          <AreaChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <GradientDefs ids={[{ id: 'lc-w', color: VIZ[4], from: 0.4 }]} />
            <CartesianGrid {...gridProps} />
            <XAxis {...x} />
            <YAxis {...y} />
            {tip}
            <Area type="monotone" dataKey="watchers" name="Streams open" stroke={VIZ[4]}
              strokeWidth={2.4} fill="url(#fill-lc-w)" isAnimationActive={false} dot={false} />
            {/* Plotted together on purpose: a stream count that sits below the
                number of seated players is the signature of boards dropping
                their connection, which is invisible in either line alone. */}
            <Area type="monotone" dataKey="inGame" name="Players in a game" stroke={VIZ[0]}
              strokeWidth={1.8} strokeDasharray="4 3" fill="transparent"
              isAnimationActive={false} dot={false} />
          </AreaChart>
        </Plot>
      </div>

      <p className="text-[11px] text-faint mt-2">
        Now: {num(counts.hosts_live)} host{Number(counts.hosts_live) === 1 ? '' : 's'} ·{' '}
        {num(counts.players_in_game)} playing · {num(counts.drawn_last_minute)} numbers called this
        minute · {num(watchers)} boards connected.
      </p>
    </div>
  );
}
