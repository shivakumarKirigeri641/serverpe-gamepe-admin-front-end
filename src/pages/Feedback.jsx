/**
 * src/pages/Feedback.jsx
 * ---------------------------------------------------------------------------
 * Ratings and comments left after a game — and which of them the world sees.
 *
 * Approving a comment publishes it on mastipe.in as a testimonial. That is the
 * one action in this panel that makes a player's private words public, so it is
 * deliberately a two-part decision: the operator chooses the comment, and the
 * name it appears under. WhatsApp profile names are often somebody's full legal
 * name, and a marketing page should say "Amruta", not that.
 *
 * Nothing is ever deleted here. Un-publishing takes a testimonial off the site
 * and leaves the feedback exactly as the player wrote it.
 */

import { useState } from 'react';
import { api, maskWa, num, when } from '../lib/api.js';
import { ErrorBox, Loading, Page, Stat, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

const stars = (n) => '★'.repeat(n || 0) + '☆'.repeat(Math.max(5 - (n || 0), 0));

/** The first word of a name — what a testimonial should carry. */
const firstName = (full) => (full || '').trim().split(/\s+/)[0] || 'A player';

function CommentCard({ f, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(firstName(f.display_name));
  const published = Boolean(f.approved_at);

  const approve = async () => {
    setBusy(true);
    try {
      await api.put(`/feedback/${f.id}/approve`, { displayAs: name.trim() || null });
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const unapprove = async () => {
    setBusy(true);
    try {
      await api.put(`/feedback/${f.id}/unapprove`, {});
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`card p-4 ${published ? 'border-2 border-good/40 bg-good/5' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gold text-sm">{stars(f.rating)}</span>
        <span className="text-[11px] text-muted">{when(f.created_at)}</span>
      </div>

      <p className="text-sm">{f.comment}</p>

      <p className="text-[11px] text-muted mt-2">
        {f.display_name || maskWa(f.wa_id)} · {f.room_code || 'no room'}
      </p>

      {published ? (
        <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-2">
          <span className="pill bg-good/10 text-good">On the website as “{f.display_as}”</span>
          <span className="text-[11px] text-muted">
            {f.approved_by ? `by ${f.approved_by}` : ''} {when(f.approved_at)}
          </span>
          <button className="btn-sec ml-auto !py-1 !text-xs" disabled={busy} onClick={unapprove}>
            {busy ? '…' : 'Take it down'}
          </button>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-line">
          {editing ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">
                <span className="block font-bold text-muted mb-1">Show on the site as</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  className="border border-line rounded-lg px-2 py-1 text-sm w-40"
                />
              </label>
              <button className="btn !py-1 !text-xs" disabled={busy} onClick={approve}>
                {busy ? 'Publishing…' : 'Publish'}
              </button>
              <button className="btn-sec !py-1 !text-xs" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="btn-sec !py-1 !text-xs" onClick={() => setEditing(true)}>
              Use as testimonial →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Feedback() {
  const { data, error, loading, refresh } = usePolling(
    () => api.get('/feedback?limit=100'),
    REFRESH_MS,
    [],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { summary, items } = data;
  const withComments = items.filter((i) => i.comment);
  const published = withComments.filter((i) => i.approved_at);

  return (
    <Page
      title="Feedback"
      subtitle="What players said after a game — and what the website shows"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Average rating" value={summary.average_rating ?? '—'} />
        <Stat index={1} label="Responses" value={num(summary.responses)} tone="ink" />
        <Stat index={2} label="With comments" value={num(summary.comments)} tone="ink" />
        <Stat
          index={3}
          label="On the website"
          value={num(published.length)}
          sub="published as testimonials"
        />
      </div>

      {withComments.length > 0 && (
        <>
          <h2 className="text-sm font-bold mb-2">
            Comments
            <span className="font-normal text-muted">
              {' '}
              — publish the good ones and they appear on mastipe.in
            </span>
          </h2>
          <div className="grid md:grid-cols-2 gap-3 mb-6">
            {withComments.map((f) => (
              <CommentCard key={f.id} f={f} onChanged={refresh} />
            ))}
          </div>
        </>
      )}

      <h2 className="text-sm font-bold mb-2">All responses</h2>
      <Table
        head={['When', 'Player', 'Room', 'Rating', 'Comment', 'Website']}
        empty="No feedback yet."
      >
        {items.map((f, i) => (
          <tr key={f.id || i}>
            <td className="td text-xs text-muted">{when(f.created_at)}</td>
            <td className="td">{f.display_name || maskWa(f.wa_id)}</td>
            <td className="td font-mono text-xs">{f.room_code || '—'}</td>
            <td className="td text-gold">{f.rating ? stars(f.rating) : '—'}</td>
            <td className="td text-muted">{f.comment || '—'}</td>
            <td className="td text-xs">
              {f.approved_at ? (
                <span className="pill bg-good/10 text-good">published</span>
              ) : (
                <span className="text-muted">—</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
