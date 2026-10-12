import { apiClient } from "@/lib/api/browser-client";
import type { ExportedMedia } from "@/lib/studio/export";

import { settleResult, type ActionResult } from "./action-result";

export async function importLibraryAssetAction(itemId: string, file: Blob, locale: string): Promise<ActionResult<ExportedMedia>> {
  const path = `/studio/library/items/${encodeURIComponent(itemId)}/import?locale=${encodeURIComponent(locale)}`;
  return settleResult(await apiClient<ExportedMedia>(path, { method: "POST", body: file, headers: { "Content-Type": file.type || "image/webp" } }));
}
