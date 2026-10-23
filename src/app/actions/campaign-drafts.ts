import { apiClient, type ApiResult } from "@/lib/api/browser-client";
import type {
  CampaignDraft,
  DraftChannel,
  DraftLaunchRequest,
  DraftLaunchResult,
  DraftList,
  DraftReviewOf,
  DraftSaveRequest,
} from "@/lib/campaign-drafts/types";

export interface DraftActionError {
  error: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

export type DraftActionResult<T> = { data: T } | DraftActionError;

export function isDraftActionError<T>(result: DraftActionResult<T>): result is DraftActionError {
  return "error" in result;
}

function draftsPath(channel: DraftChannel, id?: string, section?: string): string {
  const base = `/campaign-drafts/${channel}`;
  if (!id) return base;
  const item = `${base}/${encodeURIComponent(id)}`;
  return section ? `${item}/${section}` : item;
}

function settle<T>(result: ApiResult<T>, empty?: T): DraftActionResult<T> {
  if (result.error) {
    return {
      error: result.error.message,
      ...(result.error.code ? { code: result.error.code } : {}),
      ...(result.error.status !== undefined ? { status: result.error.status } : {}),
      ...(result.error.details ? { details: result.error.details } : {}),
    };
  }
  if (result.data === undefined || result.data === null) {
    return empty === undefined ? { error: "Empty response" } : { data: empty };
  }
  return { data: result.data };
}

async function send<T>(path: string, method: string, body?: unknown, empty?: T, signal?: AbortSignal): Promise<DraftActionResult<T>> {
  const result = await apiClient<T>(path, { method, signal, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return settle(result, empty);
}

export function listCampaignDraftsAction<R = unknown, S = unknown>(channel: DraftChannel, signal?: AbortSignal) {
  return send<DraftList<R, S>>(draftsPath(channel), "GET", undefined, { items: [] }, signal);
}

export function getCampaignDraftAction<R = unknown, S = unknown>(channel: DraftChannel, id: string, signal?: AbortSignal) {
  return send<CampaignDraft<R, S>>(draftsPath(channel, id), "GET", undefined, undefined, signal);
}

export function createCampaignDraftAction<R = unknown, S = unknown>(channel: DraftChannel, request: DraftSaveRequest<R, S>) {
  return send<CampaignDraft<R, S>>(draftsPath(channel), "POST", request);
}

export function updateCampaignDraftAction<R = unknown, S = unknown>(channel: DraftChannel, id: string, request: DraftSaveRequest<R, S>) {
  return send<CampaignDraft<R, S>>(draftsPath(channel, id), "PUT", request);
}

export function deleteCampaignDraftAction(channel: DraftChannel, id: string) {
  return send<{ deleted: true }>(draftsPath(channel, id), "DELETE", undefined, { deleted: true });
}

export function reviewCampaignDraftAction<C extends DraftChannel>(channel: C, id: string, signal?: AbortSignal) {
  return send<DraftReviewOf[C]>(draftsPath(channel, id, "review"), "POST", undefined, undefined, signal);
}

export function launchCampaignDraftAction<T = unknown>(channel: DraftChannel, id: string, request: DraftLaunchRequest) {
  return send<DraftLaunchResult<T>>(draftsPath(channel, id, "launch"), "POST", request);
}
