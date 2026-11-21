import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteSettings } from '../../context/SettingsContext';
import { applyHead, setDefaultRobots } from '../../lib/seo';
import { SITE_NAME, breadcrumbLd, isPrivatePath, leadInstructorLd, organizationLd, staticPage, websiteLd } from '../../seo/seoConfig';

const PRIVATE_TITLES: [RegExp, string][] = [
  [/^\/login/, 'Sign in'],
  [/^\/register/, 'Create your account'],
  [/^\/forgot-password/, 'Reset your password'],
  [/^\/reset-password/, 'Choose a new password'],
  [/^\/learn\//, 'Course player'],
  [/^\/student/, 'My learning'],
  [/^\/instructor/, 'Instructor dashboard'],
  [/^\/admin/, 'Admin'],
  [/^\/auth\//, 'Signing you in'],
];

/**
 * Keeps head tags right on every route change: fixed public pages get their title, description, canonical URL
 * and structured data (same text as the prerendered HTML); private pages (sign-in, learning area, dashboards,
 * admin) are marked noindex without a canonical. Course, bundle, blog and instructor pages set their own tags
 * from their data (useSeo).
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();
  const indexable = !/noindex/i.test(settings.seo.robots || '');
  const robots = indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow';
  setDefaultRobots(robots);
  const social = (settings.social?.links || []).filter((l) => l.enabled && /^https:\/\//.test(l.url || '')).map((l) => l.url);

  useEffect(() => {
    const path = pathname.replace(/\/+$/, '') || '/';
    if (isPrivatePath(path)) {
      const t = PRIVATE_TITLES.find(([re]) => re.test(path))?.[1];
      applyHead({ title: t ? `${t} | ${SITE_NAME}` : SITE_NAME, robots: 'noindex, nofollow', canonicalPath: null, description: null, ld: [] });
      return;
    }
    const s = staticPage(path);
    if (!s) return; // dynamic pages (course, bundle, blog post, instructor) and 404 set their own tags
    const ld =
      s.path === '/'
        ? [
            organizationLd({
              legalName: settings.general.companyName,
              description: settings.general.description,
              telephone: settings.contact?.primaryPhone,
              email: settings.contact?.supportEmail,
              sameAs: social,
            }),
            websiteLd(),
            leadInstructorLd(),
          ]
        : [breadcrumbLd([{ name: 'Home', path: '/' }, { name: s.h1, path: s.path }])];
    applyHead({ title: s.title, description: s.description, canonicalPath: s.path, robots, ld });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, robots, settings.general.companyName, settings.general.description, settings.contact?.primaryPhone, settings.contact?.supportEmail, social.join('|')]);

  return null;
}
