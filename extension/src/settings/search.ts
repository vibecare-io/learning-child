/** Normalize for case/diacritic-insensitive matching. */
const COMBINING_MARKS = /[̀-ͯ]/g;

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(COMBINING_MARKS, "").trim();
}

/**
 * Does `haystack` match the search `query`? Empty query matches everything.
 * Every whitespace-separated term in the query must appear as a substring —
 * so "reel break" matches "Reels allowed before a break" but "reel xyz" does not.
 */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const hay = norm(haystack);
  return q.split(/\s+/).every((term) => hay.includes(term));
}
