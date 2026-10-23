import { parsedRequest } from "@/lib/api/parsed-request";
import type { CarrierInboxSettings } from "@/lib/carrier-messaging/types";
import { parseSmsRoute, parseSmsRouteList, parseSmsTextCheck, parseSmsToGsm } from "@/lib/sms/parse";
import type { SmsRouteInput, SmsTextCheckRequest, SmsToGsmRequest } from "@/lib/sms/types";

export type SmsRouteTransition = "pause" | "resume";

function routePath(routeId: string): string {
  return `/sms/routes/${encodeURIComponent(routeId)}`;
}

export function checkSmsTextAction(request: SmsTextCheckRequest, signal?: AbortSignal) {
  return parsedRequest("/sms/text/check", { method: "POST", body: JSON.stringify(request), signal }, parseSmsTextCheck);
}

export function smsTextToGsmAction(request: SmsToGsmRequest) {
  return parsedRequest("/sms/text/to-gsm", { method: "POST", body: JSON.stringify(request) }, parseSmsToGsm);
}

export function listSmsRoutesAction(signal?: AbortSignal) {
  return parsedRequest("/sms/routes", { method: "GET", signal }, parseSmsRouteList);
}

export function createSmsRouteAction(input: SmsRouteInput) {
  return parsedRequest("/sms/routes", { method: "POST", body: JSON.stringify(input) }, parseSmsRoute);
}

export function updateSmsRouteAction(routeId: string, input: SmsRouteInput) {
  return parsedRequest(routePath(routeId), { method: "PATCH", body: JSON.stringify(input) }, parseSmsRoute);
}

export function transitionSmsRouteAction(routeId: string, transition: SmsRouteTransition) {
  return parsedRequest(`${routePath(routeId)}/${transition}`, { method: "POST" }, parseSmsRoute);
}

export function setSmsRouteInboxAction(routeId: string, settings: CarrierInboxSettings) {
  return parsedRequest(`${routePath(routeId)}/inbox`, { method: "PUT", body: JSON.stringify(settings) }, parseSmsRoute);
}

export function deleteSmsRouteAction(routeId: string) {
  return parsedRequest(routePath(routeId), { method: "DELETE" }, () => true as const);
}
