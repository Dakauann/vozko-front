import { isPlainObject, signatureTime, sortedValue } from "./json-value";
import type { WorkflowRunLog } from "./types";

export const PIN_MAX_BYTES = 64 * 1024;

export interface NodePin {
  output: Record<string, unknown> | null;
  edge?: string;
  source: string;
  pinned_at: string;
  withheld?: boolean;
}

export type PinSourceKind = "manual" | "simulation" | "run";

export interface PinSource {
  kind: PinSourceKind;
  runId?: string;
}

export type PinDraftError = "invalid_json" | "not_object" | "too_large" | "unknown_edge";

const PINNABLE_STEP_STATUSES: ReadonlySet<string> = new Set(["executed", "skipped"]);
const RUN_SOURCE_PREFIX = "run:";

export const SIMULATION_PIN_SOURCE = "simulation";
export const MANUAL_PIN_SOURCE = "manual";

export function isWithheldPin(pin: NodePin | null | undefined): boolean {
  return pin?.withheld === true;
}

export function isPinnableStep(step: Pick<WorkflowRunLog, "status">): boolean {
  return PINNABLE_STEP_STATUSES.has(step.status);
}

export function pinSourceOf(source: string): PinSource | null {
  if (source === MANUAL_PIN_SOURCE) return { kind: "manual" };
  if (source === SIMULATION_PIN_SOURCE) return { kind: "simulation" };
  if (!source.startsWith(RUN_SOURCE_PREFIX)) return null;
  const runId = source.slice(RUN_SOURCE_PREFIX.length).trim();
  return runId ? { kind: "run", runId } : null;
}

function knownEdge(edge: string | undefined, edges: readonly string[]): string | undefined {
  return edge && edges.includes(edge) ? edge : undefined;
}

export function pinFromStep(
  step: Pick<WorkflowRunLog, "status" | "output" | "branch">,
  edgeLabels: readonly string[],
  at: Date,
): NodePin | null {
  if (!isPinnableStep(step)) return null;
  const edge = knownEdge(step.branch, edgeLabels);
  return {
    output: { ...(step.output ?? {}) },
    ...(edge ? { edge } : {}),
    source: SIMULATION_PIN_SOURCE,
    pinned_at: at.toISOString(),
  };
}

function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function parsePinDraft(input: {
  text: string;
  edge: string;
  edges: readonly string[];
  source: string;
  at: Date;
}): { pin: NodePin } | { error: PinDraftError } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.text);
  } catch {
    return { error: "invalid_json" };
  }
  if (!isPlainObject(parsed)) return { error: "not_object" };
  if (input.edge && !input.edges.includes(input.edge)) return { error: "unknown_edge" };
  if (utf8Bytes(JSON.stringify(parsed)) > PIN_MAX_BYTES) return { error: "too_large" };
  return {
    pin: {
      output: parsed,
      ...(input.edge ? { edge: input.edge } : {}),
      source: input.source,
      pinned_at: input.at.toISOString(),
    },
  };
}

export function pinEdgeOptions(
  edges: readonly { source: string; label?: string | null }[],
  nodeId: string,
): string[] {
  const labels: string[] = [];
  for (const edge of edges) {
    if (edge.source !== nodeId || !edge.label || labels.includes(edge.label)) continue;
    labels.push(edge.label);
  }
  return labels;
}

export function pinText(pin: NodePin): string {
  return JSON.stringify(pin.output, null, 2);
}

export function pinSignature(pin: NodePin | undefined | null): string {
  if (!pin) return "";
  return JSON.stringify({
    output: sortedValue(pin.output ?? {}),
    edge: pin.edge ?? "",
    source: pin.source,
    at: signatureTime(pin.pinned_at),
    ...(isWithheldPin(pin) ? { withheld: true } : {}),
  });
}
