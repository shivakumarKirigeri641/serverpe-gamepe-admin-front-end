/**
 * src/pages/BakraQuestions.jsx
 * ---------------------------------------------------------------------------
 * Which questions are beating people — and which are simply broken.
 *
 * This is the content quality screen. A question almost nobody gets right is
 * either an excellent trap or a bad row, and no percentage can tell you which:
 * you have to read the question. So the instruction, the options and the right
 * answer sit next to the number, and the judgement stays with the operator.
 */

import { api, num } from '../lib/api.js';
import {
  ErrorBox, Loading, Page, Panel, Table, BarRow, REFRESH_MS, usePolling, VIZ,
} from '../components/ui.jsx';

const MODE_LABEL = {
  go: 'Straight tap — TAP MANGO',
  position: 'Word vs slot — TAP THE WORD RIGHT',
  rule: 'Rule — TAP THE ANIMAL',
  except: 'Both but one — TAP BOTH EXCEPT X',
  hold: 'Holding still — DON’T TAP IF YOU SEE X',
};

const TRAP_LABEL = {
  none: 'No trap',
  no_go: 'No-go — the answer is to touch nothing',
  slot_conflict: 'Slot conflict — the word is not where it says',
  lookalike: 'Lookalike — BAT and BAG on one screen',
  digit_word: 'Digit and word — 6 next to SIX',
};

export default function BakraQuestions() {
  const { data, error, loading, reload } = usePolling(
    () => api.get('/bakra/questions'), REFRESH_MS * 3,
  );

  if (loading && !data) return <Page title="Questions"><Loading /></Page>;
  if (error && !data) return <Page title="Questions"><ErrorBox error={error} onRetry={reload} /></Page>;

  const maxMode = Math.max(...data.byMode.map((m) => m.asked), 1);

  return (
    <Page
      title="Questions"
      subtitle="How the bank is performing across every player"
    >
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Accuracy by question type" subtitle="Where players actually struggle">
          {data.byMode.map((m, i) => (
            <BarRow
              key={m.mode}
              index={i}
              label={MODE_LABEL[m.mode] || m.mode}
              value={m.accuracyPct ?? 0}
              max={100}
              color={m.accuracyPct >= 70 ? VIZ[2] : m.accuracyPct >= 50 ? VIZ[0] : VIZ[1]}
              hint={`${num(m.correct)}/${num(m.asked)}${m.avgMs ? ` · ${num(m.avgMs)}ms` : ''}`}
            />
          ))}
          <p className="text-xs text-muted mt-3">
            Holding still should be the hardest of these. If it is not, the no-go
            questions are not doing their job and the bank needs rebalancing.
          </p>
        </Panel>

        <Panel title="Accuracy by level" subtitle="The difficulty ramp, as played">
          {data.byDifficulty.map((d, i) => (
            <BarRow
              key={d.difficulty}
              index={i}
              label={`Level ${d.difficulty}`}
              value={d.accuracyPct ?? 0}
              max={100}
              color={VIZ[0]}
              hint={`${num(d.correct)}/${num(d.asked)}${d.avgMs ? ` · ${num(d.avgMs)}ms` : ''}`}
            />
          ))}
          <p className="text-xs text-muted mt-3">
            Accuracy should fall as the level rises. A flat line means the ramp is
            decorative — the questions are not actually getting harder.
          </p>
        </Panel>
      </div>

      <Panel title="How the traps are performing" subtitle="Lower is a better trap" className="mt-4">
        <Table head={['Trap', 'Asked', 'Got it right', 'Accuracy']}>
          {data.traps.map((t) => (
            <tr key={t.trap}>
              <td className="td">{TRAP_LABEL[t.trap] || t.trap}</td>
              <td className="td">{num(t.asked)}</td>
              <td className="td">{num(t.correct)}</td>
              <td className={`td font-semibold ${t.accuracyPct < 50 ? 'text-bad' : ''}`}>
                {t.accuracyPct === null ? '—' : `${t.accuracyPct}%`}
              </td>
            </tr>
          ))}
        </Table>
      </Panel>

      <Panel
        title="Hardest questions"
        subtitle="Asked at least three times, worst first — read them before deciding they are good"
        className="mt-4"
      >
        <Table
          head={['Question', 'Options', 'Right answer', 'Asked', 'Accuracy', 'Trap']}
          empty="Not enough plays yet to rank anything."
        >
          {data.hardest.map((q) => (
            <tr key={q.questionId}>
              <td className="td">
                <div className="font-semibold">{q.instruction}</div>
                <div className="text-xs text-muted">{q.questionId} · level {q.difficulty}</div>
              </td>
              <td className="td text-xs text-muted">{q.options.join(' | ')}</td>
              <td className="td text-xs">{q.answer}</td>
              <td className="td">{num(q.asked)}</td>
              <td className={`td font-semibold ${q.accuracyPct < 34 ? 'text-bad' : ''}`}>
                {q.accuracyPct}%
              </td>
              <td className="td text-xs text-muted">{q.trap || '—'}</td>
            </tr>
          ))}
        </Table>
        <p className="text-xs text-muted mt-3">
          A question below about a third is worth reading closely: three options
          means random tapping alone scores 33%, so anything under that is being
          got wrong more often than chance — which usually means the wording is
          at fault rather than the players.
        </p>
      </Panel>
    </Page>
  );
}
