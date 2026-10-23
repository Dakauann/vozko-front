import { describe, expect, it } from "vitest";

import { keepsRechargeKey, rechargeKeyFor } from "./recharge-key";

let counter = 0;
const nextKey = () => `key-${++counter}`;

describe("rechargeKeyFor", () => {
  it("starts a new key when there is none", () => {
    const key = rechargeKeyFor(null, { amountBrl: 50, billingType: "PIX" }, nextKey);
    expect(key.key).toMatch(/^key-/);
  });

  it("reuses the key for the same recharge so a retry never charges twice", () => {
    const first = rechargeKeyFor(null, { amountBrl: 50, billingType: "PIX" }, nextKey);
    const again = rechargeKeyFor(first, { amountBrl: 50, billingType: "PIX" }, nextKey);
    expect(again.key).toBe(first.key);
  });

  it("takes a new key when the amount or the method changes", () => {
    const first = rechargeKeyFor(null, { amountBrl: 50, billingType: "PIX" }, nextKey);
    expect(rechargeKeyFor(first, { amountBrl: 60, billingType: "PIX" }, nextKey).key).not.toBe(first.key);
    expect(rechargeKeyFor(first, { amountBrl: 50, billingType: "BOLETO" }, nextKey).key).not.toBe(first.key);
  });
});

describe("keepsRechargeKey", () => {
  it("keeps the key only when the request got no answer", () => {
    expect(keepsRechargeKey({ error: "Network error", errorStatus: null })).toBe(true);
  });

  it("drops the key after any answer, so a refused charge is not returned again", () => {
    expect(keepsRechargeKey({ error: null, errorStatus: null })).toBe(false);
    expect(keepsRechargeKey({ error: "failed to create invoice", errorStatus: 500 })).toBe(false);
    expect(keepsRechargeKey({ error: "bad", errorStatus: 400 })).toBe(false);
  });
});
