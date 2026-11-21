/**
 * Meta (Facebook) Pixel for Edufy Academy ads measurement.
 *
 * - The standard Meta base code is in index.html (and so in every prerendered page): it initialises the pixel
 *   and sends the first PageView as soon as the page loads, before the React app starts.
 * - This website is a single-page app, so moving to another page does not reload it. The app sends one PageView
 *   for each page change (MetaPixel component → trackPixelPageView). Meta's own History API tracking is switched
 *   off in the base code (fbq.disablePushState) so a page change is never counted twice or sent from an
 *   excluded page.
 * - Page changes use fbq('trackSingle', id, 'PageView'): with History API tracking off, Meta's script drops any
 *   further fbq('track', 'PageView') in the same page load as a duplicate (verified with fbevents.js 2.9.441),
 *   while trackSingle is sent every time.
 * - The pixel never runs on pages whose address can carry sign-in tokens (email-link / Google sign-in callback,
 *   password reset) or on the admin and instructor dashboards, because Meta receives the full page address.
 *
 * The Pixel ID is a public value (it is visible in every page that uses it); no access token is used here.
 */
export const META_PIXEL_ID = '2722451508224726';
export const META_PIXEL_SRC = 'https://connect.facebook.net/en_US/fbevents.js';

/** Addresses never sent to Meta (same rule as the base code in index.html). */
export const PIXEL_EXCLUDED = /^\/(auth|reset-password|forgot-password|admin|instructor)(\/|$)/i;

export function isPixelPath(pathname: string): boolean {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  return !PIXEL_EXCLUDED.test(p);
}

export type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};
/** fbq/_fbq come from Meta; edufyPixelPageView is the path the base code in index.html already sent. */
export type PixelWindow = { fbq?: Fbq; _fbq?: Fbq; edufyPixelPageView?: string };

/**
 * Same as Meta's base code. Only used when the visitor arrived on an excluded page (so index.html did not load
 * the pixel) and then moved to a public page.
 */
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
  n.disablePushState = true;
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

/**
 * One PageView per page. The first page was already sent by the base code in index.html, so it is not sent
 * again; excluded pages send nothing.
 */
export function trackPixelPageView(pathname: string, w: PixelWindow = window as unknown as PixelWindow, doc: Document = document): boolean {
  if (lastTracked === null && w.edufyPixelPageView) lastTracked = w.edufyPixelPageView;
  if (!isPixelPath(pathname) || pathname === lastTracked) return false;
  lastTracked = pathname;
  installMetaPixel(w, doc)('trackSingle', META_PIXEL_ID, 'PageView');
  return true;
}

/** For tests. */
export const resetPixelTracking = () => {
  lastTracked = null;
};
