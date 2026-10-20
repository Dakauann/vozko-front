import type { Workflow } from "./types";

export const AUTOSAVE_DELAY_MS = 1500;
export const MAX_AUTO_RETRIES = 5;
const BACKOFF_BASE_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
export const DRAFT_CONFLICT = "draft_conflict";

export type DraftFailureKind = "transient" | "refused" | "invalid";

export interface DraftSaveFailure {
  kind: DraftFailureKind;
  message: string;
  key: string;
  attempts: number;
  autoRetry: boolean;
}

export interface DraftConflict {
  revision: number | null;
  dismissed: boolean;
}

export interface DraftSaveState {
  revision: number | null;
  savedKey: string | null;
  savedAt: number | null;
  sending: boolean;
  failure: DraftSaveFailure | null;
  conflict: DraftConflict | null;
}

export type DraftSaveEvent =
  | { type: "sent" }
  | { type: "settled" }
  | { type: "saved"; key: string; revision: number | null; at: number }
  | { type: "failed"; key: string; kind: DraftFailureKind; message: string; autoRetry: boolean }
  | { type: "conflicted"; revision: number | null }
  | { type: "loaded"; key: string; revision: number | null; at: number }
  | { type: "revised"; revision: number }
  | { type: "overwrite" }
  | { type: "retry" }
  | { type: "dismissConflict" }
  | { type: "showConflict" };

export type DraftSaveStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "saved"; at: number | null }
  | { kind: "failed"; message: string; retryable: boolean }
  | { kind: "conflict" };

export interface DraftWriteAnswer {
  workflow: Workflow | null;
  error?: string;
  code?: string;
  status?: number;
  conflict?: { revision: number | null };
}

export interface DraftStatusCopy {
  key: "saving" | "saved" | "savedNoTime" | "failed" | "conflict";
  tone: "muted" | "healthy" | "fault" | "warning";
  action: "retry" | "resolve" | null;
}

export function initialDraftSave(input: { key: string | null; revision: number | null; savedAt: number | null }): DraftSaveState {
  return { revision: input.revision, savedKey: input.key, savedAt: input.savedAt, sending: false, failure: null, conflict: null };
}

export function initialDraftName(workflow: Pick<Workflow, "name"> | null | undefined, defaultName: string): string {
  return workflow?.name ?? defaultName;
}

export function isDraftRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

export function draftSaveReducer(state: DraftSaveState, event: DraftSaveEvent): DraftSaveState {
  switch (event.type) {
    case "sent":
      return { ...state, sending: true };
    case "settled":
      return { ...state, sending: false };
    case "saved":
    case "loaded":
      return {
        ...state,
        sending: false,
        revision: event.revision,
        savedKey: event.key,
        savedAt: event.at,
        failure: null,
        conflict: event.type === "loaded" ? null : state.conflict,
      };
    case "failed": {
      const attempts = state.failure?.key === event.key ? state.failure.attempts + 1 : 1;
      return {
        ...state,
        sending: false,
        failure: { kind: event.kind, message: event.message, key: event.key, attempts, autoRetry: event.autoRetry },
      };
    }
    case "conflicted":
      return { ...state, sending: false, failure: null, conflict: { revision: event.revision, dismissed: false } };
    case "revised":
      return state.revision !== null && state.revision >= event.revision ? state : { ...state, revision: event.revision };
    case "overwrite":
      if (!canOverwriteDraft(state)) return state;
      return { ...state, revision: state.conflict!.revision, conflict: null, failure: null };
    case "retry":
      return state.failure ? { ...state, failure: null } : state;
    case "dismissConflict":
      return state.conflict ? { ...state, conflict: { ...state.conflict, dismissed: true } } : state;
    case "showConflict":
      return state.conflict ? { ...state, conflict: { ...state.conflict, dismissed: false } } : state;
  }
}

export function canOverwriteDraft(state: DraftSaveState): boolean {
  return state.conflict !== null && state.conflict.revision !== null;
}

export function hasUnsavedDraft(state: DraftSaveState, key: string): boolean {
  return key !== state.savedKey;
}

export function canSendDraft(state: DraftSaveState, key: string): boolean {
  return !state.sending && state.conflict === null && hasUnsavedDraft(state, key);
}

function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

export function autosaveDelay(state: DraftSaveState, key: string): number | null {
  if (!canSendDraft(state, key)) return null;
  const failure = state.failure;
  if (!failure || failure.key !== key) return AUTOSAVE_DELAY_MS;
  if (failure.kind !== "transient" || !failure.autoRetry || failure.attempts >= MAX_AUTO_RETRIES) return null;
  return backoffMs(failure.attempts);
}

export function draftSaveStatus(state: DraftSaveState, key: string): DraftSaveStatus {
  if (state.conflict) return { kind: "conflict" };
  if (state.sending) return { kind: "saving" };
  if (state.failure && state.failure.key === key) {
    return { kind: "failed", message: state.failure.message, retryable: state.failure.kind !== "invalid" };
  }
  if (!hasUnsavedDraft(state, key)) {
    return state.revision === null && state.savedAt === null ? { kind: "idle" } : { kind: "saved", at: state.savedAt };
  }
  return { kind: "pending" };
}

export function draftStatusCopy(status: DraftSaveStatus): DraftStatusCopy | null {
  switch (status.kind) {
    case "idle":
      return null;
    case "pending":
    case "saving":
      return { key: "saving", tone: "muted", action: null };
    case "saved":
      return { key: status.at === null ? "savedNoTime" : "saved", tone: "healthy", action: null };
    case "failed":
      return { key: "failed", tone: "fault", action: status.retryable ? "retry" : null };
    case "conflict":
      return { key: "conflict", tone: "warning", action: "resolve" };
  }
}

export function draftFailureKindOf(error: { status?: number; code?: string }): Exclude<DraftFailureKind, "invalid"> {
  if (error.code === "timeout") return "transient";
  const status = error.status;
  if (status === undefined || status === 408 || status === 429 || status >= 500) return "transient";
  return "refused";
}

export function draftConflictOf(error: { status?: number; code?: string; details?: Record<string, unknown> }): { revision: number | null } | null {
  if (error.code !== DRAFT_CONFLICT) return null;
  const revision = error.details?.revision;
  return { revision: isDraftRevision(revision) ? revision : null };
}
