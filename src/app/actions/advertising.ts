import { apiClient, fetchWithRefresh, getApiBaseUrl, scopeHeaders } from "@/lib/api/browser-client";
import { isActionError, type ActionError, type ActionResult } from "@/app/actions/action-result";
import { settleAds } from "@/app/actions/advertising-result";
import { downloadBlob, filenameFromDisposition } from "@/lib/browser/download";
import {
  accountPath,
  liveInsightsPath,
  objectPath,
  reportCsvPath,
  reportQuery,
  type LiveQuery,
  type ReportFilters,
  type TrendFilters,
} from "@/lib/advertising/report-query";
import type {
  AdAccount,
  AdCopyRequest,
  AdCreatedRef,
  AdEditableObject,
  AdLiveInsights,
  AdObjectEdit,
  AdSplitTest,
  AdConversationOrigin,
  AdLocation,
  AdPage,
  AdPublishJob,
  AdReadiness,
  AdReport,
  AdRow,
  AdTrend,
} from "@/lib/advertising/types";

export type AdsActionError = ActionError;

export type AdsResult<T> = ActionResult<T>;

const DEFAULT_CSV_NAME = "anuncios.csv";

export const isAdsError = isActionError;

export type { LiveQuery, ReportFilters, TrendFilters };

export async function listAdAccountsAction(): Promise<AdsResult<AdAccount[]>> {
  return settleAds(await apiClient<AdAccount[]>("/ads/accounts", { method: "GET" }), []);
}

export async function syncAdAccountAction(id: string): Promise<AdsResult<AdAccount>> {
  return settleAds(await apiClient<AdAccount>(`${accountPath(id)}/sync`, { method: "POST" }));
}

export async function getAdReadinessAction(id: string): Promise<AdsResult<AdReadiness>> {
  return settleAds(await apiClient<AdReadiness>(`${accountPath(id)}/readiness`, { method: "GET" }));
}

export async function disconnectAdAccountAction(id: string): Promise<AdsResult<null>> {
  return settleAds(await apiClient<null>(accountPath(id), { method: "DELETE" }), null);
}

export async function getAdsReportAction(accountId: string, filters: ReportFilters): Promise<AdsResult<AdReport>> {
  return settleAds(await apiClient<AdReport>(`${accountPath(accountId)}/report?${reportQuery(filters)}`, { method: "GET" }));
}

export async function getAdsTrendAction(
  accountId: string,
  filters: TrendFilters,
): Promise<AdsResult<AdTrend>> {
  return settleAds(await apiClient<AdTrend>(`${accountPath(accountId)}/trend?${reportQuery(filters)}`, { method: "GET" }));
}

export async function listAdPagesAction(accountId: string): Promise<AdsResult<AdPage[]>> {
  return settleAds(await apiClient<AdPage[]>(`${accountPath(accountId)}/pages`, { method: "GET" }), []);
}

export async function requestNumberLinkAction(accountId: string, pageId: string, number: string): Promise<AdsResult<null>> {
  return settleAds(
    await apiClient<null>(`${accountPath(accountId)}/pages/${encodeURIComponent(pageId)}/whatsapp-link/code`, {
      method: "POST",
      body: JSON.stringify({ number }),
    }),
    null,
  );
}

export async function confirmNumberLinkAction(accountId: string, pageId: string, number: string, code: string): Promise<AdsResult<AdPage>> {
  return settleAds(
    await apiClient<AdPage>(`${accountPath(accountId)}/pages/${encodeURIComponent(pageId)}/whatsapp-link`, {
      method: "POST",
      body: JSON.stringify({ number, code }),
    }),
  );
}

export async function searchAdLocationsAction(accountId: string, query: string): Promise<AdsResult<AdLocation[]>> {
  const params = new URLSearchParams({ q: query });
  return settleAds(await apiClient<AdLocation[]>(`${accountPath(accountId)}/locations?${params.toString()}`, { method: "GET" }), []);
}

export async function setAdObjectOnAction(metaId: string, on: boolean): Promise<AdsResult<AdRow>> {
  return settleAds(await apiClient<AdRow>(`${objectPath(metaId)}/${on ? "activate" : "pause"}`, { method: "POST" }));
}

export async function updateAdBudgetAction(metaId: string, amount: number): Promise<AdsResult<AdRow>> {
  return settleAds(
    await apiClient<AdRow>(`${objectPath(metaId)}/budget`, {
      method: "PATCH",
      body: JSON.stringify({ amount }),
    }),
  );
}

export async function listAdPublishJobsAction(): Promise<AdsResult<AdPublishJob[]>> {
  return settleAds(await apiClient<AdPublishJob[]>("/ads/publish-jobs", { method: "GET" }), []);
}

export async function getAdPublishJobAction(id: string): Promise<AdsResult<AdPublishJob>> {
  return settleAds(await apiClient<AdPublishJob>(`/ads/publish-jobs/${encodeURIComponent(id)}`, { method: "GET" }));
}

export async function switchOnPublishJobAction(id: string): Promise<AdsResult<AdPublishJob>> {
  return settleAds(await apiClient<AdPublishJob>(`/ads/publish-jobs/${encodeURIComponent(id)}/activate`, { method: "POST" }));
}

export async function getConversationAdOriginAction(
  entryType: string,
  entryId: string,
): Promise<AdsResult<AdConversationOrigin>> {
  return settleAds(
    await apiClient<AdConversationOrigin>(
      `/ads/conversations/${encodeURIComponent(entryType)}/${encodeURIComponent(entryId)}/origin`,
      { method: "GET" },
    ),
  );
}

export async function setAdSpendCapAction(accountId: string, amount: number | null): Promise<AdsResult<AdAccount>> {
  return settleAds(
    await apiClient<AdAccount>(`${accountPath(accountId)}/spend-cap`, { method: "PUT", body: JSON.stringify({ amount }) }),
  );
}

export async function getAdLiveInsightsAction(accountId: string, query: LiveQuery): Promise<AdsResult<AdLiveInsights>> {
  return settleAds(await apiClient<AdLiveInsights>(liveInsightsPath(accountId, query), { method: "GET" }));
}

export async function downloadAdsCsv(path: string): Promise<AdsResult<null>> {
  try {
    const response = await fetchWithRefresh(() =>
      fetch(`${getApiBaseUrl()}${path}`, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "text/csv", ...scopeHeaders() },
      }),
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      return { error: body.message || response.statusText, code: body.code, status: response.status };
    }
    downloadBlob(await response.blob(), filenameFromDisposition(response.headers.get("Content-Disposition")) ?? DEFAULT_CSV_NAME);
    return { data: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Network error" };
  }
}

export async function downloadAdsReportCsvAction(accountId: string, filters: ReportFilters): Promise<AdsResult<null>> {
  return downloadAdsCsv(reportCsvPath(accountId, filters));
}

export async function getAdEditableObjectAction(metaId: string): Promise<AdsResult<AdEditableObject>> {
  return settleAds(await apiClient<AdEditableObject>(objectPath(metaId), { method: "GET" }));
}

export async function updateAdObjectAction(metaId: string, edit: AdObjectEdit): Promise<AdsResult<AdRow>> {
  return settleAds(await apiClient<AdRow>(objectPath(metaId), { method: "PATCH", body: JSON.stringify({ edit }) }));
}

export async function copyAdObjectAction(metaId: string, request: AdCopyRequest): Promise<AdsResult<AdCreatedRef>> {
  return settleAds(await apiClient<AdCreatedRef>(`${objectPath(metaId)}/copies`, { method: "POST", body: JSON.stringify(request) }));
}

export async function archiveAdObjectAction(metaId: string): Promise<AdsResult<AdRow>> {
  return settleAds(await apiClient<AdRow>(`${objectPath(metaId)}/archive`, { method: "POST" }));
}

export async function deleteAdObjectAction(metaId: string): Promise<AdsResult<null>> {
  return settleAds(await apiClient<null>(objectPath(metaId), { method: "DELETE" }), null);
}

export async function listAdTestsAction(accountId: string): Promise<AdsResult<AdSplitTest[]>> {
  return settleAds(await apiClient<AdSplitTest[]>(`${accountPath(accountId)}/tests`, { method: "GET" }), []);
}

export async function createAdTestAction(test: AdSplitTest): Promise<AdsResult<AdCreatedRef>> {
  return settleAds(await apiClient<AdCreatedRef>("/ads/tests", { method: "POST", body: JSON.stringify(test) }));
}
