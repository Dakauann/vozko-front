import { describe, expect, it } from "vitest";

import { isRealCallRefusal, startDecision, unconfirmedRealCalls, withConfirmedRealCalls } from "./real-calls";

describe("unconfirmedRealCalls", () => {
  it("asks about every real call node the first time", () => {
    expect(unconfirmedRealCalls(["n2", "n1"], new Set())).toEqual(["n2", "n1"]);
  });

  it("asks nothing once the same nodes were confirmed in this session", () => {
    const confirmed = withConfirmedRealCalls(new Set(), ["n1", "n2"]);
    expect(unconfirmedRealCalls(["n1", "n2"], confirmed)).toEqual([]);
  });

  it("asks again only about a node added after the confirmation", () => {
    const confirmed = withConfirmedRealCalls(new Set(), ["n1"]);
    expect(unconfirmedRealCalls(["n1", "n9"], confirmed)).toEqual(["n9"]);
  });

  it("asks nothing when the test makes no real call", () => {
    expect(unconfirmedRealCalls([], new Set())).toEqual([]);
  });
});

describe("withConfirmedRealCalls", () => {
  it("keeps earlier confirmations and returns a new set", () => {
    const first = new Set(["n1"]);
    const next = withConfirmedRealCalls(first, ["n2"]);
    expect([...next].sort()).toEqual(["n1", "n2"]);
    expect(next).not.toBe(first);
  });
});

describe("isRealCallRefusal", () => {
  it("recognises the step the simulation refused for lack of confirmation", () => {
    expect(isRealCallRefusal({ errorKind: "real_call_not_confirmed" })).toBe(true);
    expect(isRealCallRefusal({ errorKind: "http_status" })).toBe(false);
    expect(isRealCallRefusal({})).toBe(false);
  });
});

describe("startDecision", () => {
  it("asks before a plain test that would call nodes not yet confirmed", () => {
    expect(startDecision({ realCallNodes: ["n1"], confirmed: new Set(), reproducing: false })).toBe("ask");
  });

  it("confirms on the new session without asking again once the nodes were confirmed", () => {
    expect(startDecision({ realCallNodes: ["n1"], confirmed: new Set(["n1"]), reproducing: false })).toBe("confirm");
  });

  it("starts plainly when nothing would call out", () => {
    expect(startDecision({ realCallNodes: [], confirmed: new Set(), reproducing: false })).toBe("plain");
  });

  it("never asks before a reproduction, since it replays recorded responses; a node it cannot replay offers the confirmation on its own step", () => {
    expect(startDecision({ realCallNodes: ["n1"], confirmed: new Set(), reproducing: true })).toBe("plain");
    expect(startDecision({ realCallNodes: ["n1"], confirmed: new Set(["n1"]), reproducing: true })).toBe("confirm");
  });
});
