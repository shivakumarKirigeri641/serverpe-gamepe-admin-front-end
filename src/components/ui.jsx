/**
 * src/components/ui.jsx
 * ---------------------------------------------------------------------------
 * Shared pieces so every page looks and behaves the same: page headers,
 * loading and error states, stat tiles, tables, and the chart primitives.
 *
 * The chart helpers matter more than they look. Recharts defaults are tuned
 * for a white page — grey gridlines, a white tooltip, a full axis box — and on
 * a dark panel they read as clutter. Everything here strips the frame back so
 * the data is the only thing with contrast.
 *
 * Wide data (message bodies, event properties) scrolls horizontally in place
 * rather than stretching the page — a panel that scrolls sideways as a whole is
 * unusable on a laptop.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

/* ------------------------------------------------------------------ layout */

export const Page = ({ title, subtitle, actions, children }) => (
  <>
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6"
    >
      <div className="min-w-0">
        <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-gradient leading-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </motion.div>
    {children}
  </>
);

/** A card with a title bar, used for every chart and panel. */
export const Panel = ({ title, subtitle, actions, className = '', children }) => (
  <section className={`card p-5 ${className}`}>
    {(title || actions) && (
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          {title && <h2 className="text-[15px] font-bold text-ink">{title}</h2>}
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </header>
    )}
    {children}
  </section>
);

export const Loading = ({ label = 'Loading…' }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card p-4">
          <div className="skeleton h-3 w-24 mb-3" />
          <div className="skeleton h-8 w-20" />
        </div>
      ))}
    </div>
    <div className="card p-5">
      <div className="skeleton h-3 w-40 mb-4" />
      <div className="skeleton h-48 w-full" />
    </div>
    <p className="text-center text-xs text-faint pt-1">{label}</p>
  </div>
);

export const ErrorBox = ({ error, onRetry }) => (
  <div className="card p-6 border-bad/30">
    <div className="flex items-start gap-3">
      <span className="grid place-items-center w-9 h-9 rounded-xl bg-bad/15 text-bad text-lg shrink-0">!</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">Something went wrong</p>
        <p className="text-sm text-bad/90 mt-0.5 break-words">{String(error?.message || error)}</p>
        {onRetry && <button className="btn-sec mt-3" onClick={onRetry}>Try again</button>}
      </div>
    </div>
  </div>
);

export const Empty = ({ children, icon = '◌' }) => (
  <div className="card p-12 text-center">
    <div className="text-3xl text-faint mb-2">{icon}</div>
    <div className="text-sm text-muted">{children}</div>
  </div>
);

/* ------------------------------------------------------------------- stats */

/**
 * A headline number, its change against the previous period, and optionally a
 * sparkline of where it has been.
 */
export function Stat({ label, value, delta, sub, tone = 'gold', index = 0, spark, icon }) {
  const hasDelta = delta !== undefined && delta !== null;
  const up = hasDelta && delta > 0;
  const down = hasDelta && delta < 0;

  const tones = {
    gold: 'text-gold',
    crimson: 'text-brand-glow',
    teal: 'text-viz-3',
    violet: 'text-viz-4',
    ink: 'text-ink',
  };
  const sparkColour = { gold: '#f5b83d', crimson: '#ff4d6d', teal: '#2dd4bf', violet: '#a78bfa', ink: '#8f8a9e' }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.045, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="card card-hover p-4 overflow-hidden"
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-sm opacity-70">{icon}</span>}
        <span className="text-[10.5px] font-bold uppercase tracking-[.09em] text-muted">{label}</span>
      </div>

      <div className={`stat-value mt-2 ${tones[tone] ?? tones.ink}`}>{value}</div>

      <div className="flex items-center gap-2 mt-2 min-h-[22px]">
        {hasDelta && (
          <span
            className={`pill ${
              up ? 'bg-good/12 text-good border-good/25'
                : down ? 'bg-bad/12 text-bad border-bad/25'
                : 'bg-white/5 text-muted border-line'
            }`}
          >
            {up ? '↑' : down ? '↓' : '—'} {Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="text-xs text-faint truncate">{sub}</span>}
      </div>

      {/* Bled to the card edges: a sparkline is context, not a chart, and
          giving it padding makes it compete with the number above it. */}
      {spark?.length > 1 && (
        <div className="h-9 -mx-4 -mb-4 mt-1 opacity-90">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`sp-${label.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sparkColour} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={sparkColour} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="v" stroke={sparkColour} strokeWidth={1.75}
                fill={`url(#sp-${label.replace(/\W/g, '')})`} isAnimationActive={false} dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ charts */

/** Axis styling shared by every chart, so no two look subtly different. */
export const axisProps = {
  stroke: '#5e5871',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tick: { fill: '#8f8a9e' },
};

export const gridProps = {
  strokeDasharray: '3 3',
  stroke: 'rgba(255,255,255,.06)',
  vertical: false,
};

export const VIZ = ['#f5b83d', '#ff4d6d', '#2dd4bf', '#a78bfa', '#60a5fa', '#fb923c'];

/**
 * Dark tooltip. Recharts' default is a white box that flares on a dark chart
 * and destroys night vision.
 */
export const ChartTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-bg-deep/95 px-3 py-2 shadow-lift backdrop-blur">
      {label !== undefined && (
        <div className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1.5">{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto font-bold nums text-ink">
            {formatter ? formatter(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * Vertical gradient fills for area charts, one per colour passed in.
 * Drop into a chart's <defs> and reference as url(#fill-<id>).
 */
export const GradientDefs = ({ ids }) => (
  <defs>
    {ids.map(({ id, color, from = 0.38, to = 0 }) => (
      <linearGradient key={id} id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={from} />
        <stop offset="100%" stopColor={color} stopOpacity={to} />
      </linearGradient>
    ))}
  </defs>
);

/** Legend swatches. Recharts' built-in legend cannot be styled enough to match. */
export const Legend = ({ items }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
    {items.map((it) => (
      <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: it.color }} />
        {it.label}
      </span>
    ))}
  </div>
);

/**
 * A horizontal funnel/ranking bar. Used where a bar chart would be overkill —
 * five labelled values with their share of the top one.
 */
export const BarRow = ({ label, value, max, color = '#f5b83d', hint, index = 0 }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between text-sm mb-1.5">
        <span className="text-ink">{label}</span>
        <span className="flex items-baseline gap-2">
          <span className="font-bold nums">{value}</span>
          {hint && <span className="text-[11px] text-faint">{hint}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}99)` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: index * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ tables */

export const Table = ({ head, children, empty = 'Nothing here yet.' }) => (
  <div className="card overflow-hidden">
    <div className="overflow-x-auto max-h-[70vh]">
      <table className="w-full min-w-[640px] border-separate border-spacing-0">
        <thead>
          <tr>
            {/* Index keys because a header can be an element (a select-all
                checkbox), which is not usable as a key. */}
            {head.map((h, i) => (
              <th key={i} className="th">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
    {!children?.length && <div className="p-10 text-center text-sm text-muted">{empty}</div>}
  </div>
);

const STATUS_TONES = {
  running: 'bg-good/12 text-good border-good/25',
  lobby: 'bg-gold/12 text-gold border-gold/25',
  finished: 'bg-white/5 text-muted border-line',
  completed: 'bg-white/5 text-muted border-line',
  abandoned: 'bg-bad/12 text-bad border-bad/25',
  cancelled: 'bg-bad/12 text-bad border-bad/25',
  sent: 'bg-good/12 text-good border-good/25',
  failed: 'bg-bad/12 text-bad border-bad/25',
  blocked: 'bg-bad/12 text-bad border-bad/25',
  dry_run: 'bg-viz-4/12 text-viz-4 border-viz-4/25',
  open: 'bg-gold/12 text-gold border-gold/25',
  in_progress: 'bg-viz-5/12 text-viz-5 border-viz-5/25',
  waiting_on_player: 'bg-white/5 text-muted border-line',
  resolved: 'bg-good/12 text-good border-good/25',
  closed: 'bg-white/5 text-muted border-line',
  urgent: 'bg-bad/12 text-bad border-bad/25',
  high: 'bg-gold/12 text-gold border-gold/25',
  normal: 'bg-white/5 text-muted border-line',
  low: 'bg-white/5 text-muted border-line',
};

export const Badge = ({ value, tone }) => (
  <span className={`pill ${tone || STATUS_TONES[value] || 'bg-white/5 text-muted border-line'}`}>
    {String(value ?? '—').replace(/_/g, ' ')}
  </span>
);

/** The "something is happening right now" indicator. */
export const LiveDot = ({ label }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-good/25 bg-good/10 px-3 py-1.5 text-xs font-semibold text-good">
    <span className="w-1.5 h-1.5 rounded-full bg-good animate-pulseRing" />
    {label}
  </span>
);

/* ------------------------------------------------------------------ polling */

/**
 * How often every live screen re-fetches.
 *
 * One number for the whole panel: a game moves every twenty seconds, so ten
 * keeps every screen ahead of the thing it is describing, and an operator never
 * has to remember which page is fresher than which.
 */
export const REFRESH_MS = 10_000;

/**
 * Re-runs `fn` on an interval, and immediately when the tab regains focus.
 *
 * Live screens go stale the moment a laptop sleeps; refreshing on focus means
 * you never look at a frozen number without realising it.
 */
export function usePolling(fn, intervalMs, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  // Bumped by refresh(), so a page can re-fetch straight after a write instead
  // of waiting out the interval and briefly showing what it just changed.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer;

    const run = async () => {
      try {
        const data = await fn();
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (error) {
        if (!cancelled && error.name !== 'AbortError') {
          setState((s) => ({ data: s.data, error, loading: false }));
        }
      }
    };

    run();
    if (intervalMs) timer = setInterval(run, intervalMs);

    const onFocus = () => {
      if (!document.hidden) run();
    };
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, refresh: () => setTick((n) => n + 1) };
}
