export const REAL_CALL_NOT_CONFIRMED = "real_call_not_confirmed";

export function unconfirmedRealCalls(realCallNodes: readonly string[], confirmed: ReadonlySet<string>): string[] {
  return realCallNodes.filter((nodeId) => !confirmed.has(nodeId));
}

export function withConfirmedRealCalls(confirmed: ReadonlySet<string>, nodeIds: readonly string[]): ReadonlySet<string> {
  return new Set([...confirmed, ...nodeIds]);
}

export function isRealCallRefusal(step: { errorKind?: string }): boolean {
  return step.errorKind === REAL_CALL_NOT_CONFIRMED;
}

export type StartDecision = "ask" | "confirm" | "plain";

export function startDecision(input: {
  realCallNodes: readonly string[];
  confirmed: ReadonlySet<string>;
  reproducing: boolean;
}): StartDecision {
  if (input.realCallNodes.length === 0) return "plain";
  const allConfirmed = unconfirmedRealCalls(input.realCallNodes, input.confirmed).length === 0;
  if (allConfirmed) return "confirm";
  return input.reproducing ? "plain" : "ask";
}
