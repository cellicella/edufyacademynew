/**
 * Pure helpers for the Cloudinary image integration (no I/O): which database columns hold images,
 * which URLs the migration moves, folder names, and safe URL replacement inside HTML.
 * Unit-tested in tests/cloudinary.test.ts.
 */
import { isCloudinaryUrl, publicIdFromUrl } from './cloudinary';

export type ImageKind = 'course' | 'bundle' | 'blog' | 'category' | 'banner' | 'offer' | 'notification' | 'profile' | 'site' | 'other';

export const FOLDERS: Record<ImageKind, string> = {
  course: 'edufy/courses',
  bundle: 'edufy/bundles',
  blog: 'edufy/blog',
  category: 'edufy/categories',
  banner: 'edufy/banners',
  offer: 'edufy/offers',
  notification: 'edufy/notifications',
  profile: 'edufy/profiles',
  site: 'edufy/site',
  other: 'edufy/uploads',
};

export const folderFor = (kind: string | undefined | null): string => FOLDERS[(kind as ImageKind) in FOLDERS ? (kind as ImageKind) : 'other'];

/** Every column that stores a single image URL (all tables use the primary key "id"). */
export const IMAGE_COLUMNS: { table: string; column: string; kind: ImageKind }[] = [
  { table: 'courses', column: 'thumbnail_url', kind: 'course' },
  { table: 'courses', column: 'banner_url', kind: 'course' },
  { table: 'bundles', column: 'thumbnail_url', kind: 'bundle' },
  { table: 'blog_posts', column: 'cover_image_url', kind: 'blog' },
  { table: 'blog_posts', column: 'author_avatar_url', kind: 'blog' },
  { table: 'categories', column: 'image_url', kind: 'category' },
  { table: 'banners', column: 'image_url', kind: 'banner' },
  { table: 'banners', column: 'mobile_image_url', kind: 'banner' },
  { table: 'offers', column: 'image_url', kind: 'offer' },
  { table: 'profiles', column: 'avatar_url', kind: 'profile' },
  { table: 'push_notifications', column: 'image_url', kind: 'notification' },
  { table: 'user_notifications', column: 'image_url', kind: 'notification' },
  { table: 'media_assets', column: 'url', kind: 'site' },
];

/** Rich-text columns that may contain <img src="..."> (images inside are migrated too). */
export const HTML_COLUMNS: { table: string; column: string; kind: ImageKind }[] = [
  { table: 'blog_posts', column: 'content_html', kind: 'blog' },
  { table: 'courses', column: 'description', kind: 'course' },
  { table: 'lessons', column: 'content_text', kind: 'course' },
];

/** Hosts whose images are copied into Cloudinary (besides this project's Supabase Storage). */
export const EXTERNAL_IMAGE_HOSTS = ['images.unsplash.com', 'plus.unsplash.com'];

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg|ico)(\?|#|$)/i;
const NON_IMAGE_EXT = /\.(mp4|mov|m4v|webm|mp3|pdf|zip|docx?|pptx?|xlsx?)(\?|#|$)/i;

export type SkipReason = 'empty' | 'not_url' | 'already_cloudinary' | 'video_or_document' | 'adilo' | 'private_storage' | 'other_host';

/**
 * Decides whether an image URL is migrated: "supabase" (public Storage object of this project),
 * "external" (Unsplash), or a skip reason. Never touches Adilo, videos, documents or private files.
 */
export function migrationSource(url: unknown, supabaseUrl: string): { source: 'supabase' | 'external' } | { skip: SkipReason } {
  if (typeof url !== 'string' || !url.trim()) return { skip: 'empty' };
  const u = url.trim();
  if (!/^https?:\/\//i.test(u)) return { skip: 'not_url' };
  if (isCloudinaryUrl(u)) return { skip: 'already_cloudinary' };
  let host = '';
  let path = '';
  try {
    const parsed = new URL(u);
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname;
  } catch {
    return { skip: 'not_url' };
  }
  if (/(^|\.)adilo\.(bigcommand\.)?com$|bigcommand\.com$/i.test(host)) return { skip: 'adilo' };
  if (NON_IMAGE_EXT.test(path)) return { skip: 'video_or_document' };
  const base = supabaseUrl.replace(/\/+$/, '').toLowerCase();
  if (base && u.toLowerCase().startsWith(`${base}/storage/v1/`)) {
    if (!/\/storage\/v1\/object\/public\//i.test(u)) return { skip: 'private_storage' };
    if (/\/storage\/v1\/object\/public\/(course-videos|course-materials|certificates)\//i.test(u)) return { skip: 'video_or_document' };
    return { source: 'supabase' };
  }
  if (EXTERNAL_IMAGE_HOSTS.includes(host)) return { source: 'external' };
  if (IMAGE_EXT.test(path) && u.startsWith('https://')) return { skip: 'other_host' };
  return { skip: 'other_host' };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces exact image URLs inside src="..." / src='...' attributes; returns the new HTML and the count. */
export function replaceInHtml(html: string, map: Map<string, string>): { html: string; count: number } {
  if (!html || !map.size) return { html, count: 0 };
  let count = 0;
  let out = html;
  for (const [from, to] of map) {
    const re = new RegExp(`(\\ssrc\\s*=\\s*)(["'])${escapeRe(from)}\\2`, 'g');
    out = out.replace(re, (_m, pre, q) => {
      count++;
      return `${pre}${q}${to}${q}`;
    });
  }
  return { html: out, count };
}

/** Image URLs used in <img src="..."> of an HTML fragment. */
export function imageSrcs(html: string | null | undefined): string[] {
  if (!html) return [];
  const out: string[] = [];
  const re = /<img\b[^>]*?\ssrc\s*=\s*(["'])([^"']+)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[2]);
  return out;
}

/** public_ids of this account's Cloudinary images found anywhere in a block of text (settings JSON, HTML). */
export function cloudinaryIdsInText(text: string, cloudName: string): string[] {
  const ids: string[] = [];
  const re = new RegExp(`https://res\\.cloudinary\\.com/${escapeRe(cloudName)}/image/upload/[^"'\\s)<>\\\\]+`, 'gi');
  for (const m of text.match(re) || []) {
    const id = publicIdFromUrl(m);
    if (id) ids.push(id);
  }
  return ids;
}

/** Whether an unused asset may be deleted now (unused for at least `graceDays`). */
export function sweepDecision(asset: { unused_since: string | null }, referenced: boolean, now: number, graceDays = 7): 'keep' | 'mark_unused' | 'clear_unused' | 'delete' {
  if (referenced) return asset.unused_since ? 'clear_unused' : 'keep';
  if (!asset.unused_since) return 'mark_unused';
  return now - Date.parse(asset.unused_since) >= graceDays * 86_400_000 ? 'delete' : 'keep';
}
