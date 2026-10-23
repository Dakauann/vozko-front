import { parsedRequest } from "@/lib/api/parsed-request";
import type { CarrierInboxSettings } from "@/lib/carrier-messaging/types";
import { parseRcsContentCheck, parseRcsMedia, parseRcsSender, parseRcsSenderList } from "@/lib/rcs/parse";
import type { RcsContentCheckRequest, RcsMediaResolveRequest, RcsSenderInput } from "@/lib/rcs/types";

export type RcsSenderTransition = "submit" | "pause" | "resume";

function senderPath(senderId: string): string {
  return `/rcs/senders/${encodeURIComponent(senderId)}`;
}

export function listRcsSendersAction(signal?: AbortSignal) {
  return parsedRequest("/rcs/senders", { method: "GET", signal }, parseRcsSenderList);
}

export function getRcsSenderAction(senderId: string, signal?: AbortSignal) {
  return parsedRequest(senderPath(senderId), { method: "GET", signal }, parseRcsSender);
}

export function createRcsSenderAction(input: RcsSenderInput) {
  return parsedRequest("/rcs/senders", { method: "POST", body: JSON.stringify(input) }, parseRcsSender);
}

export function updateRcsSenderAction(senderId: string, input: Partial<RcsSenderInput>) {
  return parsedRequest(senderPath(senderId), { method: "PATCH", body: JSON.stringify(input) }, parseRcsSender);
}

export function transitionRcsSenderAction(senderId: string, transition: RcsSenderTransition) {
  return parsedRequest(`${senderPath(senderId)}/${transition}`, { method: "POST" }, parseRcsSender);
}

export function checkRcsContentAction(request: RcsContentCheckRequest, signal?: AbortSignal) {
  return parsedRequest("/rcs/content/check", { method: "POST", body: JSON.stringify(request), signal }, parseRcsContentCheck);
}

export function setRcsSenderInboxAction(senderId: string, settings: CarrierInboxSettings) {
  return parsedRequest(`${senderPath(senderId)}/inbox`, { method: "PUT", body: JSON.stringify(settings) }, parseRcsSender);
}

export function deleteRcsSenderAction(senderId: string) {
  return parsedRequest(senderPath(senderId), { method: "DELETE" }, () => true as const);
}

export function resolveRcsMediaAction(request: RcsMediaResolveRequest) {
  return parsedRequest("/rcs/media", { method: "POST", body: JSON.stringify(request) }, parseRcsMedia);
}
