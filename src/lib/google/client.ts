import { apiClient } from "@/lib/api/browser-client";
import { codedErrorOf, type CodedError } from "@/lib/api/coded-error";
import type { GoogleProduct, GoogleProductStatus } from "@/lib/google/types";

export async function fetchGoogleStatus(product: GoogleProduct): Promise<{ status: GoogleProductStatus | null; error?: CodedError }> {
  const res = await apiClient<GoogleProductStatus>(`/google/accounts/${product}`, { method: "GET" });
  if (res.error) return { status: null, error: codedErrorOf(res.error) };
  return { status: res.data ?? null };
}

export async function disconnectGoogle(product: GoogleProduct): Promise<{ error?: CodedError }> {
  const res = await apiClient<{ disconnected: boolean }>(`/google/accounts/${product}`, { method: "DELETE" });
  if (res.error) return { error: codedErrorOf(res.error) };
  return {};
}
