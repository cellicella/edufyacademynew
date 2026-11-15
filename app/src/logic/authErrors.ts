/** Maps Supabase Auth errors to clear messages. Never includes passwords or tokens. */
export function authMessage(err: unknown): string {
  const m = String((err as any)?.message || err || '');
  if (/invalid login credentials/i.test(m)) return 'Incorrect email or password.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email address first — check your inbox for the link.';
  if (/already registered|already been registered|user already exists/i.test(m)) return 'An account with this email already exists. Please sign in.';
  if (/rate limit|too many|over_email_send_rate_limit/i.test(m)) return 'Too many attempts. Please wait a minute and try again.';
  if (/network request failed|failed to fetch|network/i.test(m)) return 'Can’t reach Edufy. Check your internet connection.';
  if (/password should be at least|weak password/i.test(m)) return 'Password must be at least 6 characters.';
  if (/same password|different from the old password/i.test(m)) return 'Choose a password different from your current one.';
  if (/invalid email|unable to validate email/i.test(m)) return 'Enter a valid email address.';
  if (/expired|invalid.*(code|token|link)|otp/i.test(m)) return 'This link is invalid or has expired. Please request a new one.';
  if (/signups not allowed|signup is disabled/i.test(m)) return 'New sign-ups are currently closed.';
  return m || 'Something went wrong. Please try again.';
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isValidEmail = (email: string) => EMAIL_RE.test(email.trim());
