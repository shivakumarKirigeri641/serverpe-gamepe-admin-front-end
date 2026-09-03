/**
 * src/pages/Documents.jsx
 * ---------------------------------------------------------------------------
 * The policies, editable.
 *
 * These pages are read by people who decide whether the platform is allowed to
 * operate: Meta reviews them before approving a WhatsApp business app, and
 * Razorpay before enabling payments. Both come back asking for wording
 * changes, and until now those words lived in a page template — so correcting
 * a sentence in a privacy policy meant a code change and a deploy.
 *
 * Two deliberate restrictions:
 *
 *   • The key cannot be changed. It forms the public URL, and Meta holds those
 *     URLs on file. Renaming one 404s a link a reviewer is holding.
 *
 *   • The version is a separate field, changed by hand. Player consent is
 *     recorded against it, so bumping it asks every player to agree again on
 *     their next message. That should be a decision, never a side effect of
 *     fixing a typo.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Badge, ErrorBox, Loading, Page, usePolling, REFRESH_MS } from '../components/ui.jsx';

/** Renders the stored plain text the way the public pages do. */
function Preview({ text }) {
  const blocks = String(text ?? '').split(/\n{2,}/);
  return (
    <div className="text-[13px] leading-relaxed text-muted space-y-3">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.trim().startsWith('- '))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines.map((l, j) => <li key={j}>{l.replace(/^\s*-\s*/, '')}</li>)}
            </ul>
          );
        }
        if (lines.length === 1 && lines[0].trim().endsWith(':')) {
          return <p key={i} className="font-bold text-ink">{lines[0]}</p>;
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}

function Editor({ doc, onSaved }) {
  const [form, setForm] = useState(doc);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // A newer copy arriving from the poll must not overwrite what is being typed.
  useEffect(() => { setForm(doc); setSaved(false); }, [doc.doc_key, doc.updated_at]);

  const dirty =
    form.title !== doc.title || form.summary !== doc.summary ||
    form.body !== doc.body || form.version !== doc.version;

  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setSaved(false); };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      await api.patch(`/legal/documents/${doc.doc_key}`, {
        lang: doc.lang,
        title: form.title,
        summary: form.summary,
        body: form.body,
        version: form.version,
      });
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = `https://mastipe.in/policies/${doc.doc_key}`;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-extrabold text-ink">{doc.title}</h2>
            {doc.requires_consent && <Badge value="needs consent" tone="bg-brand/10 text-gold" />}
          </div>
          <a href={publicUrl} target="_blank" rel="noreferrer"
             className="text-[11.5px] text-gold hover:underline font-mono break-all">
            {publicUrl}
          </a>
        </div>
        <span className="text-[11px] text-faint whitespace-nowrap">
          v{doc.version}
        </span>
      </div>

      <label className="block mt-4 text-[11px] font-bold uppercase tracking-wider text-muted">Title</label>
      <input className="input mt-1" value={form.title ?? ''} onChange={set('title')} />

      <label className="block mt-3 text-[11px] font-bold uppercase tracking-wider text-muted">Summary</label>
      <input className="input mt-1" value={form.summary ?? ''} onChange={set('summary')} />

      <label className="block mt-3 text-[11px] font-bold uppercase tracking-wider text-muted">
        Body
        <span className="ml-2 font-normal normal-case tracking-normal text-faint">
          blank line = new paragraph · line starting “- ” = bullet · line ending “:” = heading
        </span>
      </label>
      <textarea
        className="input mt-1 font-mono text-[12.5px] leading-relaxed"
        rows={16}
        value={form.body ?? ''}
        onChange={set('body')}
      />

      <label className="block mt-3 text-[11px] font-bold uppercase tracking-wider text-muted">
        Version
        {doc.requires_consent && (
          <span className="ml-2 font-normal normal-case tracking-normal text-bad">
            changing this asks every player to accept again
          </span>
        )}
      </label>
      <input className="input mt-1 w-40" value={form.version ?? ''} onChange={set('version')} />

      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button className="btn btn-pri" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && !dirty && <span className="text-good text-sm font-semibold">Saved — live now</span>}
        {dirty && !saving && <span className="text-gold text-sm">Unsaved changes</span>}
        <span className="text-[11px] text-faint ml-auto">
          last edited {doc.updated_by || 'seed'}
        </span>
      </div>

      {error && <div className="mt-3"><ErrorBox error={error} /></div>}

      <details className="mt-5">
        <summary className="cursor-pointer text-[12px] text-muted">Preview as players see it</summary>
        <div className="mt-3 border-t border-line pt-3"><Preview text={form.body} /></div>
      </details>
    </div>
  );
}

export default function Documents() {
  const { data, error, loading, refresh } = usePolling(
    () => api.get('/legal/documents?lang=en'),
    REFRESH_MS,
    [],
  );

  if (loading && !data) return <Loading label="Reading the policies…" />;
  if (error && !data) return <ErrorBox error={error} />;

  const docs = Array.isArray(data) ? data : [];

  return (
    <Page
      title="Policies & terms"
      subtitle="Edited here, live immediately on mastipe.in and in WhatsApp"
    >
      <div className="card p-4 mb-4">
        <p className="text-sm text-muted leading-relaxed">
          Meta reviews these before approving the WhatsApp app, and Razorpay before enabling
          payments. They are stored in the database, so a wording change asks for nothing more
          than a save — no deploy. The public address of each is fixed: it is what reviewers
          have on file.
        </p>
      </div>

      {docs.length === 0 && (
        <div className="card p-8 text-center text-muted">
          No documents yet. They are seeded when the back end starts.
        </div>
      )}

      <div className="space-y-4">
        {docs.map((d) => <Editor key={d.doc_key} doc={d} onSaved={refresh} />)}
      </div>
    </Page>
  );
}
