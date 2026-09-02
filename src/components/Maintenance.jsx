/**
 * src/components/Maintenance.jsx
 * ---------------------------------------------------------------------------
 * Scheduled downtime, announced everywhere at once.
 *
 * Saving here changes what the WhatsApp bot replies to every player and what
 * the marketing site shows, immediately and with no restart. That reach is why
 * the current state is stated in a sentence at the top rather than left for the
 * operator to infer from three form fields.
 *
 * Two switches, because they answer different questions:
 *   Scheduled — there IS a window, set in advance
 *   Down now  — we are down RIGHT NOW, whatever the clock says
 */

import { useEffect, useState } from 'react';
import { api, when } from '../lib/api.js';
import { Panel } from './ui.jsx';

/** <input type="datetime-local"> wants local time with no zone suffix. */
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function Maintenance() {
  const [state, setState] = useState(null);
  const [form, setForm] = useState({ from: '', to: '', message: '' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const w = await api.get('/maintenance');
    setState(w);
    setForm({ from: toLocalInput(w.from), to: toLocalInput(w.to), message: w.message || '' });
  };

  useEffect(() => { load(); }, []);

  const save = async (patch) => {
    setBusy(true);
    try {
      const next = await api.put('/maintenance', {
        // datetime-local has no zone, so it is read in the browser's own zone —
        // which is the operator's, and therefore the one they meant.
        from: form.from ? new Date(form.from).toISOString() : null,
        to: form.to ? new Date(form.to).toISOString() : null,
        message: form.message,
        ...patch,
      });
      setState(next);
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <Panel title="Maintenance"><p className="text-sm text-muted">Loading…</p></Panel>;

  const status = state.active
    ? { tone: 'bg-bad/12 text-bad border-bad/30', label: 'Down now' }
    : state.upcoming
      ? { tone: 'bg-gold/12 text-gold border-gold/30', label: 'Scheduled' }
      : { tone: 'bg-good/12 text-good border-good/30', label: 'Everything running' };

  return (
    <Panel
      title="Maintenance"
      subtitle="Changes the WhatsApp bot and the website immediately — no restart"
      actions={<span className={`pill border ${status.tone}`}>{status.label}</span>}
    >
      <div className={`rounded-xl border p-3 mb-4 text-sm ${status.tone}`}>
        {state.active && (
          <>
            <strong>Players are being told the platform is down.</strong>{' '}
            {state.endsInMinutes != null
              ? `The notice says we are back in about ${state.endsInMinutes} minute${state.endsInMinutes === 1 ? '' : 's'}.`
              : 'The notice does not promise a time.'}
            {' '}Games already in progress are allowed to finish.
          </>
        )}
        {state.upcoming && (
          <>Window starts in {state.startsInMinutes} minute{state.startsInMinutes === 1 ? '' : 's'} ({when(state.from)}). Nothing is blocked yet.</>
        )}
        {!state.active && !state.upcoming && <>No maintenance scheduled. Players are being served normally.</>}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="lbl">From</label>
          <input type="datetime-local" className="input" value={form.from}
            onChange={(e) => setForm({ ...form, from: e.target.value })} />
        </div>
        <div>
          <label className="lbl">To</label>
          <input type="datetime-local" className="input" value={form.to}
            onChange={(e) => setForm({ ...form, to: e.target.value })} />
        </div>
      </div>

      <label className="lbl mt-3">What to tell players</label>
      <textarea
        className="input" rows={2}
        placeholder="We are upgrading the game engine."
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
      />
      <p className="text-[11px] text-muted mt-1.5">
        Shown inside a fuller message that already says when we are back and that
        nothing was lost. Leave blank to send just that.
      </p>

      <div className="flex flex-wrap gap-2 mt-4">
        <button className="btn-pri" disabled={busy} onClick={() => save({ enabled: true })}>
          {busy ? 'Saving…' : 'Schedule window'}
        </button>

        {state.active ? (
          <button className="btn-sec" disabled={busy}
            onClick={() => save({ enabled: false, force: false })}>
            End maintenance now
          </button>
        ) : (
          <button className="btn-danger" disabled={busy} onClick={() => save({ force: true })}>
            Go down now
          </button>
        )}

        <button className="btn-sec" disabled={busy}
          onClick={() => { setForm({ from: '', to: '', message: form.message }); save({ enabled: false, force: false, from: null, to: null }); }}>
          Clear
        </button>
      </div>

      {state.updatedAt && (
        <p className="text-[11px] text-muted mt-3">
          Last changed {when(state.updatedAt)}{state.updatedBy ? ` by ${state.updatedBy}` : ''}.
        </p>
      )}
    </Panel>
  );
}
