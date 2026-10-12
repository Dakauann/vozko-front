import type { ExportFailure } from "@/lib/studio/export";

export type BrowserExport = { status: "done"; file: Blob } | { status: "failed"; reason: ExportFailure };

export function failedExport(reason: ExportFailure): BrowserExport {
  return { status: "failed", reason };
}
