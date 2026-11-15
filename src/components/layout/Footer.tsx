import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EdufyLogo } from '../common/EdufyLogo';
import { ArrowUpRight, Mail, Phone } from 'lucide-react';
import { SOCIAL_ICONS } from '../../config/social';
import { courseService } from '../../services/api';
import { useSiteSettings } from '../../context/SettingsContext';
import { copyrightText, isHttps, telHref } from '../../config/siteSettings';

const columns = [
  {
    title: 'Learn',
    links: [
      { label: 'All courses', to: '/courses' },
      { label: 'Categories', to: '/categories' },
      { label: 'Bundles', to: '/bundles' },
      { label: 'Blog', to: '/blog' },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'Instructors', to: '/instructors' },
      { label: 'Teach on Edufy', to: '/become-instructor' },
      { label: 'Verify a certificate', to: '/verify-certificate' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', to: '/about' },
      { label: 'Contact', to: '/contact' },
      { label: 'Help & FAQ', to: '/faq' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', to: '/privacy' },
      { label: 'Terms of service', to: '/terms' },
      { label: 'Refund policy', to: '/refund' },
    ],
  },
];

export const Footer: React.FC = () => {
  const { settings } = useSiteSettings();
  const { general, contact } = settings;
  const socials = settings.social.links;
  // Top categories (by number of courses) come from the database
  const [topCategories, setTopCategories] = useState<{ label: string; to: string }[]>([]);
  useEffect(() => {
    courseService
      .getCategories()
      .then((cats) =>
        setTopCategories([...cats].filter((c) => c.courseCount > 0).sort((a, b) => b.courseCount - a.courseCount).slice(0, 3).map((c) => ({ label: c.name, to: `/courses?category=${c.slug}` })))
      )
      .catch(() => undefined);
  }, []);
  const cols = columns.map((c) => (c.title === 'Learn' ? { ...c, links: [...c.links.slice(0, 2), ...topCategories, ...c.links.slice(2)] } : c));

  return (
    <footer className="bg-[#0B1220] text-white">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8">
        {/* Statement row */}
        <div className="py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-end border-b border-white/10">
          <div className="lg:col-span-8">
            <h2 className="font-display text-[2.25rem] sm:text-[3rem] lg:text-[3.5rem] font-extrabold leading-[1.05] tracking-[-0.035em]">
              Keep learning.
              <span className="block text-white/40">Keep moving forward.</span>
            </h2>
          </div>
          <div className="lg:col-span-4 flex lg:justify-end gap-3 flex-wrap">
            <Link to="/courses" className="ed-btn bg-white text-[#111827]">
              Explore courses <ArrowUpRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Link columns */}
        <div className="py-14 grid grid-cols-2 md:grid-cols-6 gap-10">
          <div className="col-span-2 space-y-5">
            <EdufyLogo variant="white" size="md" />
            <p className="text-[16px] leading-[1.7] text-white/60 max-w-xs">{general.description}</p>
            {(contact.primaryPhone || contact.supportEmail) && (
              <ul className="space-y-1.5 text-[15px] text-white/70">
                {contact.primaryPhone && (
                  <li><a href={telHref(contact.primaryPhone)} className="inline-flex items-center gap-2 hover:text-white"><Phone className="w-4 h-4" /> {contact.primaryPhone}</a></li>
                )}
                {contact.supportEmail && (
                  <li><a href={`mailto:${contact.supportEmail}`} className="inline-flex items-center gap-2 hover:text-white"><Mail className="w-4 h-4" /> {contact.supportEmail}</a></li>
                )}
              </ul>
            )}
            <nav aria-label="Edufy Academy on social media">
              <ul className="flex flex-wrap gap-2.5">
                {socials.map((s) => {
                  const icon = SOCIAL_ICONS[s.platform] || SOCIAL_ICONS.custom;
                  return (
                  <li key={s.id}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Edufy Academy on ${s.label} (opens in a new tab)`}
                      title={s.label}
                      className="w-11 h-11 rounded-full bg-white/10 hover:bg-white hover:text-[#0B1220] text-white/85 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A5B8FF]"
                    >
                      {s.platform === 'custom' && isHttps(s.icon) ? (
                        <img src={s.icon} alt="" className="w-[18px] h-[18px] object-contain" />
                      ) : (
                        <svg viewBox={icon.viewBox} className="w-[18px] h-[18px]" fill="currentColor" aria-hidden="true" focusable="false">
                          <path d={icon.path} />
                        </svg>
                      )}
                    </a>
                  </li>
                  );
                })}
              </ul>
            </nav>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/45 mb-5">{col.title}</h3>
              <ul className="space-y-3.5">
                {col.links.map((l) => (
                  <li key={l.to + l.label}>
                    <Link to={l.to} className="text-[16px] text-white/80 hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="py-7 border-t border-white/10 flex flex-col sm:flex-row gap-3 sm:items-center justify-between text-[14px] text-white/50">
          <span>{copyrightText(settings)}</span>
          <span>{general.siteName}{general.tagline ? ` — ${general.tagline}` : ''}</span>
        </div>
      </div>
    </footer>
  );
};
