/**
 * ALL YouTube DOM selectors live here. Never inline a selector in an adapter.
 * When YouTube breaks the extension, this is the only file to fix.
 */

/** Hidden pre-paint by the lc-hide style. Broad, container-level, slow-churn. */
export const HIDE_SELECTORS = [
  // Home recommendation grid contents (our grid is injected alongside)
  "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer #contents",
  // Watch-page related videos / up next
  "#related",
  // Comments
  "ytd-comments#comments",
  // Shorts shelves and nav entries
  "ytd-reel-shelf-renderer",
  "ytd-rich-shelf-renderer[is-shorts]",
  "ytd-guide-entry-renderer:has(a[href^='/shorts'])",
  "ytd-mini-guide-entry-renderer:has(a[href^='/shorts'])",
  // Trending / Explore nav entries
  "ytd-guide-entry-renderer:has(a[href='/feed/trending'])",
  "ytd-guide-entry-renderer:has(a[href='/feed/explore'])",
  // Notification bell
  "ytd-notification-topbar-button-renderer",
  // End-screen suggestion cards + grid
  ".ytp-ce-element",
  ".ytp-endscreen-content",
];

/** Home grid container - our curated grid is inserted before it. */
export const HOME_GRID = "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer";

/** Watch page right-hand column - our up-next list is prepended into it. */
export const WATCH_SIDEBAR = "#secondary.ytd-watch-flexy";

/** Search results list container (observed for infinite scroll). */
export const SEARCH_RESULTS = "ytd-search #contents";

/** A single organic search result. */
export const SEARCH_RESULT_ITEM = "ytd-video-renderer";

/** Channel link inside a search result (href is /channel/UC… or /@handle). */
export const CHANNEL_LINK_IN_RESULT = "ytd-channel-name a";

/** Non-video shelves in search results (Shorts, "people also watched", …). */
export const SEARCH_SHELF_ITEMS = "ytd-reel-shelf-renderer, ytd-shelf-renderer, ytd-horizontal-card-list-renderer";

/** Player autoplay-next toggle (aria-checked reflects state). */
export const AUTONAV_TOGGLE = ".ytp-autonav-toggle-button";
