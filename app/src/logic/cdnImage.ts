/**
 * Optimised image delivery through the Cloudinary CDN.
 *
 * Cloudinary images are stored with "f_auto,q_auto" (AVIF/WebP where the browser supports it, automatic
 * quality). These helpers add a width for the space the image fills, plus a srcSet for sharp images on
 * every screen. Any other URL (Unsplash, Supabase, local) is returned unchanged, so they are safe to use
 * everywhere. No secrets are involved: delivery URLs are public.
 */
const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i;

export const isCdnImage = (url: unknown): url is string => typeof url === 'string' && CLOUDINARY_UPLOAD.test(url);

/** "v123/<public_id>.<ext>" part of a delivery URL (transformations removed). */
function assetPath(rest: string): string {
  const parts = rest.split('?')[0].split('/');
  const v = parts.findIndex((p) => /^v\d+$/.test(p));
  if (v >= 0) return parts.slice(v).join('/');
  while (parts.length > 1 && /^([a-z]{1,3}_[^/,]+)(,[a-z]{1,3}_[^/,]+)*$/i.test(parts[0]) && (parts[0].includes(',') || /^(w|h|c|f|q|g|dpr|ar|e)_/i.test(parts[0]))) parts.shift();
  return parts.join('/');
}

export interface CdnOptions {
  /** Target height in px (with crop "fill" the image is cropped to width × height). */
  height?: number;
  /** "limit" (default) never upscales and keeps the aspect ratio; "fill" crops to the exact box. */
  crop?: 'limit' | 'fill';
}

/** Delivery URL sized for `width` CSS pixels (non-Cloudinary URLs pass through unchanged). */
export function cdnImage<T extends string | null | undefined>(url: T, width?: number, opts: CdnOptions = {}): T {
  if (!isCdnImage(url)) return url;
  const m = url.match(CLOUDINARY_UPLOAD)!;
  const t = ['f_auto', 'q_auto'];
  if (width || opts.height) {
    t.push(`c_${opts.crop || 'limit'}`);
    if (width) t.push(`w_${Math.round(width)}`);
    if (opts.height) t.push(`h_${Math.round(opts.height)}`);
    if (opts.crop === 'fill') t.push('g_auto');
  }
  return `${m[1]}${t.join(',')}/${assetPath(m[2])}` as T;
}

/** srcSet with several widths for responsive images (undefined for non-Cloudinary URLs). */
export function cdnSrcSet(url: string | null | undefined, widths: number[] = [320, 480, 640, 960, 1280], opts: Omit<CdnOptions, 'height'> = {}): string | undefined {
  if (!isCdnImage(url)) return undefined;
  return widths.map((w) => `${cdnImage(url, w, opts)} ${w}w`).join(', ');
}

/** Square, face-aware crop for profile pictures (2× for sharp display). */
export const cdnAvatar = <T extends string | null | undefined>(url: T, size: number): T =>
  cdnImage(url, size * 2, { height: size * 2, crop: 'fill' });
