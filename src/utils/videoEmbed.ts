/**
 * Turns whatever an admin pastes as a course preview video — an <iframe> embed code,
 * an Adilo / YouTube / Vimeo link, or a direct video file URL — into something safe to play.
 * Raw HTML is never rendered: only the iframe's src is used, and only trusted hosts are allowed.
 */
export type ResolvedVideo = { kind: 'iframe'; src: string } | { kind: 'file'; src: string };

const IFRAME_HOSTS = ['adilo.bigcommand.com', 'www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'];

export function extractVideoSource(input: string | null | undefined): string {
  let raw = (input || '').trim();
  if (/<\s*iframe/i.test(raw)) {
    raw = raw.match(/\ssrc\s*=\s*"([^"]+)"/i)?.[1] || raw.match(/\ssrc\s*=\s*'([^']+)'/i)?.[1] || '';
    raw = raw.replace(/&amp;/gi, '&').trim();
  }
  if (raw.startsWith('//')) raw = `https:${raw}`;
  return raw;
}

export function resolveVideo(input: string | null | undefined): ResolvedVideo | null {
  const raw = extractVideoSource(input);
  if (!raw || /[<>"']/.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  // http is accepted only for a local test server, and only in development builds (never for real visitors)
  const devBuild = typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
  if (u.protocol !== 'https:' && !(devBuild && u.protocol === 'http:' && /^(localhost|127\.0\.0\.1)$/.test(u.hostname))) return null;
  const host = u.hostname.toLowerCase();

  // YouTube → embed URL
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return id ? { kind: 'iframe', src: `https://www.youtube.com/embed/${id}` } : null;
  }
  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v') || u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
    return id ? { kind: 'iframe', src: `https://www.youtube.com/embed/${id}` } : null;
  }
  // Vimeo → player URL
  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    const id = u.pathname.match(/^\/(\d+)/)?.[1];
    return id ? { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (IFRAME_HOSTS.includes(host)) {
    u.hash = '';
    return { kind: 'iframe', src: u.toString() };
  }
  // Direct video files (e.g. uploaded to Supabase Storage)
  if (/\.(mp4|webm|mov|m4v|ogg)$/i.test(u.pathname) || /\/storage\/v1\/object\//.test(u.pathname)) {
    return { kind: 'file', src: u.toString() };
  }
  return null;
}
