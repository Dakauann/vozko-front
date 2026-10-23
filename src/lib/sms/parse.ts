import { oneOf, parseCarrierPrice, parseChannelAutomation, parseNullableId } from "@/lib/carrier-messaging/parse";
import { isCount, isJson, isText } from "@/lib/json/guards";
import { SMS_CHARGE_KINDS, SMS_ENCODINGS, SMS_ROUTE_KINDS, SMS_ROUTE_PAUSE_REASONS, SMS_ROUTE_STATUSES, type SmsIssue, type SmsMeasurement, type SmsRoute, type SmsRouteList, type SmsTextCheck, type SmsToGsmAnswer } from "@/lib/sms/types";

function parseMeasurement(value: unknown): SmsMeasurement | null {
  if (!isJson(value) || !oneOf(SMS_ENCODINGS, value.encoding)) return null;
  const { units, segments, per_segment, remaining } = value;
  if (!isCount(units) || !isCount(segments) || !isCount(per_segment) || !isCount(remaining)) return null;
  return { encoding: value.encoding, units, segments, per_segment, remaining };
}

function parseIssues(value: unknown): SmsIssue[] | null {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const issues = value.map((issue) => (isJson(issue) && isText(issue.code) ? { code: issue.code } : null));
  return issues.some((issue) => issue === null) ? null : (issues as SmsIssue[]);
}

export function parseSmsTextCheck(value: unknown): SmsTextCheck | null {
  if (!isJson(value) || typeof value.composed_text !== "string") return null;
  const measurement = parseMeasurement(value.measurement);
  const issues = parseIssues(value.issues);
  const price = parseCarrierPrice(value.price, SMS_CHARGE_KINDS);
  if (!measurement || !issues || !price || !isCount(value.variable_slots)) return null;
  return { measurement, composed_text: value.composed_text, variable_slots: value.variable_slots, issues, price };
}

export function parseSmsToGsm(value: unknown): SmsToGsmAnswer | null {
  if (!isJson(value) || typeof value.text !== "string") return null;
  return { text: value.text };
}

export function parseSmsRoute(value: unknown): SmsRoute | null {
  if (!isJson(value) || !isText(value.id) || typeof value.brand_prefix !== "string" || !oneOf(SMS_ROUTE_KINDS, value.kind)) return null;
  if (typeof value.number !== "string" || !oneOf(SMS_ROUTE_STATUSES, value.status) || !(value.pause_reason === "" || oneOf(SMS_ROUTE_PAUSE_REASONS, value.pause_reason))) return null;
  if (typeof value.can_send !== "boolean" || !isText(value.created_at)) return null;
  const automation = parseChannelAutomation(value.automation);
  const departmentId = parseNullableId(value.department_id);
  const pipelineId = parseNullableId(value.pipeline_id);
  if (!automation || departmentId === undefined || pipelineId === undefined) return null;
  const route: SmsRoute = {
    id: value.id,
    brand_prefix: value.brand_prefix,
    kind: value.kind,
    number: value.number,
    status: value.status,
    pause_reason: value.pause_reason,
    can_send: value.can_send,
    department_id: departmentId,
    pipeline_id: pipelineId,
    automation,
    created_at: value.created_at,
  };
  if (isText(value.workspace_id)) route.workspace_id = value.workspace_id;
  return route;
}

export function parseSmsRouteList(value: unknown): SmsRouteList | null {
  if (!isJson(value) || !Array.isArray(value.routes)) return null;
  const routes = value.routes.map(parseSmsRoute);
  return routes.some((route) => route === null) ? null : { routes: routes as SmsRoute[] };
}
