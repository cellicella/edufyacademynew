/**
 * Safe, dependency-free HTML → blocks parser for blog articles in the app.
 * Only a small whitelist is understood (headings, paragraphs, lists, quotes, code, images, links,
 * bold/italic). Everything else is reduced to plain text, so nothing from the HTML is ever executed.
 */

export interface Inline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
}

export type Block =
  | { type: 'p' | 'h2' | 'h3' | 'quote'; inlines: Inline[] }
  | { type: 'li'; ordered: boolean; index: number; inlines: Inline[] }
  | { type: 'pre'; text: string }
  | { type: 'img'; src: string; alt: string }
  | { type: 'hr' };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™', bull: '•', rarr: '→' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const safeHref = (v: string) => (/^(https:\/\/|http:\/\/|mailto:|\/(?!\/))/i.test(v) && !/^\s*(javascript|data|vbscript):/i.test(v) ? v : undefined);
const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : '';
};

const BLOCK_TAGS: Record<string, 'p' | 'h2' | 'h3' | 'quote'> = { p: 'p', div: 'p', h1: 'h2', h2: 'h2', h3: 'h3', h4: 'h3', h5: 'h3', h6: 'h3', blockquote: 'quote', figcaption: 'p' };

export function parseHtml(html: string): Block[] {
  const blocks: Block[] = [];
  const src = (html || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|embed|noscript|template|svg|form)[\s\S]*?<\/\1\s*>/gi, '');
  const tokens = src.match(/<\/?[a-zA-Z][^>]*>|[^<]+|</g) || [];

  let inlines: Inline[] = [];
  let blockType: 'p' | 'h2' | 'h3' | 'quote' = 'p';
  const fmt = { bold: 0, italic: 0, underline: 0, code: 0 };
  const hrefs: (string | undefined)[] = [];
  const lists: { ordered: boolean; count: number }[] = [];
  let inLi = false;
  let pre: string | null = null;

  const flush = () => {
    const merged: Inline[] = [];
    for (const i of inlines) {
      const last = merged[merged.length - 1];
      if (last && last.bold === i.bold && last.italic === i.italic && last.underline === i.underline && last.code === i.code && last.href === i.href) last.text += i.text;
      else merged.push({ ...i });
    }
    // collapse whitespace, trim the edges of the block
    merged.forEach((i) => (i.text = i.text.replace(/[ \t\r\n]+/g, ' ')));
    if (merged.length) {
      merged[0].text = merged[0].text.replace(/^ +/, '');
      merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/ +$/, '');
    }
    const content = merged.filter((i) => i.text.length);
    if (content.length && content.some((i) => i.text.trim())) {
      if (inLi && lists.length) {
        const l = lists[lists.length - 1];
        blocks.push({ type: 'li', ordered: l.ordered, index: l.count, inlines: content });
      } else blocks.push({ type: blockType, inlines: content });
    }
    inlines = [];
  };

  for (const tok of tokens) {
    if (pre !== null) {
      if (/^<\/pre\s*>/i.test(tok)) {
        blocks.push({ type: 'pre', text: decodeEntities(pre).replace(/^\n+|\n+$/g, '') });
        pre = null;
      } else if (!tok.startsWith('<')) pre += tok;
      else if (/^<br/i.test(tok)) pre += '\n';
      continue;
    }
    if (!tok.startsWith('<') || tok === '<') {
      const text = decodeEntities(tok);
      if (text) inlines.push({ text, bold: fmt.bold > 0 || undefined, italic: fmt.italic > 0 || undefined, underline: fmt.underline > 0 || undefined, code: fmt.code > 0 || undefined, href: hrefs[hrefs.length - 1] });
      continue;
    }
    const m = tok.match(/^<(\/?)([a-zA-Z0-9]+)/);
    if (!m) continue;
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();

    if (name in BLOCK_TAGS) {
      flush();
      blockType = closing ? 'p' : BLOCK_TAGS[name];
    } else if (name === 'br') {
      inlines.push({ text: '\n' });
    } else if (name === 'ul' || name === 'ol') {
      flush();
      if (closing) lists.pop();
      else lists.push({ ordered: name === 'ol', count: 0 });
    } else if (name === 'li') {
      flush();
      inLi = !closing;
      if (!closing && lists.length) lists[lists.length - 1].count++;
    } else if (name === 'pre') {
      flush();
      if (!closing) pre = '';
    } else if (name === 'hr') {
      flush();
      blocks.push({ type: 'hr' });
    } else if (name === 'img') {
      const s = attr(tok, 'src');
      if (/^https:\/\/\S+$/i.test(s)) {
        flush();
        blocks.push({ type: 'img', src: s, alt: attr(tok, 'alt') });
      }
    } else if (name === 'strong' || name === 'b') fmt.bold += closing ? -1 : 1;
    else if (name === 'em' || name === 'i') fmt.italic += closing ? -1 : 1;
    else if (name === 'u') fmt.underline += closing ? -1 : 1;
    else if (name === 'code') fmt.code += closing ? -1 : 1;
    else if (name === 'a') {
      if (closing) hrefs.pop();
      else hrefs.push(safeHref(attr(tok, 'href')));
    }
    (Object.keys(fmt) as (keyof typeof fmt)[]).forEach((k) => (fmt[k] = Math.max(0, fmt[k])));
  }
  flush();
  return blocks;
}

/** Plain text (for search snippets and share messages). */
export const htmlToText = (html: string) => decodeEntities((html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
