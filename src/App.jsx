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
import { getToken, logout, setToastHandler, setUnauthorizedHandler } from './lib/api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
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
import Settings from './pages/Settings.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◎', end: true },
  { to: '/live', label: 'Live monitoring', icon: '◉' },
  { to: '/analytics', label: 'Analytics', icon: '◫' },
  { to: '/conversations', label: 'Conversations', icon: '✉' },
  { to: '/players', label: 'Players', icon: '☰' },
  { to: '/lookup', label: 'Number lookup', icon: '⌕' },
  { to: '/moderation', label: 'Blocked numbers', icon: '⊘' },
  { to: '/games', label: 'Games', icon: '⬢' },
  { to: '/revenue', label: 'Revenue & GST', icon: '₹' },
  { to: '/credits', label: 'Credits & wallets', icon: '◈' },
  { to: '/support', label: 'Support tickets', icon: '⛑' },
  { to: '/feedback', label: 'Feedback', icon: '★' },
  { to: '/documents', label: 'Documents', icon: '⎙' },
  { to: '/events', label: 'Event stream', icon: '⌁' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
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
          className={`fixed left-1/2 -translate-x-1/2 bottom-6 z-50 rounded-full px-5 py-3 text-sm
            font-semibold text-white shadow-lg ${toast.tone === 'bad' ? 'bg-red-600' : 'bg-ink'}`}
        >
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Shell({ children, onSignOut }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* Wide, always-visible rail on desktop; a drawer on a phone. */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-brand-deep text-white
          transform transition-transform lg:transform-none
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-lg font-extrabold tracking-tight">MastiPe</div>
          <div className="text-xs text-white/60 mt-0.5">Admin · ServerPe App Solutions</div>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 150px)' }}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
            >
              <span className="w-5 text-center opacity-80">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 inset-x-0 p-3 border-t border-white/10">
          <button className="nav-link w-full" onClick={onSignOut}>
            <span className="w-5 text-center opacity-80">⏻</span>
            Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-20 bg-brand-deep text-white px-4 py-3 flex items-center gap-3">
          <button onClick={() => setOpen(true)} className="text-2xl leading-none">
            ☰
          </button>
          <span className="font-bold">MastiPe Admin</span>
        </header>

        <main className="p-4 sm:p-6 max-w-[1400px] mx-auto">{children}</main>
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
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/conversations/:id" element={<Conversations />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:id" element={<Players />} />
          <Route path="/lookup" element={<Lookup />} />
          <Route path="/moderation" element={<Moderation />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/:id" element={<Games />} />
          <Route path="/revenue" element={<Revenue />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/support" element={<Support />} />
          <Route path="/support/:id" element={<Support />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/events" element={<Events />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
      <Toaster />
    </>
  );
}
