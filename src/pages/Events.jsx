/**
 * src/pages/Events.jsx
 * ---------------------------------------------------------------------------
 * The raw event stream, filterable by type.
 *
 * Every other screen in this panel is a view over this table. When a number
 * looks wrong somewhere else, this is where you find out why.
 */

import { useState } from 'react';
import { api, maskWa, when } from '../lib/api.js';
import { ErrorBox, Loading, Page, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

export default function Events() {
  const [type, setType] = useState('');
  const [applied, setApplied] = useState('');

  const { data, error, loading } = usePolling(
    async () => {
      const [events, types] = await Promise.all([
        api.get(`/events?limit=200${applied ? `&type=${encodeURIComponent(applied)}` : ''}`),
        api.get('/events/types'),
      ]);
      return { events, types };
    },
    REFRESH_MS,
    [applied],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  return (
    <Page
      title="Event stream"
      subtitle="Every tracked action, newest first"
      actions={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(type);
          }}
          className="flex gap-2"
        >
          <select
            className="input !py-1.5 !w-60"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All event types</option>
            {data.types.map((t) => (
              <option key={t.event_type} value={t.event_type}>
                {t.event_type} ({t.count})
              </option>
            ))}
          </select>
          <button className="btn-sec !py-1.5">Filter</button>
        </form>
      }
    >
      <Table head={['When', 'Event', 'Who', 'Source', 'Detail']} empty="No events recorded yet.">
        {data.events.map((e) => (
          <tr key={e.id}>
            <td className="td text-xs text-muted whitespace-nowrap">{when(e.occurred_at)}</td>
            <td className="td text-xs font-mono font-semibold">{e.event_type}</td>
            <td className="td text-xs">{maskWa(e.wa_id)}</td>
            <td className="td text-xs text-muted">{e.source}</td>
            <td className="td text-[11px] font-mono text-muted max-w-md truncate">
              {JSON.stringify(e.properties)}
            </td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
