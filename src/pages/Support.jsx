/**
 * src/pages/Support.jsx
 * ---------------------------------------------------------------------------
 * Support tickets: the queue, one ticket in full, and replies.
 *
 * Sorted by priority then age, so the urgent-and-old sit at the top rather than
 * being buried under whatever arrived most recently.
 */

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, maskWa, num, when } from '../lib/api.js';
import { Badge, ErrorBox, Loading, Page, Stat, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

const STATUSES = ['open', 'in_progress', 'waiting_on_player', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

function TicketDetail({ id }) {
  const navigate = useNavigate();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  const { data, error, loading } = usePolling(() => api.get(`/support/tickets/${id}`), REFRESH_MS, [id, nonce]);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;
  if (!data) return <Page title="Ticket not found" />;

  const { ticket, messages } = data;

  const change = async (patch) => {
    await api.patch(`/support/tickets/${id}`, patch);
    setNonce((n) => n + 1);
  };

  const send = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/support/tickets/${id}/messages`, { body: reply });
      setReply('');
      setNonce((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={ticket.subject}
      subtitle={`${ticket.reference} · opened ${when(ticket.created_at)}`}
      actions={
        <button className="btn-sec" onClick={() => navigate('/support')}>
          All tickets
        </button>
      }
    >
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="card p-4 mb-4 max-h-[55vh] overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`mb-3 flex ${m.author === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                    m.author === 'admin' ? 'bg-brand text-white' : 'bg-white/5'
                  }`}
                >
                  {m.body}
                  <div className={`text-[10px] mt-1.5 ${m.author === 'admin' ? 'text-white/70' : 'text-muted'}`}>
                    {m.author_name || m.author} · {when(m.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={send} className="card p-4">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-2">
              Add a reply
            </label>
            <textarea
              className="input min-h-[90px]"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="What did you do about it?"
            />
            <p className="text-[11px] text-muted mt-2">
              Recorded on the ticket only. Messaging the player on WhatsApp is a separate step.
            </p>
            <button className="btn-pri mt-3" disabled={busy || !reply.trim()}>
              {busy ? 'Saving…' : 'Add reply'}
            </button>
          </form>
        </div>

        <div className="card p-4 h-fit">
          <h2 className="text-sm font-bold mb-3">Details</h2>

          <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1">
            Status
          </label>
          <select className="input mb-3" value={ticket.status} onChange={(e) => change({ status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1">
            Priority
          </label>
          <select
            className="input mb-3"
            value={ticket.priority}
            onChange={(e) => change({ priority: e.target.value })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <dl className="text-sm space-y-1.5 mt-4">
            <div className="flex justify-between">
              <dt className="text-muted">Player</dt>
              <dd className="font-medium">
                {ticket.player_id ? (
                  <Link to={`/players/${ticket.player_id}`} className="text-gold hover:underline">
                    {ticket.display_name || maskWa(ticket.wa_id)}
                  </Link>
                ) : (
                  maskWa(ticket.wa_id)
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Room</dt>
              <dd className="font-medium">{ticket.room_code || '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Updated</dt>
              <dd className="font-medium">{when(ticket.updated_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Page>
  );
}

function TicketList() {
  const [status, setStatus] = useState('');
  const { data, error, loading } = usePolling(
    () => api.get(`/support/tickets?limit=100${status ? `&status=${status}` : ''}`),
    REFRESH_MS,
    [status],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { stats, items } = data;

  return (
    <Page
      title="Support tickets"
      subtitle="Most urgent and oldest first"
      actions={
        <div className="flex gap-1 flex-wrap">
          {['', ...STATUSES].map((s) => (
            <button
              key={s || 'all'}
              onClick={() => setStatus(s)}
              className={`btn ${status === s ? 'btn-pri' : 'btn-sec'} !px-3 !py-1.5 text-xs`}
            >
              {s ? s.replace(/_/g, ' ') : 'All'}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat index={0} label="Open" value={num(stats.open)} />
        <Stat index={1} label="In progress" value={num(stats.in_progress)} tone="ink" />
        <Stat index={2} label="Waiting on player" value={num(stats.waiting)} tone="ink" />
        <Stat index={3} label="Closed" value={num(stats.closed)} tone="ink" />
        <Stat index={4} label="Urgent open" value={num(stats.urgent_open)} />
      </div>

      <Table head={['Ref', 'Subject', 'Player', 'Priority', 'Status', 'Replies', 'Opened']}>
        {items.map((t) => (
          <tr key={t.id} className="hover:bg-line/20">
            <td className="td font-mono text-xs">
              <Link to={`/support/${t.id}`} className="text-gold hover:underline font-semibold">
                {t.reference}
              </Link>
            </td>
            <td className="td font-semibold max-w-xs truncate">{t.subject}</td>
            <td className="td">{t.display_name || maskWa(t.wa_id)}</td>
            <td className="td">
              <Badge value={t.priority} />
            </td>
            <td className="td">
              <Badge value={t.status} />
            </td>
            <td className="td">{num(t.messages)}</td>
            <td className="td text-xs text-muted">{when(t.created_at)}</td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}

export default function Support() {
  const { id } = useParams();
  return id ? <TicketDetail id={id} /> : <TicketList />;
}
