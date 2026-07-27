import type { AllowedChannels } from "../../shared/types";

export function channelRefFromHref(href: string): string | null {
  let path = href;
  if (href.startsWith("http")) {
    try {
      path = new URL(href).pathname;
    } catch {
      return null;
    }
  }
  if (path.startsWith("/channel/")) return path.split("/")[2] ?? null;
  if (path.startsWith("/@")) return `@${path.slice(2).split("/")[0].toLowerCase()}`;
  return null;
}

export function isAllowed(href: string | null, allowed: AllowedChannels): boolean {
  if (!href) return false;
  const ref = channelRefFromHref(href);
  if (!ref) return false;
  if (ref.startsWith("@")) return allowed.handles.includes(ref);
  return allowed.channelIds.includes(ref);
}
