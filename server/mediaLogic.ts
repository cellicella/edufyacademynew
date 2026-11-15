/**
 * Image validation for the media library (pure, no I/O): detects the real file type from its bytes,
 * reads dimensions, and rejects unsafe SVG. Unit-tested in tests/settings.test.ts.
 */

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'image/svg+xml' | 'image/x-icon';
export interface ImageInfo { mime: ImageMime; ext: string; width: number | null; height: number | null }

export const ASSET_TYPES = ['website_banner', 'app_banner', 'course_thumbnail', 'bundle_image', 'blog_image', 'category_image', 'promo', 'logo', 'seo', 'other'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** Limits per asset type: max file size, minimum size, and whether SVG/ICO are allowed. */
export const ASSET_RULES: Record<AssetType, { maxBytes: number; minW: number; minH: number; maxW: number; maxH: number; svg: boolean; ico: boolean; hint: string }> = {
  website_banner: { maxBytes: 3_000_000, minW: 1200, minH: 300, maxW: 4000, maxH: 2000, svg: false, ico: false, hint: 'Desktop 1920×600 (min 1200×300); mobile version 1080×1080 or 1080×1350' },
  app_banner: { maxBytes: 2_000_000, minW: 640, minH: 300, maxW: 3000, maxH: 2000, svg: false, ico: false, hint: '1280×720 (16:9), min 640×360' },
  course_thumbnail: { maxBytes: 2_000_000, minW: 400, minH: 225, maxW: 3000, maxH: 2000, svg: false, ico: false, hint: '1280×720 (16:9)' },
  bundle_image: { maxBytes: 2_000_000, minW: 400, minH: 225, maxW: 3000, maxH: 2000, svg: false, ico: false, hint: '1280×720 (16:9)' },
  blog_image: { maxBytes: 3_000_000, minW: 600, minH: 300, maxW: 4000, maxH: 3000, svg: false, ico: false, hint: '1600×900' },
  category_image: { maxBytes: 1_500_000, minW: 200, minH: 200, maxW: 2000, maxH: 2000, svg: true, ico: false, hint: '800×600 or square' },
  promo: { maxBytes: 3_000_000, minW: 200, minH: 100, maxW: 4000, maxH: 4000, svg: false, ico: false, hint: 'Any size up to 4000 px' },
  logo: { maxBytes: 1_000_000, minW: 32, minH: 32, maxW: 2048, maxH: 2048, svg: true, ico: true, hint: 'Square PNG/SVG, 512×512 recommended (favicon 64×64+)' },
  seo: { maxBytes: 2_000_000, minW: 600, minH: 315, maxW: 2400, maxH: 1260, svg: false, ico: false, hint: '1200×630' },
  other: { maxBytes: 5_000_000, minW: 1, minH: 1, maxW: 6000, maxH: 6000, svg: false, ico: false, hint: 'Up to 6000 px' },
};

function u16be(b: Buffer, o: number) { return b.readUInt16BE(o); }
function u24le(b: Buffer, o: number) { return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16); }

/** Detects PNG/JPEG/WebP/GIF/ICO/SVG from the bytes (never trusts the file name or client MIME type). */
export function sniffImage(buf: Buffer): ImageInfo | null {
  if (buf.length < 12) return null;
  // PNG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    if (buf.length < 24) return null;
    return { mime: 'image/png', ext: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const marker = buf[o + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
      const len = u16be(buf, o + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { mime: 'image/jpeg', ext: 'jpg', width: u16be(buf, o + 7), height: u16be(buf, o + 5) };
      }
      o += 2 + len;
    }
    return { mime: 'image/jpeg', ext: 'jpg', width: null, height: null };
  }
  // GIF
  if (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return { mime: 'image/gif', ext: 'gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP' && buf.length >= 30) {
    const chunk = buf.subarray(12, 16).toString('ascii');
    if (chunk === 'VP8X') return { mime: 'image/webp', ext: 'webp', width: u24le(buf, 24) + 1, height: u24le(buf, 27) + 1 };
    if (chunk === 'VP8 ') return { mime: 'image/webp', ext: 'webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const b0 = buf[21], b1 = buf[22], b2 = buf[23], b3 = buf[24];
      return { mime: 'image/webp', ext: 'webp', width: 1 + (((b1 & 0x3f) << 8) | b0), height: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    return { mime: 'image/webp', ext: 'webp', width: null, height: null };
  }
  // ICO
  if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) {
    return { mime: 'image/x-icon', ext: 'ico', width: buf[6] || 256, height: buf[7] || 256 };
  }
  // SVG (text)
  const head = buf.subarray(0, Math.min(buf.length, 2048)).toString('utf8').replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    const text = buf.toString('utf8');
    const tag = text.match(/<svg[^>]*>/i)?.[0] || '';
    const num = (name: string) => {
      const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([0-9.]+)(px)?\\s*["']`, 'i'));
      return m ? Math.round(parseFloat(m[1])) : null;
    };
    let width = num('width');
    let height = num('height');
    const vb = tag.match(/viewBox\s*=\s*["']\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*["']/i);
    if ((!width || !height) && vb) {
      width = Math.round(parseFloat(vb[1]));
      height = Math.round(parseFloat(vb[2]));
    }
    return { mime: 'image/svg+xml', ext: 'svg', width, height };
  }
  return null;
}

/** Rejects SVG features that can run code or load external content. Returns an error message or null. */
export function svgProblem(text: string): string | null {
  const t = text.toLowerCase();
  if (/<script[\s>]/.test(t)) return 'SVG files with scripts are not allowed.';
  if (/<foreignobject[\s>]/.test(t)) return 'SVG files with embedded HTML (foreignObject) are not allowed.';
  if (/\son[a-z]+\s*=/.test(t)) return 'SVG files with event handlers (onload, onclick…) are not allowed.';
  if (/javascript:|vbscript:/.test(t)) return 'SVG files with javascript: links are not allowed.';
  if (/<!entity/.test(t)) return 'SVG files with XML entities are not allowed.';
  if (/(xlink:)?href\s*=\s*["']\s*(?!#|data:image\/(png|jpeg|gif|webp);base64,)/.test(t)) return 'SVG files may only reference their own elements (#id) or embedded images.';
  if (/<(iframe|embed|object|audio|video)[\s>]/.test(t)) return 'SVG files with embedded media are not allowed.';
  return null;
}

/** Full validation for an upload. */
export function validateUpload(buf: Buffer, assetType: AssetType): { ok: true; info: ImageInfo } | { ok: false; error: string } {
  const rules = ASSET_RULES[assetType] || ASSET_RULES.other;
  if (!buf.length) return { ok: false, error: 'The file is empty.' };
  if (buf.length > rules.maxBytes) return { ok: false, error: `The file is ${(buf.length / 1e6).toFixed(1)} MB; the limit for this image type is ${(rules.maxBytes / 1e6).toFixed(1)} MB.` };
  const info = sniffImage(buf);
  if (!info) return { ok: false, error: 'Unsupported file. Upload a PNG, JPG, WebP or GIF image (SVG for logos/icons).' };
  if (info.mime === 'image/svg+xml') {
    if (!rules.svg) return { ok: false, error: 'SVG is only allowed for logos, icons and category images.' };
    const problem = svgProblem(buf.toString('utf8'));
    if (problem) return { ok: false, error: problem };
    return { ok: true, info };
  }
  if (info.mime === 'image/x-icon') {
    if (!rules.ico) return { ok: false, error: 'ICO files are only allowed for the favicon (logo type).' };
    return { ok: true, info };
  }
  if (!info.width || !info.height) return { ok: false, error: 'Could not read the image size. Re-export the image and try again.' };
  if (info.width < rules.minW || info.height < rules.minH) {
    return { ok: false, error: `The image is ${info.width}×${info.height}px; at least ${rules.minW}×${rules.minH}px is needed (${rules.hint}).` };
  }
  if (info.width > rules.maxW || info.height > rules.maxH) {
    return { ok: false, error: `The image is ${info.width}×${info.height}px; the maximum is ${rules.maxW}×${rules.maxH}px. Resize it first.` };
  }
  return { ok: true, info };
}

/** Safe storage file name: lowercase, dashes, no path characters. */
export function safeFileStem(name: string): string {
  return (
    String(name || 'image')
      .replace(/\.[A-Za-z0-9]{1,5}$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image'
  );
}
