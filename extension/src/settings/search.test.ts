import { describe, expect, it } from "vitest";
import { matchesQuery } from "./search";

describe("matchesQuery", () => {
  it("matches everything on an empty/whitespace query", () => {
    expect(matchesQuery("anything", "")).toBe(true);
    expect(matchesQuery("anything", "   ")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesQuery("Supervised mode", "SUPERVISED")).toBe(true);
  });

  it("requires every term to appear (AND semantics)", () => {
    const hay = "Reels allowed before a break";
    expect(matchesQuery(hay, "reel break")).toBe(true);
    expect(matchesQuery(hay, "reel xyz")).toBe(false);
  });

  it("matches on partial words / keyword blobs", () => {
    expect(matchesQuery("blocked words keywords title filter", "keyword")).toBe(true);
    expect(matchesQuery("Catalog source production custom", "custom url".replace(" url", ""))).toBe(true);
  });

  it("ignores diacritics on both sides", () => {
    expect(matchesQuery("Réglages", "reglages")).toBe(true);
  });
});
