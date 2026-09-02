/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "Midnight Maroon" — the deep maroon and gold of a tambola ticket, but
        // laid on near-black instead of paper. Dark is the right ground for an
        // operations panel: it is looked at for hours, and saturated data
        // colours read far more clearly against it than against white.
        bg: { DEFAULT: '#0b0910', deep: '#07060b', raise: '#141019' },
        // Hex, not rgba: Tailwind can only apply its /opacity modifier to a
        // parseable colour, and 'border-line/60' silently emits nothing for an
        // rgba() value. Glass translucency is done in index.css instead.
        surface: { DEFAULT: '#16131f', hi: '#1d1927' },
        line: '#272231',
        ink: '#eceaf2',
        muted: '#8f8a9e',
        faint: '#5e5871',

        brand: { DEFAULT: '#b3122b', light: '#e8365d', deep: '#5c0a19', glow: '#ff4d6d' },
        gold: { DEFAULT: '#f5b83d', deep: '#c98a12' },

        // Chart series. Picked to stay distinguishable side by side and to
        // survive the most common form of colour blindness, rather than to
        // simply look different from each other.
        viz: {
          1: '#f5b83d',  // gold
          2: '#ff4d6d',  // crimson
          3: '#2dd4bf',  // teal
          4: '#a78bfa',  // violet
          5: '#60a5fa',  // blue
          6: '#fb923c',  // orange
        },

        good: '#34d399',
        warn: '#fbbf24',
        bad: '#fb7185',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.4), 0 8px 32px rgba(0,0,0,.36)',
        glow: '0 0 0 1px rgba(245,184,61,.3), 0 8px 32px rgba(245,184,61,.12)',
        lift: '0 12px 40px rgba(0,0,0,.5)',
      },
      backgroundImage: {
        // A single soft light source top-left, so cards nearer the top read as
        // slightly raised without anyone having to draw a shadow.
        aurora:
          'radial-gradient(1000px 620px at 8% -8%, rgba(179,18,43,.20), transparent 60%),' +
          'radial-gradient(760px 520px at 96% 4%, rgba(245,184,61,.10), transparent 58%),' +
          'radial-gradient(620px 620px at 50% 108%, rgba(167,139,250,.08), transparent 62%)',
        sheen: 'linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0) 46%)',
      },
      keyframes: {
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(52,211,153,.5)' },
          '70%': { boxShadow: '0 0 0 8px rgba(52,211,153,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(52,211,153,0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        pulseRing: 'pulseRing 2s ease-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
};
