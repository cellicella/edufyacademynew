/**
 * Cloudinary client for the Edufy API (server only). The API secret is read from the server
 * environment (CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>, or CLOUDINARY_CLOUD_NAME /
 * CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET) and never sent to the website or the app.
 *
 * Uses Cloudinary's signed REST API directly (no SDK dependency). Pure helpers are unit-tested in
 * tests/cloudinary.test.ts.
 */
import crypto from 'crypto';

export interface CloudinaryConfig { cloudName: string; apiKey: string; apiSecret: string }

export interface CloudinaryAsset {
  public_id: string;
  secure_url: string;
  version: number;
  format: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  resource_type: string;
}

/** Delivery transformation stored with every image URL: best format per browser (AVIF/WebP) and automatic quality. */
export const DEFAULT_DELIVERY = 'f_auto,q_auto';

const CLOUD_NAME_RE = /^[a-z0-9_-]{2,64}$/i;

/** Reads the configuration from the environment; null when Cloudinary is not configured. */
export function parseCloudinaryEnv(env: Record<string, string | undefined>): CloudinaryConfig | null {
  const url = (env.CLOUDINARY_URL || '').trim();
  if (url) {
    const m = url.match(/^cloudinary:\/\/([^:@/\s]+):([^@/\s]+)@([^/?#\s]+)\/?$/i);
    if (m && !/[<>]/.test(url) && CLOUD_NAME_RE.test(m[3])) return { apiKey: decodeURIComponent(m[1]), apiSecret: decodeURIComponent(m[2]), cloudName: m[3] };
  }
  const cloudName = (env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (env.CLOUDINARY_API_SECRET || '').trim();
  if (cloudName && apiKey && apiSecret && CLOUD_NAME_RE.test(cloudName)) return { cloudName, apiKey, apiSecret };
  return null;
}

/**
 * Cloudinary request signature: SHA-1 of the alphabetically sorted "key=value" pairs joined with "&",
 * followed by the API secret. file, cloud_name, resource_type and api_key are never signed.
 */
export function signParams(params: Record<string, string | number | boolean | undefined | null>, apiSecret: string): string {
  const skip = new Set(['file', 'cloud_name', 'resource_type', 'api_key', 'signature']);
  const toSign = Object.keys(params)
    .filter((k) => !skip.has(k) && params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

/** True for image URLs served from this Cloudinary account. */
export function isCloudinaryUrl(url: string | null | undefined, cloudName?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const m = url.match(/^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\//i);
  return !!m && (!cloudName || m[1].toLowerCase() === cloudName.toLowerCase());
}

/**
 * Extracts the public_id from a delivery URL:
 * https://res.cloudinary.com/<cloud>/image/upload/[transformations/][v123/]<public_id>.<ext>
 */
export function publicIdFromUrl(url: string): string | null {
  const rest = assetPath(url);
  if (!rest) return null;
  const parts = rest.split('/');
  if (parts.length > 1 && /^v\d+$/.test(parts[0])) parts.shift();
  const last = parts.length - 1;
  parts[last] = parts[last].replace(/\.[a-z0-9]+$/i, '');
  const id = parts.join('/');
  return id || null;
}

/** "v123/<public_id>.<ext>" (or "<public_id>.<ext>") of a delivery URL, without transformations or query. */
function assetPath(url: string): string | null {
  const m = String(url || '').match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(.+)$/i);
  if (!m) return null;
  const parts = m[1].split('?')[0].split('/');
  // The version segment marks where the asset starts; every URL Cloudinary returns has one.
  const v = parts.findIndex((p) => /^v\d+$/.test(p));
  if (v >= 0) return parts.slice(v).join('/');
  // No version: drop leading transformation segments ("f_auto,q_auto", "w_640", "c_limit,w_640")
  while (parts.length > 1 && /^([a-z]{1,3}_[^/,]+)(,[a-z]{1,3}_[^/,]+)*$/i.test(parts[0]) && (parts[0].includes(',') || /^(w|h|c|f|q|g|dpr|ar|e)_/i.test(parts[0]))) parts.shift();
  return parts.join('/');
}

/**
 * Delivery URL with the given transformation (replaces any existing one). Non-Cloudinary URLs are
 * returned unchanged, so callers can use it for every image.
 */
export function deliveryUrl(url: string, transformation = DEFAULT_DELIVERY): string {
  if (!isCloudinaryUrl(url)) return url;
  const prefix = url.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//i)![0];
  const rest = assetPath(url)!;
  return `${prefix}${transformation ? `${transformation}/` : ''}${rest}`;
}

export type CloudinaryClient = ReturnType<typeof createCloudinaryClient>;

export function createCloudinaryClient(cfg: CloudinaryConfig, fetchImpl: typeof fetch = fetch) {
  const base = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image`;

  async function post(action: 'upload' | 'destroy', params: Record<string, string>, file?: Blob | string) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = { ...params, timestamp };
    const form = new FormData();
    if (file !== undefined) form.append('file', file as any);
    for (const [k, v] of Object.entries(signed)) form.append(k, v);
    form.append('api_key', cfg.apiKey);
    form.append('signature', signParams(signed, cfg.apiSecret));
    const res = await fetchImpl(`${base}/${action}`, { method: 'POST', body: form });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    if (!res.ok || json?.error) {
      const msg = json?.error?.message || `HTTP ${res.status}`;
      throw new Error(`Cloudinary ${action} failed: ${msg}`);
    }
    return json;
  }

  return {
    cloudName: cfg.cloudName,

    /**
     * Uploads an image. `source` is the file bytes, or a public http(s) URL that Cloudinary downloads
     * itself (used by the migration, so nothing passes through the API server).
     */
    async upload(source: Buffer | string, opts: { folder: string; mime?: string; publicId?: string; tags?: string[] }): Promise<CloudinaryAsset> {
      const params: Record<string, string> = { folder: opts.folder, overwrite: 'false', unique_filename: 'true' };
      if (opts.publicId) params.public_id = opts.publicId;
      if (opts.tags?.length) params.tags = opts.tags.join(',');
      const file = typeof source === 'string' ? source : new Blob([new Uint8Array(source)], { type: opts.mime || 'application/octet-stream' });
      const r = await post('upload', params, file);
      return {
        public_id: r.public_id,
        secure_url: r.secure_url,
        version: Number(r.version) || 0,
        format: r.format,
        width: Number(r.width) || null,
        height: Number(r.height) || null,
        bytes: Number(r.bytes) || null,
        resource_type: r.resource_type || 'image',
      };
    },

    /** Deletes an image (and invalidates CDN copies). Resolves "ok" or "not found". */
    async destroy(publicId: string): Promise<string> {
      const r = await post('destroy', { public_id: publicId, invalidate: 'true' });
      return String(r?.result || 'ok');
    },
  };
}
