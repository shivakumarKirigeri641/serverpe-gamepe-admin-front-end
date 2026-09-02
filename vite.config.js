import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Where `npm run dev` sends API calls.
 *
 * This MUST go through loadEnv. Vite does not populate process.env from .env
 * files when evaluating this config - only `import.meta.env` inside the app
 * gets them - so `process.env.VITE_PROXY_TARGET` is always undefined here and
 * the fallback silently wins. That is how the panel ended up talking to an old
 * back-end on another port while .env clearly said otherwise.
 *
 * Defaults to the local back-end so admin actions in development can never
 * reach production by accident - this panel reads players' phone numbers and
 * message history, so the safe default matters more here than anywhere else.
 */
export default defineConfig(({ mode }) => {
  // '' loads every var, not just the VITE_-prefixed ones.
  const env = loadEnv(mode, process.cwd(), '');
  const API = env.VITE_PROXY_TARGET || 'http://localhost:5006';

  // Printed on every start: the single most confusing failure in this panel is
  // talking to the wrong back-end, and it is invisible until data looks stale.
  console.log(`\n  admin panel → API proxy target: ${API}\n`);

  return {
    plugins: [react()],
    server: {
      port: 5174,
      // Fail loudly instead of hopping to 5175. A moved port means the URL in
      // your browser silently stops working.
      strictPort: true,
      proxy: {
        // The whole platform namespace, so the panel can also reach the public
        // endpoints (policies, brand) without a second rule.
        '/serverpe': { target: API, changeOrigin: true },
      },
    },
  };
});
