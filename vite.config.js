import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Where `npm run dev` sends API calls. Defaults to the local back-end so admin
// actions in development can never reach production by accident — this panel
// reads players' phone numbers and message history, so the safe default matters
// more here than anywhere else. Point it elsewhere deliberately.
const API = process.env.VITE_PROXY_TARGET || 'http://localhost:5009';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // The whole platform namespace, so the panel can also reach the public
      // endpoints (policies, business profile) without a second rule.
      '/serverpe': { target: API, changeOrigin: true },
    },
  },
});
