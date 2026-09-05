/**
 * src/pages/BakraRounds.jsx
 * ---------------------------------------------------------------------------
 * Every Tap Bakra round, and the question-by-question record of one.
 *
 * The detail view is the answer to "the game marked me wrong". It shows the
 * question as the bank holds it, what the player tapped, what the right answer
 * was, and both clocks — the player's own stopwatch and the server's. Those
 * two disagree by the round trip, which is exactly why both are kept: a time
 * faster than physics allows is visible here and nowhere else.
 */

import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, num, when, maskWa } from '../lib/api.js';
import {
  ErrorBox, Loading, Page, Panel, Stat, Table, Badge, REFRESH_MS, usePolling,
} from '../components/ui.jsx';

const MODE_LABEL = {
  go: 'Straight tap', position: 'Word vs slot', rule: 'Rule',
  except: 'Both but one', hold: 'Holding still',
};

function RoundDetail({ id }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = usePolling(
    () => api.get(`/bakra/rounds/${id}`), REFRESH_MS, [id],
  );

  if (loading && !data) return <Page title="Round"><Loading /></Page>;
  if (error && !data) return <Page title="Round"><ErrorBox error={error} onRetry={reload} /></Page>;

  const r = data.round;
  const correct = data.answers.filter((a) => a.wasCorrect).length;
  const noGos = data.answers.filter((a) => a.mode === 'hold' && a.correctPositions.length === 0);

  return (
    <Page
      title={`Round ${r.id}`}
      subtitle={`${r.player} · ${maskWa(r.waId)} · ${when(r.createdAt)}`}
      actions={<button className="btn-sec" onClick={() => navigate('/bakra/rounds')}>← All rounds</button>}
    >
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat index={0} label="Score" value={num(r.score)} tone="gold" />
        <Stat index={1} label="Correct" value={`${correct}/${data.answers.length}`} />
        <Stat index={2} label="Held" value={`${noGos.filter((a) => a.wasCorrect).length}/${noGos.length}`} tone="ink" />
        <Stat index={3} label="Language" value={r.lang === 'hi' ? 'Hindi' : 'English'} tone="ink" />
        <Stat index={4} label="Status" value={r.status} tone={r.status === 'finished' ? 'gold' : 'ink'} />
      </div>

      <Panel
        title="Question by question"
        subtitle={`Seed ${r.seed} — the round rebuilds from the ids stored on it`}
      >
        <Table head={['#', 'Question', 'Options', 'Answer', 'Tapped', 'Their clock', 'Server', 'Points']}>
          {data.answers.map((a) => (
            <tr key={a.seq} className={a.wasCorrect ? '' : 'bg-bad/5'}>
              <td className="td">{a.seq}</td>
              <td className="td">
                <div className="font-semibold">{a.instruction}</div>
                <div className="text-xs text-muted">
                  {MODE_LABEL[a.mode] || a.mode} · level {a.difficulty}
                  {a.twisted ? ' · shuffled' : ''}
                  {a.trap ? ` · ${a.trap}` : ''}
                </div>
              </td>
              <td className="td text-xs text-muted">{a.options.join(' | ')}</td>
              <td className="td text-xs">
                {a.correctPositions.length
                  ? a.correctPositions.map((p) => a.options[p - 1]).join(' + ')
                  : <span className="text-gold">nothing</span>}
              </td>
              <td className={`td text-xs ${a.wasCorrect ? 'text-good' : 'text-bad'}`}>
                {a.tapped.length ? a.tapped.map((p) => a.options[p - 1]).join(' + ') : 'nothing'}
              </td>
              <td className="td text-xs">{a.takenMs === null ? '—' : `${num(a.takenMs)}ms`}</td>
              {/*
                The server's own elapsed time includes the round trip, so it is
                always the larger of the two. A player's clock that is wildly
                below it is the shape a forged time would take.
              */}
              <td className="td text-xs text-muted">{a.serverMs === null ? '—' : `${num(a.serverMs)}ms`}</td>
              <td className="td font-semibold">{a.points ? num(Math.round(a.points)) : '—'}</td>
            </tr>
          ))}
        </Table>
      </Panel>
    </Page>
  );
}

export default function BakraRounds() {
  const { id } = useParams();
  if (id) return <RoundDetail id={id} />;

  const { data, error, loading, reload } = usePolling(
    () => api.get('/bakra/rounds?limit=100'), REFRESH_MS,
  );

  if (loading && !data) return <Page title="Rounds"><Loading /></Page>;
  if (error && !data) return <Page title="Rounds"><ErrorBox error={error} onRetry={reload} /></Page>;

  return (
    <Page title="Rounds" subtitle="Every Tap Bakra round, newest first">
      <Table
        head={['Round', 'Player', 'Where', 'Score', 'Correct', 'Speed', 'Lang', 'Status', 'When']}
        empty="No rounds played yet."
      >
        {data.map((r) => (
          <tr key={r.id} className="hover:bg-line/20">
            <td className="td">
              <Link to={`/bakra/rounds/${r.id}`} className="text-gold hover:underline font-semibold">
                #{r.id}
              </Link>
            </td>
            <td className="td font-semibold">{r.player}</td>
            <td className="td text-xs text-muted">
              {[r.city, r.region].filter(Boolean).join(', ') || '—'}
            </td>
            <td className="td font-semibold">{num(r.score)}</td>
            <td className="td">{r.answered ? `${r.correct}/${r.answered}` : '—'}</td>
            <td className="td text-muted text-xs">{r.avgMs === null ? '—' : `${num(r.avgMs)}ms`}</td>
            <td className="td text-xs">{r.lang === 'hi' ? 'हिं' : 'EN'}</td>
            <td className="td"><Badge value={r.status} /></td>
            <td className="td text-xs text-muted">{when(r.createdAt)}</td>
          </tr>
        ))}
      </Table>
    </Page>
  );
}
