import type { Clip, VideoDocument } from "./document";
import { firstUnreadableLut, videoLutUses, type LutReadable, type LutUse } from "./lut-uses";
import { exportedDocument } from "./organize";

export const EXPORT_FAILURES = ["no_encoder", "undecodable", "stalled", "too_large", "renderer_off", "upload_failed", "out_of_range", "lut_unavailable", "failed"] as const;
export type ExportFailure = (typeof EXPORT_FAILURES)[number];

export type ExportFailureCode = "empty" | "unsaved" | ExportFailure;

export type ExportPhase = { phase: "saving" } | { phase: "encoding"; done: number; total: number } | { phase: "uploading" };

export interface ExportedMedia {
  mediaId: string;
  mediaUrl: string;
}

export type LocalExport = { status: "done"; result: ExportedMedia } | { status: "failed"; reason: ExportFailure };

export type ExportOutcome = { status: "done"; result: ExportedMedia; document: VideoDocument } | { status: "failed"; code: ExportFailureCode; clip?: Clip };

export interface ExportDeps {
  flush: () => Promise<void>;
  committed: () => { version: number | null; settled: boolean };
  document: () => VideoDocument;
  local: (document: VideoDocument, onPhase: (phase: ExportPhase) => void) => Promise<LocalExport>;
  lutReadable: LutReadable;
  onPhase?: (phase: ExportPhase) => void;
}

function lutRefusal(use: LutUse | null): ExportOutcome {
  return use?.owner.kind === "clip" ? { status: "failed", code: "lut_unavailable", clip: use.owner.clip } : { status: "failed", code: "failed" };
}

function unreadableLut(document: VideoDocument, deps: Pick<ExportDeps, "lutReadable">): Promise<LutUse | null> {
  return firstUnreadableLut(videoLutUses(exportedDocument(document)), deps.lutReadable);
}

export async function startVideoExport(deps: ExportDeps): Promise<ExportOutcome> {
  deps.onPhase?.({ phase: "saving" });
  await deps.flush();
  const { version, settled } = deps.committed();
  if (!settled || version === null) return { status: "failed", code: "unsaved" };
  const document = deps.document();
  if (document.durationMs <= 0) return { status: "failed", code: "empty" };
  const blocked = await unreadableLut(document, deps);
  if (blocked) return lutRefusal(blocked);
  const local = await deps.local(document, (phase) => deps.onPhase?.(phase));
  if (local.status === "failed") return local.reason === "lut_unavailable" ? lutRefusal(await unreadableLut(document, deps)) : { status: "failed", code: local.reason };
  return { status: "done", result: local.result, document };
}

export function isExportOutdated(rendered: VideoDocument, current: VideoDocument): boolean {
  return rendered !== current;
}
