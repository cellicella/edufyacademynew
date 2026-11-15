/**
 * HTML helpers for blog content.
 * sanitizeHtml keeps a small whitelist of formatting tags and safe attributes; scripts, event
 * handlers, iframes, styles and javascript:/data: URLs are removed. It runs when a post is saved
 * AND again before rendering, so stored content can never inject script into the site.
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote',
  'code', 'pre', 'img', 'hr', 'figure', 'figcaption',
]);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math', 'form', 'input', 'button', 'select', 'textarea', 'link', 'meta']);

const safeHref = (v: string) => /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(v.trim()) && !/^\s*(javascript|data|vbscript):/i.test(v);
const safeSrc = (v: string) => /^https:\/\/\S+$/i.test(v.trim());

export function sanitizeHtml(input: string): string {
  if (!input) return '';
  if (typeof DOMParser === 'undefined') return input.replace(/<[^>]*>/g, ''); // non-browser: plain text only
  const doc = new DOMParser().parseFromString(`<div id="root">${input}</div>`, 'text/html');
  const root = doc.getElementById('root')!;

  const clean = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) {
        child.remove();
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (DROP_WITH_CONTENT.has(tag)) {
        el.remove();
        continue;
      }
      clean(el);
      if (!ALLOWED_TAGS.has(tag)) {
        // Unknown tag (div, span, font, h1…): keep its content, drop the wrapper
        const replacement = tag === 'h1' ? doc.createElement('h2') : tag === 'div' ? doc.createElement('p') : null;
        if (replacement) {
          while (el.firstChild) replacement.appendChild(el.firstChild);
          el.replaceWith(replacement);
        } else {
          el.replaceWith(...Array.from(el.childNodes));
        }
        continue;
      }
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const keep =
          (tag === 'a' && name === 'href' && safeHref(attr.value)) ||
          (tag === 'img' && name === 'src' && safeSrc(attr.value)) ||
          (tag === 'img' && name === 'alt');
        if (!keep) el.removeAttribute(attr.name);
      }
      if (tag === 'img' && !el.getAttribute('src')) {
        el.remove();
        continue;
      }
      if (tag === 'a') {
        const href = el.getAttribute('href') || '';
        if (/^https?:\/\//i.test(href)) {
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer nofollow');
        }
      }
    }
  };
  clean(root);
  // Drop empty paragraphs produced by editors
  return root.innerHTML.replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, '').trim();
}

export function htmlToText(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export function readingMinutes(html: string): number {
  const words = htmlToText(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.min(240, Math.round(words / 200)));
}

export function toSlug(v: string): string {
  return (v || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
}
