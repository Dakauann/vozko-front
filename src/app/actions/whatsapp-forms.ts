import { parsedRequest } from "@/lib/api/parsed-request";
import {
  parseAutomations,
  parseCompiled,
  parseCreatedAutomation,
  parseDistribution,
  parseDraftSaved,
  parseForm,
  parseFormDetail,
  parseFormSummaries,
  parseOptions,
  parsePreview,
  parseProblems,
  parsePublishResult,
  parseResponseDetail,
  parseResponsePage,
  parseSend,
  parseSendableForms,
  parseSendPage,
  parseStats,
  parseVersions,
} from "@/lib/whatsapp-forms/parse";
import type { Document, MatchFilter, SendCopy, SendOrigin } from "@/lib/whatsapp-forms/types";

const ROOT = "/whatsapp/forms";

export interface FormListQuery {
  search?: string;
  archived?: boolean;
}

export interface CreateFormInput {
  name: string;
  description?: string;
  starter?: string;
}

export interface RenameFormInput {
  name: string;
  description?: string;
}

export interface PeriodQuery {
  from?: string;
  to?: string;
}

export interface ResponseListQuery extends PeriodQuery {
  origin?: SendOrigin;
  phoneId?: string;
  campaignId?: string;
  versionId?: string;
  match?: MatchFilter;
  search?: string;
  after?: string;
  limit?: number;
}

export interface SendListQuery {
  after?: string;
  limit?: number;
}

export type SendableQuery = { phoneId: string } | { metaWabaId: string };

function formPath(formId: string): string {
  return `${ROOT}/${encodeURIComponent(formId)}`;
}

function responsePath(responseId: string): string {
  return `${ROOT}/responses/${encodeURIComponent(responseId)}`;
}

function queryString(values: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === "" || value === false) continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

function done() {
  return true as const;
}

export function formOptionsAction(signal?: AbortSignal) {
  return parsedRequest(`${ROOT}/options`, { method: "GET", signal }, parseOptions);
}

export function listFormsAction(query: FormListQuery = {}, signal?: AbortSignal) {
  const search = query.search?.trim();
  return parsedRequest(`${ROOT}${queryString({ search, archived: query.archived })}`, { method: "GET", signal }, parseFormSummaries);
}

export function createFormAction(input: CreateFormInput) {
  return parsedRequest(ROOT, { method: "POST", body: JSON.stringify(input) }, parseFormDetail);
}

export function getFormAction(formId: string, signal?: AbortSignal) {
  return parsedRequest(formPath(formId), { method: "GET", signal }, parseFormDetail);
}

export function renameFormAction(formId: string, input: RenameFormInput) {
  return parsedRequest(formPath(formId), { method: "PATCH", body: JSON.stringify(input) }, parseForm);
}

export function saveDraftAction(formId: string, document: Document, baseVersionId: string) {
  return parsedRequest(`${formPath(formId)}/draft`, { method: "PUT", body: JSON.stringify({ document, baseVersionId }) }, parseDraftSaved);
}

export function checkDocumentAction(document: Document, signal?: AbortSignal) {
  return parsedRequest(`${ROOT}/check`, { method: "POST", body: JSON.stringify({ document }), signal }, parseProblems);
}

export function compiledFormAction(formId: string, signal?: AbortSignal) {
  return parsedRequest(`${formPath(formId)}/compiled`, { method: "GET", signal }, parseCompiled);
}

export function duplicateFormAction(formId: string) {
  return parsedRequest(`${formPath(formId)}/duplicate`, { method: "POST" }, parseFormDetail);
}

export function archiveFormAction(formId: string) {
  return parsedRequest(`${formPath(formId)}/archive`, { method: "POST" }, done);
}

export function publishFormAction(formId: string) {
  return parsedRequest(`${formPath(formId)}/publish`, { method: "POST" }, parsePublishResult);
}

export function deprecatePublicationAction(formId: string, metaWabaId: string) {
  return parsedRequest(`${formPath(formId)}/publications/${encodeURIComponent(metaWabaId)}/deprecate`, { method: "POST" }, done);
}

export function previewFormAction(formId: string) {
  return parsedRequest(`${formPath(formId)}/preview`, { method: "POST" }, parsePreview);
}

export function formVersionsAction(formId: string, signal?: AbortSignal) {
  return parsedRequest(`${formPath(formId)}/versions`, { method: "GET", signal }, parseVersions);
}

export function sendableFormsAction(query: SendableQuery, signal?: AbortSignal) {
  const values = "phoneId" in query ? { phoneId: query.phoneId } : { metaWabaId: query.metaWabaId };
  return parsedRequest(`${ROOT}/sendable${queryString(values)}`, { method: "GET", signal }, parseSendableForms);
}

export function formAutomationsAction(formId: string, signal?: AbortSignal) {
  return parsedRequest(`${formPath(formId)}/automations`, { method: "GET", signal }, parseAutomations);
}

export function createFormAutomationAction(formId: string) {
  return parsedRequest(`${formPath(formId)}/automations`, { method: "POST" }, parseCreatedAutomation);
}

export function sendFormInConversationAction(entryId: string, formId: string, copy: SendCopy) {
  return parsedRequest(
    `/conversations/whatsapp/${encodeURIComponent(entryId)}/forms`,
    { method: "POST", body: JSON.stringify({ formId, copy }) },
    parseSend,
  );
}

export function listFormResponsesAction(formId: string, query: ResponseListQuery = {}, signal?: AbortSignal) {
  const values = {
    from: query.from,
    to: query.to,
    origin: query.origin,
    phoneId: query.phoneId,
    campaignId: query.campaignId,
    versionId: query.versionId,
    match: query.match,
    search: query.search?.trim(),
    after: query.after,
    limit: query.limit,
  };
  return parsedRequest(`${formPath(formId)}/responses${queryString(values)}`, { method: "GET", signal }, parseResponsePage);
}

export function formResponseAction(responseId: string, signal?: AbortSignal) {
  return parsedRequest(responsePath(responseId), { method: "GET", signal }, parseResponseDetail);
}

export function deleteFormResponseAction(responseId: string) {
  return parsedRequest(responsePath(responseId), { method: "DELETE" }, done);
}

export function formStatsAction(formId: string, period: PeriodQuery = {}, signal?: AbortSignal) {
  return parsedRequest(`${formPath(formId)}/stats${queryString({ from: period.from, to: period.to })}`, { method: "GET", signal }, parseStats);
}

export function fieldDistributionAction(formId: string, fieldKey: string, period: PeriodQuery = {}, signal?: AbortSignal) {
  return parsedRequest(
    `${formPath(formId)}/fields/${encodeURIComponent(fieldKey)}/distribution${queryString({ from: period.from, to: period.to })}`,
    { method: "GET", signal },
    parseDistribution,
  );
}

export function listFormSendsAction(formId: string, query: SendListQuery = {}, signal?: AbortSignal) {
  return parsedRequest(`${formPath(formId)}/sends${queryString({ after: query.after, limit: query.limit })}`, { method: "GET", signal }, parseSendPage);
}
