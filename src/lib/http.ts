/**
 * Safe JSON reading for calls to the Edufy Express API (/api/*).
 *
 * If the API server isn't running behind the website (e.g. only the static `dist` folder was
 * uploaded to the host, or VITE_API_BASE_URL points to the wrong place), the host answers API
 * requests with the website's index.html. Calling res.json() on that throws the cryptic
 * "Unexpected token '<', "<!DOCTYPE "... is not valid JSON". This helper detects that case and
 * throws an error that explains what is actually wrong.
 */
export class ApiUnavailableError extends Error {
  constructor(public status: number, public url: string) {
    super(
      'The Edufy server (API) is not reachable from this website — it returned a web page instead of data. ' +
        'The Node.js server (server.ts) must be running and /api must point to it (VITE_API_BASE_URL).'
    );
    this.name = 'ApiUnavailableError';
  }
}

export async function readJson<T = any>(res: Response): Promise<T> {
  const type = (res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  if (!text) {
    if (res.ok) return {} as T;
    throw Object.assign(new Error(`Request failed (${res.status} ${res.statusText || ''})`.trim()), { status: res.status });
  }
  const looksHtml = type.includes('text/html') || /^\s*<(!doctype|html)/i.test(text);
  if (looksHtml) throw new ApiUnavailableError(res.status, res.url);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw Object.assign(new Error(`The server sent an unexpected response (${res.status}).`), { status: res.status });
  }
}
