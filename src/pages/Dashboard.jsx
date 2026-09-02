/**
 * src/pages/Dashboard.jsx
 * ---------------------------------------------------------------------------
 * The one screen to open first: what is happening now, how today compares with
 * yesterday, and the shape of the last thirty days.
 *
 * Chart choices are deliberate. Active players is an area, because it is one
 * continuous quantity and the filled shape carries the trend at a glance.
 * Games and prizes are lines on a shared axis, because the interesting thing
 * is the gap between them - how many games actually produced a winner.
 */

import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, num } from '../lib/api.js';
import {
  BarRow, ChartTooltip, ErrorBox, GradientDefs, Legend, LiveDot, Loading,
  Page, Panel, Stat, VIZ, axisProps, gridProps, usePolling, REFRESH_MS,
} from '../components/ui.jsx';

export default function Dashboard() {
  const { data, error, loading } = usePolling(
    async () => {
      const [overview, comparisons, metrics, live, funnel] = await Promise.all([
        api.get('/overview'),
        api.get('/comparisons'),
        api.get('/metrics/daily'),
        api.get('/live'),
        api.get('/funnel').catch(() => null),
      ]);
      return { overview, comparisons, metrics, live, funnel };
    },
    REFRESH_MS,
    [],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { overview, comparisons, metrics, live, funnel } = data;
  const daily = comparisons.daily.reduce((acc, r) => ({ ...acc, [r.metric]: r }), {});

  const series = metrics.map((m) => ({
    day: m.day.slice(5),
    players: m.active_players,
    games: m.games_started,
    prizes: m.claims_awarded,
    joined: m.new_players,
  }));

  // Sparklines read the same 30-day series, so a tile and the chart below it
  // can never disagree about what happened.
  const spark = (key) => series.map((s) => s[key]);
  // /funnel is an object keyed by step, matching what Analytics expects; the
  // labels live here so both screens can word them differently if they need to.
  const FUNNEL_STEPS = [
    ['messaged_bot', 'Messaged us'],
    ['saw_menu', 'Accepted terms'],
    ['joined_room', 'Joined a game'],
    ['started_game', 'Played'],
    ['won_a_prize', 'Won a prize'],
  ];
  const funnelRows = funnel
    ? FUNNEL_STEPS.map(([key, label]) => ({ label, value: funnel[key] ?? 0 }))
    : [];
  const funnelMax = funnelRows.length ? Math.max(...funnelRows.map((s) => s.value)) : 0;

  return (
    <Page
      title="Dashboard"
      subtitle="Refreshes every 10 seconds — for live state, see Live monitoring"
      actions={
        <Link to="/live" className="no-underline">
          <LiveDot label={`${live.counts.games_running} running now · Live \u2192`} />
        </Link>
      }
    >
      {/* Today, against yesterday */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <Stat index={0} icon="◉" label="Active players" tone="gold" spark={spark('players')}
          value={num(daily['Active players']?.now ?? 0)}
          delta={daily['Active players']?.changePct} sub="vs yesterday" />
        <Stat index={1} icon="⬢" label="Games today" tone="crimson" spark={spark('games')}
          value={num(daily['Games created']?.now ?? 0)}
          delta={daily['Games created']?.changePct} sub="vs yesterday" />
        <Stat index={2} icon="✦" label="New players" tone="teal" spark={spark('joined')}
          value={num(daily['New players']?.now ?? 0)}
          delta={daily['New players']?.changePct} sub="vs yesterday" />
        <Stat index={3} icon="♛" label="Prizes won" tone="violet" spark={spark('prizes')}
          value={num(daily['Prizes won']?.now ?? 0)}
          delta={daily['Prizes won']?.changePct} sub="vs yesterday" />
      </div>

      {/* All-time */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={4} label="Total players" tone="ink" value={num(overview.total_players)} />
        <Stat index={5} label="Games played" tone="ink" value={num(overview.total_games)}
          sub={`${num(overview.games_completed)} completed`} />
        <Stat index={6} label="Messages sent" tone="ink" value={num(overview.messages_out)}
          sub={overview.messages_failed ? `${num(overview.messages_failed)} failed` : 'none failed'} />
        <Stat index={7} label="Events recorded" tone="ink" value={num(overview.events_recorded)}
          sub={`${num(overview.board_sessions)} board sessions`} />
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        <Panel className="xl:col-span-3" title="Active players" subtitle="Distinct players seen per day, last 30 days">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                <GradientDefs ids={[{ id: 'players', color: VIZ[0], from: 0.45 }]} />
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} minTickGap={22} />
                <YAxis allowDecimals={false} {...axisProps} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,.14)' }} />
                <Area type="monotone" dataKey="players" name="Players" stroke={VIZ[0]} strokeWidth={2.5}
                  fill="url(#fill-players)" activeDot={{ r: 4, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

      </div>

      <div className="grid xl:grid-cols-2 gap-4 mb-4">
        <Panel title="Games and prizes" subtitle="The gap is games that ended with no winner">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} minTickGap={22} />
                <YAxis allowDecimals={false} {...axisProps} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,.14)' }} />
                <Line type="monotone" dataKey="games" name="Games started" stroke={VIZ[1]}
                  strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="prizes" name="Prizes won" stroke={VIZ[2]}
                  strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend items={[
            { label: 'Games started', color: VIZ[1] },
            { label: 'Prizes won', color: VIZ[2] },
          ]} />
        </Panel>

        <Panel title="New players per day" subtitle="How fast the base is growing">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" {...axisProps} minTickGap={22} />
                <YAxis allowDecimals={false} {...axisProps} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                <Bar dataKey="joined" name="New players" radius={[4, 4, 0, 0]} maxBarSize={22}>
                  {/* The most recent day is picked out, because "is today good?"
                      is the question this chart is actually asked. */}
                  {series.map((_, i) => (
                    <Cell key={i} fill={i === series.length - 1 ? VIZ[0] : 'rgba(245,184,61,.32)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        {funnelRows.length > 0 && (
          <Panel title="From first message to a prize" subtitle="Last 30 days"
            actions={<Link to="/analytics" className="text-xs font-semibold text-gold hover:underline">Analytics →</Link>}>
            {funnelRows.map((step, i) => (
              <BarRow key={step.label} index={i} label={step.label} value={step.value} max={funnelMax}
                color={VIZ[i % VIZ.length]}
                hint={funnelMax > 0 ? `${Math.round((step.value / funnelMax) * 100)}%` : null} />
            ))}
          </Panel>
        )}

        <Panel title="This week vs last">
          <div className="space-y-1">
            {comparisons.weekly.map((row) => {
              const up = row.changePct > 0;
              const down = row.changePct < 0;
              return (
                <div key={row.metric} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <span className="text-[13px] text-muted">{row.metric}</span>
                  <span className="flex items-center gap-2.5">
                    <span className="font-bold nums text-ink">{num(row.now)}</span>
                    <span className="text-[11px] text-faint nums">from {num(row.before)}</span>
                    {row.changePct !== null ? (
                      <span className={`pill ${
                        up ? 'bg-good/12 text-good border-good/25'
                          : down ? 'bg-bad/12 text-bad border-bad/25'
                          : 'bg-white/5 text-muted border-line'
                      }`}>
                        {up ? '↑' : down ? '↓' : '—'} {Math.abs(row.changePct)}%
                      </span>
                    ) : (
                      // Nothing last week to divide by. Saying "new" is honest;
                      // showing 0% or ∞ would not be.
                      <span className="pill bg-viz-4/12 text-viz-4 border-viz-4/25">new</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </Page>
  );
}
