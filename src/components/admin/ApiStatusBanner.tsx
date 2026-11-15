import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../services/api';
import { ApiUnavailableError, readJson } from '../../lib/http';

type Status = { state: 'checking' } | { state: 'ok' } | { state: 'down'; reason: string };

/**
 * Admin-only notice when the Express API (/api) isn't reachable from this website.
 * Catalogue pages read Supabase directly and keep working; saving courses, uploads, lesson import,
 * payments and push notifications need the server.
 */
export const ApiStatusBanner: React.FC = () => {
  const [status, setStatus] = useState<Status>({ state: 'checking' });

  const check = async () => {
    setStatus({ state: 'checking' });
    try {
      const res = await fetch(`${API_BASE_URL}/health`, { headers: { accept: 'application/json' } });
      const data = await readJson<{ status?: string; supabase?: { hasServiceRole?: boolean } }>(res);
      if (!res.ok || data.status !== 'ok') throw new Error(`The API answered with status ${res.status}.`);
      if (data.supabase && data.supabase.hasServiceRole === false) {
        setStatus({ state: 'down', reason: 'The API is running but SUPABASE_SERVICE_ROLE_KEY is not set on the server, so admin actions that need it will fail.' });
        return;
      }
      setStatus({ state: 'ok' });
    } catch (e: any) {
      setStatus({
        state: 'down',
        reason:
          e instanceof ApiUnavailableError
            ? `Requests to ${API_BASE_URL} return the website's HTML page instead of the Edufy server — the Node.js server isn't deployed behind this site, or VITE_API_BASE_URL points to the wrong address.`
            : `The Edufy server at ${API_BASE_URL} couldn't be reached (${e?.message || 'network error'}).`,
      });
    }
  };

  useEffect(() => {
    check();
  }, []);

  if (status.state !== 'down') return null;
  return (
    <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-[15px] text-amber-900 flex gap-3" role="alert">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1">
        <div className="font-semibold">Edufy server not reachable</div>
        <div className="mt-0.5">{status.reason}</div>
        <div className="mt-1 text-[14px] text-amber-800">
          Course lists, bundles, categories, blog, banners and offers still work. Saving courses, uploads, lesson import, payments and push notifications need the server.
        </div>
      </div>
      <button onClick={check} className="ed-btn ed-btn-text ed-btn-sm shrink-0" aria-label="Check again">
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );
};
