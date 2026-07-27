// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disableAutoplay } from "./watch";
import { AUTONAV_TOGGLE } from "../selectors";

function mountToggle(checked: boolean): HTMLButtonElement {
  const toggle = document.createElement("button");
  toggle.className = AUTONAV_TOGGLE.replace(/^\./, "");
  toggle.setAttribute("aria-checked", String(checked));
  toggle.addEventListener("click", () => toggle.setAttribute("aria-checked", "false"));
  document.body.appendChild(toggle);
  return toggle;
}

describe("disableAutoplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("clicks the checked toggle off within a tick and then stops polling", () => {
    const toggle = mountToggle(true);
    const clickSpy = vi.fn();
    toggle.addEventListener("click", clickSpy);

    disableAutoplay();
    vi.advanceTimersByTime(500);

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    // Interval must be cleared after the click - advancing further should
    // not click again even though the poll function would still find the
    // element (it's just no longer checked).
    vi.advanceTimersByTime(10_000);
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("does nothing if the toggle is already unchecked", () => {
    const toggle = mountToggle(false);
    const clickSpy = vi.fn();
    toggle.addEventListener("click", clickSpy);

    disableAutoplay();
    vi.advanceTimersByTime(20_000);

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("gives up polling after 15s if the toggle never appears", () => {
    disableAutoplay();
    vi.advanceTimersByTime(15_000);

    // Toggle finally appears after the give-up window - should not be clicked.
    const toggle = mountToggle(true);
    const clickSpy = vi.fn();
    toggle.addEventListener("click", clickSpy);
    vi.advanceTimersByTime(5_000);

    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("cancel() stops the poller before it ever finds the toggle", () => {
    const cancel = disableAutoplay();
    cancel();

    const toggle = mountToggle(true);
    const clickSpy = vi.fn();
    toggle.addEventListener("click", clickSpy);
    vi.advanceTimersByTime(20_000);

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
