/**
 * Meta (Facebook) Pixel for Edufy Academy ads measurement.
 *
 * The standard Meta snippet runs once per page load, but this website is a single-page app, so a PageView is
 * sent on every route change instead. The pixel is not loaded on pages whose address can carry sign-in
 * tokens (email-link / Google sign-in callback, password reset) or on the admin and instructor dashboards,
 * because Meta receives the full page address.
 *
 * The Pixel ID is a public value (it is visible in every page that uses it); no access token is used here.
 */
export const META_PIXEL_ID = '2722451508224726';
export const META_PIXEL_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

/** Addresses never sent to Meta. */
const EXCLUDED = [/^\/auth(\/|$)/, /^\/reset-password(\/|$)/, /^\/forgot-password(\/|$)/, /^\/admin(\/|$)/, /^\/instructor(\/|$)/];

export function isPixelPath(pathname: string): boolean {
  const p = ((pathname || '/').replace(/\/+$/, '') || '/').toLowerCase();
  return !EXCLUDED.some((re) => re.test(p));
}

export type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
};
export type PixelWindow = { fbq?: Fbq; _fbq?: Fbq };

/** Same as Meta's base code: a queueing fbq() stub, the async fbevents.js loader and fbq('init'). */
export function installMetaPixel(w: PixelWindow, doc: Document, pixelId = META_PIXEL_ID): Fbq {
  if (w.fbq) return w.fbq;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue.push(args);
  } as Fbq;
  w.fbq = n;
  if (!w._fbq) w._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  const s = doc.createElement('script');
  s.async = true;
  s.src = META_PIXEL_SRC;
  const first = doc.getElementsByTagName('script')[0];
  if (first?.parentNode) first.parentNode.insertBefore(s, first);
  else doc.head.appendChild(s);
  n('init', pixelId);
  return n;
}

let lastTracked: string | null = null;

/** Sends one PageView for this address (loads the pixel on first use); excluded pages send nothing. */
export function trackPixelPageView(pathname: string, w: PixelWindow = window as unknown as PixelWindow, doc: Document = document): boolean {
  if (!isPixelPath(pathname) || pathname === lastTracked) return false;
  lastTracked = pathname;
  installMetaPixel(w, doc)('track', 'PageView');
  return true;
}

/** For tests. */
export const resetPixelTracking = () => {
  lastTracked = null;
};
