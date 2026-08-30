/**
 * src/pages/Feedback.jsx
 * ---------------------------------------------------------------------------
 * Ratings and comments left after a game.
 */

import { api, maskWa, num, when } from '../lib/api.js';
import { ErrorBox, Loading, Page, Stat, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

const stars = (n) => '★'.repeat(n || 0) + '☆'.repeat(Math.max(5 - (n || 0), 0));

export default function Feedback() {
  const { data, error, loading } = usePolling(() => api.get('/feedback?limit=100'), REFRESH_MS, []);

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { summary, items } = data;
  const withComments = items.filter((i) => i.comment);

  return (
    <Page title="Feedback" subtitle="What players said after a game">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Average rating" value={summary.average_rating ?? '—'} />
        <Stat index={1} label="Responses" value={num(summary.responses)} tone="ink" />
        <Stat index={2} label="Rated" value={num(summary.rated)} tone="ink" />
        <Stat index={3} label="With comments" value={num(summary.comments)} tone="ink" />
      </div>

      {withComments.length > 0 && (
        <>
          <h2 className="text-sm font-bold mb-2">Comments</h2>
          <div className="grid md:grid-cols-2 gap-3 mb-6">
            {withComments.map((f, i) => (
              <div key={i} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gold text-sm">{stars(f.rating)}</span>
                  <span className="text-[11px] text-muted">{when(f.created_at)}</span>
                </div>
                <p className="text-sm">{f.comment}</p>
                <p className="text-[11px] text-muted mt-2">
                  {f.display_name || maskWa(f.wa_id)} · {f.room_code || 'no room'}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-sm font-bold mb-2">All responses</h2>
      <Table head={['When', 'Player', 'Room', 'Rating', 'Comment']} empty="No feedback yet.">
        {items.map((f, i) => (
          <tr key={i}>
            <td className="td text-xs text-muted">{when(f.created_at)}</td>
            <td className="td">{f.display_name || maskWa(f.wa_id)}</td>
            <td className="td font-mono text-xs">{f.room_code || '—'}</td>
            <td className="td text-gold">{f.rating ? stars(f.rating) : '—'}</td>
            <td className="td text-muted">{f.comment || '—'}</td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
