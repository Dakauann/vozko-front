import { MAX_SCREEN_MESSAGE, screenOk, screenRefusal, type ScreenReply, type ScreenTarget } from "@/lib/aichat/screen";
import type { MediaGenerationJob, MediaJobStatus, MediaKind } from "@/lib/media-generation/types";
import { firstInvalidStep, type AgentStep, type BatchPlan, type StepCheck } from "@/lib/studio/agent/batch";
import { issueText } from "@/lib/studio/agent/layer-style";
import { isCatalogIcon, type LibraryLookup } from "@/lib/studio/agent/element-ops";
import { readyItem } from "@/lib/studio/library/instantiate";
import type { DocumentIssue } from "@/lib/studio/validate";

import type { AgentPresence } from "./presence";
import type { ReplayOutcome } from "./replay";

export const FACT_TIMEOUT_MS = 6000;

export function pageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

const JOB_STATUSES: readonly MediaJobStatus[] = ["queued", "running", "settling", "done", "failed"];
const JOB_KINDS: readonly MediaKind[] = ["image", "music", "voice", "sfx", "video", "cutout", "captions", "denoise"];

const LIBRARY_OPERATIONS: ReadonlySet<string> = new Set(["add_element", "add_chart", "update_chart_data"]);

async function readyLookup(lookup: LibraryLookup, ids: readonly string[]): Promise<LibraryLookup | undefined> {
  const items = ids.flatMap((id) => lookup.items.get(id.trim()) ?? []);
  const ready = await Promise.all(items.map(readyItem));
  return ready.every(Boolean) ? lookup : undefined;
}

type LibraryOperation = { op: string; item_id?: string; icon_id?: string };

function libraryIdsOf(operation: LibraryOperation, icons: readonly string[]): string[] | null {
  if (operation.op === "add_icon") return operation.icon_id && !isCatalogIcon(operation.icon_id, icons) ? [operation.icon_id] : null;
  if (!LIBRARY_OPERATIONS.has(operation.op)) return null;
  return operation.item_id ? [operation.item_id] : [];
}

export function libraryFor(operations: readonly LibraryOperation[], load: (() => Promise<LibraryLookup>) | undefined, icons: readonly string[]): Promise<LibraryLookup | undefined> {
  const wanted = operations.map((operation) => libraryIdsOf(operation, icons)).filter((ids): ids is string[] => ids !== null);
  if (!load || wanted.length === 0) return Promise.resolve(undefined);
  return withTimeout(load().then((lookup) => readyLookup(lookup, wanted.flat())));
}

export async function withTimeout<T>(work: Promise<T>, ms: number = FACT_TIMEOUT_MS): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export interface FollowRequest<P extends string> {
  job: MediaGenerationJob;
  purpose: P;
  clipId?: string;
  layerId?: string;
  trackId?: string;
  atMs?: number;
  durationMs?: number;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => optionalString(item) !== undefined) ? [...value] : [];
}

function jobStart(job: Record<string, unknown>): Pick<MediaGenerationJob, "sourceMediaId" | "referenceMediaIds"> {
  const source = optionalString(job.sourceMediaId);
  return { referenceMediaIds: stringList(job.referenceMediaIds), ...(source ? { sourceMediaId: source } : {}) };
}

export function parseFollow<P extends string>(args: unknown, purposes: readonly P[]): FollowRequest<P> | null {
  if (!args || typeof args !== "object") return null;
  const raw = args as Record<string, unknown>;
  const job = raw.job as Record<string, unknown> | undefined;
  const purpose = raw.purpose;
  if (!job || typeof job.id !== "string" || job.id === "" || typeof purpose !== "string" || !purposes.includes(purpose as P)) return null;
  if (!JOB_KINDS.includes(job.kind as MediaKind) || !JOB_STATUSES.includes(job.status as MediaJobStatus)) return null;
  return {
    job: { id: job.id, kind: job.kind as MediaKind, status: job.status as MediaJobStatus, ...jobStart(job), createdAt: "", updatedAt: "" },
    purpose: purpose as P,
    clipId: optionalString(raw.clipId),
    layerId: optionalString(raw.layerId),
    trackId: optionalString(raw.trackId),
    atMs: optionalNumber(raw.atMs),
    durationMs: optionalNumber(raw.durationMs),
  };
}

export function ignoredOf(plan: Extract<BatchPlan<unknown>, { ok: true }>): { ignored?: string[] } {
  return plan.notes.length > 0 ? { ignored: plan.notes } : {};
}

export interface OperationNote {
  operation: number;
  op: string;
  reason: string;
}

export const BATCH_HELD = "não foi aplicada: estava certa, mas o lote só entra inteiro; reenvie junto com as recusadas corrigidas";
export const DEPENDS_ON_REFUSED = "não foi aplicada: depende de uma operação recusada";
export const REASON_CUT = "motivo omitido por falta de espaço; corrija as outras e reenvie para ver este";
export const CONCURRENT_SKIP = "não foi aplicada: o usuário mexeu no mesmo ponto ao mesmo tempo e ela deixaria o projeto inválido; leia de novo com studio_read antes de tentar outra vez";

type Refused = { index: number; op: string; reason: string };

function boundedReasons(failures: readonly Refused[]): OperationNote[] {
  let used = 0;
  return failures.map((failure) => {
    const fits = used + failure.reason.length <= MAX_SCREEN_MESSAGE - REASON_CUT.length;
    used += fits ? failure.reason.length : 0;
    return { operation: failure.index + 1, op: failure.op, reason: fits ? failure.reason : REASON_CUT };
  });
}

function refusedBatch(code: string, failures: readonly Refused[], skipped: readonly number[], operations: readonly { op: string }[]): ScreenReply {
  const refused = new Set(failures.map((failure) => failure.index));
  const waiting = new Set(skipped);
  const notApplied = operations.flatMap((operation, index) => (refused.has(index) ? [] : [{ operation: index + 1, op: operation.op, reason: waiting.has(index) ? DEPENDS_ON_REFUSED : BATCH_HELD }]));
  const message = `Nada foi aplicado: ${failures.length} de ${operations.length} operações foram recusadas e o lote só entra inteiro. Leia refused, corrija essas operações e reenvie o lote inteiro, ou diga ao usuário que a mudança não foi feita.`;
  return screenRefusal(code, message, { applied: [], refused: boundedReasons(failures), not_applied: notApplied });
}

export function planRefusal(plan: Extract<BatchPlan<unknown>, { ok: false }>, operations: readonly { op: string }[]): ScreenReply {
  return refusedBatch("operation_refused", plan.failures, plan.skipped, operations);
}

export function invalidResultRefusal<D>(steps: readonly AgentStep<D>[], operations: readonly { op: string }[], check: StepCheck<D, DocumentIssue>): ScreenReply | null {
  const invalid = firstInvalidStep(steps, check);
  if (!invalid) return null;
  const { issue, index } = invalid;
  const operation = steps[index].operation ?? index;
  return refusedBatch("invalid_result", [{ index: operation, op: operations[operation]?.op ?? "?", reason: `deixaria a arte inválida (${issue.field}: ${issueText(issue.code)})` }], [], operations);
}

type PlannedSteps = Pick<Extract<BatchPlan<unknown>, { ok: true }>, "steps" | "spread">;

export function appliedReport(plan: PlannedSteps, operations: readonly { op: string }[], outcome: ReplayOutcome): { applied: number[]; not_applied?: OperationNote[] } {
  const lost = new Set(outcome.skipped.map((step) => plan.steps[step]?.operation ?? step));
  const landed = [...new Set(plan.steps.map((step, index) => step.operation ?? index))].filter((operation) => !lost.has(operation));
  const applied = landed.map((operation) => operation + 1);
  if (lost.size === 0) return { applied };
  return { applied, not_applied: [...lost].sort((a, b) => a - b).map((operation) => ({ operation: operation + 1, op: operations[operation]?.op ?? "?", reason: CONCURRENT_SKIP })) };
}

export function spreadReport(plan: PlannedSteps): { per_artboard?: { operation: number; op: string; artboards: { artboard_id: string; layers: string[] }[] }[] } {
  if (plan.spread.length === 0) return {};
  return { per_artboard: plan.spread.map((entry) => ({ operation: entry.operation + 1, op: entry.op, artboards: entry.artboards.map((part) => ({ artboard_id: part.artboard, layers: part.ids })) })) };
}

export function concurrentOf(outcome: ReplayOutcome): { concurrent?: { kept_user_values: string[]; steps_skipped: number; note: string } } {
  if (outcome.conflicts.length === 0 && outcome.skipped.length === 0) return {};
  return {
    concurrent: {
      kept_user_values: outcome.conflicts,
      steps_skipped: outcome.skipped.length,
      note: "o usuário editou o projeto ao mesmo tempo; onde vocês dois mexeram na mesma coisa ficou o que ele fez, e passos que deixariam o projeto inválido foram pulados. Leia de novo com studio_read antes de insistir nesses pontos.",
    },
  };
}

export function stringArg(args: unknown, key: string): string | undefined {
  return args && typeof args === "object" ? optionalString((args as Record<string, unknown>)[key]) : undefined;
}

export function flagArg(args: unknown, key: string): boolean {
  return Boolean(args && typeof args === "object" && (args as Record<string, unknown>)[key] === true);
}

export function seenReply(presence: Pick<AgentPresence, "shots">, data: unknown, image: string, target: ScreenTarget): ScreenReply {
  presence.shots.add(image, target);
  return screenOk(data, [image], target);
}
