import { apiClient } from "@/lib/api/browser-client";
import { settleAds } from "@/app/actions/advertising-result";
import { downloadAdsCsv, type AdsResult } from "@/app/actions/advertising";
import { accountPath } from "@/lib/advertising/report-query";
import type {
  AdReportExport,
  AdReportExportRequest,
  AdReportOptions,
  AdReportRun,
  AdReportRunRequest,
  AdSavedReport,
  AdSavedReportInput,
} from "@/lib/advertising/types";

function reportPath(id: string): string {
  return `/ads/reports/${encodeURIComponent(id)}`;
}

export async function getAdReportOptionsAction(): Promise<AdsResult<AdReportOptions>> {
  return settleAds(await apiClient<AdReportOptions>("/ads/report-options", { method: "GET" }));
}

export async function listAdSavedReportsAction(): Promise<AdsResult<AdSavedReport[]>> {
  return settleAds(await apiClient<AdSavedReport[]>("/ads/reports", { method: "GET" }), []);
}

export async function getAdSavedReportAction(id: string): Promise<AdsResult<AdSavedReport>> {
  return settleAds(await apiClient<AdSavedReport>(reportPath(id), { method: "GET" }));
}

export async function createAdSavedReportAction(input: AdSavedReportInput): Promise<AdsResult<AdSavedReport>> {
  return settleAds(await apiClient<AdSavedReport>("/ads/reports", { method: "POST", body: JSON.stringify(input) }));
}

export async function updateAdSavedReportAction(id: string, input: AdSavedReportInput): Promise<AdsResult<AdSavedReport>> {
  return settleAds(await apiClient<AdSavedReport>(reportPath(id), { method: "PUT", body: JSON.stringify(input) }));
}

export async function deleteAdSavedReportAction(id: string): Promise<AdsResult<null>> {
  return settleAds(await apiClient<null>(reportPath(id), { method: "DELETE" }), null);
}

export async function runAdReportAction(accountId: string, request: AdReportRunRequest): Promise<AdsResult<AdReportRun>> {
  return settleAds(await apiClient<AdReportRun>(`${accountPath(accountId)}/report-runs`, { method: "POST", body: JSON.stringify(request) }));
}

export async function createAdReportExportAction(request: AdReportExportRequest): Promise<AdsResult<AdReportExport>> {
  return settleAds(await apiClient<AdReportExport>("/ads/report-exports", { method: "POST", body: JSON.stringify(request) }));
}

export async function listAdReportExportsAction(): Promise<AdsResult<AdReportExport[]>> {
  return settleAds(await apiClient<AdReportExport[]>("/ads/report-exports", { method: "GET" }), []);
}

export async function deleteAdReportExportAction(id: string): Promise<AdsResult<null>> {
  return settleAds(await apiClient<null>(`/ads/report-exports/${encodeURIComponent(id)}`, { method: "DELETE" }), null);
}

export async function downloadAdReportExportAction(reportExport: AdReportExport): Promise<AdsResult<null>> {
  return downloadAdsCsv(`/ads/report-exports/${encodeURIComponent(reportExport.id)}/file`);
}
