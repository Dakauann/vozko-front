import type { CallBlocker } from "@/lib/call-session/call-readiness";

const NUMBER_REFUSALS = ["blocked", "opted_out", "invalid_number", "refused"] as const;
const LEAD_REFUSALS = [...NUMBER_REFUSALS, "no_number"] as const;
const TRUNK_REFUSALS = ["unauthorized", "no_dialable_trunk", "refused"] as const;
const FAILURES = ["forbidden", "lead_not_found", "unavailable"] as const;
const UNKNOWN_REFUSAL = "refused";

export type DialNumberRefusal = (typeof NUMBER_REFUSALS)[number];
export type DialLeadRefusal = (typeof LEAD_REFUSALS)[number];
export type DialTrunkRefusal = (typeof TRUNK_REFUSALS)[number];
export type DialTargetsFailure = (typeof FAILURES)[number];

export interface DialTargetNumber {
  number: string;
  identity: boolean;
  label?: string;
  phoneId?: string;
  refusal?: DialNumberRefusal;
}

export interface DialTrunk {
  id: string;
  name: string;
}

export interface DialTargets {
  leadId: string;
  refusal?: DialLeadRefusal;
  callable?: string;
  numbers: DialTargetNumber[];
  trunks: DialTrunk[];
  trunkRefusal?: DialTrunkRefusal;
}

export const DIAL_BLOCKERS = [
  "noPermission",
  "connecting",
  "busy",
  "checking",
  ...FAILURES,
  "linesForbidden",
  "blocked",
  "opted_out",
  "invalid_number",
  "no_number",
  "number_not_held",
  "unauthorized",
  "no_dialable_trunk",
  UNKNOWN_REFUSAL,
] as const;

export type DialBlocker = (typeof DIAL_BLOCKERS)[number];

function refusalOf<T extends string>(known: readonly T[], value: unknown): T | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  return (known as readonly string[]).includes(value) ? (value as T) : (UNKNOWN_REFUSAL as T);
}

interface DialTargetsBody {
  leadId?: unknown;
  refusal?: unknown;
  callable?: unknown;
  numbers?: unknown;
  trunks?: unknown;
  trunkRefusal?: unknown;
}

interface DialTargetNumberBody {
  number?: unknown;
  identity?: unknown;
  label?: unknown;
  phoneId?: unknown;
  refusal?: unknown;
}

interface DialTrunkBody {
  id?: unknown;
  name?: unknown;
}

function presentText(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function readNumber(body: DialTargetNumberBody): DialTargetNumber {
  const refusal = refusalOf(NUMBER_REFUSALS, body.refusal);
  const label = presentText(body.label);
  const phoneId = presentText(body.phoneId);
  return {
    number: String(body.number ?? ""),
    identity: body.identity === true,
    ...(label ? { label } : {}),
    ...(phoneId ? { phoneId } : {}),
    ...(refusal ? { refusal } : {}),
  };
}

function readTrunk(body: DialTrunkBody): DialTrunk {
  return { id: String(body.id ?? ""), name: String(body.name ?? "") };
}

export function readDialTargets(body: DialTargetsBody): DialTargets {
  const refusal = refusalOf(LEAD_REFUSALS, body.refusal);
  const trunkRefusal = refusalOf(TRUNK_REFUSALS, body.trunkRefusal);
  const callable = presentText(body.callable);
  return {
    leadId: String(body.leadId ?? ""),
    ...(refusal ? { refusal } : {}),
    ...(callable ? { callable } : {}),
    numbers: Array.isArray(body.numbers) ? body.numbers.map((number: DialTargetNumberBody) => readNumber(number)) : [],
    trunks: Array.isArray(body.trunks) ? body.trunks.map((trunk: DialTrunkBody) => readTrunk(trunk)) : [],
    ...(trunkRefusal ? { trunkRefusal } : {}),
  };
}

export function callableNumber(targets: DialTargets): DialTargetNumber | null {
  if (!targets.callable) return null;
  return targets.numbers.find((number) => number.number === targets.callable && !number.refusal) ?? null;
}

export function numberRefusal(targets: DialTargets, number: string): DialNumberRefusal | "number_not_held" | null {
  const held = targets.numbers.find((candidate) => candidate.number === number);
  if (!held) return "number_not_held";
  return held.refusal ?? null;
}

export function dialTargetsFailure(error: { status?: number; code?: string }): DialTargetsFailure {
  if (error.status === 403) return "forbidden";
  if (error.status === 404 || error.code === "lead_not_found") return "lead_not_found";
  return "unavailable";
}

export class DialTargetsError extends Error {
  readonly failure: DialTargetsFailure;
  readonly status?: number;

  constructor(message: string, failure: DialTargetsFailure, status?: number) {
    super(message);
    this.name = "DialTargetsError";
    this.failure = failure;
    this.status = status;
  }
}

export interface DialBlockerInput {
  readiness: CallBlocker | null;
  status: "loading" | "ready" | "error";
  failure: DialTargetsFailure | null;
  targets?: DialTargets | null;
  linesOnly?: boolean;
  number?: string;
}

function leadRefusal(targets: DialTargets, number: string | undefined): DialBlocker | null {
  if (number !== undefined) return numberRefusal(targets, number);
  if (targets.refusal) return targets.refusal;
  return callableNumber(targets) ? null : "no_number";
}

function targetRefusal(targets: DialTargets, linesOnly: boolean, number: string | undefined): DialBlocker | null {
  if (!linesOnly) {
    const refusal = leadRefusal(targets, number);
    if (refusal) return refusal;
  }
  if (targets.trunkRefusal) return targets.trunkRefusal;
  if (targets.trunks.length === 0) return "no_dialable_trunk";
  return null;
}

function failureBlocker(failure: DialTargetsFailure | null, linesOnly: boolean): DialBlocker {
  if (linesOnly && failure === "forbidden") return "linesForbidden";
  return failure ?? "unavailable";
}

export function dialBlocker({ readiness, status, failure, targets, linesOnly = false, number }: DialBlockerInput): DialBlocker | null {
  if (readiness === "noPermission") return "noPermission";
  if (status === "loading") return "checking";
  if (status === "error") return failureBlocker(failure, linesOnly);
  if (!targets) return "unavailable";
  return targetRefusal(targets, linesOnly, number) ?? readiness;
}
