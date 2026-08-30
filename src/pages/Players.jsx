/**
 * src/pages/Players.jsx
 * ---------------------------------------------------------------------------
 * Everyone who has ever messaged the bot, and one player in full.
 *
 * The list masks phone numbers; the detail page shows the full number, because
 * that is the page you open when you need to call somebody back.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fullWa, inr, maskWa, num, when } from '../lib/api.js';
import { Badge, ErrorBox, Loading, Page, Stat, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

function PlayerDetail({ id }) {
  const navigate = useNavigate();
  const { data, error, loading } = usePolling(
    async () => {
      const [detail, timeline, consents, wallet] = await Promise.all([
        api.get(`/players/${id}`),
        api.get(`/players/${id}/timeline?limit=60`),
        api.get(`/players/${id}/consents`),
        api.get(`/wallets/${id}?limit=20`),
      ]);
      return { detail, timeline, consents, wallet };
    },
    REFRESH_MS,
    [id],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;
  if (!data.detail) return <Page title="Player not found" />;

  const p = data.detail.player;

  return (
    <Page
      title={p.display_name || 'Player'}
      subtitle={fullWa(p.wa_id)}
      actions={
        <button className="btn-sec" onClick={() => navigate('/players')}>
          ← All players
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat index={0} label="Games" value={num(p.games_played)} />
        <Stat index={1} label="Prizes" value={num(p.prizes_won)} tone="ink" />
        <Stat index={2} label="Full houses" value={num(p.full_houses)} tone="ink" />
        <Stat index={3} label="Points" value={num(p.points)} tone="ink" />
        <Stat index={4} label="Credits" value={inr(p.balance_paise)} tone="ink" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3">Account</h2>
          <dl className="text-sm space-y-1.5">
            {[
              ['First seen', when(p.created_at)],
              ['Last seen', when(p.last_seen_at)],
              ['Blocked', p.is_blocked ? 'Yes' : 'No'],
              ['Locale', p.locale],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <Link to={`/conversations/${id}`} className="btn-sec w-full mt-4">
            View conversation
          </Link>

          {/* Only known once they have opened their board in a browser — WhatsApp
              itself carries no address. City is approximate: a mobile connection
              often resolves to the operator's gateway, not the person. */}
          <h2 className="text-sm font-bold mt-5 mb-3 pt-4 border-t border-line">Where &amp; device</h2>
          <dl className="text-sm space-y-1.5">
            {[
              [
                'Location',
                [p.last_city, p.last_region, p.last_country].filter(Boolean).join(', ') || 'Not known',
              ],
              ['IP', p.last_ip || 'Not known'],
              ['Seen on web', when(p.last_device_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium truncate">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted mt-2 break-words" title={p.last_user_agent}>
            {p.last_user_agent || 'No device recorded'}
          </p>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3">Consents</h2>
          {data.consents.length === 0 ? (
            <p className="text-sm text-muted">Nothing accepted yet.</p>
          ) : (
            <ul className="text-sm space-y-1.5">
              {data.consents.map((c, i) => (
                <li key={i} className="flex justify-between">
                  <span>
                    {c.title} <span className="text-muted">v{c.version}</span>
                  </span>
                  <span className="text-muted text-xs">{when(c.accepted_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h2 className="text-sm font-bold mb-2">Credit movements</h2>
      <div className="mb-5">
        <Table head={['When', 'Amount', 'Reason', 'Note', 'By']} empty="No credit movements.">
          {data.wallet.history.map((t, i) => (
            <tr key={i}>
              <td className="td text-xs text-muted">{when(t.created_at)}</td>
              <td className={`td font-semibold ${Number(t.amount_paise) < 0 ? 'text-red-600' : 'text-good'}`}>
                {Number(t.amount_paise) < 0 ? '−' : '+'}
                {inr(Math.abs(Number(t.amount_paise)))}
              </td>
              <td className="td"><Badge value={t.kind} /></td>
              <td className="td text-muted">{t.note || t.room_code || '—'}</td>
              <td className="td text-xs text-muted">{t.created_by || 'system'}</td>
            </tr>
          ))}
        </Table>
      </div>

      <h2 className="text-sm font-bold mb-2">Recent activity</h2>
      <Table head={['When', 'Type', 'What']}>
        {data.timeline.map((t, i) => (
          <tr key={i}>
            <td className="td text-xs text-muted whitespace-nowrap">{when(t.at)}</td>
            <td className="td text-xs">{t.kind === 'message' ? `${t.direction} message` : 'event'}</td>
            <td className="td text-xs font-mono text-muted truncate max-w-xs">
              {t.subtype}
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

export default function Players() {
  const { id } = useParams();
  const [search, setSearch] = useState('');

  if (id) return <PlayerDetail id={id} />;

  return <PlayerList search={search} setSearch={setSearch} />;
}

function PlayerList({ search, setSearch }) {
  const [query, setQuery] = useState('');
  const { data, error, loading } = usePolling(
    () => api.get(`/players?limit=100${query ? `&search=${encodeURIComponent(query)}` : ''}`),
    REFRESH_MS,
    [query],
  );

  return (
    <Page
      title="Players"
      subtitle="Everyone who has messaged the bot"
      actions={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
          }}
          className="flex gap-2"
        >
          <input
            className="input !py-1.5 !w-56"
            placeholder="Name or number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn-sec !py-1.5">Search</button>
        </form>
      }
    >
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorBox error={error} />
      ) : (
        <Table head={['Player', 'Number', 'Games', 'Prizes', 'Points', 'First seen', 'Last seen']}>
          {data.map((p) => (
            <tr key={p.id} className="hover:bg-line/20">
              <td className="td font-semibold">
                <Link to={`/players/${p.id}`} className="text-brand hover:underline">
                  {p.display_name || 'Unnamed'}
                </Link>
              </td>
              <td className="td text-muted">{maskWa(p.wa_id)}</td>
              <td className="td">{num(p.games_played)}</td>
              <td className="td">{num(p.prizes_won)}</td>
              <td className="td font-semibold">{num(p.points)}</td>
              <td className="td text-xs text-muted">{when(p.created_at)}</td>
              <td className="td text-xs text-muted">{when(p.last_seen_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Page>
  );
}
