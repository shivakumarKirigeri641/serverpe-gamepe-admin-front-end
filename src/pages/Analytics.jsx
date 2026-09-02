/**
 * src/pages/Analytics.jsx
 * ---------------------------------------------------------------------------
 * The shape of the business over time: the funnel from "hi" to a won prize,
 * daily activity, how fast players answer, and message delivery.
 */

import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, num } from '../lib/api.js';
import { ErrorBox, Loading, Page, Table, usePolling, REFRESH_MS , axisProps, gridProps, ChartTooltip} from '../components/ui.jsx';
// Geography carries its own period control and its own slower poll, so it is
// deliberately not folded into this page's fetch.
import Geography from '../components/Geography.jsx';

// Shared with every other chart in the panel, so no two look subtly different.
const axis = axisProps;

const FUNNEL_LABELS = {
  messaged_bot: 'Messaged the bot',
  saw_menu: 'Saw the menu',
  created_room: 'Created a room',
  joined_room: 'Joined a room',
  started_game: 'Started a game',
  answered_a_number: 'Answered a number',
  won_a_prize: 'Won a prize',
};

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

export default function Analytics() {
  const [days, setDays] = useState(30);

  const { data, error, loading } = usePolling(
    async () => {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
      const qs = `?from=${from}&to=${to}`;

      const [metrics, funnel, response, delivery, types] = await Promise.all([
        api.get(`/metrics/daily${qs}`),
        api.get(`/funnel${qs}`),
        api.get(`/engagement/response-times${qs}`),
        api.get(`/messages/delivery${qs}`),
        api.get(`/events/types${qs}`),
      ]);
      return { metrics, funnel, response, delivery, types };
    },
    REFRESH_MS,
    [days],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { metrics, funnel, response, delivery, types } = data;

  const series = metrics.map((m) => ({
    day: m.day.slice(5),
    players: m.active_players,
    newPlayers: m.new_players,
    games: m.games_started,
    completed: m.games_completed,
    answers: m.acknowledgements,
    median: m.median_response_ms ? Math.round(m.median_response_ms / 100) / 10 : null,
  }));

  const funnelRows = Object.entries(FUNNEL_LABELS).map(([key, label]) => ({
    label,
    value: funnel[key] ?? 0,
  }));
  const funnelTop = funnelRows[0]?.value || 1;

  return (
    <Page
      title="Analytics"
      subtitle={`Last ${days} days`}
      actions={
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`btn ${days === r.days ? 'btn-pri' : 'btn-sec'} !px-3 !py-1.5 text-xs`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      <Geography />

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3">From “hi” to a prize</h2>
          <div className="space-y-2">
            {funnelRows.map((row, i) => {
              const pct = Math.round((row.value / funnelTop) * 100);
              const prev = funnelRows[i - 1]?.value;
              const drop = prev && prev > 0 ? Math.round(((prev - row.value) / prev) * 100) : null;
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold">{row.label}</span>
                    <span className="text-muted">
                      {num(row.value)}
                      {drop > 0 && <span className="text-bad ml-2">−{drop}%</span>}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted mt-3">
            Each step counts distinct players, so the drop between steps is real attrition.
          </p>
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3">How fast players answer</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={response} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="bucket" {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip />
                <Bar dataKey="responses" radius={[6, 6, 0, 0]}>
                  {response.map((r, i) => (
                    <Cell key={i} fill={i < 3 ? '#2dd4bf' : i < 5 ? '#f5b83d' : '#ff4d6d'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Green answers land well inside the tick. Red ones are close to timing out — if that bar
            grows, the draw interval is too short.
          </p>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h2 className="text-sm font-bold mb-3">Players and games</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="day" {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" name="Active" dataKey="players" stroke="#ff4d6d" strokeWidth={2} dot={false} />
              <Line type="monotone" name="New" dataKey="newPlayers" stroke="#f5b83d" strokeWidth={2} dot={false} />
              <Line type="monotone" name="Games" dataKey="games" stroke="#2dd4bf" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="text-sm font-bold mb-3">Message delivery</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={delivery} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="day" tickFormatter={(d) => d.slice(5)} {...axis} />
                <YAxis allowDecimals={false} {...axis} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="Sent" dataKey="sent" fill="rgba(255,255,255,.12)" radius={[4, 4, 0, 0]} />
                <Bar name="Delivered" dataKey="delivered" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                <Bar name="Read" dataKey="read" fill="#ff4d6d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold mb-2">What players did</h2>
          <Table head={['Event', 'Count']}>
            {types.slice(0, 14).map((t) => (
              <tr key={t.event_type}>
                <td className="td font-mono text-xs">{t.event_type}</td>
                <td className="td text-right font-semibold">{num(t.count)}</td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </Page>
  );
}
