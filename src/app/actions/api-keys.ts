import { settleResult, type ActionResult } from "@/app/actions/action-result";
import { apiClient } from "@/lib/api/browser-client";
import type { ApiKey, ApiKeyList, CreateApiKeyInput, CreatedApiKey } from "@/lib/api-keys/types";

export async function listApiKeysAction(signal?: AbortSignal): Promise<ActionResult<ApiKeyList>> {
  return settleResult(await apiClient<ApiKeyList>("/api-keys", { method: "GET", signal }));
}

export async function createApiKeyAction(input: CreateApiKeyInput): Promise<ActionResult<CreatedApiKey>> {
  return settleResult(await apiClient<CreatedApiKey>("/api-keys", { method: "POST", body: JSON.stringify(input) }));
}

export async function revokeApiKeyAction(id: string): Promise<ActionResult<ApiKey>> {
  return settleResult(await apiClient<ApiKey>(`/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" }));
}
