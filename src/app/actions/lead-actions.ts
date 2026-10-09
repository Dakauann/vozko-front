import { parsedRequest, type ParsedAnswer } from "@/lib/api/parsed-request";
import {
  parseLeadActionPreview,
  parseLeadActionRun,
  parseLeadActionStart,
  parseLeadAudienceJob,
  type LeadActionPreview,
  type LeadActionRequest,
  type LeadActionRun,
  type LeadActionStart,
  type LeadAudienceJob,
} from "@/lib/leads/actions";

export type LeadActionAnswer<T> = ParsedAnswer<T>;

const read = parsedRequest;

export function previewLeadActionAction(request: LeadActionRequest, signal?: AbortSignal) {
  return read<LeadActionPreview>(
    "/leads/actions/preview",
    { method: "POST", body: JSON.stringify(request), signal },
    parseLeadActionPreview,
  );
}

export function getLeadActionPreviewAction(previewId: string, signal?: AbortSignal) {
  return read<LeadActionPreview>(
    `/leads/actions/previews/${encodeURIComponent(previewId)}`,
    { method: "GET", signal },
    parseLeadActionPreview,
  );
}

export function startLeadActionAction(request: LeadActionRequest, idempotencyKey: string) {
  return read<LeadActionStart>(
    "/leads/actions",
    { method: "POST", body: JSON.stringify(request), headers: { "Idempotency-Key": idempotencyKey } },
    parseLeadActionStart,
  );
}

export function getLeadActionRunAction(runId: string) {
  return read<LeadActionRun>(`/leads/actions/${encodeURIComponent(runId)}`, { method: "GET" }, parseLeadActionRun);
}

export function getLeadAudienceAction(audienceId: string) {
  return read<LeadAudienceJob>(
    `/leads/actions/audiences/${encodeURIComponent(audienceId)}`,
    { method: "GET" },
    parseLeadAudienceJob,
  );
}
