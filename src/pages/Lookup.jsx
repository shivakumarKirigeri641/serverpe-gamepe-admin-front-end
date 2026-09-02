/**
 * src/pages/Lookup.jsx
 * ---------------------------------------------------------------------------
 * Search by mobile number, and see everything about that person on one screen.
 *
 * Support questions arrive as "this number says X", so the search is keyed on
 * the number and the answer is deliberately complete: profile, location and
 * device, credits, consents, every game, every message, every tap, feedback and
 * tickets — plus block and export, because finding the person is usually only
 * half of what you came to do.
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, inr, num, when } from '../lib/api.js';
import { Badge, ErrorBox, LiveDot, Loading, Page, Stat, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

/* ------------------------------------------------------------------ export */

function download(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  if (!rows?.length) return '';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    // Quote anything containing a comma, quote or newline, doubling inner quotes.
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}

function bodyText(body) {
  if (!body) return '';
  if (body.text?.body) return body.text.body;
  if (body.interactive?.body?.text) return body.interactive.body.text;
  if (body.image) return '[ticket image]';
  if (body.document) return `[document: ${body.document.filename || 'file'}]`;
  if (typeof body.text === 'string') return body.text;
  if (body.actionId) return '[tapped: ' + body.actionId + ']';
  return '';
}

/* ------------------------------------------------------------------- block */

function BlockDialog({ waId, blocked, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('abuse');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (blocked) {
        await api.del('/blocked/' + waId, { reason });
      } else {
        await api.post('/blocked', { waId, reason, category });
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-surface rounded-2xl shadow-card w-full max-w-md p-6"
      >
        <h2 className="text-lg font-bold text-gold">
          {blocked ? 'Unblock' : 'Block'} +{waId}
        </h2>
        <p className="text-sm text-muted mt-1">
          {blocked
            ? 'They will be able to start and join games again.'
            : 'They will be told once, and cannot start or join any game.'}
        </p>

        {!blocked && (
          <>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mt-5 mb-1">
              Category
            </label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="abuse">Abuse or harassment</option>
              <option value="betting">Betting or money games</option>
              <option value="cheating">Cheating</option>
              <option value="spam">Spam or automation</option>
              <option value="multiple_accounts">Multiple accounts</option>
              <option value="other">Other</option>
            </select>
          </>
        )}

        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mt-4 mb-1">
          Reason
        </label>
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={blocked ? 'Appeal accepted — first offence' : 'Reported for betting in room ABC123'}
          minLength={3}
          required
        />
        <p className="text-[11px] text-muted mt-1">
          Required, and kept permanently — this is what defends the decision if it is appealed.
        </p>

        <div className="flex gap-2 mt-6">
          <button type="button" className="btn-sec flex-1" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className={`flex-1 btn ${blocked ? 'btn-sec' : 'btn-pri'}`}
            disabled={busy || reason.length < 3}
          >
            {busy ? 'Saving…' : blocked ? 'Unblock' : 'Block this number'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------- page */

const TABS = ['Overview', 'Conversation', 'Taps', 'Games', 'Events', 'Money'];

/**
 * The record refreshes on the panel-wide cadence, every tab included.
 *
 * A support conversation is happening *now* — the person is usually still
 * messaging while you read — and a game they are in can end mid-scroll. Pause
 * it with the Live control when you want to read a long thread undisturbed.
 */

export default function Lookup() {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState(null);
  const [waId, setWaId] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [auto, setAuto] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [blocking, setBlocking] = useState(false);

  const fetchDetail = useCallback(
    () => (waId ? api.get(`/lookup/${waId}`) : Promise.resolve(null)),
    [waId],
  );

  // usePolling also re-runs the moment the tab regains focus, so coming back to
  // a laptop that slept shows current data rather than a frozen thread.
  const { data: detail, error, loading, refresh } = usePolling(
    fetchDetail,
    auto ? REFRESH_MS : null,
    [waId, auto],
  );

  const search = async (event) => {
    event?.preventDefault();
    setSearching(true);
    setSearchError(null);
    try {
      const digits = term.replace(/[^0-9]/g, '');
      // A complete number goes straight to the full record; anything shorter
      // lists candidates first.
      if (digits.length >= 10) {
        setResults(null);
        setTab('Overview');
        setWaId(digits);
      } else {
        setWaId(null);
        setResults(await api.get(`/lookup/search?q=${encodeURIComponent(term)}&limit=25`));
      }
    } catch (err) {
      setSearchError(err);
    } finally {
      setSearching(false);
    }
  };

  const open = (found) => {
    setResults(null);
    setTab('Overview');
    setWaId(found);
  };

  const exportAll = () => {
    if (!detail) return;
    download(
      `mastipe-${detail.player.wa_id}-full.json`,
      JSON.stringify(detail, null, 2),
      'application/json',
    );
  };

  const busy = searching || (loading && !detail);

  return (
    <Page
      title="Number lookup"
      subtitle="Search a mobile number for the complete record"
      actions={
        detail && (
          <>
            {auto ? (
              <button onClick={() => setAuto(false)} title="Click to pause">
                <LiveDot label={`Live · ${REFRESH_MS / 1000}s`} />
              </button>
            ) : (
              <button className="btn-sec" onClick={() => setAuto(true)}>
                Resume auto-refresh
              </button>
            )}
            <button className="btn-sec" onClick={refresh}>
              Refresh now
            </button>
            <button className="btn-sec" onClick={exportAll}>
              Export everything (JSON)
            </button>
            <button
              className={`btn ${detail.player?.is_blocked ? 'btn-sec' : 'btn-pri'}`}
              onClick={() => setBlocking(true)}
            >
              {detail.player?.is_blocked ? 'Unblock' : 'Block number'}
            </button>
          </>
        )
      }
    >
      <form onSubmit={search} className="card p-4 mb-5 flex flex-col sm:flex-row gap-3">
        <input
          className="input flex-1"
          placeholder="91XXXXXXXXXX, or part of a number, or a name"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <button className="btn-pri sm:w-40" disabled={busy || term.trim().length < 2}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {(searchError || (error && !detail)) && <ErrorBox error={searchError || error} onRetry={refresh} />}
      {busy && !detail && <Loading />}

      {results && (
        <Table head={['Number', 'Name', 'Games', 'Where', 'Last seen', '']} empty="No match.">
          {results.map((r) => (
            <tr key={r.id} className="hover:bg-line/20">
              <td className="td font-mono font-semibold">+{r.wa_id}</td>
              <td className="td">
                {r.display_name || '—'}
                {r.is_blocked && <Badge value="blocked" tone="bg-bad/12 text-bad ml-2" />}
              </td>
              <td className="td">{num(r.games)}</td>
              <td className="td text-xs text-muted">
                {[r.last_city, r.last_region].filter(Boolean).join(', ') || '—'}
              </td>
              <td className="td text-xs text-muted">{when(r.last_seen_at)}</td>
              <td className="td text-right">
                <button className="btn-sec !px-3 !py-1.5 text-xs" onClick={() => open(r.wa_id)}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {detail && detail.found === false && (
        <div className="card p-6">
          <p className="font-bold text-bad">This number is blocked but has never played.</p>
          <p className="text-sm text-muted mt-1">{detail.block?.reason}</p>
        </div>
      )}

      {detail?.found && (
        <>
          <div className="card p-5 mb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-2xl font-extrabold text-gold">
                  {detail.player.display_name || 'Unnamed player'}
                </div>
                <div className="font-mono text-lg mt-0.5">+{detail.player.wa_id}</div>
                <div className="text-sm text-muted mt-2">
                  First seen {when(detail.player.created_at)} · last seen {when(detail.player.last_seen_at)}
                </div>
              </div>
              {detail.player.is_blocked && (
                <div className="text-right">
                  <Badge value="blocked" tone="bg-bad/12 text-bad" />
                  <div className="text-xs text-muted mt-1 max-w-xs">{detail.player.blocked_reason}</div>
                  <div className="text-[11px] text-muted">
                    by {detail.player.blocked_by} · {when(detail.player.blocked_at)}
                  </div>
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 mt-5 pt-4 border-t border-line text-sm">
              <div>
                <div className="text-[11px] font-bold uppercase text-muted">Where</div>
                <div>
                  {[detail.player.last_city, detail.player.last_region, detail.player.last_country]
                    .filter(Boolean)
                    .join(', ') || 'Not known'}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-muted">IP</div>
                <div className="font-mono text-xs">{detail.player.last_ip || 'Not known'}</div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-muted">Device</div>
                <div className="text-xs truncate" title={detail.player.last_user_agent}>
                  {detail.player.last_user_agent || 'Not known'}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase text-muted">Seen on web</div>
                <div className="text-xs">{when(detail.player.last_device_at)}</div>
              </div>
            </div>

            <p className="text-[11px] text-muted mt-3">
              Location and device are only known when they opened their board in a browser — WhatsApp
              traffic carries no IP. Treat the city as approximate; a mobile connection often resolves
              to the operator&rsquo;s gateway rather than the person.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <Stat index={0} label="Games" value={num(detail.counts.games)} />
            <Stat index={1} label="Prizes" value={num(detail.stats?.prizes_won ?? 0)} tone="ink" />
            <Stat index={2} label="Points" value={num(detail.stats?.points ?? 0)} tone="ink" />
            <Stat index={3} label="Credits" value={inr(detail.wallet?.balance_paise ?? 0)} tone="ink" />
            <Stat index={4} label="Free games" value={num(detail.wallet?.free_games ?? 0)} tone="ink" />
          </div>

          <div className="flex flex-wrap gap-1 mb-4">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`btn ${tab === t ? 'btn-pri' : 'btn-sec'} !px-4 !py-2 text-xs`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'Overview' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold mb-2">Consents accepted</h3>
                <Table head={['Document', 'Version', 'When', 'How']} empty="Nothing accepted.">
                  {detail.consents.map((c, i) => (
                    <tr key={i}>
                      <td className="td">{c.title}</td>
                      <td className="td">v{c.version}</td>
                      <td className="td text-xs text-muted">{when(c.accepted_at)}</td>
                      <td className="td text-xs">{c.source}</td>
                    </tr>
                  ))}
                </Table>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">Feedback &amp; tickets</h3>
                <Table head={['When', 'What']} empty="Nothing yet.">
                  {[
                    ...detail.feedback.map((f) => ({
                      at: f.created_at,
                      what: `Rated ${f.rating ?? '—'}/5 ${f.comment ? `— ${f.comment}` : ''}`,
                    })),
                    ...detail.tickets.map((t) => ({
                      at: t.created_at,
                      what: `Ticket ${t.reference}: ${t.subject} (${t.status})`,
                    })),
                  ].map((row, i) => (
                    <tr key={i}>
                      <td className="td text-xs text-muted whitespace-nowrap">{when(row.at)}</td>
                      <td className="td text-sm">{row.what}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </div>
          )}

          {tab === 'Conversation' && (
            <>
              <button
                className="btn-sec mb-3 !py-1.5 text-xs"
                onClick={() =>
                  download(
                    `mastipe-${detail.player.wa_id}-messages.csv`,
                    toCsv(
                      detail.messages.map((m) => ({
                        at: m.created_at,
                        direction: m.direction,
                        kind: m.kind,
                        status: m.status,
                        room: m.room_code,
                        text: bodyText(m.body),
                        error: m.error,
                      })),
                    ),
                  )
                }
              >
                Export conversation (CSV)
              </button>
              <div className="card p-4 max-h-[60vh] overflow-y-auto bg-bg">
                {[...detail.messages].reverse().map((m, i) => {
                  const inbound = m.direction === 'inbound';
                  return (
                    <div key={i} className={`flex mb-2 ${inbound ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                          inbound ? 'bg-surface' : 'bg-brand text-white'
                        }`}
                      >
                        {bodyText(m.body) || <span className="opacity-60">[{m.kind}]</span>}
                        <div className={`text-[10px] mt-1.5 ${inbound ? 'text-muted' : 'text-white/70'}`}>
                          {when(m.created_at)}
                          {m.room_code ? ` · ${m.room_code}` : ''}
                          {!inbound && m.status ? ` · ${m.status}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === 'Taps' && (
            <Table head={['When', 'Tapped', 'Label', 'Kind']} empty="No taps recorded.">
              {detail.taps.map((t, i) => (
                <tr key={i}>
                  <td className="td text-xs text-muted whitespace-nowrap">{when(t.created_at)}</td>
                  <td className="td font-mono text-xs">{t.action || '—'}</td>
                  <td className="td text-sm">{t.label || '—'}</td>
                  <td className="td text-xs text-muted">{t.kind}</td>
                </tr>
              ))}
            </Table>
          )}

          {tab === 'Games' && (
            <>
              <button
                className="btn-sec mb-3 !py-1.5 text-xs"
                onClick={() => download(`mastipe-${detail.player.wa_id}-games.csv`, toCsv(detail.games))}
              >
                Export games (CSV)
              </button>
              <Table head={['Room', 'Role', 'Status', 'Numbers', 'Answered', 'Prizes', 'When']}>
                {detail.games.map((g) => (
                  <tr key={g.id}>
                    <td className="td font-mono">
                      <Link to={`/games/${g.id}`} className="text-gold hover:underline">
                        {g.room_code}
                      </Link>
                    </td>
                    <td className="td">{g.was_host ? <Badge value="host" tone="bg-brand/10 text-gold" /> : 'player'}</td>
                    <td className="td"><Badge value={g.status} /></td>
                    <td className="td">{num(g.numbers)}</td>
                    <td className="td">{num(g.answered)}</td>
                    <td className="td">{num(g.prizes)}</td>
                    <td className="td text-xs text-muted">{when(g.created_at)}</td>
                  </tr>
                ))}
              </Table>
            </>
          )}

          {tab === 'Events' && (
            <>
              <button
                className="btn-sec mb-3 !py-1.5 text-xs"
                onClick={() => download(`mastipe-${detail.player.wa_id}-events.csv`, toCsv(detail.events))}
              >
                Export events (CSV)
              </button>
              <Table head={['When', 'Event', 'Source', 'IP', 'Detail']}>
                {detail.events.map((e, i) => (
                  <tr key={i}>
                    <td className="td text-xs text-muted whitespace-nowrap">{when(e.occurred_at)}</td>
                    <td className="td text-xs font-mono font-semibold">{e.event_type}</td>
                    <td className="td text-xs">{e.source}</td>
                    <td className="td text-xs font-mono">{e.request_ip || '—'}</td>
                    <td className="td text-[11px] font-mono text-muted max-w-sm truncate">
                      {JSON.stringify(e.properties)}
                    </td>
                  </tr>
                ))}
              </Table>
            </>
          )}

          {tab === 'Money' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold mb-2">Credit movements</h3>
                <Table head={['When', 'Amount', 'Kind', 'Note']} empty="No movements.">
                  {detail.walletHistory.map((t, i) => (
                    <tr key={i}>
                      <td className="td text-xs text-muted">{when(t.created_at)}</td>
                      <td className={`td font-semibold ${Number(t.amount_paise) < 0 ? 'text-bad' : 'text-good'}`}>
                        {Number(t.amount_paise) < 0 ? '−' : '+'}
                        {inr(Math.abs(Number(t.amount_paise)))}
                      </td>
                      <td className="td"><Badge value={t.kind} /></td>
                      <td className="td text-xs text-muted">{t.note || '—'}</td>
                    </tr>
                  ))}
                </Table>
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2">Free games given</h3>
                <Table head={['When', 'How many', 'Reason', 'By']} empty="None given.">
                  {detail.freeGames.map((f, i) => (
                    <tr key={i}>
                      <td className="td text-xs text-muted">{when(f.granted_at)}</td>
                      <td className="td font-semibold">{f.quantity}</td>
                      <td className="td text-sm">{f.reason}</td>
                      <td className="td text-xs text-muted">{f.granted_by}</td>
                    </tr>
                  ))}
                </Table>
              </div>
            </div>
          )}
        </>
      )}

      {blocking && detail?.player && (
        <BlockDialog
          waId={detail.player.wa_id}
          blocked={detail.player.is_blocked}
          onClose={() => setBlocking(false)}
          onDone={() => {
            setBlocking(false);
            refresh();
          }}
        />
      )}
    </Page>
  );
}
