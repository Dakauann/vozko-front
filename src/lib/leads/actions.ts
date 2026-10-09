import type { CodedError, CodedTranslator } from "@/lib/api/coded-error";
import { parseCallList, type CallList, type CallListPhoneSource } from "@/lib/call-lists/types";
import type { CrmFilter } from "@/lib/crm/board";
import {
  SEND_SKIP_REASONS,
  parseSendQuote,
  parseSendReview,
  reasonRows,
  type LeadSendAction,
  type LeadSendParams,
  type SendQuote,
  type SendReview,
  type SendSkipRow,
} from "@/lib/leads/sends";
import type { LeadPhoneLabel } from "@/lib/leads/types";
import type { ReportJob } from "@/lib/reports/types";
import type { SelectionMode } from "@/lib/selection/bulk-state";
import { selectionErrorMessage } from "@/lib/selection/errors";

export type LeadActionKind = "classify" | "assign_owner" | "block" | "export" | "meta_audience" | "call_list" | LeadSendAction;

export interface LeadSelectionSort {
  field: string;
  key?: string;
  desc?: boolean;
}

export interface LeadSelection {
  mode: SelectionMode;
  ids?: string[];
  filter?: CrmFilter;
  sort?: LeadSelectionSort[];
  limit?: number;
  expectedCount?: number;
  fingerprint?: string;
}

export interface LeadActionParams {
  key?: string;
  value?: unknown;
  ownerId?: string;
  blocked?: boolean;
  format?: "csv";
  addresses?: boolean;
  sensitive?: boolean;
  adAccountId?: string;
  name?: string;
  description?: string;
  callList?: CallListParams;
  send?: LeadSendParams;
}

export interface CallListParams {
  name: string;
  assigneeIds: string[];
  phoneSource: CallListPhoneSource;
  phoneLabel?: LeadPhoneLabel;
}

export interface LeadActionRequest {
  action: LeadActionKind;
  params: LeadActionParams;
  selection: LeadSelection;
}

export const LEAD_ACTION_SKIP_REASONS = ["unchanged", "gone"] as const;

export type LeadActionSkips = Record<string, number>;

export type LeadActionPreviewStatus = "running" | "done" | "failed";

export interface LeadActionPreview {
  id: string;
  action: string;
  status: LeadActionPreviewStatus;
  result: {
    matched: number;
    expectedCount: number;
    fingerprint: string;
    selected: number;
    eligible: number;
    skipped: LeadActionSkips;
  };
  failureCode?: string;
  updatedAt?: string;
  send?: SendQuote;
}

export type LeadActionRunStatus = "queued" | "running" | "done" | "failed";

export interface LeadActionRun {
  id: string;
  action: string;
  status: LeadActionRunStatus;
  phase?: string;
  actorId?: string;
  params?: Record<string, unknown>;
  result: {
    matched: number;
    selected: number;
    processed: number;
    changed: number;
    skipped: LeadActionSkips;
    metaApplied?: number;
    metaFailed?: number;
    metaUnavailable?: boolean;
  };
  failureCode?: string;
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
}

export type LeadAudienceStatus = "pending" | "done" | "failed";

export interface LeadAudienceJob {
  id: string;
  status: LeadAudienceStatus;
  audience?: { id?: string; name?: string } & Record<string, unknown>;
  matched: number;
  skipped: number;
  failureCode?: string;
  startedAt?: string;
  updatedAt?: string;
}

export interface LeadActionStart {
  action: LeadActionKind;
  run?: LeadActionRun;
  report?: ReportJob;
  audience?: LeadAudienceJob;
  callList?: CallList;
  send?: SendReview;
}

export const LEAD_ACTION_ERROR_CODES = [
  "forbidden",
  "lead_action_unknown",
  "lead_action_params_ambiguous",
  "lead_action_key_required",
  "lead_action_value_required",
  "lead_action_owner_required",
  "lead_action_blocked_required",
  "lead_action_format_unsupported",
  "lead_action_ad_account_required",
  "lead_action_name_required",
  "lead_action_requirement_unknown",
  "lead_action_workspace_required",
  "lead_action_actor_required",
  "idempotency_key_required",
  "idempotency_key_reused",
  "lead_action_not_a_run",
  "lead_action_run_not_found",
  "lead_action_preview_not_found",
  "lead_action_claim_lost",
  "lead_actions_unavailable",
  "lead_action_selection_too_large",
  "lead_action_selection_empty",
  "lead_action_mode_unsupported",
  "lead_action_in_progress",
  "lead_action_phone_unavailable",
  "lead_action_snapshot_lost",
  "lead_action_audience_not_found",
  "lead_owner_out_of_reach",
  "report_forbidden",
  "reports_unavailable",
  "audience_sensitive_filter",
  "no_customers_matched",
  "audience_terms_not_accepted",
  "reconnect_required",
  "not_found",
] as const;

export const LEAD_ACTION_PREVIEW_NOT_FOUND = "lead_action_preview_not_found";

export const LEAD_ACTION_FAILURE_CODES = ["stalled", "forbidden", "invalid", "internal", "snapshot_lost", "unknown"] as const;

const PREVIEW_STATUSES: readonly string[] = ["running", "done", "failed"];
const RUN_STATUSES: readonly string[] = ["queued", "running", "done", "failed"];
const AUDIENCE_STATUSES: readonly string[] = ["pending", "done", "failed"];
const ACTIONS: readonly string[] = ["classify", "assign_owner", "block", "export", "meta_audience", "call_list", "send_template", "send_unofficial"];
const SENDS: readonly string[] = ["send_template", "send_unofficial"];
const RECORD_EDITS: readonly string[] = ["classify", "assign_owner", "block"];

export function leadActionSkipRows(action: string, skipped: Record<string, number>): SendSkipRow[] {
  return reasonRows(skipped, isLeadSendAction(action) ? SEND_SKIP_REASONS : LEAD_ACTION_SKIP_REASONS);
}

export function isRecordEdit(action: string): boolean {
  return RECORD_EDITS.includes(action);
}

export function isLeadSendAction(action: string): action is LeadSendAction {
  return SENDS.includes(action);
}

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function skipsOf(value: unknown): LeadActionSkips | null {
  if (value === undefined || value === null) return {};
  if (!isJson(value)) return null;
  const skips: LeadActionSkips = {};
  for (const [reason, count] of Object.entries(value)) {
    if (!isCount(count)) return null;
    skips[reason] = count;
  }
  return skips;
}

function withOptional<T extends Json>(base: T, extra: Json): T {
  const out: Json = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

export function parseLeadActionPreview(value: unknown): LeadActionPreview | null {
  if (!isJson(value) || typeof value.id !== "string" || typeof value.action !== "string") return null;
  if (typeof value.status !== "string" || !PREVIEW_STATUSES.includes(value.status)) return null;
  const result = value.result;
  if (!isJson(result) || typeof result.fingerprint !== "string") return null;
  const { matched, expectedCount, selected, eligible } = result;
  if (!isCount(matched) || !isCount(expectedCount) || !isCount(selected) || !isCount(eligible)) return null;
  const skipped = skipsOf(result.skipped);
  if (!skipped) return null;
  const send = value.send === undefined || value.send === null ? undefined : parseSendQuote(value.send);
  if (send === null) return null;
  return withOptional(
    {
      id: value.id,
      action: value.action,
      status: value.status as LeadActionPreviewStatus,
      result: { matched, expectedCount, fingerprint: result.fingerprint, selected, eligible, skipped },
    },
    { failureCode: optionalString(value.failureCode), updatedAt: optionalString(value.updatedAt), send },
  );
}

export function parseLeadActionRun(value: unknown): LeadActionRun | null {
  if (!isJson(value) || typeof value.id !== "string" || typeof value.action !== "string") return null;
  if (typeof value.status !== "string" || !RUN_STATUSES.includes(value.status)) return null;
  const result = value.result;
  if (!isJson(result)) return null;
  const { matched, selected, processed, changed } = result;
  if (!isCount(matched) || !isCount(selected) || !isCount(processed) || !isCount(changed)) return null;
  const skipped = skipsOf(result.skipped);
  if (!skipped) return null;
  return withOptional(
    {
      id: value.id,
      action: value.action,
      status: value.status as LeadActionRunStatus,
      result: withOptional(
        { matched, selected, processed, changed, skipped },
        {
          metaApplied: isCount(result.metaApplied) ? result.metaApplied : undefined,
          metaFailed: isCount(result.metaFailed) ? result.metaFailed : undefined,
          metaUnavailable: result.metaUnavailable === true ? true : undefined,
        },
      ),
    },
    {
      phase: optionalString(value.phase),
      actorId: optionalString(value.actorId),
      params: isJson(value.params) ? value.params : undefined,
      failureCode: optionalString(value.failureCode),
      createdAt: optionalString(value.createdAt),
      startedAt: optionalString(value.startedAt),
      finishedAt: optionalString(value.finishedAt),
    },
  );
}

export function parseLeadAudienceJob(value: unknown): LeadAudienceJob | null {
  if (!isJson(value) || typeof value.id !== "string") return null;
  if (typeof value.status !== "string" || !AUDIENCE_STATUSES.includes(value.status)) return null;
  if (!isCount(value.matched) || !isCount(value.skipped)) return null;
  return withOptional(
    { id: value.id, status: value.status as LeadAudienceStatus, matched: value.matched, skipped: value.skipped },
    {
      audience: isJson(value.audience) ? value.audience : undefined,
      failureCode: optionalString(value.failureCode),
      startedAt: optionalString(value.startedAt),
      updatedAt: optionalString(value.updatedAt),
    },
  );
}

function isReportJob(value: unknown): value is ReportJob {
  return isJson(value) && typeof value.id === "string" && typeof value.status === "string";
}

export function parseLeadActionStart(value: unknown): LeadActionStart | null {
  if (!isJson(value) || typeof value.action !== "string" || !ACTIONS.includes(value.action)) return null;
  const action = value.action as LeadActionKind;
  if (isRecordEdit(action)) {
    const run = parseLeadActionRun(value.run);
    return run ? { action, run } : null;
  }
  if (action === "export") {
    return isReportJob(value.report) ? { action, report: value.report } : null;
  }
  if (isLeadSendAction(action)) {
    const send = parseSendReview(value.send);
    return send ? { action, send } : null;
  }
  if (action === "call_list") {
    const callList = parseCallList(value.callList);
    return callList ? { action, callList } : null;
  }
  const audience = parseLeadAudienceJob(value.audience);
  return audience ? { action, audience } : null;
}

export interface LeadActionPreviewProgress {
  done: number;
  total: number;
}

export function leadActionPreviewProgress(preview: LeadActionPreview | null): LeadActionPreviewProgress | null {
  if (!preview || preview.status !== "running") return null;
  const { expectedCount, matched, selected } = preview.result;
  const total = expectedCount > 0 ? expectedCount : matched;
  return total > 0 ? { done: Math.min(selected, total), total } : null;
}

export function leadActionPreviewSelected(preview: LeadActionPreview | null): number {
  return preview?.result.selected ?? 0;
}

export function isTerminalRun(status: LeadActionRunStatus): boolean {
  return status === "done" || status === "failed";
}

export function isTerminalAudience(status: LeadAudienceStatus): boolean {
  return status === "done" || status === "failed";
}

export function leadActionErrorMessage(translators: readonly CodedTranslator[], error: CodedError): string {
  const key = `errors.${error.code ?? ""}`;
  if (error.code) {
    const found = translators.find((t) => t.has(key));
    if (found) return found(key);
  }
  const fallback = translators[translators.length - 1];
  return selectionErrorMessage(fallback, { ...error, code: undefined });
}
