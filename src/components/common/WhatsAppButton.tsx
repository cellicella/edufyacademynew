import React from 'react';
import { useLocation } from 'react-router-dom';
import { useSiteSettings } from '../../context/SettingsContext';
import { waHref } from '../../config/siteSettings';

/** Floating WhatsApp chat button, bottom-left (Tidio chat sits bottom-right). Managed in Settings → WhatsApp. */
export const WhatsAppButton: React.FC = () => {
  const { settings } = useSiteSettings();
  const { pathname } = useLocation();
  const w = settings.whatsapp;
  const href = waHref(w.number, w.welcomeMessage);
  if (!w.enabled || !href || pathname.startsWith('/admin') || pathname.startsWith('/learn')) return null;
  const label = w.buttonText || 'Chat with us on WhatsApp';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (${w.number})`}
      title={label}
      className="fixed bottom-5 left-5 w-14 h-14 flex items-center justify-center rounded-full text-white shadow-lg hover:shadow-xl hover:scale-105 transition-transform"
      style={{ backgroundColor: '#25D366', zIndex: 55 }}
    >
      <svg viewBox="0 0 32 32" className="w-8 h-8 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M16.02 3C9.4 3 4.02 8.37 4.02 15c0 2.11.55 4.17 1.6 5.99L4 29l8.2-1.6A11.95 11.95 0 0 0 16.02 27C22.64 27 28 21.63 28 15S22.64 3 16.02 3zm0 21.8c-1.86 0-3.68-.5-5.27-1.45l-.38-.22-4.87.95.97-4.74-.25-.4A9.77 9.77 0 0 1 6.2 15c0-5.41 4.4-9.8 9.82-9.8 5.4 0 9.8 4.39 9.8 9.8 0 5.4-4.4 9.8-9.8 9.8zm5.38-7.34c-.29-.15-1.74-.86-2.01-.96-.27-.1-.47-.15-.66.15-.2.29-.76.96-.93 1.15-.17.2-.34.22-.64.07-.29-.15-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.6-.91-2.19-.24-.57-.48-.5-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44s1.05 2.83 1.2 3.03c.15.2 2.06 3.15 5 4.42.7.3 1.24.48 1.67.62.7.22 1.34.19 1.84.12.56-.08 1.74-.71 1.98-1.4.25-.69.25-1.28.17-1.4-.07-.12-.27-.2-.56-.34z" />
      </svg>
    </a>
  );
};
