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

export function renderList(videos: CatalogVideo[]): HTMLElement {
  return renderContainer(videos, "lc-list");
}

/** Uses YouTube's own CSS variables so tiles follow light/dark theme. */
const UI_CSS = `
.lc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px 16px;
  padding: 24px;
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
`;

export function injectUiCss(doc: Document = document): void {
  if (doc.getElementById("lc-ui-css")) return;
  const style = doc.createElement("style");
  style.id = "lc-ui-css";
  style.textContent = UI_CSS;
  doc.head?.appendChild(style) ?? doc.documentElement.appendChild(style);
}
