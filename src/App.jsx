/**
 * src/App.jsx
 * ---------------------------------------------------------------------------
 * Shell: the passcode gate, the navigation rail and the routes.
 *
 * Everything behind the gate reads real player data, so the token check runs
 * before any page mounts rather than each page defending itself.
 */

import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { fetchBrand, getToken, logout, setToastHandler, setUnauthorizedHandler } from './lib/api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import BakraDashboard from './pages/BakraDashboard.jsx';
import BakraRounds from './pages/BakraRounds.jsx';
import BakraQuestions from './pages/BakraQuestions.jsx';
import Live from './pages/Live.jsx';
import Analytics from './pages/Analytics.jsx';
import Conversations from './pages/Conversations.jsx';
import Games from './pages/Games.jsx';
import Players from './pages/Players.jsx';
import Revenue from './pages/Revenue.jsx';
import Support from './pages/Support.jsx';
import Feedback from './pages/Feedback.jsx';
import Events from './pages/Events.jsx';
import Credits from './pages/Credits.jsx';
import Lookup from './pages/Lookup.jsx';
import Moderation from './pages/Moderation.jsx';
import Documents from './pages/Documents.jsx';
import Trial from './pages/Trial.jsx';
import Hosts from './pages/Hosts.jsx';
import Notifications from './pages/Notifications.jsx';
import Settings from './pages/Settings.jsx';
import Audit from './pages/Audit.jsx';
import Operations from './pages/Operations.jsx';

/**
 * Grouped, because eighteen flat links is a wall you read every time instead
 * of a menu you learn. The headings are what let you find "Blocked numbers"
 * without scanning all eighteen.
 */
const NAV = [
  {
    group: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: '◎', end: true },
      { to: '/live', label: 'Live monitoring', icon: '◉' },
      { to: '/analytics', label: 'Analytics', icon: '◫' },
      { to: '/operations', label: 'Operations', icon: '⚡' },
      { to: '/trial', label: 'Free trial', icon: '◷' },
    ],
  },
  {
    group: 'People',
    items: [
      { to: '/players', label: 'Players', icon: '☰' },
      { to: '/hosts', label: 'Hosts', icon: '★' },
      { to: '/conversations', label: 'Conversations', icon: '✉' },
      { to: '/lookup', label: 'Number lookup', icon: '⌕' },
      { to: '/moderation', label: 'Blocked numbers', icon: '⊘' },
    ],
  },
  {
    group: 'Tambola',
    items: [
      { to: '/games', label: 'Games', icon: '⬢' },
      { to: '/audit', label: 'Game audit', icon: '🔍' },
    ],
  },
  {
    group: 'Tap Bakra',
    items: [
      { to: '/bakra', label: 'Overview', icon: '🐐', end: true },
      { to: '/bakra/rounds', label: 'Rounds', icon: '≡' },
      { to: '/bakra/questions', label: 'Questions', icon: '?' },
    ],
  },
  {
    group: 'Shared',
    items: [
      { to: '/feedback', label: 'Feedback', icon: '♥' },
      { to: '/events', label: 'Event stream', icon: '⌁' },
    ],
  },
  {
    group: 'Business',
    items: [
      { to: '/revenue', label: 'Revenue & GST', icon: '₹' },
      { to: '/credits', label: 'Credits & wallets', icon: '◈' },
      { to: '/support', label: 'Support tickets', icon: '⛑' },
      { to: '/documents', label: 'Documents', icon: '⎙' },
      { to: '/notifications', label: 'Notifications', icon: '⚑' },
      { to: '/settings', label: 'Settings', icon: '⚙' },
    ],
  },
];

function Toaster() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setToastHandler((t) => {
      setToast(t);
      setTimeout(() => setToast(null), 3200);
    });
  }, []);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 rounded-full border px-5 py-3
            text-sm font-semibold shadow-lift backdrop-blur-xl ${
              toast.tone === 'bad'
                ? 'border-bad/30 bg-bad/15 text-bad'
                : 'border-good/30 bg-good/15 text-good'
            }`}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Shell({ children, onSignOut }) {
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState(null);

  // Fetched, not bundled: one manifest serves this panel, the marketing site
  // and the game board, so a new logo lands everywhere at once.
  useEffect(() => {
    let alive = true;
    fetchBrand().then((b) => {
      if (alive) setBrand(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen lg:flex">
      {/* Wide, always-visible rail on desktop; a drawer on a phone. */}
      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 w-[264px] shrink-0
          h-screen flex flex-col border-r border-line bg-bg-deep/80 backdrop-blur-xl
          transform transition-transform duration-200 lg:transform-none
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-5 border-b border-line">
          <div className="flex items-center gap-2.5">
            {brand?.primary?.markLight ? (
              <img src={brand.primary.markLight} alt="" className="h-7 w-auto" aria-hidden="true" />
            ) : (
              <span
                className="grid place-items-center w-8 h-8 rounded-xl text-bg-deep font-extrabold text-sm shrink-0"
                style={{ background: 'linear-gradient(135deg,#f5b83d,#c98a12)' }}
                aria-hidden="true"
              >
                M
              </span>
            )}
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold tracking-tight text-ink truncate">
                {brand?.name ?? 'MastiPe'}
              </div>
              <div className="text-[10.5px] uppercase tracking-[.12em] text-faint">Admin console</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {NAV.map((section) => (
            <div key={section.group}>
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-faint">
                {section.group}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                  >
                    <span className="w-4 text-center text-[13px] opacity-70">{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-line">
          <button className="nav-link w-full" onClick={onSignOut}>
            <span className="w-4 text-center text-[13px] opacity-70">⏻</span>
            Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 border-b border-line bg-bg-deep/85 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="text-xl leading-none text-muted" aria-label="Open menu">
            ☰
          </button>
          <span className="font-bold text-ink">{brand?.name ?? 'MastiPe'} Admin</span>
        </header>

        <main className="p-4 sm:p-7 max-w-[1500px] mx-auto">{children}</main>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const navigate = useNavigate();

  // A 401 from anywhere drops straight back to the gate.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuthed(false);
      navigate('/', { replace: true });
    });
  }, [navigate]);

  const signOut = useCallback(async () => {
    await logout();
    setAuthed(false);
    navigate('/', { replace: true });
  }, [navigate]);

  if (!authed) {
    return (
      <>
        <Login onSuccess={() => setAuthed(true)} />
        <Toaster />
      </>
    );
  }

  return (
    <>
      <Shell onSignOut={signOut}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/live" element={<Live />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/trial" element={<Trial />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/conversations/:id" element={<Conversations />} />
          <Route path="/hosts" element={<Hosts />} />
          <Route path="/hosts/:id" element={<Hosts />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<Players />} />
          <Route path="/lookup" element={<Lookup />} />
          <Route path="/moderation" element={<Moderation />} />
          <Route path="/bakra" element={<BakraDashboard />} />
          <Route path="/bakra/rounds" element={<BakraRounds />} />
          <Route path="/bakra/rounds/:id" element={<BakraRounds />} />
          <Route path="/bakra/questions" element={<BakraQuestions />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/:id" element={<Games />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/support" element={<Support />} />
          <Route path="/support/:id" element={<Support />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/events" element={<Events />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      <Toaster />
    </>
  );
}
