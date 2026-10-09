import { parsedRequest } from "@/lib/api/parsed-request";
import { parseSendReview, type LeadSendRequest, type SendReview } from "@/lib/leads/sends";

function post<T>(path: string, request: LeadSendRequest, parse: (value: unknown) => T | null) {
  return parsedRequest<T>(path, { method: "POST", body: JSON.stringify(request) }, parse);
}

function parseCancelled(value: unknown): { cancelled: true } | null {
  return typeof value === "object" && value !== null && (value as { cancelled?: unknown }).cancelled === true ? { cancelled: true } : null;
}

export function reviewLeadSendAction(request: LeadSendRequest) {
  return post<SendReview>("/leads/actions/sends/review", request, parseSendReview);
}

export function startLeadSendAction(request: LeadSendRequest) {
  return post<SendReview>("/leads/actions/sends/start", request, parseSendReview);
}

export function cancelLeadSendAction(request: LeadSendRequest) {
  return post<{ cancelled: true }>("/leads/actions/sends/cancel", request, parseCancelled);
}
