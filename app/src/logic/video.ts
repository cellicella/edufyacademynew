/**
 * Mirrors the website's src/utils/videoEmbed.ts: turns an embed code / link into a safe
 * player source. Raw HTML is never rendered — only the iframe src from a trusted host.
 */
export type ResolvedVideo = { kind: 'iframe'; src: string } | { kind: 'file'; src: string };

export const ADILO_ORIGIN = 'https://adilo.bigcommand.com';
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
  if (!raw || /[<>"'\s]/.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    return id ? { kind: 'iframe', src: `https://www.youtube.com/embed/${id}?playsinline=1` } : null;
  }
  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v') || u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
    return id ? { kind: 'iframe', src: `https://www.youtube.com/embed/${id}?playsinline=1` } : null;
  }
  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    const id = u.pathname.match(/^\/(\d+)/)?.[1];
    return id ? { kind: 'iframe', src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (IFRAME_HOSTS.includes(host)) {
    u.hash = '';
    return { kind: 'iframe', src: u.toString() };
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(u.pathname) || /\/storage\/v1\/object\//.test(u.pathname)) return { kind: 'file', src: u.toString() };
  return null;
}

/** HTML attribute escaping for URLs placed into the player page. */
export const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
