// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { waitFor } from "./dom";

describe("waitFor", () => {
  it("resolves immediately when the element exists", async () => {
    document.body.innerHTML = `<div id="x"></div>`;
    expect((await waitFor("#x")).id).toBe("x");
  });

  it("resolves when the element appears later", async () => {
    document.body.innerHTML = "";
    setTimeout(() => {
      const el = document.createElement("div");
      el.id = "later";
      document.body.appendChild(el);
    }, 10);
    expect((await waitFor("#later", 1000)).id).toBe("later");
  });

  it("rejects on timeout", async () => {
    document.body.innerHTML = "";
    await expect(waitFor("#never", 30)).rejects.toThrow(/timeout/i);
  });
});
