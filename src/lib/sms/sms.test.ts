import { describe, expect, it } from "vitest";

import { SMS_ERROR_CODES, smsFieldOf } from "@/lib/sms/errors";
import { SMS_LIMITS } from "@/lib/sms/limits";
import { parseSmsTextCheck, parseSmsToGsm } from "@/lib/sms/parse";

describe("SMS limits", () => {
  it("mirrors the route and text limits of vozko-back domain/sms, the text cap being 8 parts of 153 as in sms.Capabilities", () => {
    expect(SMS_LIMITS).toEqual({ maxSegments: 8, minBrandPrefixRunes: 2, maxBrandPrefixRunes: 20, maxTextRunes: 1224 });
  });
});

describe("parseSmsTextCheck", () => {
  const check = {
    measurement: { encoding: "ucs2", units: 74, segments: 2, per_segment: 67, remaining: 60 },
    composed_text: "Loja: Olá, {{1}}! Sua entrega chegou.",
    variable_slots: 0,
    issues: [{ code: "sms_text_too_long" }],
    price: { charge_kind: "sms_segment", unit_micros: 90000, quantity: 2, total_micros: 180000 },
  };

  it("reads the backend measurement exactly", () => {
    expect(parseSmsTextCheck(check)).toEqual(check);
  });

  it("reads issues written as null", () => {
    expect(parseSmsTextCheck({ ...check, issues: null })).toEqual({ ...check, issues: [] });
  });

  it("refuses an unknown encoding or charge kind", () => {
    expect(parseSmsTextCheck({ ...check, measurement: { ...check.measurement, encoding: "latin1" } })).toBeNull();
    expect(parseSmsTextCheck({ ...check, price: { ...check.price, charge_kind: "rcs_basic" } })).toBeNull();
  });

  it("refuses negative or fractional counts", () => {
    expect(parseSmsTextCheck({ ...check, measurement: { ...check.measurement, units: -1 } })).toBeNull();
    expect(parseSmsTextCheck({ ...check, price: { ...check.price, quantity: 1.5 } })).toBeNull();
  });

  it("reads an empty composed text", () => {
    expect(parseSmsTextCheck({ ...check, composed_text: "" })?.composed_text).toBe("");
  });
});

describe("parseSmsToGsm", () => {
  it("reads the converted text, empty included", () => {
    expect(parseSmsToGsm({ text: "Ola, voce" })).toEqual({ text: "Ola, voce" });
    expect(parseSmsToGsm({ text: "" })).toEqual({ text: "" });
    expect(parseSmsToGsm({})).toBeNull();
  });
});

describe("SMS error codes", () => {
  it("lists each code once", () => {
    expect(new Set(SMS_ERROR_CODES).size).toBe(SMS_ERROR_CODES.length);
  });

  it("names the field a route refusal belongs to", () => {
    expect(smsFieldOf("sms_route_paused")).toBe("route");
    expect(smsFieldOf("sms_text_too_long")).toBe("text");
    expect(smsFieldOf("carrier_quiet_hours")).toBeNull();
  });
});
