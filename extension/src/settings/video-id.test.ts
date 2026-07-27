import { describe, expect, it } from "vitest";
import { extractVideoId } from "./video-id";

describe("extractVideoId", () => {
  it("accepts raw ids and common URL shapes", () => {
    expect(extractVideoId("XZ6j5-nBFyc")).toBe("XZ6j5-nBFyc");
    expect(extractVideoId("https://www.youtube.com/watch?v=XZ6j5-nBFyc&t=10")).toBe("XZ6j5-nBFyc");
    expect(extractVideoId("https://youtu.be/XZ6j5-nBFyc?si=abc")).toBe("XZ6j5-nBFyc");
    expect(extractVideoId("https://www.youtube.com/shorts/XZ6j5-nBFyc")).toBe("XZ6j5-nBFyc");
  });
  it("rejects garbage", () => {
    expect(extractVideoId("not a video")).toBeNull();
    expect(extractVideoId("https://example.com/")).toBeNull();
  });
});
