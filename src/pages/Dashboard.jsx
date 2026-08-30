/**
 * src/pages/Dashboard.jsx
 * ---------------------------------------------------------------------------
 * The one screen to open first: what is happening now, how today compares with
 * yesterday, and the shape of the last two weeks.
 */

import { Link } from 'react-router-dom';
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
import { api, num, when } from '../lib/api.js';
import { ErrorBox, LiveDot, Loading, Page, Stat, usePolling, REFRESH_MS } from '../components/ui.jsx';

const chartAxis = { stroke: '#6b7684', fontSize: 11, tickLine: false, axisLine: false };

export default function Dashboard() {
  const { data, error, loading } = usePolling(
    async () => {
      const [overview, comparisons, metrics, live] = await Promise.all([
        api.get('/overview'),
        api.get('/comparisons'),
        api.get('/metrics/daily'),
        api.get('/live'),
      ]);
      return { overview, comparisons, metrics, live };
    },
    REFRESH_MS,
    [],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { overview, comparisons, metrics, live } = data;
  const daily = comparisons.daily.reduce((acc, r) => ({ ...acc, [r.metric]: r }), {});

  const series = metrics.map((m) => ({
    day: m.day.slice(5),
    players: m.active_players,
    games: m.games_started,
    prizes: m.claims_awarded,
  }));

  return (
    <Page
      title="Dashboard"
      subtitle="Updated every 30 seconds"
      actions={<LiveDot label={`${live.counts.games_running} running`} />}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat
          index={0}
          label="Active players today"
          value={num(daily['Active players']?.now ?? 0)}
          delta={daily['Active players']?.changePct}
          sub="vs yesterday"
        />
        <Stat
          index={1}
          label="Games today"
          value={num(daily['Games created']?.now ?? 0)}
          delta={daily['Games created']?.changePct}
          sub="vs yesterday"
        />
        <Stat
          index={2}
          label="New players today"
          value={num(daily['New players']?.now ?? 0)}
          delta={daily['New players']?.changePct}
          sub="vs yesterday"
        />
        <Stat
          index={3}
          label="Prizes won today"
          value={num(daily['Prizes won']?.now ?? 0)}
          delta={daily['Prizes won']?.changePct}
          sub="vs yesterday"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={4} label="Total players" value={num(overview.total_players)} tone="ink" />
        <Stat index={5} label="Games played" value={num(overview.total_games)} tone="ink" />
        <Stat
          index={6}
          label="Messages sent"
          value={num(overview.messages_out)}
          sub={overview.messages_failed ? `${num(overview.messages_failed)} failed` : 'none failed'}
          tone="ink"
        />
        <Stat index={7} label="Events recorded" value={num(overview.events_recorded)} tone="ink" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <h2 className="text-sm font-bold text-ink mb-3">Active players, last 30 days</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="playersFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7d0f22" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#7d0f22" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e7ee" vertical={false} />
                <XAxis dataKey="day" {...chartAxis} />
                <YAxis allowDecimals={false} {...chartAxis} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="players"
                  stroke="#7d0f22"
                  strokeWidth={2}
                  fill="url(#playersFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold text-ink mb-3">Games and prizes</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e7ee" vertical={false} />
                <XAxis dataKey="day" {...chartAxis} />
                <YAxis allowDecimals={false} {...chartAxis} />
                <Tooltip />
                <Line type="monotone" dataKey="games" stroke="#b3122b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="prizes" stroke="#f0a202" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs text-muted mt-2">
            <span>
              <span className="inline-block w-3 h-0.5 bg-brand-accent align-middle mr-1" /> games started
            </span>
            <span>
              <span className="inline-block w-3 h-0.5 bg-gold align-middle mr-1" /> prizes won
            </span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-ink">Right now</h2>
            <Link to="/live" className="text-xs font-semibold text-brand hover:underline">
              Live monitoring →
            </Link>
          </div>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            {[
              ['Games running', live.counts.games_running],
              ['Rooms waiting to start', live.counts.games_in_lobby],
              ['Players in a game', live.counts.players_in_game],
              ['Players waiting', live.counts.players_waiting],
              ['Active in last 5 min', live.counts.active_5m],
              ['Said “hi” in last hour', live.counts.said_hi_1h],
              ['Messages sent (1h)', live.counts.sent_1h],
              ['Open support tickets', live.counts.tickets_open],
            ].map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="font-bold text-right pr-2">{num(value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-ink">This week vs last</h2>
            <Link to="/analytics" className="text-xs font-semibold text-brand hover:underline">
              Analytics →
            </Link>
          </div>
          <div className="space-y-2">
            {comparisons.weekly.map((row) => (
              <div key={row.metric} className="flex items-center justify-between text-sm">
                <span className="text-muted">{row.metric}</span>
                <span className="flex items-center gap-2">
                  <span className="font-bold">{num(row.now)}</span>
                  <span className="text-xs text-muted">from {num(row.before)}</span>
                  {row.changePct !== null && (
                    <span
                      className={`pill ${row.changePct > 0 ? 'bg-good/10 text-good' : row.changePct < 0 ? 'bg-red-100 text-red-700' : 'bg-line/60 text-muted'}`}
                    >
                      {row.changePct > 0 ? '▲' : row.changePct < 0 ? '▼' : '—'}
                      {Math.abs(row.changePct)}%
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-4">
            Rollups fresh to {overview.metricsFreshTo ? when(overview.metricsFreshTo) : 'never'}
          </p>
        </div>
      </div>
    </Page>
  );
}
