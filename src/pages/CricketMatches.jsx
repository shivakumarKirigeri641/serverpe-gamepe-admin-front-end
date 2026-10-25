/**
 * src/pages/CricketMatches.jsx
 * ---------------------------------------------------------------------------
 * Every Hand Cricket match, and the ball-by-ball record of one.
 *
 * The detail view answers "the bot cheated" and "my friend's score is wrong":
 * every ball with both numbers shown, who was batting, and what it scored. The
 * bot only ever chose from the balls before it, and this is where that can be
 * checked.
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, when } from '../lib/api.js';
import { ErrorBox, Loading, Page, Panel, Stat, Table, Badge, REFRESH_MS, usePolling } from '../components/ui.jsx';
import { inningsText } from './CricketDashboard.jsx';

const modeText = (m) => (m.mode === 'bot' ? `vs bot · ${m.bot_level}` : `friend${m.code ? ` · ${m.code}` : ''}`);

function MatchDetail({ id }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = usePolling(() => api.get(`/cricket/matches/${id}`), REFRESH_MS, [id]);

  if (loading && !data) return <Page title="Match"><Loading /></Page>;
  if (error && !data) return <Page title="Match"><ErrorBox error={error} onRetry={reload} /></Page>;

  const m = data;
  const side = (s) => (s === 1 ? m.host_name : (m.guest_name || 'Friend'));
  const batFirst = m.bat_first;
  const chasing = batFirst ? (batFirst === 1 ? 2 : 1) : null;

  return (
    <Page
      title={`Match #${m.id}`}
      subtitle={`${m.host_name} vs ${m.guest_name || 'waiting…'} · ${modeText(m)} · ${when(m.created_at)}`}
      actions={<button className="btn-sec" onClick={() => navigate('/cricket/matches')}>← All matches</button>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label={batFirst ? `${side(batFirst)} (1st)` : '1st innings'} value={inningsText(m.runs1, m.wkts1, m.balls1)} tone="gold" />
        <Stat index={1} label={chasing ? `${side(chasing)} (2nd)` : '2nd innings'} value={inningsText(m.runs2, m.wkts2, m.balls2)} tone="gold" />
        <Stat index={2} label="Toss" value={m.toss_winner ? side(m.toss_winner) : '—'} sub={m.toss_call ? `called ${m.toss_call}` : ''} tone="ink" />
        <Stat index={3} label="Status" value={m.status} sub={m.result || ''} tone={m.status === 'finished' ? 'gold' : 'ink'} />
      </div>

      <Panel title="Ball by ball" subtitle="Both numbers, as shown at the same time">
        <Table head={['Ball', 'Batting', 'Bat showed', 'Bowl showed', 'Result', 'When']} empty="No balls bowled yet.">
          {m.balls.map((b) => (
            <tr key={`${b.innings}.${b.ball_no}`} className={b.is_out ? 'bg-bad/5' : ''}>
              <td className="td">{b.innings === 1 ? '1st' : '2nd'} · {Math.floor((b.ball_no - 1) / 6)}.{((b.ball_no - 1) % 6) + 1}</td>
              <td className="td text-xs">{side(b.batter)}</td>
              <td className="td font-semibold">{b.bat_pick}</td>
              <td className="td font-semibold">{b.bowl_pick}</td>
              <td className={`td font-semibold ${b.is_out ? 'text-bad' : 'text-good'}`}>{b.is_out ? 'OUT' : `+${b.runs}`}</td>
              <td className="td text-xs text-muted">{when(b.created_at)}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </Page>
  );
}

export default function CricketMatches() {
  const { id } = useParams();
  if (id) return <MatchDetail id={id} />;

  const { data, error, loading, reload } = usePolling(() => api.get('/cricket/matches?limit=100'), REFRESH_MS);

  if (loading && !data) return <Page title="Matches"><Loading /></Page>;
  if (error && !data) return <Page title="Matches"><ErrorBox error={error} onRetry={reload} /></Page>;

  return (
    <Page title="Matches" subtitle="Every Hand Cricket match, newest first">
      <Table head={['Match', 'Sides', 'Mode', '1st innings', '2nd innings', 'Result', 'Status', 'When']} empty="No matches played yet.">
        {data.map((m) => (
          <tr key={m.id} className="hover:bg-line/20">
            <td className="td"><Link to={`/cricket/matches/${m.id}`} className="text-gold hover:underline font-semibold">#{m.id}</Link></td>
            <td className="td text-xs">{m.host_name} <span className="text-muted">vs</span> {m.guest_name || <span className="text-muted">nobody yet</span>}</td>
            <td className="td text-xs text-muted">{modeText(m)}</td>
            <td className="td text-xs">{inningsText(m.runs1, m.wkts1, m.balls1)}</td>
            <td className="td text-xs">{inningsText(m.runs2, m.wkts2, m.balls2)}</td>
            <td className="td text-xs">{m.result || '—'}</td>
            <td className="td"><Badge value={m.status} /></td>
            <td className="td text-xs text-muted">{when(m.created_at)}</td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
