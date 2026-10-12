"use client";

import { frameFits, type FrameExportRequest } from "@/lib/studio/animated-export";
import { videoCanvasSize, type VideoDocument } from "@/lib/studio/document";
import { exportedDocument } from "@/lib/studio/organize";

import { canvasBlob, frameReader, loopOf, type Progress } from "./animated-encoders";
import { failedExport, type BrowserExport } from "./export-result";
import { renderFrames } from "./frame-loop";
import { withRenderSession } from "./render-session";
import { reactLevels } from "../react-levels";

const FRAME_TYPES: Record<FrameExportRequest["format"], string> = { png: "image/png", jpeg: "image/jpeg" };

export async function exportFrameInBrowser(edited: VideoDocument, request: FrameExportRequest, onPhase: Progress): Promise<BrowserExport> {
  const doc = exportedDocument(edited);
  if (!frameFits(request, doc.durationMs)) return failedExport("out_of_range");
  const levels = await reactLevels.ready(doc);
  if (!levels) return failedExport("undecodable");
  return withRenderSession(videoCanvasSize(doc), async (session) => {
    const reader = frameReader(session);
    if (!reader) return failedExport("no_encoder");
    const outcome = await renderFrames({
      ...loopOf(doc, session, 0, levels),
      times: [request.atMs],
      emit: async () => void reader.read(),
      onProgress: (done, total) => onPhase({ phase: "encoding", done, total }),
    });
    if (outcome !== "complete") return failedExport(outcome);
    const type = FRAME_TYPES[request.format];
    const file = await canvasBlob(reader.canvas, type, request.format === "jpeg" ? request.quality : undefined);
    return file?.type === type ? { status: "done", file } : failedExport("no_encoder");
  });
}
