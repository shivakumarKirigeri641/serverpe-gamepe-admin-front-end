/**
 * src/pages/Notifications.jsx
 * ---------------------------------------------------------------------------
 * Which alerts reach your inbox, and proof that they can.
 *
 * Three things sit on one screen because they are the three questions asked in
 * the same breath: is email working at all, which triggers are on, and did
 * anything actually get sent. An operator who cannot answer the third stops
 * trusting the first two.
 *
 * Alerts are batched by default. Instant is reserved for the one trigger where
 * somebody is genuinely waiting — a support ticket — because an inbox that
 * floods is an inbox that gets muted, and then the alert that mattered is
 * ignored along with the rest.
 */

import { useState } from 'react';
import { api, num, when } from '../lib/api.js';
import { Badge, ErrorBox, Loading, Page, REFRESH_MS, Stat, Table, usePolling } from '../components/ui.jsx';

const MODES = [
  ['instant', 'Instant', 'Sent the moment it happens'],
  ['digest', 'Batched', 'Collected into the periodic email'],
  ['off', 'Off', 'Recorded, never emailed'],
];

const MODE_TONE = {
  instant: 'bg-red-100 text-red-700',
  digest: 'bg-brand/10 text-brand',
  off: 'bg-line/60 text-muted',
};

function ModePicker({ value, onChange, busy }) {
  return (
    <div className="inline-flex rounded-xl border border-line overflow-hidden">
      {MODES.map(([mode, label, hint]) => (
        <button
          key={mode}
          title={hint}
          disabled={busy}
          onClick={() => onChange(mode)}
          className={`px-3 py-1.5 text-xs font-bold transition disabled:opacity-50
            ${value === mode ? 'bg-brand text-white' : 'bg-white text-ink hover:bg-line/40'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function Notifications() {
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const { data, error, loading, refresh } = usePolling(
    () => api.get('/notifications'),
    REFRESH_MS,
    [],
  );

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />;
  if (loading && !data) return <Loading />;

  const { status, settings, pending, preview, log } = data;

  const setMode = async (key, mode) => {
    setBusy(key);
    try {
      await api.patch(`/notifications/${key}`, { mode, enabled: mode !== 'off' });
      refresh();
    } finally {
      setBusy(null);
    }
  };

  const act = async (path, body, label) => {
    setBusy(label);
    setResult(null);
    try {
      setResult({ label, value: await api.post(path, body) });
      refresh();
    } catch (err) {
      setResult({ label, value: { ok: false, error: err.message } });
    } finally {
      setBusy(null);
    }
  };

  const lastSend = log?.[0];

  return (
    <Page
      title="Notifications"
      subtitle={`Batched every ${status.digestMinutes} minutes · ${status.from} → ${status.to}`}
      actions={
        <>
          <button
            className="btn-sec"
            disabled={busy === 'verify'}
            onClick={() => act('/notifications/verify', {}, 'verify')}
          >
            {busy === 'verify' ? 'Checking…' : 'Test connection'}
          </button>
          <button
            className="btn-pri"
            disabled={busy === 'send'}
            onClick={() => act('/notifications/send', { force: true }, 'send')}
          >
            {busy === 'send' ? 'Sending…' : 'Send digest now'}
          </button>
        </>
      }
    >
      {/* Configured but disabled looks identical to working, until you notice
          nothing has arrived for a week. Said plainly instead. */}
      {(!status.enabled || !status.configured) && (
        <div className="card p-4 mb-4 border-2 border-amber-300 bg-amber-50/60">
          <strong className="text-amber-800">
            {!status.configured
              ? 'Email is not configured — no alerts can be sent.'
              : 'Alerts are switched off globally (ADMIN_NOTIFICATIONS_ENABLED=false).'}
          </strong>
          <p className="text-sm text-muted mt-1">
            Everything below is still recorded; nothing is emailed until this is fixed in the
            back-end .env.
          </p>
        </div>
      )}

      {result && (
        <div
          className={`card p-4 mb-4 border-2 ${
            result.value.ok === false ? 'border-red-300 bg-red-50/50' : 'border-good/40 bg-good/5'
          }`}
        >
          {result.label === 'verify' ? (
            result.value.ok ? (
              <strong className="text-good">
                Connected to the mail server and authenticated. Nothing was sent.
              </strong>
            ) : (
              <span className="text-red-700">
                <strong>Could not connect:</strong> {result.value.error}
              </span>
            )
          ) : result.value.sent ? (
            <strong className="text-good">
              Digest sent to {result.value.recipient} — {num(result.value.events)} event
              {result.value.events === 1 ? '' : 's'} included.
            </strong>
          ) : (
            <span className="text-red-700">
              <strong>Not sent:</strong> {result.value.reason}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Waiting to send" value={num(pending)} sub={`Next batch ≤ ${status.digestMinutes} min`} />
        <Stat index={1} label="New people" value={num(preview.players.new)} tone="ink" sub="This window" />
        <Stat index={2} label="Games started" value={num(preview.games.started)} tone="ink" sub="This window" />
        <Stat
          index={3}
          label="Failed sends"
          value={num(preview.messages.failed)}
          tone="ink"
          sub={preview.messages.failed > 0 ? 'Worth a look' : 'All delivered'}
        />
      </div>

      <h2 className="text-sm font-bold mb-2">What you get told about</h2>
      <Table head={['Alert', 'When', 'Goes to', '']} empty="No triggers configured.">
        {settings.map((s) => (
          <tr key={s.trigger_key}>
            <td className="td">
              <div className="font-semibold">{s.label}</div>
              <div className="text-xs text-muted mt-0.5 max-w-lg">{s.description}</div>
              <div className="text-[11px] font-mono text-muted mt-1">{s.trigger_key}</div>
            </td>
            <td className="td">
              <Badge value={s.mode} tone={MODE_TONE[s.mode]} />
            </td>
            <td className="td text-xs text-muted">{s.recipient || status.to}</td>
            <td className="td text-right">
              <ModePicker
                value={s.mode}
                busy={busy === s.trigger_key}
                onChange={(mode) => setMode(s.trigger_key, mode)}
              />
            </td>
          </tr>
        ))}
      </Table>

      <div className="grid lg:grid-cols-2 gap-4 mt-6">
        <div>
          <h2 className="text-sm font-bold mb-2">
            What the next digest would say
            <span className="font-normal text-muted"> · last {preview.windowMinutes} minutes</span>
          </h2>
          <div className="card p-4">
            <dl className="text-sm space-y-1.5">
              {[
                ['New people', preview.players.new],
                ['Active', preview.players.active],
                ['Games created', preview.games.created],
                ['Games started', preview.games.started],
                ['Games completed', preview.games.completed],
                ['Rooms never started', preview.games.abandoned],
                ['Prizes won', preview.prizes],
                ['Messages in / out', `${preview.messages.inbound} / ${preview.messages.outbound}`],
                ['Failed sends', preview.messages.failed],
                ['Feedback', preview.feedback.count],
                ['Support tickets', preview.tickets],
                ['Numbers blocked', preview.blocked],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-semibold">{num(v)}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 pt-3 border-t border-line text-sm">
              <div className="font-bold mb-1.5">Free trial</div>
              <div className="flex justify-between">
                <span className="text-muted">Signups / played / returning</span>
                <span className="font-semibold">
                  {num(preview.trial.signups)} / {num(preview.trial.played)} /{' '}
                  {num(preview.trial.returning)}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted">Ends</span>
                <span className="font-semibold">
                  {preview.trial.endsOn} · {preview.trial.daysRemaining}d
                </span>
              </div>
            </div>

            <p className="text-xs text-muted mt-4">
              The same figures go out as a PDF attachment. A digest with nothing in it is not sent
              at all — an empty email every {status.digestMinutes} minutes would teach you to ignore
              the subject line.
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold mb-2">
            Recently sent
            {lastSend && (
              <span className="font-normal text-muted"> · last {when(lastSend.sent_at)}</span>
            )}
          </h2>
          <Table head={['When', 'Kind', 'Subject', 'Events', '']} empty="Nothing sent yet.">
            {log.map((l, i) => (
              <tr key={i}>
                <td className="td text-xs text-muted whitespace-nowrap">{when(l.sent_at)}</td>
                <td className="td">
                  <Badge value={l.kind} />
                </td>
                <td className="td text-xs max-w-xs truncate" title={l.subject}>
                  {l.subject}
                </td>
                <td className="td text-xs">{num(l.event_count)}</td>
                <td className="td">
                  {l.ok ? (
                    <span className="text-good text-xs font-bold">sent</span>
                  ) : (
                    <span className="text-red-700 text-xs font-bold" title={l.error}>
                      failed
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </div>

      <p className="text-xs text-muted mt-5">
        Sent from <strong>{status.from}</strong> so a reply to an alert goes nowhere, rather than
        into the mailbox support tickets arrive in. Change the recipient or the interval in the
        back-end .env (<code>ALERT_RECIPIENT</code>, <code>ALERT_DIGEST_MINUTES</code>).
      </p>
    </Page>
  );
}
