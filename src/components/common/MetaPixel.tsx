import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPixelPageView } from '../../lib/metaPixel';
import { flushRegistration } from '../../lib/metaEvents';

/**
 * Meta Pixel: a PageView for every page the visitor opens in the app (see lib/metaPixel.ts), and a pending
 * CompleteRegistration (e.g. after Google sign-up, which returns through the excluded /auth/callback page) once
 * the visitor reaches a page where the pixel runs (lib/metaEvents.ts).
 */
export function MetaPixel() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPixelPageView(pathname);
    flushRegistration();
  }, [pathname]);
  return null;
}
