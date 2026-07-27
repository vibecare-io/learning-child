import { describe, expect, it } from "vitest";
import { matchesBlockedKeyword } from "./safety";

describe("matchesBlockedKeyword", () => {
  it("matches whole words case-insensitively", () => {
    expect(matchesBlockedKeyword("EXPLODING watermelon!", ["exploding"])).toBe("exploding");
    expect(matchesBlockedKeyword("Great explorers of the deep", ["exploding"])).toBeNull();
    expect(matchesBlockedKeyword("nothing risky here", [])).toBeNull();
  });
  it("matches multi-word phrases", () => {
    expect(matchesBlockedKeyword("DO NOT TRY this at home", ["do not try"])).toBe("do not try");
  });
  it("escapes regex metacharacters in keywords", () => {
    expect(matchesBlockedKeyword("what is c++ anyway", ["c++"])).toBe("c++");
  });
});
