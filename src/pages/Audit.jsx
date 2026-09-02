/**
 * src/pages/Audit.jsx
 * ---------------------------------------------------------------------------
 * Game audit: pick a host by number, open one of their games, and read every
 * player's ticket and every single tap they made.
 *
 * This is the screen to open when a result is disputed. It answers, for one
 * game, in one place: was that number really called, did that player really
 * tap that, were they right, how long did they take, and was the prize
 * validly awarded. Everything is printable so a dispute can be answered with
 * a PDF rather than a screenshot.
 *
 * The time range drives both the list and the chart, and the chart's bucket
 * size follows the range - an hourly chart over 90 days is unreadable, so the
 * server picks minutes, hours, days or weeks to match.
 */

import { useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, fullWa, num, when } from '../lib/api.js';
import {
  ChartTooltip, Empty, ErrorBox, GradientDefs, Legend, Loading, Page, Panel,
  Stat, Table, VIZ, axisProps, gridProps, usePolling, REFRESH_MS,
} from '../components/ui.jsx';

const RANGES = [
  { key: '1h', label: '1 hour' },
  { key: '6h', label: '6 hours' },
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

const ANSWER_TONE = {
  yes: 'bg-good/12 text-good border-good/25',
  no: 'bg-bad/12 text-bad border-bad/25',
  no_response: 'bg-white/5 text-muted border-line',
};
const ANSWER_LABEL = { yes: 'I have it', no: 'Not on mine', no_response: 'no response' };

export default function Audit() {
  const [range, setRange] = useState('7d');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [openGame, setOpenGame] = useState(null);

  const { data, error, loading } = usePolling(
    async () => {
      const qs = `?range=${range}${applied ? `&search=${encodeURIComponent(applied)}` : ''}`;
      const [hosts, activity] = await Promise.all([
        api.get(`/audit/hosts${qs}`),
        api.get(`/audit/activity?range=${range}`),
      ]);
      return { hosts, activity };
    },
    REFRESH_MS,
    [range, applied],
  );

  if (openGame) return <GameAudit id={openGame} onBack={() => setOpenGame(null)} />;
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { hosts, activity } = data;
  const totals = hosts.reduce(
    (a, h) => ({
      games: a.games + h.games.length,
      finished: a.finished + h.finished,
      players: a.players + h.distinct_players,
      numbers: a.numbers + (h.numbers_called || 0),
    }),
    { games: 0, finished: 0, players: 0, numbers: 0 },
  );

  return (
    <Page
      title="Game audit"
      subtitle="Every host, every game, every tap"
      actions={
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`pill border ${
                range === r.key
                  ? 'bg-gold/15 text-gold border-gold/40'
                  : 'bg-surface text-muted border-line hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat index={0} label="Hosts" value={num(hosts.length)} tone="gold" />
        <Stat index={1} label="Games" value={num(totals.games)} tone="crimson"
          sub={`${num(totals.finished)} finished`} />
        <Stat index={2} label="Players seated" value={num(totals.players)} tone="teal" />
        <Stat index={3} label="Numbers called" value={num(totals.numbers)} tone="violet" />
      </div>

      <Panel title="Activity" subtitle="Bucket size follows the range you picked"
        className="mb-4">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activity} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
              <GradientDefs ids={[{ id: 'aud', color: VIZ[0], from: 0.4 }]} />
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="bucket" {...axisProps} minTickGap={26} />
              <YAxis allowDecimals={false} {...axisProps} width={40} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,.14)' }} />
              <Area type="monotone" dataKey="games" name="Games" stroke={VIZ[0]}
                strokeWidth={2.5} fill="url(#fill-aud)" />
              <Area type="monotone" dataKey="players" name="Players" stroke={VIZ[2]}
                strokeWidth={2} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <Legend items={[{ label: 'Games', color: VIZ[0] }, { label: 'Players', color: VIZ[2] }]} />
      </Panel>

      <form
        className="flex gap-2 mb-4"
        onSubmit={(e) => { e.preventDefault(); setApplied(search.trim()); }}
      >
        <input
          className="input"
          placeholder="Host number or name — e.g. 9198861…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-pri shrink-0">Search</button>
        {applied && (
          <button type="button" className="btn-sec shrink-0"
            onClick={() => { setSearch(''); setApplied(''); }}>Clear</button>
        )}
      </form>

      {hosts.length === 0 ? (
        <Empty icon="⌕">No games in this window.</Empty>
      ) : (
        hosts.map((h) => (
          <Panel
            key={h.host_id}
            className="mb-3"
            title={`${h.host_name} · ${fullWa(h.host_wa_id)}`}
            subtitle={
              `${h.games.length} game${h.games.length === 1 ? '' : 's'} · ` +
              `${h.distinct_players} distinct players · last ${when(h.last_game_at)}` +
              (h.last_city ? ` · ${h.last_city}` : '')
            }
          >
            <Table head={['Room', 'Status', 'Players', 'Numbers', 'Prizes', 'Minutes', 'Started', '']}>
              {h.games.map((g) => (
                <tr key={g.id} className="row-link" onClick={() => setOpenGame(g.id)}>
                  <td className="td font-mono font-bold text-gold">{g.room_code}</td>
                  <td className="td"><span className="pill bg-white/5 text-muted border-line">{g.status}</span></td>
                  <td className="td nums">{g.players} / {g.expected_players}</td>
                  <td className="td nums">{g.numbers_called}</td>
                  <td className="td nums">{g.prizes_awarded}</td>
                  <td className="td nums">{g.minutes}</td>
                  <td className="td text-xs text-muted whitespace-nowrap">{when(g.created_at)}</td>
                  <td className="td text-gold text-xs font-semibold">Open →</td>
                </tr>
              ))}
            </Table>
          </Panel>
        ))
      )}
    </Page>
  );
}

/* ------------------------------------------------------- one game in full */

function GameAudit({ id, onBack }) {
  const { data, error, loading } = usePolling(() => api.get(`/audit/games/${id}`), 0, [id]);
  const [openPlayer, setOpenPlayer] = useState(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { game, players, draws, prizes } = data;

  return (
    <Page
      title={`Game ${game.code}`}
      subtitle={`Hosted by ${game.host_name} · ${fullWa(game.host_wa_id)} · ${when(game.created_at)}`}
      actions={
        <div className="flex gap-2 noprint">
          <button className="btn-sec" onClick={onBack}>← Back</button>
          <button className="btn-pri" onClick={() => window.print()}>Download PDF</button>
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat index={0} label="Players" value={num(players.length)} tone="gold" />
        <Stat index={1} label="Numbers called" value={`${draws.length} / 90`} tone="crimson" />
        <Stat index={2} label="Prizes awarded" value={num(prizes.filter((p) => p.winner).length)} tone="teal" />
        <Stat index={3} label="Ended" value={(game.ended_reason || '—').replace(/_/g, ' ')} tone="violet"
          sub={game.ended_at ? when(game.ended_at) : 'still running'} />
      </div>

      <Panel title="Prizes" className="mb-4">
        <ul className="prizes">
          {prizes.map((p) => (
            <li key={p.key} className="flex py-2 border-t border-line first:border-0 text-sm">
              {p.label}
              <span className="ml-auto font-semibold">
                {p.winner
                  ? <span className="text-gold">{p.winner}{p.seq ? ` · on number ${p.seq}` : ''}</span>
                  : <span className="text-muted font-normal">unclaimed</span>}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {players.map((p) => (
        <Panel
          key={p.id}
          className="mb-3"
          title={`${p.display_name}${p.is_host ? ' · host' : ''}`}
          subtitle={
            `${fullWa(p.wa_id)} · ${p.stats.correct}/${p.stats.answered} correct ` +
            `(${p.stats.accuracyPct}%) · ${p.stats.missed} missed` +
            (p.stats.avgSeconds != null ? ` · avg ${p.stats.avgSeconds}s` : '') +
            (p.device.type ? ` · ${p.device.type}${p.device.os ? ' / ' + p.device.os : ''}` : '')
          }
          actions={
            <button className="btn-sec !py-1.5 text-xs noprint"
              onClick={() => setOpenPlayer(openPlayer === p.id ? null : p.id)}>
              {openPlayer === p.id ? 'Hide taps' : 'Every tap'}
            </button>
          }
        >
          <div className="grid lg:grid-cols-2 gap-4">
            <Ticket ticket={p.ticket} drawn={draws.map((d) => d.value)} />

            <div>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { k: 'Correct', v: p.stats.correct },
                      { k: 'Wrong', v: p.stats.wrong },
                      { k: 'Missed', v: p.stats.missed },
                    ]}
                    margin={{ top: 4, right: 8, bottom: 0, left: -22 }}
                  >
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="k" {...axisProps} />
                    <YAxis allowDecimals={false} {...axisProps} width={38} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,.04)' }} />
                    <Bar dataKey="v" name="Numbers" radius={[5, 5, 0, 0]} maxBarSize={44} fill={VIZ[2]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {p.claims.length > 0 && (
                <ul className="prizes mt-2">
                  {p.claims.map((c, i) => (
                    <li key={i} className="flex py-1.5 text-xs border-t border-line first:border-0">
                      <span className="capitalize">{c.claim_type.replace(/_/g, ' ')}</span>
                      <span className="text-muted ml-2 truncate">{c.reason}</span>
                      <span className={`ml-auto font-bold ${c.status === 'awarded' ? 'text-good' : 'text-bad'}`}>
                        {c.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {openPlayer === p.id && (
            <div className="mt-4">
              <Table head={['#', 'Number', 'On ticket', 'Tapped', 'Right?', 'Took', 'Called at']}>
                {p.trail.map((t) => (
                  <tr key={t.seq}>
                    <td className="td text-muted">{t.seq}</td>
                    <td className="td font-mono font-bold text-gold">{t.value}</td>
                    <td className="td">{t.onTicket ? 'yes' : <span className="text-muted">no</span>}</td>
                    <td className="td">
                      <span className={`pill ${ANSWER_TONE[t.answer]}`}>{ANSWER_LABEL[t.answer]}</span>
                    </td>
                    <td className="td">
                      {t.wasCorrect === true ? <span className="text-good font-bold">✓</span>
                        : t.wasCorrect === false ? <span className="text-bad font-bold">✗</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="td nums text-xs">
                      {t.tookSeconds == null ? '—' : `${t.tookSeconds.toFixed(1)}s`}
                    </td>
                    <td className="td text-xs text-muted whitespace-nowrap">{when(t.drawnAt)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </Panel>
      ))}
    </Page>
  );
}

/** The ticket as it finished: cells that were called are marked. */
function Ticket({ ticket, drawn }) {
  if (!ticket) return <div className="text-sm text-muted">No ticket recorded.</div>;
  const called = new Set(drawn);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#f4ecd8' }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          {ticket.grid.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => (
                <td
                  key={c}
                  style={{
                    border: '1px solid rgba(139,30,63,.45)',
                    height: 40,
                    textAlign: 'center',
                    font: '600 15px/1 Georgia, serif',
                    color: v === null ? 'transparent' : called.has(v) ? '#06301f' : '#2b2118',
                    background: v === null
                      ? 'repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(139,30,63,.06) 4px,rgba(139,30,63,.06) 8px)'
                      : called.has(v) ? 'rgba(16,185,129,.35)' : 'transparent',
                  }}
                >
                  {v ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
