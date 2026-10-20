import type { ResponseListQuery } from "@/app/actions/whatsapp-forms";

import { SEND_ORIGINS, type MatchFilter, type SendOrigin } from "./types";

export const RESPONSE_FILTER_PARAMS = ["from", "to", "origin", "phoneId", "versionId", "match", "q"] as const;

export type ResponseFilterParam = (typeof RESPONSE_FILTER_PARAMS)[number];

export function dayStart(day: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const at = new Date(`${day}T00:00:00`);
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
}

export function dayEnd(day: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const at = new Date(`${day}T23:59:59.999`);
  return Number.isNaN(at.getTime()) ? undefined : at.toISOString();
}

function originOf(value: string): SendOrigin | undefined {
  return (SEND_ORIGINS as readonly string[]).includes(value) ? (value as SendOrigin) : undefined;
}

function matchOf(value: string): MatchFilter | undefined {
  return value === "matched" || value === "unmatched" ? value : undefined;
}

export function responseQueryFrom(param: (name: ResponseFilterParam) => string): ResponseListQuery {
  const query: ResponseListQuery = {};
  const from = dayStart(param("from"));
  const to = dayEnd(param("to"));
  const origin = originOf(param("origin"));
  const match = matchOf(param("match"));
  if (from) query.from = from;
  if (to) query.to = to;
  if (origin) query.origin = origin;
  if (param("phoneId")) query.phoneId = param("phoneId");
  if (param("versionId")) query.versionId = param("versionId");
  if (match) query.match = match;
  if (param("q").trim()) query.search = param("q").trim();
  return query;
}

export function exportParams(formId: string, query: ResponseListQuery): Record<string, unknown> {
  return {
    formId,
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.origin ? { origins: [query.origin] } : {}),
    ...(query.phoneId ? { phoneIds: [query.phoneId] } : {}),
    ...(query.versionId ? { versionIds: [query.versionId] } : {}),
    ...(query.match ? { match: query.match } : {}),
  };
}
