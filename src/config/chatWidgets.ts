/**
 * Floating contact widgets (WhatsApp button and Tidio live chat) appear only on these pages.
 * Everywhere else — course pages, checkout, login/sign-up, blog, student area, admin — they are hidden.
 */
export const CHAT_WIDGET_PATHS = ['/', '/contact'] as const;

/** Tidio live-chat loader (the existing Edufy Tidio project). */
export const TIDIO_SCRIPT_SRC = 'https://code.tidio.co/mljojfmeyd9gulch7gpmnesmnfllzaci.js';

export function showChatWidgets(pathname: string): boolean {
  const p = (pathname || '/').replace(/\/+$/, '') || '/';
  return (CHAT_WIDGET_PATHS as readonly string[]).includes(p.toLowerCase());
}
