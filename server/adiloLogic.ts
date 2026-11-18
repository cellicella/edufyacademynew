/**
 * Adilo video library — pure helpers (no network, unit-tested in tests/adiloLibrary.test.ts).
 *
 * Verified facts (November 2026):
 *  - REST API: https://adilo-api.bigcommand.com/v1 with headers X-Public-Key / X-Secret-Key
 *    (https://developers.adilo.com/). Responses wrap data in `payload`. The docs show no response examples, so
 *    every field is read defensively. A real GET /v1/files/{id} response (stored in adilo_uploads) has:
 *    id, title, description, tags, views, project{id,title,…}, duration_formatted ("00:00:26"), created_at, updated_at.
 *  - The API does NOT return an embed/player URL and the docs define no way to build one.
 *  - Adilo's watch pages publish an oEmbed endpoint (standard oEmbed discovery:
 *    <link rel="alternate" type="application/json+oembed" href="https://adilo.bigcommand.com/web/oembed?format=json">).
 *    GET /web/oembed?format=json&url=<watch page> returns {type:"video", title, html:"<iframe src=…>"} for a real
 *    video and 404 {"error":"Config not found"} otherwise. The player URL is taken from that iframe `src`
 *    (Adilo's own embed code), never assembled by hand. The watch page used as the oEmbed `url` is the
 *    https://adilo.bigcommand.com/watch/{file id} page — confirmed to open the same file (API id NxSjM8fj →
 *    watch/NxSjM8fj shows that file's title) — and oEmbed must return the matching video before anything is saved.
 */

export const ADILO_PLAYER_ORIGIN = 'https://adilo.bigcommand.com';
export const ADILO_OEMBED_ENDPOINT = `${ADILO_PLAYER_ORIGIN}/web/oembed`;

export interface AdiloProject {
  id: string;
  title: string;
  createdAt: string | null;
}
export interface AdiloFolder {
  id: string;
  title: string;
  projectId: string | null;
  parentId: string | null;
}
export interface AdiloVideo {
  id: string;
  title: string;
  durationSeconds: number | null;
  durationFormatted: string | null;
  projectId: string | null;
  projectTitle: string | null;
  folderId: string | null;
  createdAt: string | null;
}

/** Adilo ids are short URL-safe strings (e.g. "NxSjM8fj", "y_dEKhMs"). */
export const isAdiloId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(v);

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
const cleanText = (v: unknown, max = 300): string =>
  String(v ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Items + total from a list response: payload array, payload.data/items/files, or data. */
export function unwrapList(resp: unknown): { items: any[]; total: number | null } {
  const r: any = resp && typeof resp === 'object' ? resp : {};
  const p = r.payload ?? r.data ?? r;
  const items = Array.isArray(p) ? p : Array.isArray(p?.data) ? p.data : Array.isArray(p?.items) ? p.items : Array.isArray(p?.files) ? p.files : Array.isArray(p?.folders) ? p.folders : Array.isArray(p?.projects) ? p.projects : [];
  const t = Number(r.meta?.total ?? r.total ?? p?.total ?? r.meta?.pagination?.total);
  return { items: items.filter((x: unknown) => x && typeof x === 'object'), total: Number.isFinite(t) && t >= 0 ? t : null };
}

/** "00:10:30" / "10:30" / "45" → seconds (null when not a duration). */
export function parseDuration(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const m = s.match(/^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?(?:\.\d+)?$/);
  if (!m) return null;
  return m[3] !== undefined ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : Number(m[1]) * 60 + Number(m[2]);
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function normaliseProject(p: any): AdiloProject | null {
  const id = str(p?.id);
  if (!isAdiloId(id)) return null;
  return { id, title: cleanText(p?.title ?? p?.name) || 'Untitled project', createdAt: str(p?.created_at) };
}

export function normaliseFolder(f: any, projectId: string | null = null): AdiloFolder | null {
  const id = str(f?.id);
  if (!isAdiloId(id)) return null;
  return {
    id,
    title: cleanText(f?.title ?? f?.name) || 'Untitled folder',
    projectId: str(f?.project_id ?? f?.project?.id) ?? projectId,
    parentId: str(f?.parent_id ?? f?.parent?.id ?? f?.folder_id),
  };
}

export function normaliseVideo(f: any, projectId: string | null = null): AdiloVideo | null {
  const id = str(f?.id);
  if (!isAdiloId(id)) return null;
  const formatted = str(f?.duration_formatted ?? f?.duration_string);
  const seconds = parseDuration(f?.duration_seconds ?? f?.duration) ?? parseDuration(formatted);
  return {
    id,
    title: cleanText(f?.title ?? f?.name) || id,
    durationSeconds: seconds,
    durationFormatted: formatted || formatDuration(seconds),
    projectId: str(f?.project?.id ?? f?.project_id) ?? projectId,
    projectTitle: str(f?.project?.title) ? cleanText(f.project.title) : null,
    folderId: str(f?.folder_id ?? f?.folder?.id),
    createdAt: str(f?.created_at),
  };
}

/** Watch page for a file id — used only as the `url` argument of Adilo's oEmbed endpoint. */
export const adiloWatchPage = (fileId: string) => `${ADILO_PLAYER_ORIGIN}/watch/${encodeURIComponent(fileId)}`;

export const oembedRequestUrl = (fileId: string) => `${ADILO_OEMBED_ENDPOINT}?format=json&url=${encodeURIComponent(adiloWatchPage(fileId))}`;

/**
 * Player URL from Adilo's oEmbed response: the iframe `src` of the official embed code. Accepted only when it is
 * an https://adilo.bigcommand.com address that refers to the requested file id.
 */
export function embedUrlFromOembed(json: any, fileId: string): string | null {
  if (!json || typeof json !== 'object' || typeof json.html !== 'string' || !isAdiloId(fileId)) return null;
  const src = json.html.match(/<iframe[^>]*\ssrc\s*=\s*"([^"]+)"/i)?.[1] || json.html.match(/<iframe[^>]*\ssrc\s*=\s*'([^']+)'/i)?.[1];
  if (!src) return null;
  try {
    const u = new URL(src.replace(/&amp;/gi, '&').trim());
    if (u.protocol !== 'https:' || u.origin !== ADILO_PLAYER_ORIGIN || u.username || u.password) return null;
    const segments = u.pathname.split('/').filter(Boolean);
    if (!segments.includes(fileId)) return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

/** Video id inside an Adilo player link (watch / e / embed / video paths). */
export function adiloIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    if (u.origin !== ADILO_PLAYER_ORIGIN) return null;
    const id = u.pathname.replace(/\/+$/, '').match(/\/(?:watch|e|embed|video|videos)\/([A-Za-z0-9_-]+)$/i)?.[1];
    return id && isAdiloId(id) ? id : null;
  } catch {
    return null;
  }
}

/** Duplicate key shared with the CSV importer (`id:<video id>`). */
export const videoKey = (id: string) => `id:${id}`;

/** Keys + value types only (no values) — lets an admin confirm the live API shape without exposing data. */
export function shapeOf(value: unknown, depth = 0): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) return depth > 3 ? 'array' : value.length ? [shapeOf(value[0], depth + 1)] : [];
  if (typeof value === 'object') {
    if (depth > 3) return 'object';
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 60)) out[k] = shapeOf(v, depth + 1);
    return out;
  }
  return typeof value;
}

/* ------------------------------------------------------------------ title matching for bulk mapping */
const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'for', 'in', 'on', 'with', 'part', 'lesson', 'video', 'mp4', 'mov']);

/** "8.ENHANCING Attention-to-Detail.mp4" → ["enhancing", "attention", "detail"] (numbering and file extensions dropped). */
export function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.(mp4|mov|m4v|webm|mkv)$/i, '')
    .replace(/^\s*(?:lesson|video|part|module)?\s*\d+\s*[.):\-–]?\s*/i, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t && !STOP.has(t));
}

/** Similarity 0..1 (token overlap, Dice coefficient). */
export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(titleTokens(a));
  const tb = new Set(titleTokens(b));
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  ta.forEach((t) => {
    if (tb.has(t)) common++;
  });
  return (2 * common) / (ta.size + tb.size);
}

/**
 * Suggests one video per lesson by title similarity (best pairs first, each video used once).
 * Pairs scoring below `min` are left unmatched for the admin to choose.
 */
export function suggestMapping(lessons: { id: string; title: string }[], videos: { id: string; title: string }[], min = 0.6): Record<string, string> {
  const pairs: { l: string; v: string; s: number }[] = [];
  for (const l of lessons) for (const v of videos) {
    const s = titleSimilarity(l.title, v.title);
    if (s >= min) pairs.push({ l: l.id, v: v.id, s });
  }
  pairs.sort((x, y) => y.s - x.s);
  const out: Record<string, string> = {};
  const usedV = new Set<string>();
  for (const p of pairs) {
    if (out[p.l] || usedV.has(p.v)) continue;
    out[p.l] = p.v;
    usedV.add(p.v);
  }
  return out;
}

/** Lesson length in minutes for the curriculum (at least 1). */
export const lessonMinutes = (seconds: number | null): number | null => (seconds && seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : null);
