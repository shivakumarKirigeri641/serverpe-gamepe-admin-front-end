/**
 * src/pages/Credits.jsx
 * ---------------------------------------------------------------------------
 * Wallets and credit adjustments.
 *
 * Hosts pay for games from credits, and are only charged once a game starts
 * calling numbers — so a wallet balance is money that has been paid for but not
 * yet consumed. That makes this page a liability register as much as a support
 * tool, which is why every adjustment demands a reason.
 */

import { useState } from 'react';
import { api, inr, maskWa, num, when } from '../lib/api.js';
import { Badge, ErrorBox, Loading, Page, Stat, Table, usePolling, REFRESH_MS } from '../components/ui.jsx';

const KINDS = [
  { value: 'topup', label: 'Top-up (paid)' },
  { value: 'goodwill', label: 'Goodwill — technical issue' },
  { value: 'promo_credit', label: 'Promotional credit' },
  { value: 'refund', label: 'Refund' },
  { value: 'adjustment', label: 'Correction' },
];

function AdjustDialog({ player, onClose, onDone }) {
  const [rupees, setRupees] = useState('');
  const [kind, setKind] = useState('goodwill');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/wallets/${player.id}/adjust`, {
        amountPaise: Math.round(Number(rupees) * 100),
        kind,
        note,
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-card w-full max-w-md p-6"
      >
        <h2 className="text-lg font-bold text-brand">Adjust credits</h2>
        <p className="text-sm text-muted mt-1">
          {player.display_name || 'Player'} · {maskWa(player.wa_id)} · currently{' '}
          {inr(player.balance_paise)}
        </p>

        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mt-5 mb-1">
          Amount in rupees
        </label>
        <input
          className="input"
          type="number"
          step="0.01"
          value={rupees}
          onChange={(e) => setRupees(e.target.value)}
          placeholder="50"
          required
        />
        <p className="text-[11px] text-muted mt-1">Use a negative number to take credit away.</p>

        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mt-4 mb-1">
          Reason
        </label>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>

        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mt-4 mb-1">
          Note
        </label>
        <input
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Game froze mid-round on 29 Aug"
          minLength={3}
          required
        />
        <p className="text-[11px] text-muted mt-1">
          Required. In six months this note is the only thing that explains the movement.
        </p>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex gap-2 mt-6">
          <button type="button" className="btn-sec flex-1" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-pri flex-1" disabled={busy || !rupees || note.length < 3}>
            {busy ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </form>
    </div>
  );
}

function FreeGameDialog({ player, onClose, onDone }) {
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [campaign, setCampaign] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/wallets/${player.id}/free-games`, {
        quantity: Number(quantity),
        reason,
        campaign: campaign || undefined,
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white rounded-2xl shadow-card w-full max-w-md p-6"
      >
        <h2 className="text-lg font-bold text-brand">Give free games</h2>
        <p className="text-sm text-muted mt-1">
          {player.display_name || 'Player'} - {maskWa(player.wa_id)} - currently{' '}
          {num(player.free_games || 0)} free
        </p>

        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mt-5 mb-1">
          How many games
        </label>
        <input
          className="input"
          type="number"
          min="-20"
          max="20"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <p className="text-[11px] text-muted mt-1">Negative takes free games away.</p>

        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mt-4 mb-1">
          Reason
        </label>
        <input
          className="input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Apology for the dropped game on 29 Aug"
          minLength={3}
          required
        />

        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mt-4 mb-1">
          Campaign (optional)
        </label>
        <input
          className="input"
          value={campaign}
          onChange={(e) => setCampaign(e.target.value)}
          placeholder="diwali-2026"
        />
        <p className="text-[11px] text-muted mt-1">
          Tag a promotion so you can measure it later.
        </p>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex gap-2 mt-6">
          <button type="button" className="btn-sec flex-1" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-pri flex-1" disabled={busy || reason.length < 3}>
            {busy ? 'Saving...' : 'Give free games'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Credits() {
  const [selected, setSelected] = useState(null);
  const [comping, setComping] = useState(null);
  const [nonce, setNonce] = useState(0);

  const { data, error, loading } = usePolling(
    () => api.get('/wallets?limit=100'),
    REFRESH_MS,
    [nonce],
  );

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorBox error={error} />;

  const { totals, items } = data;

  return (
    <Page
      title="Credits & wallets"
      subtitle="Hosts are charged only when a game starts calling numbers"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat index={0} label="Credit outstanding" value={inr(totals.total_balance_paise)} />
        <Stat index={1} label="Wallets in credit" value={num(totals.wallets_with_credit)} tone="ink" />
        <Stat index={2} label="Free games outstanding" value={num(totals.free_games_outstanding)} tone="ink" />
        <Stat index={3} label="Wallets total" value={num(totals.wallets)} tone="ink" />
      </div>

      <div className="card p-4 mb-5 bg-gold/5 border-gold/30">
        <p className="text-sm">
          <strong>Credit outstanding is a liability.</strong> It is money players have paid for and
          not yet used, so it belongs on your books until a game consumes it — not as revenue on the
          day it was bought.
        </p>
      </div>

      <Table head={['Player', 'Number', 'Balance', 'Free games', 'Movements', 'Hosted', '']}>
        {items.map((w) => (
          <tr key={w.id}>
            <td className="td font-semibold">{w.display_name || '—'}</td>
            <td className="td text-muted">{maskWa(w.wa_id)}</td>
            <td className="td font-bold">
              {Number(w.balance_paise) > 0 ? (
                <span className="text-good">{inr(w.balance_paise)}</span>
              ) : (
                <span className="text-muted">{inr(0)}</span>
              )}
            </td>
            <td className="td">
              {w.free_games > 0 ? (
                <span className="pill bg-gold/15 text-[#8a5d00]">{num(w.free_games)} free</span>
              ) : (
                <span className="text-muted">-</span>
              )}
            </td>
            <td className="td">{num(w.movements)}</td>
            <td className="td">{num(w.games_hosted)}</td>
            <td className="td text-right whitespace-nowrap">
              <button className="btn-sec !px-3 !py-1.5 text-xs mr-1" onClick={() => setComping(w)}>
                Free game
              </button>
              <button className="btn-sec !px-3 !py-1.5 text-xs" onClick={() => setSelected(w)}>
                Credits
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {comping && (
        <FreeGameDialog
          player={comping}
          onClose={() => setComping(null)}
          onDone={() => {
            setComping(null);
            setNonce((n) => n + 1);
          }}
        />
      )}

      {selected && (
        <AdjustDialog
          player={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            setNonce((n) => n + 1);
          }}
        />
      )}
    </Page>
  );
}
