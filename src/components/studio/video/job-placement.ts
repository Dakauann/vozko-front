"use client";

import { fetchMediaFileAction } from "@/app/actions/medias";
import type { SourceWindow } from "@/lib/studio/caption-cues";
import { captionsFromText, type CaptionsOutcome } from "@/lib/studio/captions";
import type { VideoDocument } from "@/lib/studio/document";
import { generatedClipType } from "@/lib/studio/job-sources";
import type { StudioEditorStore } from "@/lib/studio/store";
import { clipSlotAsset, withSlotAsset } from "@/lib/studio/image-sources";
import { jobLanding } from "@/lib/studio/job-landing";
import { findClip, replaceClipAsset, updateClip } from "@/lib/studio/timeline";

import type { AssetCatalog } from "./asset-catalog";
import type { EditorCommands } from "./editor-commands";
import type { VideoJob } from "./view-store";

interface PlacementDeps {
  store: StudioEditorStore<VideoDocument>;
  commands: EditorCommands;
  assets: AssetCatalog;
  captionTrackName: string;
}

type PlacementProblem = "captionsUnreadable" | "captionsEmpty" | "captionsInvalid" | "noRoom" | "clipGone" | "clipChanged" | "clipLocked";

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
  const found = clipId ? findClip(document, clipId) : null;
  if (!clipId || !found) return "clipGone";
  const { slot } = job.target;
  if (jobLanding(job.startedFrom, clipSlotAsset(found.clip, slot)) !== "inPlace") return "clipChanged";
  const layer = found.clip.layer;
  const next = slot !== undefined && layer ? updateClip(document, clipId, { layer: { ...layer, ...withSlotAsset(layer, slot, mediaId) } }) : replaceClipAsset(document, clipId, mediaId);
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
    case "sfx":
    case "image": {
      await deps.assets.loadLibrary();
      const placed = await deps.commands.insertMedia({ id: mediaId, type: generatedClipType(job.purpose) }, job.target.atMs, job.target.trackId, job.target.durationMs);
      if (!placed) return "noRoom";
      const clipId = deps.store.getState().selection[0];
      if (job.target.thenCutout && clipId) void deps.commands.startJob("cutout", { kind: "cutout", sourceMediaId: mediaId }, { clipId });
      return null;
    }
  }
}
