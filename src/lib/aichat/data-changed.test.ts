import { describe, expect, it, vi } from "vitest";

import { announceDataChanged, onDataChanged } from "./data-changed";

describe("data changed", () => {
  it("tells only the screens that show the changed resource", () => {
    const target = new EventTarget();
    const ads = vi.fn();
    const leads = vi.fn();
    onDataChanged("ads", ads, target);
    onDataChanged("leads", leads, target);
    announceDataChanged("ads", target);
    expect(ads).toHaveBeenCalledTimes(1);
    expect(leads).not.toHaveBeenCalled();
  });

  it("stops listening once the screen leaves", () => {
    const target = new EventTarget();
    const ads = vi.fn();
    const stop = onDataChanged("ads", ads, target);
    stop();
    announceDataChanged("ads", target);
    announceDataChanged("", target);
    expect(ads).not.toHaveBeenCalled();
  });
});
