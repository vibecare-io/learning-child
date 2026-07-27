import { describe, expect, it } from "vitest";
import { channelRefFromHref, isAllowed } from "./search-filter";
import type { AllowedChannels } from "../../shared/types";

const allowed: AllowedChannels = {
  channelIds: ["UCgood"],
  handles: ["@goodchannel"],
};

describe("channelRefFromHref", () => {
  it("extracts channel ids and lowercased handles", () => {
    expect(channelRefFromHref("/channel/UCgood")).toBe("UCgood");
    expect(channelRefFromHref("/@GoodChannel")).toBe("@goodchannel");
    expect(channelRefFromHref("https://www.youtube.com/@GoodChannel/videos")).toBe("@goodchannel");
    expect(channelRefFromHref("/watch?v=x")).toBeNull();
  });
});

describe("isAllowed", () => {
  it("matches by channel id or handle, rejects everything else", () => {
    expect(isAllowed("/channel/UCgood", allowed)).toBe(true);
    expect(isAllowed("/@goodchannel", allowed)).toBe(true);
    expect(isAllowed("/@GOODCHANNEL", allowed)).toBe(true);
    expect(isAllowed("/channel/UCevil", allowed)).toBe(false);
    expect(isAllowed("/@clickbait", allowed)).toBe(false);
    expect(isAllowed(null, allowed)).toBe(false);
  });
});
