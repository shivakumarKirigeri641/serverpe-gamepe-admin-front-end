/**
 * src/pages/Moderation.jsx
 * ---------------------------------------------------------------------------
 * Blocking and unblocking mobile numbers.
 *
 * A block is keyed on the number rather than the player record, so it survives
 * a deleted account and still holds when the same number comes back. Every
 * block and unblock is written to a permanent audit trail — a block with no
 * stated reason cannot be defended when it is appealed, so a reason is required
 * in both directions, bulk actions included.
 *
 * Blocked people are told once, on their next message, and then ignored. The
 * "told" column is how you know that notice actually went out.
 *
 * Built around selection because reports arrive as groups, not individuals:
 * one room, four numbers, the same reason. Filter, select all, act once.
 */

import { useCallback, useMemo, useState } from 'react';
import { api, when } from '../lib/api.js';
import { Badge, ErrorBox, Loading, Page, REFRESH_MS, Stat, Table, usePolling } from '../components/ui.jsx';

const CATEGORIES = [
  ['abuse', 'Abuse or harassment'],
  ['betting', 'Betting or money games'],
  ['cheating', 'Cheating'],
  ['spam', 'Spam or automation'],
  ['multiple_accounts', 'Multiple accounts'],
  ['underage', 'Under 18'],
  ['other', 'Other'],
];

const CATEGORY_TONE = {
  abuse: 'bg-bad/12 text-bad',
  betting: 'bg-bad/12 text-bad',
  cheating: 'bg-amber-100 text-amber-800',
  spam: 'bg-amber-100 text-amber-800',
};

const digitsOf = (text) => [...new Set(text.split(/[^0-9]+/).filter((n) => n.length >= 10))];

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* --------------------------------------------------------------- block form */

/**
 * Blocks one number or a pasted list of them.
 *
 * The same box takes both: paste whatever the reporter sent — a line each,
 * commas, a copied transcript — and every ten-plus-digit run in it is picked
 * out. Counting them back before the button is pressed is the check that the
 * paste was read the way it looked.
 */
function BlockForm({ onDone }) {
  const [raw, setRaw] = useState('');
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('abuse');
  const [reportedBy, setReportedBy] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const numbers = useMemo(() => digitsOf(raw), [raw]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      setResult(
        await api.post('/blocked/bulk', {
          waIds: numbers,
          action: 'block',
          reason,
          category,
          reportedBy: reportedBy.trim() || undefined,
        }),
      );
      setRaw('');
      setReason('');
      setReportedBy('');
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5 mb-5">
      <h2 className="font-bold">Block numbers</h2>
      <p className="text-sm text-muted mt-1">
        Reports come to <strong>support@mastipe.in</strong> with the number attached. Paste one
        number or a whole list — anything with ten or more digits is picked out. Each person is told
        once, then cannot start or join any game.
      </p>

      <div className="grid lg:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="lbl">Numbers</label>
          <textarea
            className="input font-mono h-28 resize-y"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={'91XXXXXXXXXX\n91XXXXXXXXXX, 91XXXXXXXXXX'}
            required
          />
          <p className="text-[11px] text-muted mt-1">
            {numbers.length
              ? `${numbers.length} number${numbers.length === 1 ? '' : 's'} found: ${numbers
                  .slice(0, 4)
                  .map((n) => `+${n}`)
                  .join(', ')}${numbers.length > 4 ? ` and ${numbers.length - 4} more` : ''}`
              : 'Country code included, no + needed'}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="lbl">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Reason (kept permanently)</label>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reported for running bets in room ABC123"
              minLength={3}
              required
            />
          </div>
          <div>
            <label className="lbl">Reported by (optional)</label>
            <input
              className="input"
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              placeholder="Number or email of the reporter"
            />
          </div>
        </div>
      </div>

      {result && (
        <div className="mt-3 text-sm">
          <strong className="text-good">Blocked {result.applied.length}.</strong>
          {result.failed.length > 0 && (
            <span className="text-bad">
              {' '}
              {result.failed.length} failed: {result.failed.map((f) => f.waId).join(', ')}
            </span>
          )}
          {result.skipped > 0 && (
            <span className="text-muted"> {result.skipped} ignored as too short.</span>
          )}
        </div>
      )}

      <button className="btn-pri mt-4" disabled={busy || numbers.length === 0 || reason.length < 3}>
        {busy
          ? 'Blocking…'
          : numbers.length > 1
            ? `Block ${numbers.length} numbers`
            : 'Block this number'}
      </button>
    </form>
  );
}

/* ----------------------------------------------------------------- the page */

export default function Moderation() {
  const [history, setHistory] = useState(null);
  const [selected, setSelected] = useState([]);
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('');
  const [bulk, setBulk] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api.get('/blocked?limit=500'), []);
  const { data, error, loading, refresh } = usePolling(load, REFRESH_MS);

  const rows = useMemo(() => data ?? [], [data]);

  // Selection follows what is on screen: "select all" under a filter means all
  // of these, not all of everything — the only reading that does not eventually
  // unblock somebody by accident.
  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!category || r.category === category) &&
          (!filter ||
            r.wa_id.includes(filter.replace(/[^0-9]/g, '')) ||
            (r.reason || '').toLowerCase().includes(filter.toLowerCase()) ||
            (r.display_name || '').toLowerCase().includes(filter.toLowerCase())),
      ),
    [rows, filter, category],
  );

  const selectedSet = new Set(selected);
  const visibleIds = visible.map((r) => r.wa_id);
  const allShown = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  const toggle = (waId) =>
    setSelected((s) => (s.includes(waId) ? s.filter((w) => w !== waId) : [...s, waId]));

  const toggleAll = () =>
    setSelected((s) =>
      allShown ? s.filter((w) => !visibleIds.includes(w)) : [...new Set([...s, ...visibleIds])],
    );

  const runBulk = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/blocked/bulk', { waIds: selected, action: bulk, reason });
      setBulk(null);
      setReason('');
      setSelected([]);
      refresh();
    } finally {
      setBusy(false);
    }
  };

  const openHistory = async (waId) => {
    setHistory({ waId, rows: null });
    setHistory({ waId, rows: await api.get(`/blocked/${waId}/history`) });
  };

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />;
  if (loading && !data) return <Loading />;

  const notTold = rows.filter((r) => !r.notified_at).length;

  return (
    <Page
      title="Blocked numbers"
      subtitle="Block, unblock and the full audit trail"
      actions={
        <button className="btn-sec" onClick={refresh}>
          Refresh
        </button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Blocked" value={rows.length} />
        <Stat index={1} label="Not yet told" value={notTold} tone="ink" sub="Told on next message" />
        <Stat
          index={2}
          label="This week"
          value={rows.filter((r) => Date.now() - new Date(r.blocked_at).getTime() < 7 * 864e5).length}
          tone="ink"
        />
        <Stat index={3} label="Selected" value={selected.length} tone="ink" />
      </div>

      <BlockForm onDone={refresh} />

      {/* Filters exist so "select all" can be aimed at one category or one
          reporter's batch rather than the whole list. */}
      <div className="card p-3 mb-3 flex flex-col sm:flex-row gap-2">
        <input
          className="input flex-1"
          placeholder="Filter by number, name or reason"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="input sm:w-56"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {(filter || category) && (
          <button
            className="btn-sec sm:w-32"
            onClick={() => {
              setFilter('');
              setCategory('');
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Shown only once something is selected: a permanent row of destructive
          buttons is a row of destructive buttons waiting to be mis-clicked. */}
      {selected.length > 0 && (
        <div className="card p-3 mb-3 bg-brand/5 border-2 border-brand/30 flex flex-wrap items-center gap-2">
          <strong className="text-sm mr-2">
            {selected.length} selected
            {selected.length !== visible.length && ` · ${visible.length} shown`}
          </strong>
          <button className="btn-sec !py-1.5 text-xs" onClick={() => setBulk('unblock')}>
            Unblock selected
          </button>
          <button className="btn-sec !py-1.5 text-xs" onClick={() => setBulk('block')}>
            Re-block with a new reason
          </button>
          <button
            className="btn-sec !py-1.5 text-xs"
            onClick={() => navigator.clipboard?.writeText(selected.map((w) => `+${w}`).join('\n'))}
          >
            Copy numbers
          </button>
          <button
            className="btn-sec !py-1.5 text-xs"
            onClick={() =>
              download(
                `mastipe-blocked-${new Date().toISOString().slice(0, 10)}.csv`,
                ['wa_id,category,reason,blocked_by,blocked_at,notified_at']
                  .concat(
                    rows
                      .filter((r) => selectedSet.has(r.wa_id))
                      .map((r) =>
                        [
                          r.wa_id,
                          r.category || '',
                          `"${(r.reason || '').replace(/"/g, '""')}"`,
                          r.blocked_by || '',
                          r.blocked_at || '',
                          r.notified_at || '',
                        ].join(','),
                      ),
                  )
                  .join('\n'),
              )
            }
          >
            Export selected (CSV)
          </button>
          <button className="btn-sec !py-1.5 text-xs ml-auto" onClick={() => setSelected([])}>
            Clear selection
          </button>
        </div>
      )}

      <Table
        head={[
          <label key="all" className="flex items-center gap-2 cursor-pointer normal-case">
            <input type="checkbox" checked={allShown} onChange={toggleAll} className="w-4 h-4" />
            All
          </label>,
          'Number',
          'Category',
          'Reason',
          'By',
          'Blocked',
          'Told',
          '',
        ]}
        empty="Nobody is blocked. Good."
      >
        {visible.map((r) => (
          <tr key={r.wa_id} className={selectedSet.has(r.wa_id) ? 'bg-brand/5' : 'hover:bg-line/20'}>
            <td className="td">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={selectedSet.has(r.wa_id)}
                onChange={() => toggle(r.wa_id)}
              />
            </td>
            <td className="td font-mono font-semibold">+{r.wa_id}</td>
            <td className="td">
              <Badge value={r.category || 'other'} tone={CATEGORY_TONE[r.category]} />
            </td>
            <td className="td text-sm max-w-sm">
              {r.reason}
              {r.display_name && <div className="text-xs text-muted">{r.display_name}</div>}
            </td>
            <td className="td text-xs text-muted">{r.blocked_by}</td>
            <td className="td text-xs text-muted whitespace-nowrap">{when(r.blocked_at)}</td>
            <td className="td text-xs">
              {r.notified_at ? (
                <span className="text-muted">{when(r.notified_at)}</span>
              ) : (
                <span className="text-amber-700 font-semibold">pending</span>
              )}
            </td>
            <td className="td text-right whitespace-nowrap">
              <button
                className="btn-sec !px-3 !py-1.5 text-xs mr-1"
                onClick={() => openHistory(r.wa_id)}
              >
                History
              </button>
              <button
                className="btn-sec !px-3 !py-1.5 text-xs"
                onClick={() => {
                  setSelected([r.wa_id]);
                  setBulk('unblock');
                }}
              >
                Unblock
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {bulk && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => setBulk(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={runBulk}
            className="bg-surface rounded-2xl shadow-card w-full max-w-md p-6"
          >
            <h2 className="text-lg font-bold text-gold">
              {bulk === 'unblock' ? 'Unblock' : 'Re-block'} {selected.length} number
              {selected.length === 1 ? '' : 's'}
            </h2>
            <p className="text-sm text-muted mt-1 font-mono break-all">
              {selected.slice(0, 8).map((w) => `+${w}`).join(', ')}
              {selected.length > 8 && ` and ${selected.length - 8} more`}
            </p>
            <p className="text-sm text-muted mt-2">
              {bulk === 'unblock'
                ? 'They will be able to start and join games again immediately.'
                : 'The reason on record is replaced for every number selected.'}
            </p>

            <label className="lbl mt-5">Reason (applies to all of them)</label>
            <input
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                bulk === 'unblock' ? 'Appeal accepted — first offence, warned' : 'Repeat offence'
              }
              minLength={3}
              required
            />

            <div className="flex gap-2 mt-6">
              <button type="button" className="btn-sec flex-1" onClick={() => setBulk(null)}>
                Cancel
              </button>
              <button className="btn-pri flex-1" disabled={busy || reason.length < 3}>
                {busy ? 'Working…' : bulk === 'unblock' ? 'Unblock them' : 'Re-block them'}
              </button>
            </div>
          </form>
        </div>
      )}

      {history && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => setHistory(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface rounded-2xl shadow-card w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto"
          >
            <h2 className="text-lg font-bold text-gold">History for +{history.waId}</h2>
            {!history.rows ? (
              <Loading />
            ) : (
              <Table head={['When', 'Action', 'Reason', 'By', 'Reported by']} empty="No history.">
                {history.rows.map((h, i) => (
                  <tr key={i}>
                    <td className="td text-xs text-muted whitespace-nowrap">{when(h.created_at)}</td>
                    <td className="td">
                      <Badge
                        value={h.action}
                        tone={h.action === 'block' ? 'bg-bad/12 text-bad' : 'bg-good/10 text-good'}
                      />
                    </td>
                    <td className="td text-sm">{h.reason}</td>
                    <td className="td text-xs text-muted">{h.performed_by}</td>
                    <td className="td text-xs text-muted">{h.reported_by || '—'}</td>
                  </tr>
                ))}
              </Table>
            )}
            <button className="btn-sec w-full mt-5" onClick={() => setHistory(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}
