import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

/**
 * Production addresses built into `vite build` when no VITE_API_BASE_URL / VITE_SITE_URL is set.
 * The website then calls the API on the right address even if the uploaded config.js is left empty.
 * Override per build with VITE_API_BASE_URL / VITE_SITE_URL (e.g. for a staging site), or at runtime
 * with window.EDUFY_CONFIG in /config.js (no rebuild). `npm run dev` is not affected.
 */
const PRODUCTION_DEFAULTS = {
  VITE_API_BASE_URL: 'https://api.edufyacademy.com/api',
  VITE_SITE_URL: 'https://edufyacademy.com',
} as const;

/** localhost, loopback, Android emulator and private-network addresses */
const LOCAL_ADDRESS = /^https?:\/\/(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i;

export default defineConfig(({command, mode}) => {
  const define: Record<string, string> = {};
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    for (const [key, fallback] of Object.entries(PRODUCTION_DEFAULTS)) {
      const value = (env[key] || '').trim();
      if (value && LOCAL_ADDRESS.test(value) && process.env.EDUFY_ALLOW_LOCAL_BUILD !== 'true') {
        throw new Error(
          `[Edufy] ${key}="${value}" is a local address, so real visitors could not use this build. ` +
            `Remove it from .env / .env.local / .env.production before "npm run build" ` +
            `(the production default is ${fallback}), or set EDUFY_ALLOW_LOCAL_BUILD=true for a local-only preview build.`
        );
      }
      if (!value) {
        // Both mechanisms: Vite reads VITE_ variables from process.env after this config runs, and
        // `define` replaces import.meta.env.KEY directly. Either alone puts the value in the bundle.
        process.env[key] = fallback;
        define[`import.meta.env.${key}`] = JSON.stringify(fallback);
      }
    }
    // Without the Supabase address and public key the website cannot sign anyone in or load courses.
    // Stop the build instead of publishing a broken site (Hostinger then keeps the current live version).
    const supabaseUrl = (env.VITE_SUPABASE_URL || '').trim();
    const supabaseKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
    if ((!supabaseUrl || !supabaseKey) && process.env.EDUFY_ALLOW_NO_SUPABASE !== 'true') {
      throw new Error(
        '[Edufy] VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required for a production build. ' +
          'Locally: put them in .env.local. On Hostinger: Websites → edufyacademy.com → Node.js → Environment variables ' +
          '(both are public values; never use the service-role key here).'
      );
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    define,
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
