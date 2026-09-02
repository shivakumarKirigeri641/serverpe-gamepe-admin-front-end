/**
 * src/pages/Login.jsx
 * ---------------------------------------------------------------------------
 * The passcode gate.
 *
 * Errors are shown inline rather than as a toast — the remaining-attempts count
 * and the lockout timer are the whole point, and a snackbar that vanishes after
 * three seconds is the wrong place for either.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { login } from '../lib/api.js';

export default function Login({ onSuccess }) {
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [lockedFor, setLockedFor] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Count the lockout down on screen, so the wait is visible rather than a
  // dead form that silently refuses.
  useEffect(() => {
    if (lockedFor <= 0) return undefined;
    const timer = setInterval(() => setLockedFor((s) => Math.max(s - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [lockedFor]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy || lockedFor > 0) return;

    setBusy(true);
    setError(null);
    try {
      await login(passcode, 'panel');
      onSuccess();
    } catch (err) {
      setPasscode('');
      inputRef.current?.focus();

      if (err.status === 429) {
        setLockedFor(err.retryAfterSeconds || 900);
        setError('Too many attempts. Locked out for a while.');
      } else if (err.attemptsRemaining !== undefined) {
        setError(
          err.attemptsRemaining > 0
            ? `Incorrect passcode. ${err.attemptsRemaining} attempt${err.attemptsRemaining === 1 ? '' : 's'} left.`
            : 'Incorrect passcode. That was the last attempt.',
        );
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const mins = Math.floor(lockedFor / 60);
  const secs = String(lockedFor % 60).padStart(2, '0');

  return (
    <div className="relative min-h-screen grid place-items-center px-4 overflow-hidden bg-bg-deep">
      {/* Two soft colour washes behind the card. The gate is the first thing
          anyone sees, and a flat black screen reads as "broken", not "secure". */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(680px 460px at 22% 18%, rgba(179,18,43,.30), transparent 62%),' +
            'radial-gradient(600px 420px at 82% 84%, rgba(245,184,61,.16), transparent 60%)',
        }}
      />
      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        onSubmit={submit}
        className="card relative w-full max-w-sm p-8"
      >
        <div className="text-center mb-7">
          <span
            className="inline-grid place-items-center w-12 h-12 rounded-2xl text-bg-deep font-extrabold text-lg mb-3"
            style={{ background: 'linear-gradient(135deg,#f5b83d,#c98a12)', boxShadow: '0 8px 28px rgba(245,184,61,.3)' }}
            aria-hidden="true"
          >
            M
          </span>
          <div className="text-[26px] font-extrabold tracking-tight text-gradient">MastiPe</div>
          <div className="text-[11px] uppercase tracking-[.14em] text-faint mt-1">Admin console</div>
        </div>

        <label className="block text-[11px] font-bold uppercase tracking-wide text-muted mb-2">
          Passcode
        </label>
        <input
          ref={inputRef}
          className="input text-center text-2xl tracking-[0.4em] font-bold"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={passcode}
          disabled={lockedFor > 0}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="••••"
        />

        {error && (
          <p className="text-sm text-bad mt-3 text-center font-medium">
            {error}
            {lockedFor > 0 && (
              <span className="block text-muted font-normal mt-1">
                Try again in {mins}:{secs}
              </span>
            )}
          </p>
        )}

        <button
          type="submit"
          className="btn-pri w-full mt-5"
          disabled={busy || lockedFor > 0 || !passcode}
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>

        <p className="text-[11px] text-muted mt-5 text-center leading-relaxed">
          This panel shows players&rsquo; phone numbers and message history.
          <br />
          Your session ends when you close the tab.
        </p>
      </motion.form>
    </div>
  );
}
