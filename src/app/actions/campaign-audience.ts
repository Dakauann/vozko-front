import { downloadApiFile } from "@/lib/api/download-file";
import { parsedRequest } from "@/lib/api/parsed-request";
import {
  parseAudienceCount,
  parseAudienceLeadPage,
  parseBindableFields,
  parseListPreview,
  parseRowPage,
  parseSavedRow,
  parseTemplateSuggestions,
} from "@/lib/campaign-audience/parse";
import type {
  AudienceChannel,
  AudienceLeadQuery,
  AudienceSpec,
  ChannelFields,
  ListContext,
  RowInput,
  RowQuery,
  SampleFormat,
  TemplateSuggestion,
} from "@/lib/campaign-audience/types";
import { isText } from "@/lib/json/guards";

const PASTED_FILE_NAME = "colado.csv";
const SAMPLE_NAME = "modelo-publico";

function channelPath(channel: AudienceChannel, section: string): string {
  return `/campaign-audience/${encodeURIComponent(channel)}/${section}`;
}

function listPath(channel: AudienceChannel, listId: string, section?: string): string {
  const base = channelPath(channel, `lists/${encodeURIComponent(listId)}`);
  return section ? `${base}/${section}` : base;
}

function rowPath(channel: AudienceChannel, listId: string, rowId: string): string {
  return listPath(channel, listId, `rows/${encodeURIComponent(rowId)}`);
}

function json(method: string, body?: unknown): RequestInit {
  return body === undefined ? { method } : { method, body: JSON.stringify(body) };
}

function parseDeleted(value: unknown): { id: string } | null {
  return typeof value === "object" && value !== null && isText((value as { id?: unknown }).id) ? { id: (value as { id: string }).id } : null;
}

export function countAudienceAction(channel: AudienceChannel, spec: AudienceSpec, fields: ChannelFields, signal?: AbortSignal) {
  const init = json("POST", { ...spec, ...fields });
  return parsedRequest(channelPath(channel, "count"), signal ? { ...init, signal } : init, parseAudienceCount);
}

export function listAudienceLeadsAction(channel: AudienceChannel, spec: AudienceSpec, fields: ChannelFields, query: AudienceLeadQuery) {
  return parsedRequest(channelPath(channel, "leads"), json("POST", { ...spec, ...fields, ...query }), parseAudienceLeadPage);
}

export function uploadAudienceListAction(channel: AudienceChannel, file: File, context: ListContext) {
  const body = new FormData();
  body.append("file", file);
  body.append("context", JSON.stringify(context));
  return parsedRequest(channelPath(channel, "lists"), { method: "POST", body }, parseListPreview);
}

export function pasteAudienceListAction(channel: AudienceChannel, text: string, context: ListContext) {
  return parsedRequest(channelPath(channel, "lists"), json("POST", { ...context, fileName: PASTED_FILE_NAME, text }), parseListPreview);
}

export function previewAudienceListAction(channel: AudienceChannel, listId: string, context: ListContext) {
  return parsedRequest(listPath(channel, listId, "preview"), json("POST", context), parseListPreview);
}

export function searchAudienceRowsAction(channel: AudienceChannel, listId: string, context: ListContext, query: RowQuery) {
  return parsedRequest(listPath(channel, listId, "rows/search"), json("POST", { ...context, ...query }), parseRowPage);
}

export function addAudienceRowAction(channel: AudienceChannel, listId: string, row: RowInput) {
  return parsedRequest(listPath(channel, listId, "rows"), json("POST", row), parseSavedRow);
}

export function editAudienceRowAction(channel: AudienceChannel, listId: string, rowId: string, row: RowInput) {
  return parsedRequest(rowPath(channel, listId, rowId), json("PATCH", row), parseSavedRow);
}

export function removeAudienceRowAction(channel: AudienceChannel, listId: string, rowId: string) {
  return parsedRequest(rowPath(channel, listId, rowId), json("DELETE"), parseDeleted);
}

export function downloadAudienceSampleAction(channel: AudienceChannel, context: ListContext, format: SampleFormat) {
  return downloadApiFile(channelPath(channel, "sample"), `${SAMPLE_NAME}.${format}`, { body: { ...context, format } });
}

export function listAudienceFieldsAction(channel: AudienceChannel) {
  return parsedRequest(channelPath(channel, "fields"), json("GET"), parseBindableFields);
}

export function listTemplateFieldsAction() {
  return parsedRequest("/campaign-audience/template-fields", json("GET"), parseBindableFields);
}

function suggestionsPath(templateId: string): string {
  return `/whatsapp/templates/${encodeURIComponent(templateId)}/variable-suggestions`;
}

export function getTemplateSuggestionsAction(templateId: string) {
  return parsedRequest(suggestionsPath(templateId), json("GET"), parseTemplateSuggestions);
}

export function saveTemplateSuggestionsAction(templateId: string, suggestions: TemplateSuggestion[]) {
  return parsedRequest(suggestionsPath(templateId), json("PUT", { suggestions }), parseTemplateSuggestions);
}
