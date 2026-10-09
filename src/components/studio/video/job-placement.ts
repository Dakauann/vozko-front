"use client";

import { fetchMediaFileAction } from "@/app/actions/medias";
import type { SourceWindow } from "@/lib/studio/caption-cues";
import { captionsFromText, type CaptionsOutcome } from "@/lib/studio/captions";
import type { VideoDocument } from "@/lib/studio/document";
import { generatedClipType } from "@/lib/studio/job-sources";
import type { StudioEditorStore } from "@/lib/studio/store";
import { findClip, replaceClipAsset } from "@/lib/studio/timeline";

import type { AssetCatalog } from "./asset-catalog";
import type { EditorCommands } from "./editor-commands";
import type { VideoJob } from "./view-store";

export interface PlacementDeps {
  store: StudioEditorStore<VideoDocument>;
  commands: EditorCommands;
  assets: AssetCatalog;
  captionTrackName: string;
}

export type PlacementProblem = "captionsUnreadable" | "captionsEmpty" | "captionsInvalid" | "noRoom" | "clipGone" | "clipLocked";

export type CaptionRefusal = Exclude<CaptionsOutcome["status"], "added">;

const JOB_CAPTION_PROBLEMS: Record<CaptionRefusal, PlacementProblem> = { unreadable: "captionsEmpty", empty: "captionsEmpty", invalid: "captionsInvalid" };

export async function readCaptions(mediaId: string): Promise<string | null> {
  const { data } = await fetchMediaFileAction(mediaId);
  return data ? await data.blob.text() : null;
}

export function placeCaptionText(text: string, window: SourceWindow, deps: Pick<PlacementDeps, "store" | "captionTrackName">): CaptionRefusal | null {
  const outcome = captionsFromText(deps.store.getState().document, text, window, deps.captionTrackName);
  if (outcome.status !== "added") return outcome.status;
  deps.store.getState().apply(() => outcome.document);
  return null;
}

async function placeCaptions(job: VideoJob, mediaId: string, deps: PlacementDeps): Promise<PlacementProblem | null> {
  const window = job.target.window;
  const text = await readCaptions(mediaId);
  if (!window || text === null) return "captionsUnreadable";
  const refusal = placeCaptionText(text, window, deps);
  return refusal ? JOB_CAPTION_PROBLEMS[refusal] : null;
}

function swapAsset(job: VideoJob, mediaId: string, deps: PlacementDeps): PlacementProblem | null {
  const clipId = job.target.clipId;
  const { document, apply } = deps.store.getState();
  if (!clipId || !findClip(document, clipId)) return "clipGone";
  const next = replaceClipAsset(document, clipId, mediaId);
  if (next === document) return "clipLocked";
  apply(() => next, [clipId]);
  return null;
}

export async function placeJobResult(job: VideoJob, mediaId: string, deps: PlacementDeps): Promise<PlacementProblem | null> {
  switch (job.purpose) {
    case "captions":
      return placeCaptions(job, mediaId, deps);
    case "denoise":
    case "cutout":
      void deps.assets.loadLibrary();
      return swapAsset(job, mediaId, deps);
    case "music":
    case "voice":
    case "image": {
      await deps.assets.loadLibrary();
      const placed = await deps.commands.insertMedia({ id: mediaId, type: generatedClipType(job.purpose) }, job.target.atMs, job.target.trackId, job.target.durationMs);
      return placed ? null : "noRoom";
    }
  }
}
