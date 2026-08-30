/**
 * src/components/ui.jsx
 * ---------------------------------------------------------------------------
 * Shared pieces so every page looks and behaves the same: page headers,
 * loading and error states, stat tiles with period-over-period deltas, and a
 * table that scrolls inside its own container.
 *
 * Wide data (message bodies, event properties) scrolls horizontally in place
 * rather than stretching the page — a panel that scrolls sideways as a whole is
 * unusable on a laptop.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export const Page = ({ title, subtitle, actions, children }) => (
  <>
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-brand">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
    {children}
  </>
);

export const Loading = ({ label = 'Loading…' }) => (
  <div className="card p-10 grid place-items-center text-muted text-sm">
    <div className="w-6 h-6 rounded-full border-2 border-line border-t-brand animate-spin mb-3" />
    {label}
  </div>
);

export const ErrorBox = ({ error, onRetry }) => (
  <div className="card p-6 border-red-200 bg-red-50/60">
    <p className="text-sm text-red-700 font-semibold mb-1">Something went wrong</p>
    <p className="text-sm text-red-600">{String(error?.message || error)}</p>
    {onRetry && (
      <button className="btn-sec mt-3" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);

export const Empty = ({ children }) => (
  <div className="card p-10 text-center text-muted text-sm">{children}</div>
);

/** A headline number, optionally with its change against the previous period. */
export function Stat({ label, value, delta, sub, tone = 'brand', index = 0 }) {
  const hasDelta = delta !== undefined && delta !== null;
  const up = hasDelta && delta > 0;
  const down = hasDelta && delta < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="card p-4"
    >
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className={`text-3xl font-extrabold mt-1 ${tone === 'brand' ? 'text-brand' : 'text-ink'}`}>
        {value}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {hasDelta && (
          <span
            className={`pill ${up ? 'bg-good/10 text-good' : down ? 'bg-red-100 text-red-700' : 'bg-line/60 text-muted'}`}
          >
            {up ? '▲' : down ? '▼' : '—'} {Math.abs(delta)}%
          </span>
        )}
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </div>
    </motion.div>
  );
}

export const Table = ({ head, children, empty = 'Nothing here yet.' }) => (
  <div className="card overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead>
          <tr>
            {/* Index keys because a header can be an element (a select-all
                checkbox), which is not usable as a key. */}
            {head.map((h, i) => (
              <th key={i} className="th">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
    {!children?.length && <div className="p-8 text-center text-sm text-muted">{empty}</div>}
  </div>
);

const STATUS_TONES = {
  running: 'bg-good/10 text-good',
  lobby: 'bg-gold/15 text-[#8a5d00]',
  completed: 'bg-line/60 text-muted',
  cancelled: 'bg-red-100 text-red-700',
  open: 'bg-gold/15 text-[#8a5d00]',
  in_progress: 'bg-blue-100 text-blue-700',
  waiting_on_player: 'bg-line/60 text-muted',
  resolved: 'bg-good/10 text-good',
  closed: 'bg-line/60 text-muted',
  urgent: 'bg-red-100 text-red-700',
  high: 'bg-gold/15 text-[#8a5d00]',
  normal: 'bg-line/60 text-muted',
  low: 'bg-line/60 text-muted',
};

export const Badge = ({ value, tone }) => (
  <span className={`pill ${tone || STATUS_TONES[value] || 'bg-line/60 text-muted'}`}>
    {String(value ?? '—').replace(/_/g, ' ')}
  </span>
);

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

/** A live dot, so it is obvious the numbers are moving on their own. */
export const LiveDot = ({ label = 'Live' }) => (
  <span className="pill bg-good/10 text-good">
    <span className="w-1.5 h-1.5 rounded-full bg-good animate-pulse" />
    {label}
  </span>
);
