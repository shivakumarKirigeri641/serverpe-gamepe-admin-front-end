/**
 * src/pages/Live.jsx
 * ---------------------------------------------------------------------------
 * What is happening this second: every open room, who is in it, who is hosting,
 * and a rolling feed of what players are doing.
 *
 * Polls every 5 seconds — fast enough to watch a game progress, slow enough not
 * to hammer the database with a dashboard nobody is looking at.
 */

import { ago, api, maskWa, num, timeOnly } from '../lib/api.js';
import { Badge, Empty, ErrorBox, LiveDot, Loading, Page, Stat, Table, usePolling, LIVE_REFRESH_MS } from '../components/ui.jsx';

const EVENT_LABELS = {
  'player.created': 'said hi for the first time',
  'player.returned': 'came back',
  'menu.shown': 'saw the menu',
  'consent.prompted': 'was shown the terms',
  'consent.accepted': 'accepted the terms',
  'consent.declined': 'declined the terms',
  'game.created': 'created a room',
  'game.joined': 'joined a room',
  'game.started': 'started the game',
  'game.draw': 'number drawn',
  'game.ack': 'answered a number',
  'game.left': 'left the game',
  'game.completed': 'game finished',
  'game.abandoned': 'game abandoned',
  'claim.awarded': 'won a prize',
  'claim.rejected': 'made a wrong claim',
  'board.opened': 'opened their board',
  'feedback.rated': 'rated the game',
  'promo.shown': 'saw the QuizPe promo',
  error: 'hit an error',
};

/**
 * "Bengaluru, Karnataka" — or an honest dash.
 *
 * Location comes from the IP the board was opened from, so two states of
 * "nothing" are worth telling apart and are rendered differently below: a
 * player who has not opened their board yet (nothing to resolve), and one
 * whose address did not resolve to a city (a datacentre IP, a VPN, a provider
 * miss). Both show as unknown, neither is an error.
 *
 * Union territories arrive in the same field as states — Delhi, Puducherry and
 * Chandigarh sit alongside Karnataka — so there is nothing to special-case.
 */
function placeOf(row) {
  const bits = [row.city, row.region].filter(Boolean);
  if (!bits.length) return null;
  // "Bengaluru, Karnataka" reads better than repeating a city that IS the state.
  return bits[0] === bits[1] ? bits[0] : bits.join(', ');
}

/** The location cell: place on top, address underneath for the rare dispute. */
const Where = ({ row }) => {
  const place = placeOf(row);
  if (!place) {
    return (
      <span className="text-muted" title={row.board_open ? 'Address did not resolve to a city' : 'Has not opened their board yet'}>
        {row.board_open ? 'unknown' : '—'}
      </span>
    );
  }
  return (
    <span title="Approximate — resolved from the IP the board was opened from. On mobile data this is the carrier gateway.">
      <span className="text-ink">{place}</span>
      {row.ip && <span className="block text-[11px] text-muted font-mono">{row.ip}</span>}
    </span>
  );
};

export default function Live() {
  const { data, error, loading } = usePolling(
    async () => {
      const [snapshot, players] = await Promise.all([api.get('/live'), api.get('/live/players')]);
      return { snapshot, players };
    },
    LIVE_REFRESH_MS,
    [],
  );

  if (loading && !data) return <Loading label="Reading live state…" />;
  if (error && !data) return <ErrorBox error={error} />;

  const { snapshot, players } = data;
  const c = snapshot.counts;

  return (
    <Page title="Live monitoring" subtitle="Refreshes every second" actions={<LiveDot />}>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat index={0} label="Games running" value={num(c.games_running)} />
        <Stat index={1} label="Waiting to start" value={num(c.games_in_lobby)} tone="ink" />
        <Stat index={2} label="Players in game" value={num(c.players_in_game)} tone="ink" />
        <Stat index={3} label="Active (5 min)" value={num(c.active_5m)} tone="ink" />
        <Stat
          index={4}
          label="Sent last hour"
          value={num(c.sent_1h)}
          sub={c.failed_1h ? `${num(c.failed_1h)} failed` : 'none failed'}
          tone="ink"
        />
      </div>

      <h2 className="text-sm font-bold text-ink mb-2">Open rooms</h2>
      {snapshot.games.length === 0 ? (
        <Empty>No games are open right now.</Empty>
      ) : (
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          {snapshot.games.map((g) => (
            <div key={g.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-extrabold text-lg tracking-wide text-gold">{g.room_code}</div>
                  <div className="text-xs text-muted mt-0.5">
                    Host {g.host_name} · {maskWa(g.host_wa_id)}
                  </div>
                </div>
                <Badge value={g.status} />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div>
                  <div className="text-2xl font-extrabold">{g.players}</div>
                  <div className="text-[11px] text-muted">
                    players{g.expected_players ? ` of ${g.expected_players}` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold">{g.numbers_drawn}</div>
                  <div className="text-[11px] text-muted">numbers called</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-gold">{g.last_number ?? '—'}</div>
                  <div className="text-[11px] text-muted">
                    {g.last_draw_at ? ago(g.last_draw_at) : 'not started'}
                  </div>
                </div>
              </div>

              {g.places && (
                <div className="text-xs text-muted mt-3 flex gap-1.5">
                  <span aria-hidden className="text-gold">◈</span>
                  <span
                    className="min-w-0"
                    title="Approximate — resolved from the IP each board was opened from."
                  >
                    {g.places}
                  </span>
                </div>
              )}

              {g.prizes_awarded > 0 && (
                <div className="text-xs text-muted mt-3">{g.prizes_awarded} prize(s) already won</div>
              )}
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-bold text-ink mb-2">Who is playing right now</h2>
      <div className="mb-6">
        <Table head={['Player', 'Number', 'Room', 'Role', 'City / state', 'Device', 'Answered', 'Last answer']}>
          {players.map((p) => (
            <tr key={`${p.id}-${p.room_code}`}>
              <td className="td font-semibold">{p.display_name || '—'}</td>
              <td className="td text-muted">{maskWa(p.wa_id)}</td>
              <td className="td font-mono">{p.room_code}</td>
              <td className="td">
                {p.is_host ? <Badge value="host" tone="bg-brand/10 text-gold" /> : <span className="text-muted">player</span>}
              </td>
              <td className="td"><Where row={p} /></td>
              <td className="td text-muted text-xs">
                {[p.device_type, p.os, p.browser].filter(Boolean).join(' · ') || '—'}
              </td>
              <td className="td">{num(p.answered)}</td>
              <td className="td text-muted">{p.last_answer_at ? ago(p.last_answer_at) : '—'}</td>
            </tr>
          ))}
        </Table>
      </div>

      <h2 className="text-sm font-bold text-ink mb-2">Activity feed · last 30 minutes</h2>
      <div className="card p-2 max-h-[420px] overflow-y-auto">
        {snapshot.recent.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Nothing in the last 30 minutes.</div>
        ) : (
          <ul className="divide-y divide-line/60">
            {snapshot.recent.map((e, i) => (
              <li key={i} className="px-3 py-2 flex items-baseline gap-3 text-sm">
                <span className="text-[11px] text-muted font-mono shrink-0 w-20">
                  {timeOnly(e.occurred_at)}
                </span>
                <span className="font-semibold shrink-0">
                  {e.display_name || maskWa(e.wa_id) || 'system'}
                </span>
                <span className="text-muted min-w-0">
                  {EVENT_LABELS[e.event_type] || e.event_type}
                  {e.room_code && <span className="font-mono text-ink"> · {e.room_code}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Page>
  );
}
