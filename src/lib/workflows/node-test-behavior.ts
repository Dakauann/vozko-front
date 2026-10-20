import type { NodeDefinition } from "./types";

export const NODE_TEST_BEHAVIORS = [
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
] as const;

export type NodeTestBehavior = (typeof NODE_TEST_BEHAVIORS)[number];

const KNOWN: ReadonlySet<string> = new Set(NODE_TEST_BEHAVIORS);
const NOT_A_STEP: ReadonlySet<NodeTestBehavior> = new Set(["trigger", "end", "decoration"]);
const SINGLE_INSTANCE: ReadonlySet<NodeTestBehavior> = new Set(["trigger", "end"]);

export function declaredTestBehavior(
  definition: Pick<NodeDefinition, "testBehavior"> | null | undefined,
): NodeTestBehavior | undefined {
  const declared = definition?.testBehavior;
  return declared && KNOWN.has(declared) ? declared : undefined;
}

export function testBehaviorOf(
  definitions: ReadonlyMap<string, Pick<NodeDefinition, "testBehavior">> | null | undefined,
  nodeType: string,
): NodeTestBehavior | undefined {
  return declaredTestBehavior(definitions?.get(nodeType));
}

export function isTestableBehavior(behavior: NodeTestBehavior | undefined): boolean {
  return behavior !== undefined && !NOT_A_STEP.has(behavior);
}

export function isPinnableBehavior(behavior: NodeTestBehavior | undefined): boolean {
  return isTestableBehavior(behavior);
}

export function isDebuggableBehavior(behavior: NodeTestBehavior | undefined): boolean {
  return behavior === "end" || isTestableBehavior(behavior);
}

export function isSingleInstanceBehavior(behavior: NodeTestBehavior | undefined): boolean {
  return behavior !== undefined && SINGLE_INSTANCE.has(behavior);
}
