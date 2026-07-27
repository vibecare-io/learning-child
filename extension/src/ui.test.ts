// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { formatDuration, injectUiCss, renderDoneToday, renderGrid, renderList } from "./ui";
import type { CatalogVideo } from "../../shared/types";

const videos: CatalogVideo[] = [
  {
    id: "abc", title: "Star stuff", channel: "Space Kids", channelId: "UC1",
    durationSec: 754, publishedAt: "2026-01-01T00:00:00Z", topics: ["space"],
    profiles: ["big"], thumbnail: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
  },
];

describe("formatDuration", () => {
  it("formats mm:ss and h:mm:ss", () => {
    expect(formatDuration(754)).toBe("12:34");
    expect(formatDuration(3723)).toBe("1:02:03");
    expect(formatDuration(45)).toBe("0:45");
  });
});

describe("renderGrid", () => {
  it("renders one tile per video linking to the watch page", () => {
    const grid = renderGrid(videos);
    expect(grid.classList.contains("lc-grid")).toBe(true);
    const tiles = grid.querySelectorAll("a.lc-tile");
    expect(tiles).toHaveLength(1);
    expect(tiles[0].getAttribute("href")).toBe("/watch?v=abc");
    expect(tiles[0].querySelector("img")!.src).toContain("abc");
    expect(tiles[0].textContent).toContain("Star stuff");
    expect(tiles[0].textContent).toContain("Space Kids");
    expect(tiles[0].textContent).toContain("12:34");
  });
});

describe("renderList", () => {
  it("renders tiles in list mode", () => {
    const list = renderList(videos);
    expect(list.classList.contains("lc-list")).toBe(true);
    expect(list.querySelectorAll("a.lc-tile")).toHaveLength(1);
  });
});

describe("renderDoneToday", () => {
  it("renders a calm full-width panel with warm copy and no thumbnails/chips", () => {
    const panel = renderDoneToday();
    expect(panel.id).toBe("lc-done-today");
    expect(panel.querySelectorAll("img")).toHaveLength(0);
    expect(panel.querySelectorAll(".lc-tile")).toHaveLength(0);
    expect(panel.querySelectorAll(".lc-chip")).toHaveLength(0);
    expect(panel.textContent).toContain("time for real-world adventures");
  });
});

describe("injectUiCss", () => {
  it("is idempotent", () => {
    injectUiCss(document);
    injectUiCss(document);
    expect(document.querySelectorAll("#lc-ui-css")).toHaveLength(1);
  });
});
