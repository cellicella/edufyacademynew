/** Course catalogue pagination helpers (pure; unit-tested). */

export const COURSES_PER_PAGE = 12;

/** Reads ?page= safely: a whole number ≥ 1, otherwise 1. */
export function parsePage(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export function totalPages(total: number, perPage = COURSES_PER_PAGE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / perPage));
}

/** Inclusive row range for a page, as used by database range queries (0-based). */
export function pageRange(page: number, perPage = COURSES_PER_PAGE): { from: number; to: number } {
  const from = (Math.max(1, page) - 1) * perPage;
  return { from, to: from + perPage - 1 };
}

/** "Showing 13–24 of 36 courses" */
export function resultSummary(page: number, total: number, perPage = COURSES_PER_PAGE): string {
  if (total <= 0) return 'No courses found';
  const first = (page - 1) * perPage + 1;
  const last = Math.min(total, page * perPage);
  const noun = total === 1 ? 'course' : 'courses';
  return first === last ? `Showing ${first} of ${total} ${noun}` : `Showing ${first}–${last} of ${total} ${noun}`;
}

/**
 * Page buttons to show: always the first and last page, the current page and its neighbours,
 * with 'gap' where pages are skipped. e.g. (6, 12) → [1, 'gap', 5, 6, 7, 'gap', 12]
 */
export function pageItems(current: number, total: number, siblings = 1): Array<number | 'gap'> {
  if (total <= 1) return [1];
  const pages = new Set<number>([1, total]);
  for (let p = current - siblings; p <= current + siblings; p++) if (p >= 1 && p <= total) pages.add(p);
  // Avoid a gap that hides a single page: show it instead.
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  sorted.forEach((p, i) => {
    if (i > 0) {
      const prev = sorted[i - 1];
      if (p - prev === 2) out.push(prev + 1);
      else if (p - prev > 2) out.push('gap');
    }
    out.push(p);
  });
  return out;
}

/** Search text that is safe inside a PostgREST or() filter (commas, parentheses and wildcards removed). */
export function sanitizeSearch(text: string): string {
  return text.replace(/[%,()*\\:"']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
