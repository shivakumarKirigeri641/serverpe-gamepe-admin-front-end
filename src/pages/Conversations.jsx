/**
 * src/pages/Conversations.jsx
 * ---------------------------------------------------------------------------
 * Every exchange with every player, split into hosts and players.
 *
 * The thread reads like a chat rather than a log table, because that is how the
 * player experienced it — and a support question is almost always "what did we
 * actually send them?".
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, fullWa, maskWa, num, when } from '../lib/api.js';
import { Badge, Empty, ErrorBox, Loading, Page, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

/** Pulls readable text out of whichever WhatsApp payload shape was stored. */
function bodyText(body) {
  if (!body) return '';
  if (body.text?.body) return body.text.body;
  if (body.interactive?.body?.text) return body.interactive.body.text;
  if (body.image) return '[ticket image]';
  if (body.document) return `[document: ${body.document.filename || 'file'}]`;
  if (typeof body.text === 'string') return body.text;
  if (body.actionId) return `[tapped: ${body.actionId}]`;
  return '';
}

function Thread({ id }) {
  const navigate = useNavigate();
  const { data, error, loading } = usePolling(
    async () => {
      const [messages, detail] = await Promise.all([
        api.get(`/conversations/${id}?limit=200`),
        api.get(`/players/${id}`),
      ]);
      return { messages, player: detail?.player };
    },
    REFRESH_MS,
    [id],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  // Stored newest-first for the API; a chat reads oldest-first.
  const messages = [...data.messages].reverse();

  return (
    <Page
      title={data.player?.display_name || 'Conversation'}
      subtitle={data.player ? fullWa(data.player.wa_id) : ''}
      actions={
        <>
          <Link to={`/players/${id}`} className="btn-sec">
            Player profile
          </Link>
          <button className="btn-sec" onClick={() => navigate('/conversations')}>
            All conversations
          </button>
        </>
      }
    >
      <div className="card p-4 max-h-[70vh] overflow-y-auto bg-bg">
        {messages.length === 0 ? (
          <Empty>No messages yet.</Empty>
        ) : (
          <div className="space-y-2">
            {messages.map((m, i) => {
              const inbound = m.direction === 'inbound';
              return (
                <div key={i} className={`flex ${inbound ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap shadow-sm ${
                      inbound ? 'bg-surface' : 'bg-brand text-white'
                    }`}
                  >
                    {bodyText(m.body) || <span className="opacity-60">[{m.kind}]</span>}
                    <div className={`text-[10px] mt-1.5 ${inbound ? 'text-muted' : 'text-white/70'}`}>
                      {when(m.created_at)}
                      {m.room_code ? ` · ${m.room_code}` : ''}
                      {!inbound && m.status ? ` · ${m.status}` : ''}
                      {m.error ? <span className="text-red-300"> · failed</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}

const FILTERS = [
  { key: 'all', label: 'Everyone' },
  { key: 'hosts', label: 'Hosts' },
  { key: 'players', label: 'Players only' },
];

function ConversationList({ filter, setFilter }) {
  const { data, error, loading } = usePolling(
    () => api.get(`/conversations?limit=100&filter=${filter}`),
    REFRESH_MS,
    [filter],
  );

  return (
    <Page
      title="Conversations"
      subtitle="Hosts and players, newest activity first"
      actions={
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`btn ${filter === f.key ? 'btn-pri' : 'btn-sec'} !px-3 !py-1.5 text-xs`}
            >
              {f.label}
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
        <Table head={['Player', 'Number', 'Role', 'Received', 'Sent', 'Last message']}>
          {data.map((c) => (
            <tr key={c.id} className="hover:bg-line/20">
              <td className="td font-semibold">
                <Link to={`/conversations/${c.id}`} className="text-gold hover:underline">
                  {c.display_name || 'Unnamed'}
                </Link>
              </td>
              <td className="td text-muted">{maskWa(c.wa_id)}</td>
              <td className="td">
                <span className="flex gap-1">
                  {c.has_hosted ? <Badge value="host" tone="bg-brand/10 text-gold" /> : null}
                  {c.in_game ? <Badge value="in game" tone="bg-good/10 text-good" /> : null}
                  {!c.has_hosted && !c.in_game ? (
                    <span className="text-muted text-xs">player</span>
                  ) : null}
                </span>
              </td>
              <td className="td">{num(c.received)}</td>
              <td className="td">{num(c.sent)}</td>
              <td className="td text-xs text-muted">{when(c.last_message_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Page>
  );
}

export default function Conversations() {
  const { id } = useParams();
  const [filter, setFilter] = useState('all');

  if (id) return <Thread id={id} />;
  return <ConversationList filter={filter} setFilter={setFilter} />;
}
