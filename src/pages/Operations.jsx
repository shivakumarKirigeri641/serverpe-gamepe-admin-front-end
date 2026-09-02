/**
 * src/pages/Operations.jsx
 * ---------------------------------------------------------------------------
 * The things that quietly go wrong.
 *
 * Every panel here was chosen because it is a LEADING indicator - it tells you
 * something is degrading while you can still fix it, rather than reporting that
 * yesterday was bad. The other screens answer "how are we doing"; this one
 * answers "what is about to break".
 */

import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, num } from '../lib/api.js';
import {
  BarRow, ChartTooltip, ErrorBox, Loading, Page, Panel, Stat, VIZ,
  axisProps, gridProps, usePolling, REFRESH_MS,
} from '../components/ui.jsx';

const RANGES = [
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Operations() {
  const [range, setRange] = useState('7d');

  const { data, error, loading } = usePolling(
    async () => {
      const [health, heatmap] = await Promise.all([
        api.get(`/ops/health?range=${range}`),
        api.get('/ops/heatmap?days=30'),
      ]);
      return { health, heatmap };
    },
    REFRESH_MS,
    [range],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { health: h, heatmap } = data;

  const neverOpenedPct = h.boardsNeverOpened.seated
    ? Math.round((h.boardsNeverOpened.never_opened / h.boardsNeverOpened.seated) * 100)
    : 0;
  const failedPct = h.delivery.sent
    ? Math.round(((h.delivery.failed + h.delivery.blocked) / h.delivery.sent) * 100)
    : 0;
  const flappingPct = h.connections.sessions
    ? Math.round((h.connections.flapping / h.connections.sessions) * 100)
    : 0;

  const deviceMax = Math.max(...h.devices.map((d) => d.count), 1);
  const roomsNotStarted = h.rooms.created ? h.rooms.still_waiting + h.rooms.never_started : 0;

  return (
    <Page
      title="Operations"
      subtitle="Leading indicators — what is about to break, not what already did"
      actions={
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`pill border ${
                range === r.key
                  ? 'bg-gold/15 text-gold border-gold/40'
                  : 'bg-surface text-muted border-line hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Stat index={0} label="Never opened board" value={`${neverOpenedPct}%`}
          tone={neverOpenedPct > 25 ? 'crimson' : 'gold'}
          sub={`${num(h.boardsNeverOpened.never_opened)} of ${num(h.boardsNeverOpened.seated)} seated`} />
        <Stat index={1} label="Messages not delivered" value={`${failedPct}%`}
          tone={failedPct > 5 ? 'crimson' : 'teal'}
          sub={`${num(h.delivery.failed)} failed · ${num(h.delivery.blocked)} blocked`} />
        <Stat index={2} label="Connections flapping" value={`${flappingPct}%`}
          tone={flappingPct > 20 ? 'crimson' : 'violet'}
          sub={`${num(h.connections.in_app)} in-app browsers`} />
        <Stat index={3} label="Prizes unclaimed" value={`${h.prizes.unclaimedPct}%`}
          tone={h.prizes.unclaimedPct > 60 ? 'crimson' : 'gold'}
          sub={`${num(h.prizes.awarded)} of ${num(h.prizes.possible)} won`} />
      </div>

      <div className="grid xl:grid-cols-2 gap-4 mb-4">
        <Panel title="Draw pacing" subtitle="How evenly numbers actually came out">
          <dl className="divide-y divide-line">
            {[
              ['Average gap', `${h.drawPacing.avg_gap_seconds}s`],
              ['Worst gap', `${h.drawPacing.worst_gap_seconds}s`],
              ['Stalls over 30s', num(h.drawPacing.stalls)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5 text-[13.5px]">
                <dt className="text-muted">{k}</dt>
                <dd className="font-bold nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted mt-3">
            The average should sit just above your draw interval. A worst gap far
            above it means the scheduler fell behind — players feel that as a
            game that stutters.
          </p>
        </Panel>

        <Panel title="What people play on" subtitle="Board sessions by device">
          {h.devices.length === 0 ? (
            <p className="text-sm text-muted">No board sessions in this window.</p>
          ) : (
            h.devices.map((d, i) => (
              <BarRow key={d.device_type} index={i} label={d.device_type}
                value={d.count} max={deviceMax} color={VIZ[i % VIZ.length]} />
            ))
          )}
          <p className="text-xs text-muted mt-3">
            Test the board on whatever leads this list. A high in-app browser
            share also explains reconnects — WhatsApp suspends backgrounded pages.
          </p>
        </Panel>
      </div>

      <div className="grid xl:grid-cols-2 gap-4 mb-4">
        <Panel title="Rooms that never played" subtitle="Hosts who created a room and stopped">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Created', h.rooms.created, 'text-ink'],
              ['Still waiting', h.rooms.still_waiting, 'text-gold'],
              ['Never started', h.rooms.never_started, 'text-bad'],
            ].map(([k, v, tone]) => (
              <div key={k} className="card p-3">
                <div className={`text-2xl font-extrabold nums ${tone}`}>{num(v)}</div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted mt-1">{k}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-3">
            {roomsNotStarted > 0
              ? `${num(roomsNotStarted)} room${roomsNotStarted === 1 ? '' : 's'} never reached a first number. If this stays high, the gap is between creating a room and getting friends to join.`
              : 'Every room created went on to play.'}
          </p>
        </Panel>

        <Panel title="Connection quality" subtitle="Board sessions and how often they reconnected">
          <dl className="divide-y divide-line">
            {[
              ['Sessions', num(h.connections.sessions)],
              ['In WhatsApp browser', num(h.connections.in_app)],
              ['Reconnected 4+ times', num(h.connections.flapping)],
              ['Average reconnects', h.connections.avg_reconnects],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5 text-[13.5px]">
                <dt className="text-muted">{k}</dt>
                <dd className="font-bold nums text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel title="When people play" subtitle="Games started, by hour and weekday, last 30 days">
        <Heatmap rows={heatmap} />
        <p className="text-xs text-muted mt-3">
          The most actionable chart here: it says when to be available, when a
          promotion would land, and when it is safe to deploy.
        </p>
      </Panel>
    </Page>
  );
}

/**
 * Hour-by-weekday grid. Built by hand rather than with a chart library -
 * recharts has no heatmap, and this is a table with background colours.
 */
function Heatmap({ rows }) {
  const grid = {};
  let max = 0;
  for (const r of rows) {
    grid[`${r.weekday}-${r.hour}`] = r.games;
    if (r.games > max) max = r.games;
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="min-w-[620px]">
        <div className="flex gap-[3px] mb-1 pl-9">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-faint">
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>
        {DAYS.map((day, d) => (
          <div key={day} className="flex items-center gap-[3px] mb-[3px]">
            <div className="w-9 text-[10px] text-muted shrink-0">{day}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const v = grid[`${d}-${h}`] ?? 0;
              // Scaled against the busiest cell, with a floor so a single game
              // is still visible rather than indistinguishable from zero.
              const strength = max ? v / max : 0;
              return (
                <div
                  key={h}
                  title={`${day} ${String(h).padStart(2, '0')}:00 — ${v} game${v === 1 ? '' : 's'}`}
                  className="flex-1 rounded-[3px]"
                  style={{
                    aspectRatio: '1',
                    background: v === 0
                      ? 'rgba(255,255,255,.04)'
                      : `rgba(245,184,61,${0.18 + strength * 0.82})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
