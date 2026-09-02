/**
 * src/pages/Documents.jsx
 * ---------------------------------------------------------------------------
 * Every PDF the platform has generated: player reports and, once charging
 * begins, invoices.
 *
 * Kept because rebuilding a report would not reproduce it — a player's history
 * has moved on by the time anybody asks for it again — and because an invoice
 * is a financial record that has to outlive the WhatsApp conversation it was
 * sent in.
 *
 * Numbers restart at 1 every day: RPT<date>MP<n> and INV<date>MP<n>. The last
 * number of a day is that day's volume, readable without opening anything.
 */

import { useState } from 'react';
import { API_BASE, api, getToken, num, when } from '../lib/api.js';
import { Badge, ErrorBox, Loading, Page, REFRESH_MS, Stat, Table, usePolling } from '../components/ui.jsx';

const KINDS = [
  ['', 'All'],
  ['report', 'Reports'],
  ['invoice', 'Invoices'],
];

const size = (bytes) => {
  const n = Number(bytes || 0);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * Opens a stored PDF.
 *
 * Fetched with the session token and handed to the browser as a blob rather
 * than linked directly: the file route needs the Authorization header, which a
 * plain <a href> cannot send.
 */
async function openDocument(id, filename, download) {
  const res = await fetch(
    `${API_BASE}/serverpe/platform/mastipe/v1/admin/documents/${id}/file`,
    { headers: { Authorization: `Bearer ${getToken()}` } },
  );
  if (!res.ok) throw new Error('Could not open that document');

  const url = URL.createObjectURL(await res.blob());
  if (download) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } else {
    window.open(url, '_blank', 'noopener');
  }
  // Revoked late: Chrome needs the URL alive until the new tab has read it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function Documents() {
  const [kind, setKind] = useState('');
  const [failed, setFailed] = useState(null);

  const { data, error, loading, refresh } = usePolling(
    () => api.get(`/documents?limit=200${kind ? `&kind=${kind}` : ''}`),
    REFRESH_MS,
    [kind],
  );

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />;
  if (loading && !data) return <Loading />;

  const docs = data?.documents ?? [];
  const stats = data?.stats ?? [];
  const today = stats.filter((s) => s.issued_on === new Date().toISOString().slice(0, 10));
  const totalBytes = stats.reduce((sum, s) => sum + Number(s.bytes || 0), 0);

  return (
    <Page
      title="Documents"
      subtitle="Generated reports and invoices, kept on disk"
      actions={
        <button className="btn-sec" onClick={refresh}>
          Refresh
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Documents" value={num(docs.length)} />
        <Stat
          index={1}
          label="Reports today"
          value={num(today.find((s) => s.kind === 'report')?.documents ?? 0)}
          tone="ink"
        />
        <Stat
          index={2}
          label="Invoices today"
          value={num(today.find((s) => s.kind === 'invoice')?.documents ?? 0)}
          tone="ink"
        />
        <Stat index={3} label="On disk" value={size(totalBytes)} tone="ink" />
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {KINDS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setKind(value)}
            className={`btn ${kind === value ? 'btn-pri' : 'btn-sec'} !px-4 !py-2 text-xs`}
          >
            {label}
          </button>
        ))}
      </div>

      {failed && <ErrorBox error={failed} />}

      <Table
        head={['Number', 'Kind', 'For', 'Room', 'Issued', 'Size', '']}
        empty="No documents yet. Reports are filed here as games finish."
      >
        {docs.map((d) => (
          <tr key={d.id} className="hover:bg-line/20">
            <td className="td font-mono font-semibold">{d.doc_number}</td>
            <td className="td">
              <Badge
                value={d.kind}
                tone={d.kind === 'invoice' ? 'bg-gold/15 text-[#7a5b00]' : 'bg-brand/10 text-gold'}
              />
            </td>
            <td className="td text-sm">
              {d.display_name || (d.wa_id ? `+${d.wa_id}` : '—')}
              {d.title && <div className="text-xs text-muted">{d.title}</div>}
            </td>
            <td className="td font-mono text-xs">{d.room_code || '—'}</td>
            <td className="td text-xs text-muted whitespace-nowrap">{when(d.created_at)}</td>
            <td className="td text-xs text-muted">{size(d.byte_size)}</td>
            <td className="td text-right whitespace-nowrap">
              <button
                className="btn-sec !px-3 !py-1.5 text-xs mr-1"
                onClick={() => openDocument(d.id, d.filename, false).catch(setFailed)}
              >
                Open
              </button>
              <button
                className="btn-sec !px-3 !py-1.5 text-xs"
                onClick={() => openDocument(d.id, d.filename, true).catch(setFailed)}
              >
                Download
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {stats.length > 0 && (
        <>
          <h2 className="text-sm font-bold mt-6 mb-2">Per day</h2>
          <Table head={['Day', 'Kind', 'Documents', 'Size']}>
            {stats.map((s, i) => (
              <tr key={i}>
                <td className="td">{s.issued_on}</td>
                <td className="td">
                  <Badge value={s.kind} />
                </td>
                <td className="td font-semibold">{num(s.documents)}</td>
                <td className="td text-muted text-xs">{size(s.bytes)}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </Page>
  );
}
