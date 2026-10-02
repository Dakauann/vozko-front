import { accountPath } from "@/lib/advertising/report-query";
import { apiClient } from "@/lib/api/browser-client";
import type { FormLeadsPage, LeadForm, LeadFormDraft } from "@/lib/advertising/forms";

import type { AdsResult } from "./advertising";
import { settleAds, withAccount } from "./advertising-result";

const formPath = (formId: string) => `/ads/forms/${encodeURIComponent(formId)}`;

export async function listLeadFormsAction(accountId: string, pageId: string): Promise<AdsResult<LeadForm[]>> {
  return settleAds(
    await apiClient<LeadForm[]>(`${accountPath(accountId)}/pages/${encodeURIComponent(pageId)}/forms`, { method: "GET" }),
    [],
  );
}

export async function createLeadFormAction(draft: LeadFormDraft): Promise<AdsResult<LeadForm>> {
  return settleAds(await apiClient<LeadForm>("/ads/forms", { method: "POST", body: JSON.stringify(draft) }));
}

export async function archiveLeadFormAction(formId: string, accountId: string): Promise<AdsResult<null>> {
  return settleAds(await apiClient<null>(withAccount(`${formPath(formId)}/archive`, accountId), { method: "POST" }), null);
}

export async function listFormLeadsAction(formId: string, limit: number, offset: number): Promise<AdsResult<FormLeadsPage>> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return settleAds(await apiClient<FormLeadsPage>(`${formPath(formId)}/leads?${params.toString()}`, { method: "GET" }), {
    items: [],
    total: 0,
  });
}

export async function syncLeadFormAction(formId: string, accountId: string): Promise<AdsResult<{ imported: number }>> {
  return settleAds(await apiClient<{ imported: number }>(withAccount(`${formPath(formId)}/sync`, accountId), { method: "POST" }));
}
