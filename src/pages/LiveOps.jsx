/**
 * Live operations — the page you open when you want to know whether MastiPe is
 * working right now, and how today compares.
 *
 * Three things, in the order you need them when something is wrong:
 *
 *   1. Pin to pin   every dependency and every stage of the player journey
 *   2. This minute  per-minute activity, with history that survives a reload
 *   3. Versus       today against yesterday and this day last week
 *
 * ── Why the minute chart has history ─────────────────────────────────────
 *
 * The older LiveCharts component built its window in the browser, appending a
 * point per poll. It is genuinely good for watching a game unfold, but it
 * starts empty and loses everything on refresh — so you could never see the
 * ten minutes BEFORE you opened the page, which is exactly the ten minutes you
 * want when you are investigating something. This series comes from the event
 * log, so it is complete the moment it loads.
 *
 * ── Why comparisons are aligned by time of day ───────────────────────────
 *
 * "Down 90% on yesterday" is meaningless at 9am, when today is nine hours old
 * and yesterday is twenty-four. Every comparison here is today-so-far against
 * the same clock time on the other days.
 *
 * ── Honesty about board.opened ───────────────────────────────────────────
 *
 * Boards poll for state about once a second each, and every poll is logged.
 * That number is the best proxy we have for "boards currently open", so it is
 * shown — on its own axis, labelled as polling, and excluded from activity.
 * Added into one total it would bury every real signal by a hundred to one.
 */

import { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { api } from '../lib/api.js';
import {
  Page, Panel, Loading, ErrorBox, Empty, Stat, LiveDot,
  axisProps, gridProps, VIZ, ChartTooltip, GradientDefs, Legend,
  usePolling, LIVE_REFRESH_MS,
} from '../components/ui.jsx';

const WINDOWS = [
  { label: '30 min', minutes: 30 },
  { label: '2 hours', minutes: 120 },
  { label: '6 hours', minutes: 360 },
  { label: '12 hours', minutes: 720 },
];

const TONE = {
  ok: { dot: 'bg-emerald-400', text: 'text-emerald-300', ring: 'ring-emerald-400/20' },
  warn: { dot: 'bg-amber-400', text: 'text-amber-300', ring: 'ring-amber-400/20' },
  fail: { dot: 'bg-rose-500', text: 'text-rose-300', ring: 'ring-rose-500/20' },
};

/** One dependency check. The reason is always visible, never behind a hover. */
function Check({ check }) {
  const tone = TONE[check.status] ?? TONE.warn;
  return (
    <div className={`flex items-start gap-3 rounded-lg bg-white/[0.03] ring-1 ${tone.ring} px-3 py-2.5`}>
      <span className={`mt-1.5 h-2 w-2 flex-none rounded-full ${tone.dot}`} />
      <div className="min-w-0">
        <div className="text-sm font-medium text-white/90">{check.name}</div>
        <div className={`text-xs ${check.status === 'ok' ? 'text-white/45' : tone.text} break-words`}>
          {check.detail}
        </div>
      </div>
    </div>
  );
}

/**
 * One step of the journey, as a bar against the step before it.
 *
 * The percentage is of the PREVIOUS stage, not of the top, because that is
 * where a leak actually is. A funnel shown against the top number tells you
 * things are bad; shown against the previous step it tells you where.
 */
function Stage({ stage, max }) {
  const width = max > 0 ? Math.max((stage.value / max) * 100, stage.value > 0 ? 2 : 0) : 0;
  const leaking = stage.percent !== null && stage.percent < 60;
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-white/80">{stage.label}</span>
        <span className="tabular-nums text-white/90 font-medium">
          {stage.value.toLocaleString('en-IN')}
          {stage.percent !== null && (
            <span className={`ml-2 text-xs ${leaking ? 'text-amber-300' : 'text-white/40'}`}>
              {stage.percent}%
            </span>
          )}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, background: leaking ? VIZ[5] : VIZ[0] }}
        />
      </div>
      <div className="mt-1 text-[11px] text-white/35">{stage.note}</div>
    </div>
  );
}

/**
 * today / yesterday / last week, at the same point in the day.
 *
 * A missing comparison shows as "no data", never as a percentage. Dividing by
 * a zero baseline produces either Infinity or a confident-looking "+100%",
 * and both read as a fact rather than as an absence.
 */
function Versus({ label, now = 0, yesterday = 0, lastWeek = 0 }) {
  const row = (caption, then) => {
    const known = Number.isFinite(then) && then > 0;
    const pct = known ? Math.round(((now - then) / then) * 100) : null;
    const tone = !known
      ? 'text-white/30'
      : now >= then
        ? 'text-emerald-300'
        : 'text-rose-300';
    return (
      <div className="flex justify-between gap-4" key={caption}>
        <span className="text-white/45">{caption}</span>
        <span className="tabular-nums">
          <span className="text-white/50 mr-2">{known ? then.toLocaleString('en-IN') : '—'}</span>
          <span className={tone}>
            {pct === null ? 'no data' : (pct > 0 ? '+' : '') + pct + '%'}
          </span>
        </span>
      </div>
    );
  };

  return (
    <div className="rounded-lg bg-white/[0.03] px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-white">
        {now.toLocaleString('en-IN')}
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {row('vs yesterday', yesterday)}
        {row('vs last week', lastWeek)}
      </div>
    </div>
  );
}

export default function LiveOps() {
  const [minutes, setMinutes] = useState(120);

  const { data, error, loading, refresh } = usePolling(
    (signal) => api.get(`/live-ops?minutes=${minutes}`, { signal, quiet: true }),
    LIVE_REFRESH_MS * 5, // five seconds: this is three queries, not one
    [minutes],
  );

  if (loading && !data) return <Page title="Live operations"><Loading /></Page>;
  if (error && !data) {
    return (
      <Page title="Live operations">
        <ErrorBox error={error} onRetry={refresh} />
      </Page>
    );
  }

  const { series, compare, health } = data;
  const points = series?.points ?? [];
  const last = points[points.length - 1] ?? {};

  // Totals across the visible window, so the tiles and the chart agree.
  const windowTotal = (k) => points.reduce((n, p) => n + Number(p[k] || 0), 0);

  const stv = compare?.sameTimeOfDay ?? { events: {}, players: {} };
  const overall = TONE[health?.status] ?? TONE.warn;
  const journeyMax = Math.max(1, ...(health?.journey ?? []).map((s) => s.value));

  return (
    <Page
      title="Live operations"
      subtitle={`Checked ${health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'} · refreshing every 5s`}
      actions={<LiveDot label="live" />}
    >
      {/* ── 1. pin to pin ────────────────────────────────────────────── */}
      <Panel
        title="Pin to pin"
        subtitle="Every dependency, checked now"
        actions={
          <span className={`inline-flex items-center gap-2 text-xs font-medium ${overall.text}`}>
            <span className={`h-2 w-2 rounded-full ${overall.dot}`} />
            {health?.status === 'ok'
              ? 'all clear'
              : health?.status === 'warn'
                ? 'needs a look'
                : 'something is broken'}
          </span>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(health?.checks ?? []).map((c) => (
            <Check key={c.name} check={c} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-white/35">
          <span>uptime {Math.floor((health?.uptimeSeconds ?? 0) / 60)} min</span>
          <span>memory {health?.memoryMb} MB</span>
          <span>window {health?.hours}h</span>
        </div>
      </Panel>

      {/* ── 2. this minute ───────────────────────────────────────────── */}
      <Panel
        title="Activity, by the minute"
        subtitle={`${series?.minutes ?? 0} minutes of history, straight from the event log`}
        actions={
          <div className="flex gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w.minutes}
                onClick={() => setMinutes(w.minutes)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  minutes === w.minutes
                    ? 'bg-white/10 text-white'
                    : 'text-white/45 hover:text-white/80'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
          <Stat label="Events this window" value={windowTotal('events')} index={0} />
          <Stat label="Numbers drawn" value={windowTotal('draws')} index={1} />
          <Stat label="Answers" value={windowTotal('answers')} index={2} />
          <Stat
            label="Board polls"
            value={windowTotal('boardPolls')}
            sub="boards checking for the next number, ~1/sec each"
            index={3}
          />
        </div>

        {windowTotal('events') === 0 && windowTotal('boardPolls') === 0 ? (
          <Empty>Nothing has happened in the last {series?.minutes} minutes.</Empty>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <GradientDefs ids={[{ id: 'ev', color: VIZ[0] }, { id: 'dr', color: VIZ[2] }]} />
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={48} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone" dataKey="events" name="Events"
                  stroke={VIZ[0]} fill="url(#fill-ev)" strokeWidth={2} dot={false}
                />
                <Area
                  type="monotone" dataKey="draws" name="Numbers drawn"
                  stroke={VIZ[2]} fill="url(#fill-dr)" strokeWidth={2} dot={false}
                />
                <Area
                  type="monotone" dataKey="answers" name="Answers"
                  stroke={VIZ[3]} fill="none" strokeWidth={1.5} dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <Legend
          items={[
            { label: 'Events', color: VIZ[0] },
            { label: 'Numbers drawn', color: VIZ[2] },
            { label: 'Answers', color: VIZ[3] },
          ]}
        />
        <p className="mt-2 text-[11px] text-white/35">
          Last minute ({last.label}): {last.events ?? 0} events, {last.players ?? 0} distinct
          players, {last.boardPolls ?? 0} board polls.
        </p>
      </Panel>

      {/* ── 3. versus ────────────────────────────────────────────────── */}
      <Panel
        title="Today versus before"
        subtitle="Compared at the same time of day — the only comparison that means anything before midnight"
      >
        <div className="grid gap-3 sm:grid-cols-2 mb-5">
          <Versus
            label="Events so far"
            now={stv.events.today ?? 0}
            yesterday={stv.events.yesterday ?? 0}
            lastWeek={stv.events.lastWeek ?? 0}
          />
          <Versus
            label="Players so far"
            now={stv.players.today ?? 0}
            yesterday={stv.players.yesterday ?? 0}
            lastWeek={stv.players.lastWeek ?? 0}
          />
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={compare?.points ?? []} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={56} />
              <YAxis {...axisProps} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              {/* Last week first, so today is drawn on top of its own history. */}
              <Line
                type="monotone" dataKey="lastWeekEvents" name="This day last week"
                stroke={VIZ[3]} strokeWidth={1.5} strokeDasharray="4 3" dot={false}
              />
              <Line
                type="monotone" dataKey="yesterdayEvents" name="Yesterday"
                stroke={VIZ[2]} strokeWidth={1.5} dot={false}
              />
              <Line
                type="monotone" dataKey="todayEvents" name="Today"
                stroke={VIZ[0]} strokeWidth={2.5} dot={false} connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Legend
          items={[
            { label: 'Today', color: VIZ[0] },
            { label: 'Yesterday', color: VIZ[2] },
            { label: 'This day last week', color: VIZ[3] },
          ]}
        />
      </Panel>

      {/* ── 4. the journey ──────────────────────────────────────────── */}
      <Panel
        title="The journey"
        subtitle={`Every stage a player has to get through, last ${health?.hours ?? 24} hours. Each percentage is of the step above it.`}
      >
        {health?.journeyError ? (
          <ErrorBox error={new Error('This pane could not be built: ' + health.journeyError)} />
        ) : (health?.journey ?? []).length === 0 ? (
          <Empty>No journey data.</Empty>
        ) : (
          <div className="divide-y divide-white/5">
            {health.journey.map((s) => (
              <Stage key={s.label} stage={s} max={journeyMax} />
            ))}
          </div>
        )}
      </Panel>
    </Page>
  );
}
