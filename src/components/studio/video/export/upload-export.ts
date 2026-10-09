"use client";

import { isActionError } from "@/app/actions/action-result";
import { saveStudioExportAction } from "@/app/actions/studio";
import type { ExportPhase, LocalExport } from "@/lib/studio/export";

export const EXPORT_TOO_LARGE = "export_too_large";

export async function uploadExport(projectId: string, video: Blob, onPhase: (phase: ExportPhase) => void): Promise<LocalExport> {
  onPhase({ phase: "uploading" });
  const saved = await saveStudioExportAction(projectId, video);
  if (!isActionError(saved)) return { status: "done", result: saved.data };
  return { status: "failed", reason: saved.code === EXPORT_TOO_LARGE ? "too_large" : "upload_failed" };
}
