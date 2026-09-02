/**
 * src/pages/Settings.jsx
 * ---------------------------------------------------------------------------
 * Business details, legal documents, queue health and admin sessions.
 *
 * The legal editor has one control that matters more than the rest: bumping a
 * version invalidates everyone's consent and asks them again. A typo fix must
 * not do that, so it is always an explicit choice.
 */

import { useEffect, useState } from 'react';
import { api, num, when } from '../lib/api.js';
import { Badge, ErrorBox, Loading, Page, Table, usePolling } from '../components/ui.jsx';

const PURGE_PHRASE = 'DELETE ALL PLAYER DATA';

function BusinessForm({ profile, onSaved }) {
  const [form, setForm] = useState(profile);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(profile), [profile]);

  const field = (key, label, type = 'text') => (
    <label className="block">
      <span className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1">{label}</span>
      <input
        className="input"
        type={type}
        value={form[key] ?? ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.put('/business', {
        ...form,
        gst_rate_bp: Number(form.gst_rate_bp),
        prices_include_gst: Boolean(form.prices_include_gst),
      });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="card p-5">
      <h2 className="text-sm font-bold mb-4">Business details</h2>
      <p className="text-xs text-muted mb-4">
        Read by the marketing site and the admin panel, so this is the one place these appear.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {field('legal_name', 'Legal name')}
        {field('trade_name', 'Trade name')}
        {field('owner_name', 'Owner')}
        {field('support_email', 'Support email', 'email')}
        {field('support_phone', 'Support phone')}
        {field('gstin', 'GSTIN')}
        {field('address_line1', 'Address line 1')}
        {field('address_line2', 'Address line 2')}
        {field('city', 'City')}
        {field('state', 'State')}
        {field('postal_code', 'Postal code')}
        {field('website', 'Website')}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-line">
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1">
            GST rate (basis points)
          </span>
          <input
            className="input"
            type="number"
            value={form.gst_rate_bp ?? 1800}
            onChange={(e) => setForm({ ...form, gst_rate_bp: e.target.value })}
          />
          <span className="text-[11px] text-muted">1800 = 18%</span>
        </label>

        <label className="flex items-start gap-2 pt-6">
          <input
            type="checkbox"
            className="mt-1"
            checked={Boolean(form.prices_include_gst)}
            onChange={(e) => setForm({ ...form, prices_include_gst: e.target.checked })}
          />
          <span className="text-sm">
            Prices include GST
            <span className="block text-[11px] text-muted">
              Decides whether tax is worked backwards out of the price or added on top. Getting this
              wrong misstates revenue by the full rate.
            </span>
          </span>
        </label>
      </div>

      <button className="btn-pri mt-5" disabled={busy}>
        {busy ? 'Saving…' : 'Save business details'}
      </button>
    </form>
  );
}

function LegalDocs({ docs, onSaved }) {
  const [editing, setEditing] = useState(null);
  const [bump, setBump] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.put(`/legal/documents/${editing.doc_key}`, {
        title: editing.title,
        summary: editing.summary,
        body: editing.body,
        bumpVersion: bump,
      });
      setEditing(null);
      setBump(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <form onSubmit={save} className="card p-5">
        <h2 className="text-sm font-bold mb-4">Editing {editing.doc_key}</h2>

        <label className="block mb-3">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1">
            Title (max 24 characters)
          </span>
          <input
            className="input"
            maxLength={24}
            value={editing.title}
            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
          />
        </label>

        <label className="block mb-3">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1">
            Summary (max 72 characters)
          </span>
          <input
            className="input"
            maxLength={72}
            value={editing.summary}
            onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
          />
        </label>

        <label className="block mb-3">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-1">
            Body
          </span>
          <textarea
            className="input font-mono text-xs min-h-[320px]"
            value={editing.body}
            onChange={(e) => setEditing({ ...editing, body: e.target.value })}
          />
          <span className="text-[11px] text-muted">
            *bold*, _italic_ and • bullets render in both WhatsApp and the policies page.
          </span>
        </label>

        <label className="flex items-start gap-2 p-3 rounded-xl bg-gold/10 border border-gold/30">
          <input type="checkbox" className="mt-1" checked={bump} onChange={(e) => setBump(e.target.checked)} />
          <span className="text-sm">
            This is a change of substance — ask everyone to accept again
            <span className="block text-[11px] text-muted mt-0.5">
              Bumps the version and invalidates every existing consent. Leave unticked for a typo.
            </span>
          </span>
        </label>

        <div className="flex gap-2 mt-5">
          <button type="button" className="btn-sec" onClick={() => setEditing(null)}>
            Cancel
          </button>
          <button className="btn-pri" disabled={busy}>
            {busy ? 'Saving…' : 'Save document'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-bold mb-2">Legal documents</h2>
      <Table head={['Title', 'Version', 'Consent', 'Active', '']}>
        {docs.map((d) => (
          <tr key={d.doc_key}>
            <td className="td">
              <div className="font-semibold">{d.title}</div>
              <div className="text-[11px] text-muted">{d.summary}</div>
            </td>
            <td className="td">v{d.version}</td>
            <td className="td">{d.requires_consent ? 'Required' : 'Informational'}</td>
            <td className="td">
              <Badge value={d.is_active ? 'active' : 'hidden'} />
            </td>
            <td className="td text-right">
              <button className="btn-sec !px-3 !py-1.5 text-xs" onClick={() => setEditing(d)}>
                Edit
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

/**
 * Clears out test data.
 *
 * Testing a WhatsApp product leaves the database full of people who do not
 * exist, and they poison every chart until they are gone. This removes them —
 * and keeps the reference tables, so the policies, plans and company details
 * survive and the bot can still legally reply to somebody the moment it is done.
 *
 * The preview is loaded before anything is offered, so the count on the button
 * is the real one rather than a guess, and the phrase has to be typed: an
 * irreversible action should not be one stray double-click away.
 */
function DangerZone() {
  const [preview, setPreview] = useState(null);
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const load = async () => {
    setPreview(await api.get('/maintenance/purge'));
    setOpen(true);
  };

  const purge = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      setDone(await api.post('/maintenance/purge', { confirm: phrase }));
      setOpen(false);
      setPhrase('');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 border-2 border-bad/30 bg-bad/10/40">
      <h2 className="text-sm font-bold text-bad">Danger zone — clean up the database</h2>
      <p className="text-sm text-muted mt-2 leading-relaxed">
        Deletes <strong>every player and game record</strong>: players, messages, events, games,
        consents, wallets, blocks, feedback, tickets, metrics and admin sessions — and clears the
        job queue and Redis cache along with them.
      </p>
      <p className="text-sm text-muted mt-2 leading-relaxed">
        <strong>Kept:</strong> legal documents, plans, business details and the migration ledger.
        Your policies and prices survive, so the bot can reply the moment this finishes.
      </p>

      {done && (
        <div className="mt-4 rounded-xl bg-surface border border-line p-3 text-sm">
          <strong className="text-good">Done.</strong> {num(done.rowsDeleted)} rows removed from{' '}
          {done.tablesCleared} tables, {num(done.redisKeysDeleted)} cache keys cleared
          {done.drawJobsDropped ? `, ${done.drawJobsDropped} queued draws dropped` : ''}. Kept:{' '}
          {done.keptTables.join(', ')}.
        </div>
      )}

      {!open ? (
        <button className="btn-sec mt-4 border-red-300 text-bad" onClick={load}>
          Clean up database…
        </button>
      ) : (
        <form onSubmit={purge} className="mt-4">
          <Table head={['Table', 'Rows to delete']} empty="Nothing to delete — already clean.">
            {preview?.wipe.map((t) => (
              <tr key={t.table}>
                <td className="td font-mono text-xs">{t.table}</td>
                <td className="td font-semibold">{num(t.rows)}</td>
              </tr>
            ))}
          </Table>

          <p className="text-sm mt-3">
            <strong>{num(preview?.totalRows)} rows</strong> and {num(preview?.redisKeys)} cache keys
            will be deleted. Kept:{' '}
            {preview?.keep.map((k) => `${k.table} (${k.rows})`).join(', ')}.
          </p>

          <label className="lbl mt-4">
            Type <span className="font-mono text-bad">{PURGE_PHRASE}</span> to confirm
          </label>
          <input
            className="input font-mono"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={PURGE_PHRASE}
            autoComplete="off"
          />

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              className="btn-sec"
              onClick={() => {
                setOpen(false);
                setPhrase('');
              }}
            >
              Cancel
            </button>
            <button
              className="btn-pri !bg-red-600 hover:!bg-red-700"
              disabled={busy || phrase !== PURGE_PHRASE}
            >
              {busy ? 'Deleting…' : `Delete ${num(preview?.totalRows)} rows`}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function Settings() {
  const [nonce, setNonce] = useState(0);
  const { data, error, loading } = usePolling(
    async () => {
      const [business, docs, consent, queues, sessions] = await Promise.all([
        api.get('/business'),
        api.get('/legal/documents'),
        api.get('/legal/consents/stats'),
        api.get('/queues'),
        api.get('/sessions'),
      ]);
      return { business, docs, consent, queues, sessions };
    },
    null,
    [nonce],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const reload = () => setNonce((n) => n + 1);

  return (
    <Page title="Settings" subtitle="Business, legal, queues and access">
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <BusinessForm profile={data.business} onSaved={reload} />

        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Queues</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {Object.entries(data.queues).map(([name, counts]) => (
                <div key={name}>
                  <div className="font-semibold capitalize mb-1">{name}</div>
                  <div className="text-xs text-muted space-y-0.5">
                    {Object.entries(counts).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span>{k}</span>
                        <span className={v > 0 && k === 'failed' ? 'text-bad font-bold' : ''}>
                          {num(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Consent adoption</h2>
            <Table head={['Document', 'Version', 'On current', 'Ever']}>
              {data.consent.map((c) => (
                <tr key={c.doc_key}>
                  <td className="td">{c.title}</td>
                  <td className="td">v{c.current_version}</td>
                  <td className="td font-semibold">{num(c.accepted_current)}</td>
                  <td className="td text-muted">{num(c.accepted_any_version)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <LegalDocs docs={data.docs} onSaved={reload} />
      </div>

      <h2 className="text-sm font-bold mb-2">Admin sessions</h2>
      <Table head={['Label', 'IP', 'Created', 'Expires', 'Last used', 'State']}>
        {data.sessions.map((s) => (
          <tr key={s.id}>
            <td className="td">{s.label || '—'}</td>
            <td className="td font-mono text-xs">{s.request_ip || '—'}</td>
            <td className="td text-xs text-muted">{when(s.created_at)}</td>
            <td className="td text-xs text-muted">{when(s.expires_at)}</td>
            <td className="td text-xs text-muted">{when(s.last_used_at)}</td>
            <td className="td">
              <Badge
                value={s.active ? 'active' : 'expired'}
                tone={s.active ? 'bg-good/10 text-good' : 'bg-white/5 text-muted'}
              />
            </td>
          </tr>
        ))}
      </Table>

      <div className="mt-6">
        <DangerZone />
      </div>
    </Page>
  );
}
