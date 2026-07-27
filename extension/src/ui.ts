import type { CatalogVideo } from "../../shared/types";

export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

function renderTile(v: CatalogVideo, doc: Document): HTMLAnchorElement {
  const a = doc.createElement("a");
  a.className = "lc-tile";
  a.href = `/watch?v=${v.id}`;

  const thumbWrap = doc.createElement("div");
  thumbWrap.className = "lc-thumb";
  const img = doc.createElement("img");
  img.src = v.thumbnail;
  img.alt = "";
  img.loading = "lazy";
  const badge = doc.createElement("span");
  badge.className = "lc-duration";
  badge.textContent = formatDuration(v.durationSec);
  thumbWrap.append(img, badge);

  const title = doc.createElement("div");
  title.className = "lc-title";
  title.textContent = v.title;

  const channel = doc.createElement("div");
  channel.className = "lc-channel";
  channel.textContent = v.channel;

  a.append(thumbWrap, title, channel);
  return a;
}

function renderContainer(videos: CatalogVideo[], className: string): HTMLElement {
  const doc = document;
  injectUiCss(doc);
  const el = doc.createElement("div");
  el.className = className;
  for (const v of videos) el.appendChild(renderTile(v, doc));
  return el;
}

export function renderGrid(videos: CatalogVideo[]): HTMLElement {
  return renderContainer(videos, "lc-grid");
}

function chipLabel(topic: string): string {
  if (topic === "all") return "All";
  if (topic === "maths") return "Maths";
  return topic.charAt(0).toUpperCase() + topic.slice(1);
}

/**
 * Our topic chip bar - replaces YouTube's algorithmic chips (Podcasts, Gaming,
 * Satire, ...). `topics` should already be the ones present in the kid's feed.
 */
export function renderChips(
  topics: string[],
  active: string,
  onSelect: (topic: string) => void,
): HTMLElement {
  const doc = document;
  injectUiCss(doc);
  const bar = doc.createElement("div");
  bar.className = "lc-chips";
  bar.id = "lc-chips";
  for (const t of topics) {
    const chip = doc.createElement("button");
    chip.className = "lc-chip" + (t === active ? " lc-chip-on" : "");
    chip.dataset.topic = t;
    chip.textContent = chipLabel(t);
    chip.addEventListener("click", () => onSelect(t));
    bar.appendChild(chip);
  }
  return bar;
}

export function renderList(videos: CatalogVideo[]): HTMLElement {
  return renderContainer(videos, "lc-list");
}

/**
 * Replaces the grid + chips entirely once the kid has hit the parent's daily
 * screen-time limit (see history.ts:isOverLimit). Calm and non-shaming - no
 * thumbnails, no countdown, no "you have used up X minutes" accounting -
 * just a warm nudge toward stopping for the day.
 */
export function renderDoneToday(): HTMLElement {
  const doc = document;
  injectUiCss(doc);
  const panel = doc.createElement("div");
  panel.id = "lc-done-today";
  panel.className = "lc-done-today";

  const emoji = doc.createElement("div");
  emoji.className = "lc-done-today-emoji";
  emoji.textContent = "🌤️";

  const message = doc.createElement("p");
  message.className = "lc-done-today-message";
  message.textContent = "That's plenty of watching for today — time for real-world adventures! See you tomorrow.";

  panel.append(emoji, message);
  return panel;
}

/** Uses YouTube's own CSS variables so tiles follow light/dark theme. */
const UI_CSS = `
.lc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px 16px;
  padding: 24px;
}
/* YouTube grows its fixed frosted-glass backdrop to cover the chip strip
   (the .with-chipbar modifier). Since we replace YouTube's chips with our own,
   trim it back to the masthead height so it stops painting over lc-chips. */
#frosted-glass.with-chipbar { height: var(--ytd-masthead-height, 56px) !important; }
.lc-chips {
  display: flex; gap: 12px; padding: 12px 24px; align-items: center;
  flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.lc-chips::-webkit-scrollbar { display: none; }
.lc-chip { flex: 0 0 auto; }
.lc-chip {
  border: none; cursor: pointer;
  background: var(--yt-spec-badge-chip-background, rgba(0,0,0,0.05));
  color: var(--yt-spec-text-primary, #0f0f0f);
  font-family: "Roboto", Arial, sans-serif; font-size: 14px; font-weight: 500;
  padding: 8px 12px; border-radius: 8px; line-height: 1; white-space: nowrap;
}
.lc-chip:hover { background: var(--yt-spec-10-percent-layer, rgba(0,0,0,0.1)); }
.lc-chip-on {
  background: var(--yt-spec-text-primary, #0f0f0f);
  color: var(--yt-spec-base-background, #fff);
}
.lc-list { display: flex; flex-direction: column; gap: 12px; padding: 8px 0; }
.lc-list .lc-tile { display: grid; grid-template-columns: 168px 1fr; gap: 8px; }
.lc-list .lc-title { grid-column: 2; margin: 0; }
.lc-list .lc-channel { grid-column: 2; }
.lc-list .lc-thumb { grid-row: 1 / span 2; }
.lc-tile { text-decoration: none; display: block; }
.lc-thumb { position: relative; }
.lc-thumb img {
  width: 100%; aspect-ratio: 16 / 9; object-fit: cover;
  border-radius: 12px; display: block; background: #0002;
}
.lc-duration {
  position: absolute; right: 6px; bottom: 6px;
  background: rgba(0,0,0,0.8); color: #fff;
  font-size: 12px; font-weight: 500; padding: 1px 4px; border-radius: 4px;
}
.lc-title {
  margin-top: 10px;
  color: var(--yt-spec-text-primary, #0f0f0f);
  font-family: "Roboto", Arial, sans-serif;
  font-size: 15px; font-weight: 500; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.lc-channel {
  color: var(--yt-spec-text-secondary, #606060);
  font-family: "Roboto", Arial, sans-serif;
  font-size: 13px; margin-top: 4px;
}
.lc-done-today {
  width: 100%; box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: 12px; padding: 64px 24px; margin: 24px;
  background: var(--yt-spec-badge-chip-background, rgba(0,0,0,0.05));
  border-radius: 16px;
}
.lc-done-today-emoji { font-size: 40px; line-height: 1; }
.lc-done-today-message {
  margin: 0; max-width: 480px;
  color: var(--yt-spec-text-primary, #0f0f0f);
  font-family: "Roboto", Arial, sans-serif;
  font-size: 16px; font-weight: 500; line-height: 1.5;
}
`;

export function injectUiCss(doc: Document = document): void {
  if (doc.getElementById("lc-ui-css")) return;
  const style = doc.createElement("style");
  style.id = "lc-ui-css";
  style.textContent = UI_CSS;
  doc.head?.appendChild(style) ?? doc.documentElement.appendChild(style);
}
