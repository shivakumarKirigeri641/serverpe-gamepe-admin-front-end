/**
 * src/pages/BakraDashboard.jsx
 * ---------------------------------------------------------------------------
 * Tap Bakra, at a glance.
 *
 * A second game needs its own master screen rather than more tiles on the
 * Tambola dashboard: the two share players and nothing else. A round here is
 * one person for sixty seconds; a game there is twenty people for twenty
 * minutes. Averaging them together would produce numbers that describe
 * neither.
 *
 * The number this screen exists for is completion. A score average tells you
 * how good the people who finished were; only completion tells you how many
 * walked out — and walking out is the failure this game can actually have.
 */

import { api, num, when } from '../lib/api.js';
import {
  ErrorBox, Loading, Page, Panel, Stat, Table, LiveDot, BarRow,
  REFRESH_MS, usePolling, VIZ,
} from '../components/ui.jsx';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { axisProps, gridProps, ChartTooltip, GradientDefs } from '../components/ui.jsx';

const MODE_LABEL = {
  go: 'Straight tap',
  position: 'Word vs slot',
  rule: 'Rule',
  except: 'Both but one',
  hold: 'Holding still',
};

export default function BakraDashboard() {
  const { data, error, loading, reload } = usePolling(
    async () => {
      const [overview, daily, live, leaders] = await Promise.all([
        api.get('/bakra/overview'),
        api.get('/bakra/daily?days=30'),
        api.get('/bakra/live'),
        api.get('/bakra/leaderboard?limit=10'),
      ]);
      return { overview, daily, live, leaders };
    },
    REFRESH_MS,
  );

  if (loading && !data) return <Page title="Tap Bakra"><Loading /></Page>;
  if (error && !data) return <Page title="Tap Bakra"><ErrorBox error={error} onRetry={reload} /></Page>;

  const o = data.overview;
  const playing = data.live.filter((r) => r.active);

  return (
    <Page
      title="Tap Bakra"
      subtitle="Tap fast, think faster — one player, ten questions, sixty seconds"
      actions={playing.length ? <LiveDot label={`${playing.length} playing now`} /> : null}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Rounds today" value={num(o.roundsToday)} />
        <Stat index={1} label="Rounds this week" value={num(o.rounds7d)} sub={`${num(o.rounds30d)} in 30 days`} />
        <Stat index={2} label="Players this week" value={num(o.players7d)} sub={`${num(o.playersAll)} ever`} tone="ink" />
        <Stat
          index={3}
          label="Completed"
          value={o.completionPct === null ? '—' : `${o.completionPct}%`}
          sub={`${num(o.finished)} finished · ${num(o.abandoned)} walked out`}
          tone={o.completionPct !== null && o.completionPct < 70 ? 'bad' : 'gold'}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Average score" value={num(o.avgScore)} />
        <Stat index={1} label="Best score" value={num(o.bestScore)} tone="gold" />
        <Stat index={2} label="Accuracy" value={o.accuracyPct === null ? '—' : `${o.accuracyPct}%`} tone="ink" />
        <Stat index={3} label="Average answer" value={o.avgMs === null ? '—' : `${num(o.avgMs)}ms`} tone="ink" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Rounds per day" subtitle="Last 30 days">
          {data.daily.length < 2 ? (
            <p className="text-sm text-muted py-6 text-center">
              Not enough days yet to draw a line.
            </p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <GradientDefs ids={['bakraRounds']} />
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="day" {...axisProps} tickFormatter={(d) => String(d).slice(5)} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone" dataKey="rounds" stroke={VIZ[0]}
                    fill="url(#bakraRounds)" strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Playing right now" subtitle="Rounds open in the last 30 minutes">
          {!data.live.length ? (
            <p className="text-sm text-muted py-6 text-center">Nobody is mid-round.</p>
          ) : (
            <Table head={['Player', 'Where', 'Progress', 'Idle']}>
              {data.live.map((r) => (
                <tr key={r.id}>
                  <td className="td font-semibold">{r.player}</td>
                  <td className="td text-muted text-xs">
                    {[r.city, r.region].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="td">
                    {r.answered}/{r.of}
                    <span className="text-muted text-xs"> · {r.correct} right</span>
                  </td>
                  <td className={`td text-xs ${r.active ? 'text-good' : 'text-muted'}`}>
                    {r.active ? `${r.idleSeconds}s` : 'idle'}
                  </td>
                </tr>
              ))}
            </Table>
          )}
          {/*
            A round left open on a closed tab is not somebody playing. Anything
            quiet for two minutes is shown as idle rather than counted as live,
            because a "12 playing now" that is really twelve abandoned tabs is
            worse than no number.
          */}
        </Panel>
      </div>

      <Panel title="Top players" subtitle="By best single round" className="mt-4">
        <Table head={['Player', 'Where', 'Rounds', 'Best', 'Average', 'Accuracy', 'Speed']}
               empty="Nobody has finished a round yet.">
          {data.leaders.map((l) => (
            <tr key={l.playerId}>
              <td className="td font-semibold">{l.player}</td>
              <td className="td text-muted text-xs">{l.city || '—'}</td>
              <td className="td">{num(l.rounds)}</td>
              <td className="td font-semibold text-gold">{num(l.best)}</td>
              <td className="td">{num(l.average)}</td>
              <td className="td">{l.accuracyPct === null ? '—' : `${l.accuracyPct}%`}</td>
              <td className="td text-muted">{l.avgMs === null ? '—' : `${num(l.avgMs)}ms`}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </Page>
  );
}
