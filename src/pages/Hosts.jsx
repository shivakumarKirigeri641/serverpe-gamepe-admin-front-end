/**
 * src/pages/Hosts.jsx
 * ---------------------------------------------------------------------------
 * Who is actually putting games together.
 *
 * The Players page answers "who uses this"; this one answers the question the
 * business runs on — who organises, how often, and who they bring with them. A
 * host is not a separate kind of account: anybody who opens a room is one, and
 * hosts play as guests in other people's rooms. So the interesting numbers are
 * the crossovers, and they are shown rather than left to be worked out:
 * repeat attendance (seats vs distinct people), and guests who have gone on to
 * host rooms of their own.
 *
 * Clicking a host opens everything about them on the same screen — their games,
 * the people in those games, and what each person claimed — because the
 * alternative is three pages and a lost thread.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, fullWa, num, when } from '../lib/api.js';
import { Badge, Empty, ErrorBox, Loading, Page, REFRESH_MS, Stat, Table, usePolling } from '../components/ui.jsx';

/**
 * "3 days ago", in the units this page needs.
 *
 * The shared `ago` in lib/api.js is tuned for live monitoring, where seconds
 * matter and nothing is older than an hour. Host history runs to weeks, and
 * "412800s ago" is not a sentence anybody can read.
 */
function ago(value) {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';

  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;

  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

const n = (v) => Number(v || 0);

/* ------------------------------------------------------------------ list */

function HostList({ onOpen }) {
  const [search, setSearch] = useState('');
  const { data, error, loading, refresh } = usePolling(
    () => api.get(`/hosts?limit=100&offset=0${search ? `&search=${encodeURIComponent(search)}` : ''}`),
    REFRESH_MS,
    [search],
  );

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />;
  if (loading && !data) return <Loading />;

  const hosts = data?.hosts ?? [];
  const totalGames = hosts.reduce((sum, h) => sum + n(h.games_hosted), 0);
  const totalSeats = hosts.reduce((sum, h) => sum + n(h.players_brought), 0);
  const repeatHosts = hosts.filter((h) => n(h.games_hosted) > 1).length;

  return (
    <Page
      title="Hosts"
      subtitle={`${num(data?.total ?? 0)} people have opened a room`}
      actions={
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Name or number…"
          className="border border-line rounded-lg px-3 py-2 text-sm w-56"
        />
      }
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Hosts" value={num(data?.total ?? 0)} index={0} />
        <Stat label="Games hosted" value={num(totalGames)} index={1} />
        <Stat
          label="Hosted more than once"
          value={num(repeatHosts)}
          sub="the ones who came back"
          index={2}
        />
        <Stat label="Seats filled" value={num(totalSeats)} sub="across all their games" index={3} />
      </div>

      <Table
        head={['Host', 'Games', 'Players brought', 'Also plays', 'First hosted', 'Last hosted']}
        empty="Nobody has hosted a game yet."
      >
        {hosts.map((h) => (
          <tr key={h.id} className="border-t border-line hover:bg-cream/60 cursor-pointer" onClick={() => onOpen(h.id)}>
            <td className="px-4 py-3">
              <div className="font-bold">{h.display_name || 'Unnamed'}</div>
              <div className="text-xs text-muted tabular-nums">{fullWa(h.wa_id)}</div>
            </td>
            <td className="px-4 py-3 tabular-nums">
              <span className="font-bold">{num(h.games_hosted)}</span>
              <span className="text-xs text-muted">
                {' '}
                · {num(h.games_completed)} finished
                {n(h.games_abandoned) > 0 && `, ${num(h.games_abandoned)} cancelled`}
              </span>
            </td>
            <td className="px-4 py-3 tabular-nums">
              <span className="font-bold">{num(h.distinct_players)}</span>
              <span className="text-xs text-muted"> people · {num(h.players_brought)} seats</span>
            </td>
            <td className="px-4 py-3 tabular-nums">
              {n(h.games_as_guest) > 0 ? (
                <Badge value={`${num(h.games_as_guest)} as guest`} tone="bg-brand/10 text-gold" />
              ) : (
                <span className="text-muted text-xs">host only</span>
              )}
            </td>
            <td className="px-4 py-3 text-xs text-muted">{when(h.first_hosted_at)}</td>
            <td className="px-4 py-3 text-xs">
              <div>{ago(h.last_hosted_at)}</div>
              <div className="text-muted">{when(h.last_hosted_at)}</div>
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

/* ---------------------------------------------------------------- detail */

function GameTimeline({ gameId }) {
  const { data, loading } = usePolling(() => api.get(`/games/${gameId}/timeline?limit=400`), 0, [gameId]);
  if (loading && !data) return <Loading label="Reading the room…" />;
  if (!data?.length) return <Empty>Nothing was recorded for this game.</Empty>;

  return (
    <ol className="text-sm space-y-1 max-h-96 overflow-y-auto pr-2">
      {data.map((row, i) => (
        <li key={i} className="flex gap-3 items-baseline">
          <span className="text-[11px] text-muted tabular-nums w-32 shrink-0">{when(row.at)}</span>
          <Badge
            value={row.kind}
            tone={
              row.kind === 'claim'
                ? 'bg-good/10 text-good'
                : row.kind === 'join'
                  ? 'bg-brand/10 text-gold'
                  : 'bg-white/5 text-muted'
            }
          />
          <span>
            {row.player_name && <b className="mr-1">{row.player_name}</b>}
            {row.detail}
          </span>
        </li>
      ))}
    </ol>
  );
}

function HostDetail({ id, onBack }) {
  const [openGame, setOpenGame] = useState(null);
  const { data, error, loading, refresh } = usePolling(() => api.get(`/hosts/${id}`), REFRESH_MS, [id]);

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />;
  if (loading && !data) return <Loading />;
  if (!data) return <Empty>That host no longer exists.</Empty>;

  const { host, roles, games, players } = data;
  const crossovers = players.filter((p) => p.id !== host.id && n(p.games_they_hosted) > 0);

  return (
    <Page
      title={host.display_name || 'Unnamed host'}
      subtitle={`${fullWa(host.wa_id)} · joined ${when(host.created_at)} · last seen ${ago(host.last_seen_at)}`}
      actions={
        <button onClick={onBack} className="text-sm font-bold text-gold hover:underline">
          ← All hosts
        </button>
      }
    >
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Games hosted" value={num(games.length)} index={0} />
        <Stat
          label="First hosted"
          value={ago(roles?.first_hosted_at)}
          sub={when(roles?.first_hosted_at)}
          index={1}
        />
        <Stat
          label="Played as a guest"
          value={num(roles?.games_as_guest)}
          sub={
            roles?.first_played_as_guest_at
              ? `first ${when(roles.first_played_as_guest_at)}`
              : 'only ever hosts'
          }
          index={2}
        />
        <Stat
          label="Guests who now host"
          value={num(crossovers.length)}
          sub="people they introduced who run their own rooms"
          index={3}
        />
      </div>

      <h3 className="font-extrabold mb-2">Their games</h3>
      <Table
        head={['Room', 'When', 'Players', 'Numbers', 'Prizes', 'Ran for', 'Status', '']}
        empty="No games."
      >
        {games.map((g) => (
          <tr key={g.id} className="border-t border-line">
            <td className="px-4 py-3 font-mono font-bold">{g.room_code}</td>
            <td className="px-4 py-3 text-xs">
              <div>{ago(g.created_at)}</div>
              <div className="text-muted">{when(g.created_at)}</div>
            </td>
            <td className="px-4 py-3 tabular-nums">
              {num(g.players)}
              {g.expected_players && (
                <span className="text-xs text-muted"> / {num(g.expected_players)} expected</span>
              )}
            </td>
            <td className="px-4 py-3 tabular-nums">{num(g.numbers_called)}</td>
            <td className="px-4 py-3 tabular-nums">
              {num(g.prizes_awarded)}
              {n(g.claims_rejected) > 0 && (
                <span className="text-xs text-muted"> · {num(g.claims_rejected)} refused</span>
              )}
            </td>
            <td className="px-4 py-3 tabular-nums text-xs">{g.minutes ? `${g.minutes} min` : '—'}</td>
            <td className="px-4 py-3">
              <Badge
                value={g.status}
                
              />
            </td>
            <td className="px-4 py-3 text-right">
              <button
                onClick={() => setOpenGame(openGame === g.id ? null : g.id)}
                className="text-xs font-bold text-gold hover:underline"
              >
                {openGame === g.id ? 'Hide' : 'Every step'}
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {openGame && (
        <div className="card p-5 mt-4">
          <h3 className="font-extrabold mb-3">
            Everything that happened in {games.find((g) => g.id === openGame)?.room_code}
          </h3>
          <GameTimeline gameId={openGame} />
        </div>
      )}

      <h3 className="font-extrabold mt-8 mb-2">Who plays with them</h3>
      <Table
        head={['Player', 'Games together', 'Prizes', 'Refused claims', 'First', 'Last', 'Hosts too?']}
        empty="Nobody has joined their games."
      >
        {players.map((p) => (
          <tr key={p.id} className="border-t border-line">
            <td className="px-4 py-3">
              <div className="font-bold">
                {p.display_name || 'Unnamed'}
                {p.id === host.id && <span className="text-xs text-muted font-normal"> (the host)</span>}
              </div>
              <div className="text-xs text-muted tabular-nums">{fullWa(p.wa_id)}</div>
            </td>
            <td className="px-4 py-3 tabular-nums font-bold">{num(p.games_with_host)}</td>
            <td className="px-4 py-3 tabular-nums">{num(p.prizes_won)}</td>
            <td className="px-4 py-3 tabular-nums text-muted">{num(p.claims_rejected)}</td>
            <td className="px-4 py-3 text-xs text-muted">{when(p.first_played_at)}</td>
            <td className="px-4 py-3 text-xs">
              <div>{ago(p.last_played_at)}</div>
            </td>
            <td className="px-4 py-3">
              {n(p.games_they_hosted) > 0 ? (
                <Badge value={`hosts ${num(p.games_they_hosted)}`} tone="bg-good/10 text-good" />
              ) : (
                <span className="text-xs text-muted">guest only</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

export default function Hosts() {
  const { id } = useParams();
  const navigate = useNavigate();

  return id ? (
    <HostDetail id={id} onBack={() => navigate('/hosts')} />
  ) : (
    <HostList onOpen={(hostId) => navigate(`/hosts/${hostId}`)} />
  );
}
