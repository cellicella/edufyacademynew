import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wrench, Phone, Mail, MessageCircle } from 'lucide-react';
import { useSiteSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { maintenanceActive, telHref, waHref } from '../../config/siteSettings';
import { EdufyLogo } from '../common/EdufyLogo';

// Admin and sign-in pages always stay reachable, so administrators can never lock themselves out.
const ALWAYS_OPEN = ['/admin', '/login', '/auth', '/forgot-password', '/reset-password'];

/**
 * Website maintenance mode (Settings → Maintenance). Visitors see a maintenance page; administrators keep
 * full access and see a reminder bar. The schedule (start/end) is checked every minute.
 */
export const MaintenanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSiteSettings();
  const { currentUser } = useAuth();
  const { pathname } = useLocation();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const m = settings.maintenance;
  const active = maintenanceActive(m, 'website', now);
  if (!active) return <>{children}</>;

  const isAdmin = currentUser?.role === 'admin';
  if (isAdmin || ALWAYS_OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return (
      <>
        {isAdmin && (
          <div className="sticky top-0 z-[60] bg-amber-400 text-[#111827] text-[14px] font-semibold text-center px-4 py-2">
            Maintenance mode is ON — visitors see the maintenance page.{' '}
            <Link to="/admin/settings/maintenance" className="underline">Turn it off</Link>
          </div>
        )}
        {children}
      </>
    );
  }

  const c = settings.contact;
  const wa = settings.whatsapp;
  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center px-5 py-16 text-center">
      <EdufyLogo size="lg" to="" />
      <div className="mt-10 w-16 h-16 rounded-2xl bg-[#E8EFFB] text-[#004AAD] flex items-center justify-center">
        <Wrench className="w-8 h-8" />
      </div>
      <h1 className="mt-6 font-display text-[2rem] sm:text-[2.5rem] font-extrabold text-[#111827] max-w-2xl">{m.title || 'We’ll be back soon'}</h1>
      <p className="mt-3 text-[17px] text-[#475569] max-w-xl whitespace-pre-line">{m.message}</p>
      {m.endsAt && (
        <p className="mt-3 text-[15px] text-[#64748B]">
          Expected back: {new Date(m.endsAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
      {m.showContact && (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {c.primaryPhone && <a href={telHref(c.primaryPhone)} className="ed-btn ed-btn-outlined ed-btn-sm"><Phone className="w-4 h-4" /> {c.primaryPhone}</a>}
          {c.supportEmail && <a href={`mailto:${c.supportEmail}`} className="ed-btn ed-btn-outlined ed-btn-sm"><Mail className="w-4 h-4" /> {c.supportEmail}</a>}
          {wa.enabled && waHref(wa.number) && (
            <a href={waHref(wa.number, wa.supportMessage)} target="_blank" rel="noopener noreferrer" className="ed-btn ed-btn-filled ed-btn-sm"><MessageCircle className="w-4 h-4" /> WhatsApp</a>
          )}
        </div>
      )}
      <Link to="/login" className="mt-10 text-[14px] text-[#64748B] underline">Administrator sign in</Link>
    </div>
  );
};
