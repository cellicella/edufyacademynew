import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPixelPageView } from '../../lib/metaPixel';

/** Meta Pixel: a PageView for every page the visitor opens in the app (see lib/metaPixel.ts). */
export function MetaPixel() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPixelPageView(pathname);
  }, [pathname]);
  return null;
}
