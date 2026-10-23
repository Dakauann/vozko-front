import { apiClient, type ApiResult } from "@/lib/api/browser-client";
import { codedRefusalOf, type CodedRefusal } from "@/lib/api/coded-error";
import type {
  CreateSheetInput,
  GoogleSheet,
  GoogleSheetList,
  SheetCatalog,
  SheetColumnInput,
  SheetColumnUpdate,
  SheetHealth,
  SheetRowsPage,
} from "@/lib/google-sheets/types";

export interface SheetResult<T> {
  data: T | null;
  error?: CodedRefusal;
}

export async function listSheetRows(id: string, page = 1, signal?: AbortSignal): Promise<SheetResult<SheetRowsPage>> {
  return settle(await apiClient<SheetRowsPage>(`/google-sheets/${id}/rows?page=${page}&pageSize=25`, { method: "GET", signal }));
}

function settle<T>(res: ApiResult<T>): SheetResult<T> {
  if (res.error) return { data: null, error: codedRefusalOf(res.error) };
  return { data: res.data ?? null };
}

function sheetOf(res: ApiResult<{ sheet: GoogleSheet }>): SheetResult<GoogleSheet> {
  const settled = settle(res);
  return { data: settled.data?.sheet ?? null, error: settled.error };
}

export async function fetchSheetCatalog(): Promise<SheetResult<SheetCatalog>> {
  return settle(await apiClient<SheetCatalog>("/google-sheets/catalog", { method: "GET" }));
}

export async function listSheets(params: { search?: string; page?: number; pageSize?: number } = {}): Promise<SheetResult<GoogleSheetList>> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return settle(await apiClient<GoogleSheetList>(`/google-sheets${suffix}`, { method: "GET" }));
}

export async function fetchSheet(id: string): Promise<SheetResult<GoogleSheet>> {
  return sheetOf(await apiClient<{ sheet: GoogleSheet }>(`/google-sheets/${id}`, { method: "GET" }));
}

export async function createSheet(input: CreateSheetInput): Promise<SheetResult<GoogleSheet>> {
  return sheetOf(await apiClient<{ sheet: GoogleSheet }>("/google-sheets", { method: "POST", body: JSON.stringify(input) }));
}

export async function updateSheetDetails(id: string, input: { version: number; title?: string; description?: string }): Promise<SheetResult<GoogleSheet>> {
  return sheetOf(await apiClient<{ sheet: GoogleSheet }>(`/google-sheets/${id}`, { method: "PATCH", body: JSON.stringify(input) }));
}

export async function editSheetColumns(
  id: string,
  input: { version: number; add?: SheetColumnInput[]; update?: SheetColumnUpdate[] },
): Promise<SheetResult<GoogleSheet>> {
  return sheetOf(await apiClient<{ sheet: GoogleSheet }>(`/google-sheets/${id}/columns`, { method: "PATCH", body: JSON.stringify(input) }));
}

export async function deleteSheet(id: string): Promise<SheetResult<{ deleted: boolean }>> {
  return settle(await apiClient<{ deleted: boolean }>(`/google-sheets/${id}`, { method: "DELETE" }));
}

export async function fetchSheetHealth(id: string): Promise<SheetResult<SheetHealth>> {
  return settle(await apiClient<SheetHealth>(`/google-sheets/${id}/health`, { method: "GET" }));
}

export async function retrySheetProblems(id: string): Promise<SheetResult<{ requeued: number }>> {
  return settle(await apiClient<{ requeued: number }>(`/google-sheets/${id}/retry`, { method: "POST" }));
}

export async function reactivateSheet(id: string, repairHeader: boolean): Promise<SheetResult<GoogleSheet>> {
  return sheetOf(await apiClient<{ sheet: GoogleSheet }>(`/google-sheets/${id}/reactivate`, { method: "POST", body: JSON.stringify({ repairHeader }) }));
}

export async function addSheetRow(id: string, values: Record<string, string>, idempotencyKey: string): Promise<SheetResult<{ rowId: string; duplicate: boolean }>> {
  return settle(
    await apiClient<{ rowId: string; duplicate: boolean }>(`/google-sheets/${id}/rows`, {
      method: "POST",
      body: JSON.stringify({ values }),
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  );
}
