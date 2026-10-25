/**
 * src/pages/CricketDashboard.jsx
 * ---------------------------------------------------------------------------
 * Hand Cricket, at a glance.
 *
 * Its own master screen, like Tap Bakra: a match is two sides for a few
 * minutes, against the bot or a friend, and its numbers mean nothing next to a
 * Tambola room's.
 *
 * Two numbers matter most. Completion - and for friend matches, how many
 * challenges were never answered - tells you whether the invite loop works.
 * Win rate against the bot tells you whether the levels are tuned: near 0% or
 * near 100% means one is too hard or too soft.
 */

import { Link } from 'react-router-dom';
import { api, num } from '../lib/api.js';
import {
  ErrorBox, Loading, Page, Panel, Stat, Table, LiveDot, REFRESH_MS, usePolling, VIZ,
} from '../components/ui.jsx';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { axisProps, gridProps, ChartTooltip, GradientDefs } from '../components/ui.jsx';

/** "24/1 (1.3)" - a side's innings the way a scorecard says it. */
export const inningsText = (runs, wkts, balls) =>
  balls ? `${runs}/${wkts} (${Math.floor(balls / 6)}.${balls % 6})` : '—';

export default function CricketDashboard() {
  const { data, error, loading, reload } = usePolling(
    async () => {
      const [overview, daily, live, leaders] = await Promise.all([
        api.get('/cricket/overview'),
        api.get('/cricket/daily?days=30'),
        api.get('/cricket/live'),
        api.get('/cricket/leaderboard?limit=10'),
      ]);
      return { overview, daily, live, leaders };
    },
    REFRESH_MS,
  );

  if (loading && !data) return <Page title="Hand Cricket"><Loading /></Page>;
  if (error && !data) return <Page title="Hand Cricket"><ErrorBox error={error} onRetry={reload} /></Page>;

  const o = data.overview;
  const playing = data.live.filter((m) => m.active);

  return (
    <Page
      title="Hand Cricket"
      subtitle="1 to 6 each ball, same number is OUT — against the bot or a friend"
      actions={playing.length ? <LiveDot label={`${playing.length} playing now`} /> : null}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Matches today" value={num(o.today)} />
        <Stat index={1} label="Matches this week" value={num(o.d7)} sub={`${num(o.d30)} in 30 days · ${num(o.all)} ever`} />
        <Stat index={2} label="Players this week" value={num(o.players7d)} sub={`${num(o.playersAll)} ever`} tone="ink" />
        <Stat
          index={3}
          label="Completed"
          value={o.completionPct === null ? '—' : `${o.completionPct}%`}
          sub={`${num(o.finished)} finished · ${num(o.abandoned)} called off`}
          tone={o.completionPct !== null && o.completionPct < 60 ? 'bad' : 'gold'}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Vs bot / vs friend" value={`${num(o.bot)} / ${num(o.friend)}`} tone="ink" />
        <Stat
          index={1}
          label="Friend never joined"
          value={num(o.friendNeverJoined)}
          sub="challenges nobody answered"
          tone={o.friend && o.friendNeverJoined / o.friend > 0.5 ? 'bad' : 'ink'}
        />
        <Stat index={2} label="Players beat the bot" value={o.playerWinPctVsBot === null ? '—' : `${o.playerWinPctVsBot}%`} tone="ink" />
        <Stat index={3} label="Best innings" value={num(o.bestInnings)} sub={o.avgFirstInnings === null ? '' : `avg 1st innings ${o.avgFirstInnings}`} tone="gold" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Matches per day" subtitle="Last 30 days · bot and friend">
          {data.daily.filter((d) => d.matches).length < 2 ? (
            <p className="text-sm text-muted py-6 text-center">Not enough days yet to draw a line.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <GradientDefs ids={['crBot', 'crFriend']} />
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="day" {...axisProps} tickFormatter={(d) => String(d).slice(5)} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="bot" name="vs bot" stroke={VIZ[0]} fill="url(#crBot)" strokeWidth={2} stackId="1" />
                  <Area type="monotone" dataKey="friend" name="vs friend" stroke={VIZ[2]} fill="url(#crFriend)" strokeWidth={2} stackId="1" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Playing right now" subtitle="Matches moved in the last 30 minutes">
          {!data.live.length ? (
            <p className="text-sm text-muted py-6 text-center">Nobody is mid-match.</p>
          ) : (
            <Table head={['Match', 'Sides', 'Stage', 'Score', 'Idle']}>
              {data.live.map((m) => (
                <tr key={m.id}>
                  <td className="td"><Link className="text-gold hover:underline font-semibold" to={`/cricket/matches/${m.id}`}>#{m.id}</Link></td>
                  <td className="td text-xs">{m.host_name} <span className="text-muted">vs</span> {m.guest_name || <span className="text-muted">waiting…</span>}</td>
                  <td className="td text-xs">{m.status === 'playing' ? `innings ${m.innings}` : m.status}</td>
                  <td className="td text-xs">{inningsText(m.runs1, m.wkts1, m.balls1)}{m.innings === 2 ? ` · ${inningsText(m.runs2, m.wkts2, m.balls2)}` : ''}</td>
                  <td className={`td text-xs ${m.active ? 'text-good' : 'text-muted'}`}>{m.active ? `${m.idle_seconds}s` : 'idle'}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>

      <Panel title="Top players" subtitle="By wins, then best innings" className="mt-4">
        <Table head={['Player', 'Played', 'Won', 'Best innings', 'Average']} empty="Nobody has finished a match yet.">
          {data.leaders.map((l) => (
            <tr key={l.player_id}>
              <td className="td font-semibold">{l.player}</td>
              <td className="td">{num(l.played)}</td>
              <td className="td font-semibold text-gold">{num(l.won)}</td>
              <td className="td">{num(l.best)}</td>
              <td className="td text-muted">{l.average === null ? '—' : l.average}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </Page>
  );
}
