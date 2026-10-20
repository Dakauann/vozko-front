import type { MatchResult } from "@/lib/whatsapp-forms/types";

import type { ConversationMessage } from "./types";

export interface FormAnswerFile {
  mediaId?: string;
  name: string;
  mimeType: string;
}

export interface FormAnswerLine {
  key: string;
  prompt: string;
  value: string;
  sensitive: boolean;
  files: FormAnswerFile[];
}

export interface FormMessageBlock {
  kind: "message";
  formId: string;
  formName: string;
  sendId: string;
  cta: string;
}

export interface FormResponseBlock {
  kind: "response";
  formId?: string;
  formName?: string;
  responseId: string;
  match: MatchResult | string;
  answers: FormAnswerLine[];
  changed: string[];
  conflicts: string[];
}

export type FormBlock = FormMessageBlock | FormResponseBlock;

export type FormMessageState = "responded" | "waiting";

type Row = Record<string, unknown>;

const MATCHED: ReadonlySet<string> = new Set(["token", "context"]);

function rowOf(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function texts(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item !== "") : [];
}

function fileOf(value: unknown): FormAnswerFile[] {
  const row = rowOf(value);
  if (!row) return [];
  const name = text(row.name);
  const mediaId = optionalText(row.mediaId);
  if (!name && !mediaId) return [];
  return [{ name, mimeType: text(row.mimeType), ...(mediaId ? { mediaId } : {}) }];
}

function answerOf(value: unknown): FormAnswerLine[] {
  const row = rowOf(value);
  if (!row) return [];
  const key = text(row.key);
  if (!key) return [];
  return [
    {
      key,
      prompt: text(row.prompt) || key,
      value: typeof row.value === "string" ? row.value : row.value == null ? "" : String(row.value),
      sensitive: row.sensitive === true,
      files: Array.isArray(row.files) ? row.files.flatMap(fileOf) : [],
    },
  ];
}

function messageBlock(form: Row): FormMessageBlock | null {
  const formId = text(form.formId);
  if (!formId) return null;
  return { kind: "message", formId, formName: text(form.formName), sendId: text(form.sendId), cta: text(form.cta) };
}

function responseBlock(form: Row): FormResponseBlock {
  return {
    kind: "response",
    ...(optionalText(form.formId) ? { formId: text(form.formId) } : {}),
    ...(optionalText(form.formName) ? { formName: text(form.formName) } : {}),
    responseId: text(form.responseId),
    match: text(form.match),
    answers: Array.isArray(form.answers) ? form.answers.flatMap(answerOf) : [],
    changed: texts(form.changed),
    conflicts: texts(form.conflicts),
  };
}

export function readFormBlock(metadata: unknown): FormBlock | null {
  const form = rowOf(rowOf(metadata)?.form);
  if (!form) return null;
  if (form.kind === "message") return messageBlock(form);
  if (form.kind === "response") return responseBlock(form);
  return null;
}

export function isMatchedResponse(block: FormResponseBlock): boolean {
  return MATCHED.has(block.match);
}

function timeOf(message: ConversationMessage): number {
  const time = new Date(message.created_at).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function answers(candidate: ConversationMessage, formId: string): boolean {
  const block = readFormBlock(candidate.metadata);
  return block?.kind === "response" && block.formId === formId && isMatchedResponse(block);
}

export function formMessageState(
  message: ConversationMessage,
  block: FormMessageBlock,
  thread: Iterable<ConversationMessage>,
): FormMessageState | null {
  if (message.local_send || message.delivery_status === "failed") return null;
  const sentAt = timeOf(message);
  for (const candidate of thread) {
    if (candidate.id !== message.id && timeOf(candidate) >= sentAt && answers(candidate, block.formId)) return "responded";
  }
  return "waiting";
}

export function hasTemplateMetadata(metadata: unknown): boolean {
  const row = rowOf(metadata);
  if (!row) return false;
  return (typeof row.template_name === "string" && row.template_name !== "") || (Array.isArray(row.components) && row.components.length > 0);
}
