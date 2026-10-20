import { describe, expect, it } from "vitest";

import {
  isDebuggableBehavior,
  isPinnableBehavior,
  isSingleInstanceBehavior,
  isTestableBehavior,
  testBehaviorOf,
  type NodeTestBehavior,
} from "./node-test-behavior";
import type { NodeDefinition } from "./types";

const ALL: NodeTestBehavior[] = [
  "pure",
  "reads_data",
  "writes_data",
  "external_call",
  "sends_message",
  "waits",
  "ai_model",
  "voice_only",
  "trigger",
  "end",
  "decoration",
];

function definitions(entries: [string, NodeTestBehavior | undefined][]): ReadonlyMap<string, NodeDefinition> {
  return new Map(
    entries.map(([type, testBehavior]) => [
      type,
      { type, testBehavior, category: "action", label: type, description: "", icon: "", defaultConfig: {}, configSchema: null } as NodeDefinition,
    ]),
  );
}

describe("testBehaviorOf", () => {
  it("reads the behaviour the backend catalog declares", () => {
    expect(testBehaviorOf(definitions([["action_custom", "external_call"]]), "action_custom")).toBe("external_call");
  });

  it("knows nothing about a type missing from the catalog or an unknown value", () => {
    const catalog = definitions([["action_x", "made_up" as NodeTestBehavior]]);
    expect(testBehaviorOf(catalog, "group")).toBeUndefined();
    expect(testBehaviorOf(catalog, "action_x")).toBeUndefined();
    expect(testBehaviorOf(null, "action_x")).toBeUndefined();
  });
});

describe("isTestableBehavior", () => {
  it.each(ALL.map((behavior) => [behavior, !["trigger", "end", "decoration"].includes(behavior)] as const))(
    "offers the node test for %s only when the engine runs it as a step (%s)",
    (behavior, expected) => {
      expect(isTestableBehavior(behavior)).toBe(expected);
    },
  );

  it("fails closed when the catalog does not say", () => {
    expect(isTestableBehavior(undefined)).toBe(false);
  });
});

describe("isPinnableBehavior", () => {
  it("mirrors the backend pin rule: no triggers, end or decorations, and nothing unknown", () => {
    expect(isPinnableBehavior("external_call")).toBe(true);
    expect(isPinnableBehavior("trigger")).toBe(false);
    expect(isPinnableBehavior("end")).toBe(false);
    expect(isPinnableBehavior("decoration")).toBe(false);
    expect(isPinnableBehavior(undefined)).toBe(false);
  });
});

describe("isDebuggableBehavior", () => {
  it("lets testable steps and the end node stop a test, never a trigger, decoration or unknown node", () => {
    expect(isDebuggableBehavior("pure")).toBe(true);
    expect(isDebuggableBehavior("end")).toBe(true);
    expect(isDebuggableBehavior("trigger")).toBe(false);
    expect(isDebuggableBehavior("decoration")).toBe(false);
    expect(isDebuggableBehavior(undefined)).toBe(false);
  });
});

describe("isSingleInstanceBehavior", () => {
  it("marks triggers and the end node, which cannot be copied", () => {
    expect(isSingleInstanceBehavior("trigger")).toBe(true);
    expect(isSingleInstanceBehavior("end")).toBe(true);
    expect(isSingleInstanceBehavior("pure")).toBe(false);
    expect(isSingleInstanceBehavior(undefined)).toBe(false);
  });
});
