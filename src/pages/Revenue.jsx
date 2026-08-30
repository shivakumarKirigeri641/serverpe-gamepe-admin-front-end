/**
 * src/pages/Revenue.jsx
 * ---------------------------------------------------------------------------
 * Money, split for GST.
 *
 * Whether tax is worked backwards out of an inclusive price or added to an
 * exclusive one is a stored setting, not an assumption — getting it the wrong
 * way round misstates revenue by 18%.
 */

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, inr, num } from '../lib/api.js';
import { ErrorBox, Loading, Page, Stat, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

const axis = { stroke: '#6b7684', fontSize: 11, tickLine: false, axisLine: false };
const RANGES = [7, 30, 90];

export default function Revenue() {
  const [days, setDays] = useState(30);

  const { data, error, loading } = usePolling(
    async () => {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
      const [revenue, wallets] = await Promise.all([
        api.get(`/revenue?from=${from}&to=${to}`),
        api.get('/wallets?limit=1'),
      ]);
      return { revenue, wallets };
    },
    REFRESH_MS,
    [days],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { revenue, wallets } = data;
  const chart = revenue.daily.map((d) => ({
    day: d.day.slice(5),
    net: d.netPaise / 100,
    gst: d.gstPaise / 100,
  }));

  return (
    <Page
      title="Revenue & GST"
      subtitle={`Last ${days} days · GST ${revenue.gstRatePct}% · prices ${revenue.pricesIncludeGst ? 'include' : 'exclude'} tax`}
      actions={
        <div className="flex gap-1">
          {RANGES.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`btn ${days === d ? 'btn-pri' : 'btn-sec'} !px-3 !py-1.5 text-xs`}
            >
              {d} days
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Gross (with GST)" value={inr(revenue.totals.grossPaise)} />
        <Stat index={1} label="Net (without GST)" value={inr(revenue.totals.netPaise)} tone="ink" />
        <Stat index={2} label="GST collected" value={inr(revenue.totals.gstPaise)} tone="ink" />
        <Stat index={3} label="Games charged" value={num(revenue.totals.games)} tone="ink" />
      </div>

      {revenue.totals.grossPaise === 0 && (
        <div className="card p-4 mb-5 bg-line/20">
          <p className="text-sm text-muted">
            No revenue yet — the free trial is running, so plans are recorded at zero. These figures
            start moving the day charging is switched on.
          </p>
        </div>
      )}

      <div className="card p-4 mb-4">
        <h2 className="text-sm font-bold mb-3">Net and GST by day</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e7ee" vertical={false} />
              <XAxis dataKey="day" {...axis} />
              <YAxis {...axis} />
              <Tooltip formatter={(v) => `₹${Number(v).toFixed(2)}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar name="Net" dataKey="net" stackId="a" fill="#7d0f22" radius={[0, 0, 0, 0]} />
              <Bar name="GST" dataKey="gst" stackId="a" fill="#f0a202" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-4 mb-4 bg-gold/5 border-gold/30">
        <p className="text-sm">
          <strong>Credit outstanding: {inr(wallets.totals.total_balance_paise)}</strong> across{' '}
          {num(wallets.totals.wallets_with_credit)} wallets. That is money taken but not yet earned —
          it becomes revenue only when a game consumes it.
        </p>
      </div>

      <Table head={['Day', 'Games', 'Net', 'GST', 'Gross']}>
        {revenue.daily.map((d) => (
          <tr key={d.day}>
            <td className="td font-mono text-xs">{d.day}</td>
            <td className="td">{num(d.games)}</td>
            <td className="td">{inr(d.netPaise)}</td>
            <td className="td text-muted">{inr(d.gstPaise)}</td>
            <td className="td font-semibold">{inr(d.grossPaise)}</td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
