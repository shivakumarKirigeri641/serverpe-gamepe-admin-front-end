/**
 * src/pages/Trial.jsx
 * ---------------------------------------------------------------------------
 * How the free trial is going, and whether to extend it.
 *
 * This screen exists to answer one question — did enough people turn up to be
 * worth charging? — so it is that question with numbers attached rather than
 * another analytics view.
 *
 * The count is shown four ways on purpose. "Everyone who said hi" flatters the
 * trial: somebody who messaged once and never played is not demand, and
 * extending the window on that number would be deciding on the wrong one. The
 * number that predicts revenue is the one at the far right — people who came
 * back on a second day.
 */

import { useState } from 'react';
import { api, num, when } from '../lib/api.js';
import { ErrorBox, Loading, Page, REFRESH_MS, Stat, Table, usePolling } from '../components/ui.jsx';

/** A small inline bar chart — enough to see a flat line without a chart library. */
function Sparkline({ rows, field, color = '#ff4d6d' }) {
  const max = Math.max(...rows.map((r) => Number(r[field] || 0)), 1);

  return (
    <div className="flex items-end gap-1 h-16">
      {rows.map((r, i) => {
        const v = Number(r[field] || 0);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${r.day}: ${v}`}>
            <div
              className="w-full rounded-t transition-all"
              style={{
                height: `${Math.max((v / max) * 100, v > 0 ? 6 : 2)}%`,
                background: v > 0 ? color : 'rgba(255,255,255,.12)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Moving the trial's end date.
 *
 * It used to mean editing FREE_TRIAL_ENDS_AT on the server and restarting,
 * during which the marketing site went on advertising the old date. Saving here
 * changes it everywhere at once — the website badge, the plan taglines in both
 * languages, the greeting players get, and the switch that decides whether
 * anybody is charged.
 */
function TrialDate({ onSaved }) {
  const { data, error, refresh } = usePolling(() => api.get('/settings'), 0, []);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  if (error || !data) return null;

  // <input type="date"> wants a plain yyyy-mm-dd, in IST rather than UTC — an
  // 11:59pm IST deadline is the previous day in UTC, and showing that would be
  // an off-by-one nobody would question until the trial ended a day early.
  const asDate = (iso) =>
    new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const current = asDate(data.freeTrialEndsAt);

  const save = async (dateStr) => {
    setBusy(true);
    try {
      // End of that day in IST, so the trial covers the whole date shown.
      await api.put('/settings/trial', { endsAt: `${dateStr}T23:59:59+05:30` });
      setValue('');
      refresh();
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await api.put('/settings/trial', { endsAt: null });
      refresh();
      onSaved?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 mb-5">
      <h2 className="font-extrabold">Trial end date</h2>
      <p className="text-sm text-muted mt-1 leading-relaxed">
        Changing this updates the website, the plan descriptions in both languages and what
        players are told — immediately, with no restart.
      </p>

      <div className="flex flex-wrap items-end gap-3 mt-4">
        <label className="text-sm">
          <span className="block text-xs font-bold text-muted mb-1">Ends on</span>
          <input
            type="date"
            value={value || current}
            onChange={(e) => setValue(e.target.value)}
            className="border border-line rounded-lg px-3 py-2 text-sm"
          />
        </label>

        <button
          className="btn"
          disabled={busy || !value || value === current}
          onClick={() => save(value)}
        >
          {busy ? 'Saving…' : 'Save date'}
        </button>

        {data.source === 'database' && (
          <button className="btn-sec" disabled={busy} onClick={reset}>
            Reset to .env
          </button>
        )}
      </div>

      <p className="text-xs text-muted mt-3">
        {data.source === 'database'
          ? `Set in this panel${data.updatedAt ? ` on ${when(data.updatedAt)}` : ''}${
              data.updatedBy ? ` by ${data.updatedBy}` : ''
            }. The server's own FREE_TRIAL_ENDS_AT says ${asDate(data.environmentDefault)}.`
          : `Currently coming from the server's FREE_TRIAL_ENDS_AT. Saving a date here takes over.`}
      </p>
    </div>
  );
}

export default function Trial() {
  const { data, error, loading, refresh } = usePolling(() => api.get('/trial'), REFRESH_MS, []);

  if (error && !data) return <ErrorBox error={error} onRetry={refresh} />;
  if (loading && !data) return <Loading />;

  const { counts, daily, daysRemaining, endsOn, isOver, monetizationEnabled } = data;

  // Of everyone who ever messaged, how many got as far as a game.
  const conversion = counts.signups > 0 ? Math.round((counts.played / counts.signups) * 100) : 0;
  const hostRate = counts.played > 0 ? Math.round((counts.hosts / counts.played) * 100) : 0;

  return (
    <Page
      title="Free trial"
      subtitle={isOver ? `Ended ${endsOn}` : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left · ends ${endsOn}`}
      actions={
        <button className="btn-sec" onClick={refresh}>
          Refresh
        </button>
      }
    >
      <div
        className={`card p-5 mb-5 border-2 ${
          isOver ? 'border-red-300 bg-bad/10/40' : 'border-brand/30 bg-brand/5'
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-4xl font-extrabold text-gold">{num(counts.signups)}</span>
          <span className="font-bold">people have messaged MastiPe</span>
        </div>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          {isOver
            ? 'The trial window has closed. Charging is still off until you switch MONETIZATION_ENABLED on.'
            : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left to decide. Change the date below and every surface follows at once.`}
          {monetizationEnabled && ' Charging is currently ON.'}
        </p>
      </div>

      <TrialDate onSaved={refresh} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Said hi" value={num(counts.signups)} sub="Loosest measure" />
        <Stat index={1} label="Accepted terms" value={num(counts.consented)} tone="ink" sub="Real intent" />
        <Stat index={2} label="Actually played" value={num(counts.played)} tone="ink" sub={`${conversion}% of signups`} />
        <Stat
          index={3}
          label="Came back"
          value={num(counts.returning)}
          tone="ink"
          sub="Played on 2+ days"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        <Stat index={0} label="Hosted a room" value={num(counts.hosts)} sub={`${hostRate}% of players`} />
        <Stat index={1} label="Games started" value={num(counts.gamesStarted)} tone="ink" />
        <Stat index={2} label="Games finished" value={num(counts.gamesCompleted)} tone="ink" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        {[
          ['New signups per day', 'signups', '#ff4d6d'],
          ['People playing per day', 'played', '#2dd4bf'],
          ['Games per day', 'games', '#f5b83d'],
        ].map(([label, field, color]) => (
          <div key={field} className="card p-4">
            <h2 className="text-sm font-bold mb-3">{label}</h2>
            <Sparkline rows={daily} field={field} color={color} />
            <div className="flex justify-between text-[10px] text-muted mt-2">
              <span>{daily[0]?.day.slice(5)}</span>
              <span>{daily[daily.length - 1]?.day.slice(5)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* The honest read on the numbers, so the decision is not made off a
          single flattering total. */}
      <div className="card p-5 mb-5">
        <h2 className="text-sm font-bold mb-2">What these numbers say</h2>
        <ul className="text-sm text-muted space-y-1.5 leading-relaxed list-disc pl-5">
          <li>
            <strong className="text-ink">{num(counts.signups)}</strong> people messaged, of whom{' '}
            <strong className="text-ink">{num(counts.played)}</strong> reached a game ({conversion}%).
            {conversion < 50 && counts.signups > 5 && (
              <> A drop this size between saying hi and playing is usually the joining flow, not the game.</>
            )}
          </li>
          <li>
            <strong className="text-ink">{num(counts.hosts)}</strong> people hosted a room. Hosts are
            who a paid plan is sold to, so this is the number that matters for pricing.
          </li>
          <li>
            <strong className="text-ink">{num(counts.returning)}</strong> played on more than one day.
            {counts.returning === 0
              ? ' Nobody has come back yet — one evening of curiosity is not a habit, and extending the trial is worth more than starting to charge.'
              : ' People who come back are the ones who would renew.'}
          </li>
        </ul>
      </div>

      <h2 className="text-sm font-bold mb-2">Day by day</h2>
      <Table head={['Day', 'New signups', 'People playing', 'Games']}>
        {[...daily].reverse().map((d) => (
          <tr key={d.day}>
            <td className="td">{d.day}</td>
            <td className="td font-semibold">{num(d.signups)}</td>
            <td className="td">{num(d.played)}</td>
            <td className="td">{num(d.games)}</td>
          </tr>
        ))}
      </Table>

      <p className="text-xs text-muted mt-4">
        Trial ends {endsOn} ({when(data.endsAt)}). Counts are live and include every number that has
        ever messaged, blocked ones included.
      </p>
    </Page>
  );
}
