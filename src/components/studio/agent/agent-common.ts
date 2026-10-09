import { MAX_SCREEN_MESSAGE, screenRefusal, type ScreenReply } from "@/lib/aichat/screen";
import type { MediaGenerationJob, MediaJobStatus, MediaKind } from "@/lib/media-generation/types";
import { firstInvalidStep, type AgentStep, type BatchPlan, type StepCheck } from "@/lib/studio/agent/batch";
import { issueText } from "@/lib/studio/agent/layer-style";
import type { DocumentIssue } from "@/lib/studio/validate";

export const FACT_TIMEOUT_MS = 6000;

export function pageHidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

const JOB_STATUSES: readonly MediaJobStatus[] = ["queued", "running", "settling", "done", "failed"];
const JOB_KINDS: readonly MediaKind[] = ["image", "music", "voice", "video", "cutout", "captions", "denoise"];

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

export function parseFollow<P extends string>(args: unknown, purposes: readonly P[]): FollowRequest<P> | null {
  if (!args || typeof args !== "object") return null;
  const raw = args as Record<string, unknown>;
  const job = raw.job as Record<string, unknown> | undefined;
  const purpose = raw.purpose;
  if (!job || typeof job.id !== "string" || job.id === "" || typeof purpose !== "string" || !purposes.includes(purpose as P)) return null;
  if (!JOB_KINDS.includes(job.kind as MediaKind) || !JOB_STATUSES.includes(job.status as MediaJobStatus)) return null;
  return {
    job: { id: job.id, kind: job.kind as MediaKind, status: job.status as MediaJobStatus, referenceMediaIds: [], createdAt: "", updatedAt: "" },
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

const REFUSAL_CLOSING = " Corrija essas operações e reenvie o lote inteiro.";

export function planRefusal(plan: Extract<BatchPlan<unknown>, { ok: false }>): ScreenReply {
  const skipped = plan.skipped.length > 0 ? ` As operações ${plan.skipped.map((i) => i + 1).join(", ")} dependem dessas e também não foram aplicadas.` : "";
  const budget = MAX_SCREEN_MESSAGE - skipped.length - REFUSAL_CLOSING.length - 40;
  const lines: string[] = [];
  let used = 0;
  for (const failure of plan.failures) {
    const line = `operação ${failure.index + 1} (${failure.op}): ${failure.reason}`;
    if (used + line.length + 2 > budget) break;
    lines.push(line);
    used += line.length + 2;
  }
  const rest = plan.failures.length - lines.length;
  const more = rest > 0 ? `; e mais ${rest} com problema` : "";
  return screenRefusal("operation_refused", `Nada foi aplicado. ${lines.join("; ")}${more}.${skipped}${REFUSAL_CLOSING}`);
}

export function invalidResultRefusal<D>(steps: readonly AgentStep<D>[], operations: readonly { op: string }[], check: StepCheck<D, DocumentIssue>): ScreenReply | null {
  const invalid = firstInvalidStep(steps, check);
  if (!invalid) return null;
  const { issue, index } = invalid;
  return screenRefusal(
    "invalid_result",
    `a operação ${index + 1} (${operations[index]?.op ?? "?"}) deixaria a arte inválida (${issue.field}: ${issueText(issue.code)}). Nada foi aplicado; corrija essa operação e envie o lote de novo.`,
  );
}

export const INTERRUPTED = screenRefusal("user_changed", "o usuário mexeu no projeto enquanto você editava; nada foi aplicado. Leia de novo com studio_read.");

export function stringArg(args: unknown, key: string): string | undefined {
  return args && typeof args === "object" ? optionalString((args as Record<string, unknown>)[key]) : undefined;
}

export function flagArg(args: unknown, key: string): boolean {
  return Boolean(args && typeof args === "object" && (args as Record<string, unknown>)[key] === true);
}
