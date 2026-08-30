/**
 * src/pages/Games.jsx
 * ---------------------------------------------------------------------------
 * Every room ever opened, and one room in forensic detail.
 *
 * The detail view exists to answer disputes: the exact draw order, who answered
 * what and when, and every claim including the rejected ones.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, inr, maskWa, num, when } from '../lib/api.js';
import { Badge, ErrorBox, Loading, Page, Stat, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

function GameDetail({ id }) {
  const navigate = useNavigate();
  const { data, error, loading } = usePolling(() => api.get(`/games/${id}`), REFRESH_MS, [id]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return <Page title="Game not found" />;

  const { game, players, draws, claims, responses } = data;

  // Response latency per player, so a slow room is visible at a glance.
  const latencyByPlayer = responses.reduce((acc, r) => {
    const key = r.wa_id;
    (acc[key] ||= []).push(Number(r.latency_ms));
    return acc;
  }, {});

  return (
    <Page
      title={`Room ${game.room_code}`}
      subtitle={`${game.game_key} · ${game.plan_key || 'no plan'} · created ${when(game.created_at)}`}
      actions={
        <button className="btn-sec" onClick={() => navigate('/games')}>
          All games
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat index={0} label="Status" value={game.status} />
        <Stat index={1} label="Players" value={num(players.length)} tone="ink" />
        <Stat index={2} label="Numbers called" value={num(draws.length)} tone="ink" />
        <Stat
          index={3}
          label="Prizes won"
          value={num(claims.filter((c) => c.status === 'awarded').length)}
          tone="ink"
        />
        <Stat index={4} label="Charged" value={inr(game.charged_paise)} tone="ink" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div>
          <h2 className="text-sm font-bold mb-2">Players</h2>
          <Table head={['Player', 'Number', 'Answered', 'Typical reply', 'Joined']}>
            {players.map((p) => {
              const times = latencyByPlayer[p.wa_id] || [];
              const median = times.length
                ? Math.round([...times].sort((a, b) => a - b)[Math.floor(times.length / 2)] / 100) / 10
                : null;
              return (
                <tr key={p.player_id}>
                  <td className="td font-semibold">
                    <Link to={`/players/${p.player_id}`} className="text-brand hover:underline">
                      {p.display_name || 'Unnamed'}
                    </Link>
                    {game.host_player_id === p.player_id && (
                      <Badge value="host" tone="bg-brand/10 text-brand ml-2" />
                    )}
                  </td>
                  <td className="td text-muted">{maskWa(p.wa_id)}</td>
                  <td className="td">{num(p.answered)}</td>
                  <td className="td">{median !== null ? `${median}s` : '—'}</td>
                  <td className="td text-xs text-muted">{when(p.joined_at)}</td>
                </tr>
              );
            })}
          </Table>
        </div>

        <div>
          <h2 className="text-sm font-bold mb-2">Claims</h2>
          <Table head={['Prize', 'Player', 'Result', 'At number']} empty="No claims were made.">
            {claims.map((c, i) => (
              <tr key={i}>
                <td className="td font-semibold">{c.claim_type.replace(/_/g, ' ')}</td>
                <td className="td">{c.display_name || maskWa(c.wa_id)}</td>
                <td className="td">
                  <Badge
                    value={c.status}
                    tone={c.status === 'awarded' ? 'bg-good/10 text-good' : 'bg-red-100 text-red-700'}
                  />
                  {c.reason && <div className="text-[11px] text-muted mt-1">{c.reason}</div>}
                </td>
                <td className="td">{c.draw_seq}</td>
              </tr>
            ))}
          </Table>
        </div>
      </div>

      <h2 className="text-sm font-bold mb-2">Draw order</h2>
      <div className="card p-4">
        {draws.length === 0 ? (
          <p className="text-sm text-muted">No numbers were called.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {draws.map((d) => (
              <span
                key={d.seq}
                title={`#${d.seq} at ${when(d.drawn_at)}`}
                className="inline-flex items-center justify-center min-w-[34px] h-8 rounded-lg
                  bg-line/50 text-sm font-bold tabular-nums"
              >
                {d.value}
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted mt-3">
          In order. Hover a number for its sequence and timestamp — this is the record that settles a
          disputed claim.
        </p>
      </div>
    </Page>
  );
}

const STATUSES = ['', 'running', 'lobby', 'completed', 'cancelled'];

function GameList() {
  const [status, setStatus] = useState('');
  const { data, error, loading } = usePolling(
    () => api.get(`/games?limit=100${status ? `&status=${status}` : ''}`),
    REFRESH_MS,
    [status],
  );

  return (
    <Page
      title="Games"
      subtitle="Every room ever opened"
      actions={
        <div className="flex gap-1">
          {STATUSES.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatus(s)}
              className={`btn ${status === s ? 'btn-pri' : 'btn-sec'} !px-3 !py-1.5 text-xs`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      }
    >
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorBox error={error} />
      ) : (
        <Table head={['Room', 'Status', 'Host', 'Players', 'Numbers', 'Prizes', 'Plan', 'Created']}>
          {data.map((g) => (
            <tr key={g.id} className="hover:bg-line/20">
              <td className="td font-mono font-bold">
                <Link to={`/games/${g.id}`} className="text-brand hover:underline">
                  {g.room_code}
                </Link>
              </td>
              <td className="td">
                <Badge value={g.status} />
              </td>
              <td className="td">{g.host_name || maskWa(g.host_wa_id)}</td>
              <td className="td">{num(g.players)}</td>
              <td className="td">{num(g.numbers_drawn)}</td>
              <td className="td">{num(g.prizes_awarded)}</td>
              <td className="td text-xs text-muted">{g.plan_key || '—'}</td>
              <td className="td text-xs text-muted">{when(g.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Page>
  );
}

export default function Games() {
  const { id } = useParams();
  return id ? <GameDetail id={id} /> : <GameList />;
}
