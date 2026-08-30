/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // MastiPe's own palette — the deep maroon and gold of a tambola ticket,
        // rather than QuizPe's WhatsApp green, so the two panels are instantly
        // distinguishable when both are open.
        brand: { DEFAULT: '#7d0f22', light: '#a8203a', accent: '#b3122b', deep: '#5c0a19' },
        gold: '#f0a202',
        good: '#1f9d55',
        ink: '#1e2733',
        muted: '#6b7684',
        line: '#e2e7ee',
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 3px rgba(16,24,40,.06), 0 6px 20px rgba(16,24,40,.06)' },
    },
  },
  plugins: [],
};
