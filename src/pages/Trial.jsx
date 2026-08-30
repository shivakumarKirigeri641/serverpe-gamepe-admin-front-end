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

import { api, num, when } from '../lib/api.js';
import { ErrorBox, Loading, Page, REFRESH_MS, Stat, Table, usePolling } from '../components/ui.jsx';

/** A small inline bar chart — enough to see a flat line without a chart library. */
function Sparkline({ rows, field, color = '#7d0f22' }) {
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
                background: v > 0 ? color : '#e2e7ee',
              }}
            />
          </div>
        );
      })}
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
          isOver ? 'border-red-300 bg-red-50/40' : 'border-brand/30 bg-brand/5'
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-4xl font-extrabold text-brand">{num(counts.signups)}</span>
          <span className="font-bold">people have messaged MastiPe</span>
        </div>
        <p className="text-sm text-muted mt-2 leading-relaxed">
          {isOver
            ? 'The trial window has closed. Charging is still off until you switch MONETIZATION_ENABLED on.'
            : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left to decide. To extend it, change FREE_TRIAL_ENDS_AT in the back-end .env and restart — the date players are told updates with it.`}
          {monetizationEnabled && ' Charging is currently ON.'}
        </p>
      </div>

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
          ['New signups per day', 'signups', '#7d0f22'],
          ['People playing per day', 'played', '#1f9d55'],
          ['Games per day', 'games', '#f0a202'],
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
