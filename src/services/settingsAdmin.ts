/* Admin client for Settings & Configuration (all writes go through the Express server, which validates,
   encrypts credentials and writes the audit log). */
import { API_BASE_URL } from './api';
import { getAuthToken } from '../lib/supabase';
import { readJson } from '../lib/http';

export class SettingsApiError extends Error {
  constructor(message: string, public status: number, public errors?: Record<string, string>, public extra?: any) {
    super(message);
  }
}

async function call<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getAuthToken();
  if (!token) throw new SettingsApiError('Please sign in again.', 401);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', accept: 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await readJson<any>(res);
  if (!res.ok) throw new SettingsApiError(data?.error || `Request failed (${res.status})`, res.status, data?.errors, data);
  return data as T;
}

export type Section =
  | 'general' | 'branding' | 'contact' | 'social' | 'payment' | 'whatsapp' | 'email' | 'seo' | 'app' | 'notifications' | 'maintenance' | 'auth' | 'domain';

export type CredProvider = 'razorpay' | 'email' | 'emovur' | 'google' | 'auth_hook';

export interface CredentialView {
  active: { publicConfig: Record<string, string>; hints: Record<string, string>; status: string; verifiedAt: string | null; lastError: string | null; updatedAt: string | null } | null;
  pending: CredentialView['active'];
  inUse: Record<string, any> | null;
  env: Record<string, any>;
}

export interface AdminSettingsResponse {
  settings: Record<string, any>;
  defaults: Record<string, any>;
  meta: Record<string, { updatedAt: string; version: number } | null>;
  access: { superAdmin: boolean; sections: string[] };
  credentials: { razorpay?: CredentialView; email?: CredentialView; emovur?: CredentialView; google?: CredentialView; auth_hook?: CredentialView };
  canEncrypt: boolean;
  migrationMissing: boolean;
  lastWebhook: { at: string; event: string } | null;
}

export interface EmailTemplateInfo { id: string; label: string; group: string; trigger: string; vars: string[]; required: string[]; authHook: boolean; defaultSubject: string; defaultHtml: string }

export interface EmailLogEntry {
  id: string; event_key: string; template: string; to_email: string; status: 'queued' | 'sending' | 'sent' | 'failed' | 'skipped' | 'cancelled';
  attempts: number; max_attempts: number; next_attempt_at: string; provider: string | null; provider_response: string | null; last_error: string | null;
  created_at: string; updated_at: string; sent_at: string | null;
}
export interface EmailLogResponse { entries: EmailLogEntry[]; counts: Record<string, number>; worker: { lastRunAt: string | null; lastError: string | null }; provider: string | null }

export type AuthCheckStatus = 'configured' | 'supabase_manual' | 'google_console' | 'deploy' | 'missing';
export interface AuthStatus {
  environment: string;
  urls: Record<string, string>;
  callbackUrl: string;
  hookUrl: string;
  requiredRedirects: string[];
  management: { enabled: boolean; ref: string | null; error: string | null };
  supabase: Record<string, any> | null;
  checks: { id: string; label: string; status: AuthCheckStatus; detail: string; value?: string }[];
  nodeEnv: string;
}

export interface TestStep { id: string; label: string; status: 'pass' | 'fail' | 'warn' | 'manual'; detail: string }

export interface MediaItem {
  id: string; url: string; path: string; asset_type: string; file_name: string | null; mime_type: string; size_bytes: number;
  width: number | null; height: number | null; alt_text: string | null; created_at: string; updated_at: string; usages: string[];
}

export const settingsAdmin = {
  load: () => call<AdminSettingsResponse>('/admin/settings'),
  save: (section: Section, value: unknown) => call<{ ok: boolean; value: any; unchanged?: boolean; changed?: string[] }>(`/admin/settings/${section}`, { method: 'PUT', body: { value } }),
  audit: (o: { section?: string; before?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (o.section) q.set('section', o.section);
    if (o.before) q.set('before', String(o.before));
    q.set('limit', String(o.limit || 50));
    return call<{ entries: any[] }>(`/admin/settings/audit?${q}`);
  },
  credentials: {
    get: (p: CredProvider) => call<CredentialView>(`/admin/settings/credentials/${p}`),
    save: (p: CredProvider, body: Record<string, unknown>) => call<{ ok: boolean; hints: Record<string, string> }>(`/admin/settings/credentials/${p}`, { method: 'POST', body }),
    test: (p: CredProvider, slot: 'pending' | 'active', extra: Record<string, unknown> = {}) =>
      call<{ ok: boolean; steps: TestStep[] }>(`/admin/settings/credentials/${p}/test`, { method: 'POST', body: { slot, ...extra } }),
    activate: (p: CredProvider, password?: string) => call<{ ok: boolean; view: CredentialView }>(`/admin/settings/credentials/${p}/activate`, { method: 'POST', body: { password } }),
    discard: (p: CredProvider, slot: 'pending' | 'active', password?: string) =>
      call<{ ok: boolean; view: CredentialView }>(`/admin/settings/credentials/${p}?slot=${slot}`, { method: 'DELETE', body: { password } }),
  },
  email: {
    preview: (templateId: string, template?: { subject: string; html: string }) =>
      call<{ subject: string; html: string; text: string; missing: string[] }>('/admin/email/preview', { method: 'POST', body: { templateId, template } }),
    test: (to: string) => call<{ ok: boolean; message: string; steps: TestStep[] }>('/admin/email/test', { method: 'POST', body: { to } }),
    templates: () => call<{ templates: EmailTemplateInfo[] }>('/admin/email/templates'),
    restore: (id: string) => call<{ ok: boolean; value: any }>(`/admin/email/templates/${id}/restore`, { method: 'POST' }),
    logs: (o: { status?: string; template?: string; q?: string; before?: string; limit?: number } = {}) => {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(o)) if (v) q.set(k, String(v));
      return call<EmailLogResponse>(`/admin/email/logs?${q}`);
    },
    retry: (id: string) => call<{ ok: boolean }>(`/admin/email/logs/${id}/retry`, { method: 'POST' }),
    retryFailed: () => call<{ ok: boolean; count: number }>('/admin/email/logs/retry-failed', { method: 'POST' }),
    announcement: (body: { title: string; body: string; audience: 'all_students' | 'enrolled'; confirm?: boolean }) =>
      call<{ ok: boolean; needsConfirmation?: boolean; recipients?: number; queued?: number }>('/admin/email/announcement', { method: 'POST', body }),
  },
  auth: {
    status: () => call<AuthStatus>('/admin/auth/status'),
    apply: (password: string, apply: { siteUrl?: boolean; redirects?: boolean; google?: boolean; emailHook?: boolean; disableEmailHook?: boolean }) =>
      call<{ ok: boolean; applied: string[] }>('/admin/auth/apply', { method: 'POST', body: { password, apply } }),
  },
  media: {
    list: (o: { type?: string; q?: string; offset?: number } = {}) => {
      const q = new URLSearchParams();
      if (o.type) q.set('type', o.type);
      if (o.q) q.set('q', o.q);
      if (o.offset) q.set('offset', String(o.offset));
      return call<{ items: MediaItem[]; total: number }>(`/admin/media?${q}`);
    },
    upload: (body: { fileBase64: string; fileName: string; assetType: string; altText?: string }) => call<{ item: MediaItem }>('/admin/media', { method: 'POST', body }),
    update: (id: string, body: { fileBase64?: string; fileName?: string; altText?: string }) => call<{ item: MediaItem }>(`/admin/media/${id}`, { method: 'PUT', body }),
    remove: (id: string) => call<{ ok: boolean }>(`/admin/media/${id}`, { method: 'DELETE' }),
  },
  permissions: {
    list: () => call<{ sections: string[]; users: any[] }>('/admin/settings/permissions'),
    save: (userId: string, body: { isSuperAdmin: boolean; sections: string[] }) => call(`/admin/settings/permissions/${userId}`, { method: 'PUT', body }),
    reset: (userId: string) => call(`/admin/settings/permissions/${userId}`, { method: 'DELETE' }),
  },
};

/* ------------------------------------------------------------------ client-side image optimisation */
export const ASSET_TYPE_LABELS: Record<string, string> = {
  website_banner: 'Website banner', app_banner: 'App banner', course_thumbnail: 'Course thumbnail', bundle_image: 'Bundle image',
  blog_image: 'Blog image', category_image: 'Category image', promo: 'Promotional', logo: 'Logo / icon', seo: 'Social sharing', other: 'Other',
};
/** Largest useful width per type; bigger images are scaled down (aspect ratio kept) before upload. */
const MAX_WIDTH: Record<string, number> = {
  website_banner: 2400, app_banner: 1600, course_thumbnail: 1600, bundle_image: 1600, blog_image: 2000, category_image: 1200, promo: 2400, logo: 1024, seo: 1200, other: 3000,
};

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(blob);
  });

export async function imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  if (file.type === 'image/svg+xml' || file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') return null;
  try {
    const bmp = await createImageBitmap(file);
    const d = { width: bmp.width, height: bmp.height };
    bmp.close();
    return d;
  } catch {
    return null;
  }
}

/**
 * Prepares an image for upload: SVG/ICO/GIF are sent unchanged; PNG/JPG/WebP larger than the useful size are
 * scaled down, and photos are re-encoded as WebP when that makes the file smaller. Logos keep transparency.
 */
export async function prepareImage(file: File, assetType: string): Promise<{ base64: string; fileName: string; width: number | null; height: number | null; optimized: boolean }> {
  const passthrough = ['image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/gif'].includes(file.type);
  if (!passthrough && !/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use a PNG, JPG, WebP, GIF or SVG image.');
  if (passthrough) return { base64: await readAsDataUrl(file), fileName: file.name, width: null, height: null, optimized: false };
  const bmp = await createImageBitmap(file);
  const maxW = MAX_WIDTH[assetType] || 3000;
  const scale = bmp.width > maxW ? maxW / bmp.width : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const keepPng = assetType === 'logo' && file.type === 'image/png';
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, keepPng ? 'image/png' : 'image/webp', 0.86));
  if (blob && (blob.size < file.size || scale < 1)) {
    const ext = keepPng ? 'png' : 'webp';
    return { base64: await readAsDataUrl(blob), fileName: file.name.replace(/\.[^.]+$/, `.${ext}`), width: w, height: h, optimized: true };
  }
  return { base64: await readAsDataUrl(file), fileName: file.name, width: w, height: h, optimized: false };
}

export const formatBytes = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
