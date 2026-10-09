import { apiClient } from "@/lib/api/browser-client";
import { codedRefusalOf, type CodedRefusal } from "@/lib/api/coded-error";
import { downloadApiFile } from "@/lib/api/download-file";
import {
  readLeadImportJob,
  readLeadImportList,
  type LeadImportDryRunBody,
  type LeadImportJob,
  type LeadImportList,
} from "@/lib/leads/imports";

export type LeadImportActionResult = { job: LeadImportJob } | { error: CodedRefusal };

export type LeadImportListActionResult = { list: LeadImportList } | { error: CodedRefusal };

export const LEAD_IMPORT_RATE_LIMITED = "lead_import_rate_limited";

export const LEAD_IMPORT_UNREADABLE = "lead_import_unreadable";

const TOO_MANY_REQUESTS = 429;

const REJECTIONS_FILENAME = "importacao-linhas.csv";

function importPath(id: string, suffix = ""): string {
  return `/leads/imports/${encodeURIComponent(id)}${suffix}`;
}

function refusal(error: CodedRefusal): CodedRefusal {
  const coded = codedRefusalOf(error);
  if (!coded.code && coded.status === TOO_MANY_REQUESTS) return { ...coded, code: LEAD_IMPORT_RATE_LIMITED };
  return coded;
}

async function jobRequest(endpoint: string, init: RequestInit): Promise<LeadImportActionResult> {
  const response = await apiClient<unknown>(endpoint, init);
  if (response.error) return { error: refusal(response.error) };
  const job = readLeadImportJob(response.data);
  if (!job) return { error: { message: "unexpected lead import response", code: LEAD_IMPORT_UNREADABLE } };
  return { job };
}

export async function listLeadImportsAction(): Promise<LeadImportListActionResult> {
  const response = await apiClient<unknown>("/leads/imports?mine=true", { method: "GET" });
  if (response.error) return { error: refusal(response.error) };
  const list = readLeadImportList(response.data);
  if (!list) return { error: { message: "unexpected lead import list response", code: LEAD_IMPORT_UNREADABLE } };
  return { list };
}

export async function uploadLeadImportAction(file: File): Promise<LeadImportActionResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  return jobRequest("/leads/imports", { method: "POST", body: form });
}

export async function getLeadImportAction(id: string): Promise<LeadImportActionResult> {
  return jobRequest(importPath(id), { method: "GET" });
}

export async function dryRunLeadImportAction(id: string, body: LeadImportDryRunBody): Promise<LeadImportActionResult> {
  return jobRequest(importPath(id, "/dry-run"), { method: "POST", body: JSON.stringify(body) });
}

export async function startLeadImportAction(id: string): Promise<LeadImportActionResult> {
  return jobRequest(importPath(id, "/start"), { method: "POST" });
}

export async function downloadLeadImportRejectionsAction(
  id: string,
  locale: string,
): Promise<{ error: CodedRefusal | null }> {
  const { error } = await downloadApiFile(
    `${importPath(id, "/rejections")}?locale=${encodeURIComponent(locale)}`,
    REJECTIONS_FILENAME,
  );
  return { error: error ? refusal(error) : null };
}
