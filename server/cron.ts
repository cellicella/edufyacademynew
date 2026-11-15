/**
 * Scheduled processing endpoint for hosts without always-on background workers (Hostinger Node.js apps).
 * GET /api/internal/cron?key=<CRON_SECRET>  (or header x-cron-key). Runs each task once; never overlaps.
 */
import crypto from 'crypto';
import type { Request, Response } from 'express';

export const sameSecret = (a: string, b: string) =>
  crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());

export function createCronHandler(getSecret: () => string, tasks: Record<string, () => Promise<string | void>>) {
  let running = false;
  return async (req: Request, res: Response) => {
    const secret = getSecret();
    if (!secret || secret.length < 32) return res.status(503).json({ error: 'CRON_SECRET (32+ characters) is not configured on the server.' });
    const key = String(req.query?.key || req.headers?.['x-cron-key'] || '');
    if (!key || !sameSecret(key, secret)) return res.status(401).json({ error: 'Unauthorized' });
    if (running) return res.json({ ok: true, skipped: 'previous run still in progress' });
    running = true;
    const started = Date.now();
    const result: Record<string, string> = {};
    try {
      for (const [name, run] of Object.entries(tasks)) {
        try {
          result[name] = (await run()) || 'ok';
        } catch (e: any) {
          result[name] = `error: ${String(e?.message || e).slice(0, 200)}`;
        }
      }
    } finally {
      running = false;
    }
    return res.json({ ok: true, ms: Date.now() - started, ...result });
  };
}
