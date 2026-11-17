/**
 * Cloudinary image service: uploads (admin pages, media library, profile pictures), the asset registry
 * (image_assets: secure_url + public_id), migration of existing images with rollback, and the cleanup of
 * images that are no longer used anywhere (after a 7-day grace period).
 *
 * The Cloudinary API secret stays in the server environment. When Cloudinary is not configured every
 * caller keeps using the previous Supabase Storage behaviour, so nothing breaks.
 */
import type { Express, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createCloudinaryClient, deliveryUrl, isCloudinaryUrl, parseCloudinaryEnv, publicIdFromUrl, DEFAULT_DELIVERY, type CloudinaryAsset } from './cloudinary';
import { cloudinaryIdsInText, folderFor, HTML_COLUMNS, IMAGE_COLUMNS, imageSrcs, migrationSource, replaceInHtml, sweepDecision, type ImageKind, type SkipReason } from './imageLogic';
import { sniffImage, svgProblem, type ImageInfo } from './mediaLogic';

export const MAX_CLOUDINARY_BYTES = 10 * 1024 * 1024; // Cloudinary image limit on the free plan

export class ImageHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface Deps {
  db: SupabaseClient | null;
  env: Record<string, string | undefined>;
  supabaseUrl: string;
  getAuthUserProfile: (req: Request) => Promise<{ user: any; profile: any } | null>;
}

type Ref = { table: string; column: string; id: string; value?: string };

const shortUrl = (u: string) => (u.length > 120 ? `${u.slice(0, 80)}…${u.slice(-30)}` : u);

export type ImageService = ReturnType<typeof createImageService>;

export function createImageService(deps: Deps) {
  const cfg = parseCloudinaryEnv(deps.env);
  const client = cfg ? createCloudinaryClient(cfg) : null;
  const db = deps.db;
  let settingsReplacer: ((from: string, to: string) => Promise<number>) | null = null;

  const configured = () => !!(client && db);

  /** URL saved in content columns: the secure_url delivered with automatic format (AVIF/WebP) and quality. */
  const storeUrl = (a: { secure_url: string }) => deliveryUrl(a.secure_url, DEFAULT_DELIVERY);

  function checkImage(buf: Buffer): ImageInfo {
    const info = sniffImage(buf);
    if (!info) throw new ImageHttpError(400, 'Only PNG, JPEG, WebP, GIF, SVG or ICO images can be uploaded.');
    if (info.mime === 'image/svg+xml') {
      const p = svgProblem(buf.toString('utf8'));
      if (p) throw new ImageHttpError(400, p);
    }
    if (buf.length > MAX_CLOUDINARY_BYTES) throw new ImageHttpError(413, 'Images can be at most 10 MB.');
    return info;
  }

  async function register(a: CloudinaryAsset, meta: { folder: string; source: string; uploadedBy?: string | null; originalUrl?: string | null }) {
    const row = {
      public_id: a.public_id, secure_url: a.secure_url, format: a.format || null, width: a.width, height: a.height, bytes: a.bytes,
      folder: meta.folder, source: meta.source, original_url: meta.originalUrl || null, uploaded_by: meta.uploadedBy || null,
    };
    const { data, error } = await db!.from('image_assets').insert(row).select('*').single();
    if (error) {
      // Not recorded → remove it again so no untracked file stays in Cloudinary
      await client!.destroy(a.public_id).catch(() => undefined);
      throw new ImageHttpError(500, `Could not record the image: ${error.message}`);
    }
    return data;
  }

  /** Validates and uploads image bytes; returns the URL to store and the Cloudinary public_id. */
  async function uploadBuffer(buf: Buffer, opts: { kind?: ImageKind | string; source: 'upload' | 'media_library' | 'avatar'; userId?: string | null }) {
    if (!configured()) throw new ImageHttpError(503, 'Cloudinary is not configured on the server.');
    const info = checkImage(buf);
    const folder = folderFor(opts.kind);
    const a = await client!.upload(buf, { folder, mime: info.mime, tags: ['edufy', opts.source] });
    await register(a, { folder, source: opts.source, uploadedBy: opts.userId });
    return { url: storeUrl(a), publicId: a.public_id, width: a.width, height: a.height, bytes: a.bytes, info };
  }

  /** Deletes an image from Cloudinary and marks it deleted in the registry. */
  async function destroyPublicId(publicId: string) {
    if (!client || !publicId) return false;
    await client.destroy(publicId);
    if (db) await db.from('image_assets').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('public_id', publicId);
    return true;
  }

  // ------------------------------------------------------------------ references
  async function scanReferences() {
    const refs = new Map<string, Ref[]>();
    const htmlRows: Ref[] = [];
    const errors: string[] = [];
    const add = (url: string, ref: Ref) => refs.set(url, [...(refs.get(url) || []), ref]);
    for (const c of IMAGE_COLUMNS) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db!.from(c.table).select(`id, ${c.column}`).not(c.column, 'is', null).range(from, from + 999);
        if (error) {
          errors.push(`${c.table}.${c.column}: ${error.message}`);
          break;
        }
        for (const r of (data || []) as any[]) {
          const v = r[c.column];
          if (typeof v === 'string' && v.trim()) add(v, { table: c.table, column: c.column, id: r.id });
        }
        if (!data || data.length < 1000) break;
      }
    }
    for (const c of HTML_COLUMNS) {
      const { data, error } = await db!.from(c.table).select(`id, ${c.column}`).ilike(c.column, '%<img%').limit(5000);
      if (error) {
        errors.push(`${c.table}.${c.column}: ${error.message}`);
        continue;
      }
      for (const r of (data || []) as any[]) htmlRows.push({ table: c.table, column: c.column, id: r.id, value: r[c.column] || '' });
    }
    const { data: settingsRows, error: sErr } = await db!.from('site_settings').select('section, value');
    if (sErr) errors.push(`site_settings: ${sErr.message}`);
    // platform_settings is only read (so the clean-up never deletes an image used there), not migrated
    const { data: platformRows } = await db!.from('platform_settings').select('key, value');
    const settingsText = JSON.stringify(settingsRows || []);
    const otherText = JSON.stringify(platformRows || []);
    return { refs, htmlRows, settingsText, otherText, errors };
  }

  const kindOf = (table: string, column: string): ImageKind =>
    (IMAGE_COLUMNS.find((c) => c.table === table && c.column === column) || HTML_COLUMNS.find((c) => c.table === table && c.column === column))?.kind || 'other';

  // ------------------------------------------------------------------ cleanup of unused images
  async function sweep(graceDays = 7): Promise<string> {
    if (!configured()) return 'not configured';
    const scan = await scanReferences();
    if (scan.errors.length) return `skipped (could not read: ${scan.errors[0]})`;
    const used = new Set<string>();
    const note = (u: string) => {
      if (isCloudinaryUrl(u, cfg!.cloudName)) {
        const id = publicIdFromUrl(u);
        if (id) used.add(id);
      }
    };
    for (const u of scan.refs.keys()) note(u);
    for (const r of scan.htmlRows) imageSrcs(r.value).forEach(note);
    for (const id of cloudinaryIdsInText(scan.settingsText + scan.otherText, cfg!.cloudName)) used.add(id);
    const { data: assets, error } = await db!.from('image_assets').select('id, public_id, unused_since').eq('status', 'active').limit(5000);
    if (error) return `skipped (${error.message})`;
    let marked = 0, cleared = 0, deleted = 0;
    const now = Date.now();
    for (const a of (assets || []) as any[]) {
      const d = sweepDecision(a, used.has(a.public_id), now, graceDays);
      if (d === 'mark_unused') {
        await db!.from('image_assets').update({ unused_since: new Date(now).toISOString() }).eq('id', a.id);
        marked++;
      } else if (d === 'clear_unused') {
        await db!.from('image_assets').update({ unused_since: null }).eq('id', a.id);
        cleared++;
      } else if (d === 'delete' && deleted < 20) {
        try {
          await destroyPublicId(a.public_id);
          deleted++;
        } catch {
          /* retried on the next run */
        }
      }
    }
    return `ok (unused ${marked}, back in use ${cleared}, deleted ${deleted})`;
  }

  // ------------------------------------------------------------------ migration
  async function existingMigrations(urls: string[]) {
    const map = new Map<string, { url: string; publicId: string }>();
    for (let i = 0; i < urls.length; i += 100) {
      const { data } = await db!.from('image_assets').select('public_id, secure_url, original_url').eq('source', 'migration').eq('status', 'active').in('original_url', urls.slice(i, i + 100));
      for (const r of (data || []) as any[]) map.set(r.original_url, { url: storeUrl(r), publicId: r.public_id });
    }
    return map;
  }

  async function saveRun(kind: 'dry_run' | 'migrate' | 'rollback', userId: string | null, report: any) {
    await db!.from('image_migration_runs').insert({ kind, started_by: userId, report });
  }

  async function migrate(opts: { dryRun: boolean; limit: number; userId: string | null }) {
    if (!db) throw new ImageHttpError(503, 'Database not configured.');
    const scan = await scanReferences();
    if (scan.errors.length) throw new ImageHttpError(500, `Could not read all image columns: ${scan.errors.join('; ')}`);

    type Cand = { source: 'supabase' | 'external'; kind: ImageKind; refs: number; html: number; settings: number };
    const cands = new Map<string, Cand>();
    const skipped: Partial<Record<SkipReason, number>> = {};
    const consider = (url: string, kind: ImageKind, field: 'refs' | 'html' | 'settings', n = 1) => {
      const d = migrationSource(url, deps.supabaseUrl);
      if ('skip' in d) {
        skipped[d.skip] = (skipped[d.skip] || 0) + n;
        return;
      }
      const c = cands.get(url) || { source: d.source, kind, refs: 0, html: 0, settings: 0 };
      c[field] += n;
      cands.set(url, c);
    };
    for (const [url, refs] of scan.refs) consider(url, kindOf(refs[0].table, refs[0].column), 'refs', refs.length);
    for (const r of scan.htmlRows) for (const u of imageSrcs(r.value)) consider(u, kindOf(r.table, r.column), 'html');
    for (const u of scan.settingsText.match(/https?:\/\/[^"\\\s]+/g) || []) {
      if (/\.(png|jpe?g|webp|gif|svg|ico)(\?|$)|\/storage\/v1\/object\/public\//i.test(u)) consider(u, 'site', 'settings');
    }

    const mapping = await existingMigrations([...cands.keys()]);
    const todo = [...cands.keys()].filter((u) => !mapping.has(u));
    const references: Record<string, number> = {};
    for (const [url, refs] of scan.refs) if (cands.has(url)) for (const r of refs) references[`${r.table}.${r.column}`] = (references[`${r.table}.${r.column}`] || 0) + 1;
    const summary = {
      cloudinaryConfigured: configured(),
      cloudName: cfg?.cloudName || null,
      distinctImages: cands.size,
      alreadyInCloudinary: mapping.size,
      toUpload: todo.length,
      bySource: {
        supabase: [...cands.values()].filter((c) => c.source === 'supabase').length,
        external: [...cands.values()].filter((c) => c.source === 'external').length,
      },
      references,
      inlineHtmlImages: [...cands.values()].reduce((n, c) => n + c.html, 0),
      settingsImages: [...cands.values()].reduce((n, c) => n + c.settings, 0),
      skipped,
    };

    if (opts.dryRun) {
      const report = {
        dryRun: true,
        ...summary,
        items: [...cands.entries()].map(([url, c]) => ({ url: shortUrl(url), source: c.source, folder: folderFor(c.kind), references: c.refs + c.html + c.settings, status: mapping.has(url) ? 'in_cloudinary' : 'pending' })),
      };
      await saveRun('dry_run', opts.userId, report);
      return report;
    }

    if (!configured()) throw new ImageHttpError(503, 'Cloudinary is not configured on the server (CLOUDINARY_URL).');
    const uploaded: string[] = [];
    const failed: { url: string; error: string }[] = [];
    for (const url of todo.slice(0, Math.max(1, Math.min(opts.limit, 25)))) {
      const c = cands.get(url)!;
      const folder = folderFor(c.kind);
      try {
        // Cloudinary downloads the original itself; the original file is left untouched
        const a = await client!.upload(url, { folder, tags: ['edufy', 'migration'] });
        const check = await fetch(storeUrl(a), { method: 'HEAD' });
        if (!check.ok) {
          await client!.destroy(a.public_id).catch(() => undefined);
          throw new Error(`CDN check returned HTTP ${check.status}`);
        }
        await register(a, { folder, source: 'migration', originalUrl: url, uploadedBy: opts.userId });
        mapping.set(url, { url: storeUrl(a), publicId: a.public_id });
        uploaded.push(shortUrl(url));
      } catch (e: any) {
        failed.push({ url: shortUrl(url), error: String(e?.message || e).slice(0, 300) });
      }
    }

    // Repoint references (exact-match guarded) for every image that is in Cloudinary
    const updated: Record<string, number> = {};
    for (const [url, refs] of scan.refs) {
      const m = mapping.get(url);
      if (!m) continue;
      for (const r of refs) {
        const patch: Record<string, unknown> = { [r.column]: m.url };
        if (r.table === 'media_assets') Object.assign(patch, { provider: 'cloudinary', public_id: m.publicId });
        const { data, error } = await db!.from(r.table).update(patch).eq('id', r.id).eq(r.column, url).select('id');
        if (error) failed.push({ url: shortUrl(url), error: `${r.table}.${r.column}: ${error.message}` });
        else if (data?.length) updated[`${r.table}.${r.column}`] = (updated[`${r.table}.${r.column}`] || 0) + data.length;
      }
    }
    const urlMap = new Map([...mapping.entries()].map(([from, m]) => [from, m.url]));
    for (const r of scan.htmlRows) {
      const next = replaceInHtml(r.value || '', urlMap);
      if (!next.count) continue;
      const { data, error } = await db!.from(r.table).update({ [r.column]: next.html }).eq('id', r.id).eq(r.column, r.value!).select('id');
      if (error) failed.push({ url: `${r.table} ${r.id}`, error: error.message });
      else if (data?.length) updated[`${r.table}.${r.column} (inline)`] = (updated[`${r.table}.${r.column} (inline)`] || 0) + next.count;
    }
    if (settingsReplacer) {
      for (const [url, c] of cands) {
        const m = mapping.get(url);
        if (m && c.settings) {
          const n = await settingsReplacer(url, m.url);
          if (n) updated['site_settings'] = (updated['site_settings'] || 0) + n;
        }
      }
    }

    const report = {
      dryRun: false,
      ...summary,
      alreadyInCloudinary: mapping.size,
      toUpload: cands.size - mapping.size,
      uploadedNow: uploaded.length,
      failedNow: failed.length,
      uploaded,
      failures: failed,
      referencesUpdated: updated,
      done: cands.size === mapping.size && failed.length === 0,
    };
    await saveRun('migrate', opts.userId, report);
    return report;
  }

  /** Points every migrated reference back at its original URL (the original files were never deleted). */
  async function rollback(userId: string | null) {
    if (!db) throw new ImageHttpError(503, 'Database not configured.');
    const { data: rows, error } = await db.from('image_assets').select('public_id, secure_url, original_url').eq('source', 'migration').eq('status', 'active').not('original_url', 'is', null);
    if (error) throw new ImageHttpError(500, error.message);
    const back = new Map<string, string>();
    for (const r of (rows || []) as any[]) {
      back.set(storeUrl(r), r.original_url);
      back.set(r.secure_url, r.original_url);
    }
    const reverted: Record<string, number> = {};
    for (const c of IMAGE_COLUMNS) {
      for (const [to, from] of back) {
        const patch: Record<string, unknown> = { [c.column]: from };
        if (c.table === 'media_assets') Object.assign(patch, { provider: 'supabase', public_id: null });
        const { data } = await db.from(c.table).update(patch).eq(c.column, to).select('id');
        if (data?.length) reverted[`${c.table}.${c.column}`] = (reverted[`${c.table}.${c.column}`] || 0) + data.length;
      }
    }
    for (const c of HTML_COLUMNS) {
      const { data } = await db.from(c.table).select(`id, ${c.column}`).ilike(c.column, '%res.cloudinary.com%').limit(5000);
      for (const r of (data || []) as any[]) {
        const next = replaceInHtml(r[c.column] || '', back);
        if (next.count) {
          await db.from(c.table).update({ [c.column]: next.html }).eq('id', r.id).eq(c.column, r[c.column]);
          reverted[`${c.table}.${c.column} (inline)`] = (reverted[`${c.table}.${c.column} (inline)`] || 0) + next.count;
        }
      }
    }
    if (settingsReplacer) for (const [to, from] of back) {
      const n = await settingsReplacer(to, from);
      if (n) reverted['site_settings'] = (reverted['site_settings'] || 0) + n;
    }
    const report = { reverted, note: 'Cloudinary copies are kept; unused ones are removed automatically after 7 days.' };
    await saveRun('rollback', userId, report);
    return report;
  }

  async function status() {
    const counts: Record<string, number> = {};
    let lastRun: any = null;
    if (db) {
      const { data } = await db.from('image_assets').select('source, status').limit(10000);
      for (const r of (data || []) as any[]) counts[`${r.source}:${r.status}`] = (counts[`${r.source}:${r.status}`] || 0) + 1;
      const { data: run } = await db.from('image_migration_runs').select('kind, report, created_at').order('created_at', { ascending: false }).limit(1).maybeSingle();
      lastRun = run || null;
    }
    return { configured: configured(), cloudName: cfg?.cloudName || null, assets: counts, lastRun };
  }

  // ------------------------------------------------------------------ routes
  const hits = new Map<string, number[]>();
  function rateLimit(key: string, max: number) {
    const now = Date.now();
    const list = (hits.get(key) || []).filter((t) => now - t < 60_000);
    if (list.length >= max) throw new ImageHttpError(429, 'Too many uploads. Please wait a minute.');
    list.push(now);
    hits.set(key, list);
  }

  function decode(body: any): Buffer {
    const raw = typeof body?.fileBase64 === 'string' ? body.fileBase64.replace(/^data:[^;]+;base64,/, '') : '';
    if (!raw) throw new ImageHttpError(400, 'No file received.');
    if (raw.length > Math.ceil((MAX_CLOUDINARY_BYTES * 4) / 3) + 16) throw new ImageHttpError(413, 'Images can be at most 10 MB.');
    return Buffer.from(raw, 'base64');
  }

  const handle = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      const status = e instanceof ImageHttpError ? e.status : 500;
      if (status >= 500) console.error('[Images]', e?.message || e);
      res.status(status).json({ error: e?.message || 'Image request failed.' });
    }
  };

  async function requireAdmin(req: Request) {
    const auth = await deps.getAuthUserProfile(req);
    if (!auth?.user) throw new ImageHttpError(401, 'Please sign in.');
    if (auth.profile?.role !== 'admin') throw new ImageHttpError(403, 'Only administrators can do this.');
    return auth;
  }

  function registerRoutes(app: Express) {
    app.get('/api/admin/images/status', handle(async (req, res) => {
      await requireAdmin(req);
      res.json(await status());
    }));

    app.post('/api/admin/images/migrate', handle(async (req, res) => {
      const auth = await requireAdmin(req);
      const dryRun = req.body?.dryRun !== false;
      const limit = Number(req.body?.limit) || 5;
      res.json(await migrate({ dryRun, limit, userId: auth.user.id }));
    }));

    app.post('/api/admin/images/rollback', handle(async (req, res) => {
      const auth = await requireAdmin(req);
      if (req.body?.confirm !== 'ROLLBACK') throw new ImageHttpError(400, 'Send {"confirm":"ROLLBACK"} to restore the original image addresses.');
      res.json(await rollback(auth.user.id));
    }));

    /** Profile picture for the signed-in user (website or app). Replaces and deletes the previous one. */
    app.post('/api/me/avatar', handle(async (req, res) => {
      const auth = await deps.getAuthUserProfile(req);
      if (!auth?.user) throw new ImageHttpError(401, 'Please sign in.');
      if (!configured()) throw new ImageHttpError(503, 'Cloudinary is not configured on the server.');
      rateLimit(`avatar:${auth.user.id}`, 10);
      const up = await uploadBuffer(decode(req.body), { kind: 'profile', source: 'avatar', userId: auth.user.id });
      const previous: string | null = auth.profile?.avatar_url || null;
      const { error } = await db!.from('profiles').update({ avatar_url: up.url, updated_at: new Date().toISOString() }).eq('id', auth.user.id);
      if (error) {
        await destroyPublicId(up.publicId).catch(() => undefined);
        throw new ImageHttpError(500, `Could not save the profile picture: ${error.message}`);
      }
      // The old picture belonged only to this profile: delete it now if it was this user's Cloudinary avatar
      if (previous && isCloudinaryUrl(previous, cfg!.cloudName)) {
        const oldId = publicIdFromUrl(previous);
        if (oldId) {
          const { data: old } = await db!.from('image_assets').select('public_id').eq('public_id', oldId).eq('source', 'avatar').eq('uploaded_by', auth.user.id).eq('status', 'active').maybeSingle();
          if (old) await destroyPublicId(oldId).catch(() => undefined);
        }
      }
      res.json({ url: up.url });
    }));
  }

  return {
    configured,
    cloudName: () => cfg?.cloudName || null,
    storeUrl,
    uploadBuffer,
    destroyPublicId,
    sweep,
    migrate,
    rollback,
    status,
    registerRoutes,
    /** Lets the settings module repoint image URLs stored in site settings (validated there). */
    setSettingsReplacer(fn: (from: string, to: string) => Promise<number>) {
      settingsReplacer = fn;
    },
  };
}
