import { fetchWithRefresh, getApiBaseUrl, scopeHeaders } from "@/lib/api/browser-client";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { downloadBlob, filenameFromDisposition } from "@/lib/browser/download";

interface RefusalBody {
  message?: string;
  code?: string;
  expected?: Record<string, string>;
}

export async function downloadApiFile(
  path: string,
  fallbackName: string,
  options: { accept?: string } = {},
): Promise<{ error: CodedRefusal | null }> {
  try {
    const response = await fetchWithRefresh(() =>
      fetch(`${getApiBaseUrl()}${path}`, {
        method: "GET",
        credentials: "include",
        headers: { ...(options.accept ? { Accept: options.accept } : {}), ...scopeHeaders() },
      }),
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as RefusalBody;
      return {
        error: {
          message: body.message || response.statusText,
          status: response.status,
          ...(body.code ? { code: body.code } : {}),
          ...(body.expected ? { expected: body.expected } : {}),
        },
      };
    }
    downloadBlob(await response.blob(), filenameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackName);
    return { error: null };
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : "Network error" } };
  }
}
