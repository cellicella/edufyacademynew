import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { LinkTarget } from '@/logic/deepLinks';
import { colors } from '@/theme';

/** Opens a validated target: in-app route, or an https link in the in-app browser. */
export function openTarget(t: LinkTarget | null) {
  if (!t) return;
  if (t.kind === 'internal') router.push(t.path as any);
  else WebBrowser.openBrowserAsync(t.url, { toolbarColor: colors.primary, controlsColor: colors.white }).catch(() => undefined);
}

/**
 * A destination waiting for the app to be ready / the student to sign in
 * (e.g. a notification tapped while the app was closed or the student was signed out).
 */
let pending: LinkTarget | null = null;
let appReady = false;
let signedIn = false;

export const pendingLink = {
  set(t: LinkTarget) {
    pending = t;
    this.flush();
  },
  /** Splash finished routing. */
  markReady() {
    appReady = true;
    this.flush();
  },
  setSignedIn(v: boolean) {
    signedIn = v;
    this.flush();
  },
  flush() {
    if (!pending || !appReady || !signedIn) return;
    const t = pending;
    pending = null;
    // Let the tab navigator mount first (after sign-in or the splash redirect)
    setTimeout(() => openTarget(t), 700);
  },
  hasPending: () => !!pending,
  isReady: () => appReady,
};
