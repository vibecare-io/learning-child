export function matchesBlockedKeyword(title: string, keywords: string[]): string | null {
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(title)) return keyword;
  }
  return null;
}
