import { clipJobRequest, type ClipJobKind } from "@/lib/studio/job-sources";
import { findClip } from "@/lib/studio/timeline";

import type { VideoEditorContextValue } from "./editor-context";

type ClipJobEditor = Pick<VideoEditorContextValue, "store" | "commands">;

export function startClipJob({ store, commands }: ClipJobEditor, kind: ClipJobKind, clipId: string | null): boolean {
  const found = clipId ? findClip(store.getState().document, clipId) : null;
  const request = found ? clipJobRequest(kind, found.clip) : null;
  if (!request) return false;
  void commands.startJob(kind, request.input, request.target);
  return true;
}
