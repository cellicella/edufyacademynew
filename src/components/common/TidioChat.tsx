import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TIDIO_SCRIPT_SRC, showChatWidgets } from '../../config/chatWidgets';

type TidioApi = { show?: () => void; hide?: () => void };
const tidio = () => (window as Window & { tidioChatApi?: TidioApi }).tidioChatApi;

/**
 * Tidio live chat on the homepage and Contact Us only. The Tidio script is loaded the first time a visitor
 * opens one of those pages (it is no longer loaded on every page); on other pages the widget is hidden with
 * Tidio's own API and, as a fallback, with CSS (html without data-chat-widgets hides #tidio-chat).
 */
export function TidioChat() {
  const { pathname } = useLocation();
  const allowed = showChatWidgets(pathname);

  useEffect(() => {
    const root = document.documentElement;
    if (!allowed) {
      delete root.dataset.chatWidgets;
      tidio()?.hide?.();
      return;
    }
    root.dataset.chatWidgets = '1';
    if (!document.querySelector(`script[src="${TIDIO_SCRIPT_SRC}"]`)) {
      const s = document.createElement('script');
      s.src = TIDIO_SCRIPT_SRC;
      s.async = true;
      document.body.appendChild(s);
    }
    tidio()?.show?.();
    // The chat API becomes available after the script has started; make sure it is shown on arrival
    const onReady = () => {
      if (document.documentElement.dataset.chatWidgets) tidio()?.show?.();
      else tidio()?.hide?.();
    };
    document.addEventListener('tidioChat-ready', onReady);
    return () => document.removeEventListener('tidioChat-ready', onReady);
  }, [allowed]);

  return null;
}
