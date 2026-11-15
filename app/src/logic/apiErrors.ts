/**
 * Pure helpers for classifying API / network failures and turning them into
 * student-friendly messages. No React Native imports (unit-tested in Node).
 */
export type ErrorKind = 'network' | 'timeout' | 'auth' | 'forbidden' | 'not_found' | 'conflict' | 'validation' | 'rate_limit' | 'server' | 'unknown';

export class AppError extends Error {
  constructor(public status: number, message: string, public kind: ErrorKind = kindForStatus(status)) {
    super(message);
    this.name = 'AppError';
  }
}

export function kindForStatus(status: number): ErrorKind {
  if (status === 0) return 'network';
  if (status === 408) return 'timeout';
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate_limit';
  if (status >= 500) return 'server';
  return 'unknown';
}

const DEFAULTS: Record<ErrorKind, string> = {
  network: 'Can’t reach Edufy right now. Check your internet connection and try again.',
  timeout: 'Edufy is taking too long to respond. Please try again.',
  auth: 'Your session has expired. Please sign in again.',
  forbidden: 'You don’t have access to this. If you bought this course, pull down to refresh.',
  not_found: 'We couldn’t find that. It may have been removed.',
  conflict: 'This action was already completed.',
  validation: 'Some details look incorrect. Please check and try again.',
  rate_limit: 'Too many requests. Please wait a moment and try again.',
  server: 'Edufy is having trouble right now. Please try again in a minute.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * Message for an HTTP failure. The server's own message is used for 4xx responses because the
 * Edufy API returns specific, safe text there (e.g. "Already enrolled…"); 5xx details are hidden.
 */
export function messageForStatus(status: number, serverMessage?: unknown): string {
  const kind = kindForStatus(status);
  const text = typeof serverMessage === 'string' ? serverMessage.trim() : '';
  if (text && status >= 400 && status < 500 && status !== 401 && text.length < 300) return text;
  return DEFAULTS[kind];
}

/** Only failures that are safe and useful to retry automatically (never 4xx). */
export function isTransientError(err: unknown): boolean {
  const e = err as any;
  if (!e) return false;
  if (e instanceof AppError) return e.kind === 'network' || e.kind === 'timeout' || e.kind === 'server';
  if (typeof e.status === 'number') return e.status === 0 || e.status === 408 || e.status >= 500;
  const msg = String(e.message || '');
  return /network request failed|failed to fetch|timeout|timed out|aborted|ECONNRESET|503|502|504/i.test(msg);
}

/** Retry policy for read queries: transient errors only, at most `max` times. */
export const shouldRetryQuery = (failureCount: number, err: unknown, max = 2) => failureCount < max && isTransientError(err);

/** Exponential backoff with a cap (ms). */
export const retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 8000);

/** Friendly message for anything thrown (Supabase errors, fetch errors, AppError). */
export function friendlyMessage(err: unknown, fallback = DEFAULTS.unknown): string {
  const e = err as any;
  if (!e) return fallback;
  if (e instanceof AppError) return e.message;
  const msg = String(e.message || e || '');
  if (/network request failed|failed to fetch|network error/i.test(msg)) return DEFAULTS.network;
  if (/abort|timed out|timeout/i.test(msg)) return DEFAULTS.timeout;
  if (/JWT expired|invalid JWT|refresh token/i.test(msg)) return DEFAULTS.auth;
  if (/permission denied|row-level security/i.test(msg)) return DEFAULTS.forbidden;
  return msg && msg.length < 300 ? msg : fallback;
}
