import { describe, expect, it, vi } from "vitest";

import { createPeriodOffers, periodOfferKey } from "./offers";

describe("period offers", () => {
  it("offers a period once, and never again after it was answered", () => {
    const offers = createPeriodOffers();
    const key = periodOfferKey("dispatch", "2026-01-01", "2026-09-30");

    expect(offers.isSettled(key)).toBe(false);
    offers.settle(key);
    expect(offers.isSettled(key)).toBe(true);
  });

  it("keeps views and periods apart", () => {
    const offers = createPeriodOffers();
    offers.settle(periodOfferKey("dispatch", "2026-01-01", "2026-09-30"));

    expect(offers.isSettled(periodOfferKey("dispatch", "2026-01-02", "2026-09-30"))).toBe(false);
    expect(offers.isSettled(periodOfferKey("ads", "2026-01-01", "2026-09-30"))).toBe(false);
  });

  it("tells subscribers when an answer arrives and stops after unsubscribing", () => {
    const offers = createPeriodOffers();
    const listener = vi.fn();
    const unsubscribe = offers.subscribe(listener);

    offers.settle("a");
    offers.settle("a");
    unsubscribe();
    offers.settle("b");

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
