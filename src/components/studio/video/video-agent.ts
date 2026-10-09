"use client";

import { STUDIO_ICON_IDS } from "@/components/studio/canvas/icon-catalog";
import { screenOk, screenRefusal, type ScreenCommand, type ScreenHandler, type ScreenReply } from "@/lib/aichat/screen";
import { planBatch, parseOperations } from "@/lib/studio/agent/batch";
import { videoDesignChecks } from "@/lib/studio/agent/design-check";
import { followTime } from "@/lib/studio/agent/follow";
import { lookTimes, MAX_LOOK_FRAMES, DEFAULT_LOOK_FRAMES } from "@/lib/studio/agent/frames";
import { clipMarkNumbers } from "@/lib/studio/agent/marks";
import { documentChanges, outlineClip, videoOutline, type OutlineContext, type OutlineDetail } from "@/lib/studio/agent/outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, VIDEO_OPERATIONS, videoIds, type VideoOperation } from "@/lib/studio/agent/video-ops";
import { captionWindow } from "@/lib/studio/captions";
import type { VideoDocument } from "@/lib/studio/document";
import { CLIP_JOB_SOURCES, type ClipJobKind } from "@/lib/studio/job-sources";
import { clipTypeForMedia } from "@/lib/studio/media-clips";
import { findClip, isClipPickable } from "@/lib/studio/timeline";
import { parseDocument } from "@/lib/studio/validate";

import { flagArg, ignoredOf, INTERRUPTED, invalidResultRefusal, pageHidden, parseFollow, planRefusal, stringArg, withTimeout } from "../agent/agent-common";
import { captureLibraryImage, captureMediaFrames, captureVideo } from "../agent/frame-capture";
import type { AgentPresence } from "../agent/presence";
import { replaySteps, stepDelay } from "../agent/replay";
import { videoTarget } from "../agent/targets";
import { measureText } from "../agent/text-measure";
import type { AgentFollower } from "./agent-follow";
import type { VideoEditorContextValue } from "./editor-context";
import { readCaptions } from "./job-placement";
import type { VideoJobPurpose, VideoJobTarget } from "./view-store";

const JOB_PURPOSES: readonly VideoJobPurpose[] = ["captions", "denoise", "cutout", "music", "voice", "image"];
const LIBRARY_LIMIT = 20;

export interface VideoAgentDeps {
  editor: Omit<VideoEditorContextValue, "projectId" | "studio">;
  presence: AgentPresence;
  follower: Pick<AgentFollower, "toward">;
  captionTrackName: string;
  label: (action: string) => string;
  reduceMotion: () => boolean;
}

type ReadArgs = { detail?: OutlineDetail };

function assetIds(doc: VideoDocument): string[] {
  return [...new Set(doc.tracks.flatMap((t) => t.clips.map((c) => c.assetId).filter((id): id is string => Boolean(id))))];
}

export function createVideoAgent(deps: VideoAgentDeps): ScreenHandler {
  const { store, view, assets, commands, frames } = deps.editor;
  let lastSeen: VideoDocument | null = null;

  const point = (focus: Parameters<typeof videoTarget>[0], action: string) => {
    const target = videoTarget(focus, store.getState().document, view.getState().pxPerSecond);
    deps.presence.point(target?.point ?? null, deps.label(action), target?.outline ?? null);
  };

  const outlineContext = (detail: OutlineDetail): OutlineContext => {
    const entries = assets.store.getState().assets;
    return {
      detail,
      asset: (id) => {
        const entry = entries[id];
        return entry?.media ? { name: entry.media.description || "mídia", type: entry.media.type, durationMs: entry.durationMs } : undefined;
      },
      playheadMs: view.getState().playheadMs,
      selection: store.getState().selection,
      jobs: view.getState().jobs.map((job) => ({ jobId: job.created?.id ?? job.id, purpose: job.purpose, status: job.state, ...(job.error ? { error: job.error.code } : {}) })),
      library: assets.store
        .getState()
        .library.medias.slice(0, LIBRARY_LIMIT)
        .map((media) => ({ media_id: media.id, name: media.description || "mídia", type: media.type })),
      icons: STUDIO_ICON_IDS,
    };
  };

  async function read(args: ReadArgs): Promise<ScreenReply> {
    const detail: OutlineDetail = args?.detail === "full" ? "full" : "summary";
    const doc = store.getState().document;
    point({ kind: "time", atMs: view.getState().playheadMs }, "read");
    await withTimeout(Promise.all([...assetIds(doc).map((id) => assets.ensure(id)), ...(detail === "full" ? [assets.loadLibrary()] : [])]));
    const outline = videoOutline(doc, { ...outlineContext(detail), changes: lastSeen ? documentChanges(lastSeen, doc) : null });
    lastSeen = doc;
    deps.presence.rest();
    return screenOk(outline);
  }

  async function facts(operations: readonly VideoOperation[]) {
    const doc = store.getState().document;
    const media = [...new Set(operations.filter((op) => op.op === "add_media" && op.media_id).map((op) => op.media_id!))];
    await withTimeout(Promise.all([...media, ...assetIds(doc)].map((id) => assets.ensure(id))));
    const timed = [...new Set([...media, ...assetIds(doc)])].filter((id) => {
      const type = assets.store.getState().assets[id]?.media?.type;
      const kind = type ? clipTypeForMedia(type) : null;
      return kind === "video" || kind === "audio";
    });
    const durations = new Map<string, number>();
    await withTimeout(
      Promise.all(
        timed.map(async (id) => {
          const ms = await assets.sourceDuration(id);
          if (ms !== undefined) durations.set(id, ms);
        }),
      ),
    );
    const captions = new Map<string, string>();
    for (const op of operations) {
      if (op.op !== "add_captions" || !op.media_id || captions.has(op.media_id)) continue;
      const vtt = await withTimeout(readCaptions(op.media_id));
      if (vtt) captions.set(op.media_id, vtt);
    }
    return { durations, captions };
  }

  async function edit(args: unknown): Promise<ScreenReply> {
    const parsed = parseOperations<VideoOperation>(args, VIDEO_OPERATIONS);
    if (!parsed.ok) return screenRefusal("invalid_batch", parsed.reason);
    const { durations, captions } = await facts(parsed.operations);
    const entries = assets.store.getState().assets;
    const ctx = {
      playheadMs: view.getState().playheadMs,
      magnetic: view.getState().magnetic,
      mediaType: (id: string) => (entries[id]?.media ? clipTypeForMedia(entries[id]!.media!.type) : null),
      sourceDuration: (id: string) => durations.get(id),
      captions: (id: string) => captions.get(id),
      captionTrackName: deps.captionTrackName,
      icons: STUDIO_ICON_IDS,
    };
    const base = store.getState().document;
    const plan = planBatch(base, parsed.operations, (doc, op) => applyVideoOperation(doc, op, ctx), VIDEO_ID_FIELDS, videoIds);
    if (!plan.ok) return planRefusal(plan);
    const invalid = invalidResultRefusal(plan.steps, parsed.operations, (doc) => parseDocument("video", doc));
    if (invalid) return invalid;
    const outcome = await replaySteps(base, plan.steps, {
      store,
      presence: deps.presence,
      locate: (focus, doc) => videoTarget(focus, doc, view.getState().pxPerSecond),
      label: (step) => deps.label(step.label),
      onStep: (step) => {
        const at = step.seekMs ?? followTime(step.focus, step.document, view.getState().playheadMs);
        if (at !== null) deps.follower.toward(at);
        if (step.select) store.getState().select(step.select);
      },
      delayMs: stepDelay(plan.steps.length, deps.reduceMotion()),
      quiet: view.getState().playing,
      hidden: pageHidden,
    });
    if (outcome === "interrupted") return INTERRUPTED;
    const after = store.getState().document;
    const kept = store.getState().selection.filter((id) => isClipPickable(after, id));
    if (kept.length !== store.getState().selection.length) store.getState().select(kept);
    lastSeen = after;
    const summary = outlineContext("summary");
    const changed = plan.changed.map((id) => findClip(after, id)).flatMap((found) => (found ? [{ track_id: found.track.id, ...outlineClip(found.clip, summary) }] : []));
    return screenOk({ applied: plan.steps.length, created: plan.created, changed, ...ignoredOf(plan), duration_ms: after.durationMs, checks: videoDesignChecks(after, measureText) });
  }

  async function lookAtMedia(mediaId: string, count: number): Promise<ScreenReply> {
    const entry = await withTimeout(assets.ensure(mediaId));
    const type = entry?.media ? clipTypeForMedia(entry.media.type) : null;
    if (type === "image") return screenOk({ media_id: mediaId, type }, [await captureLibraryImage(mediaId)]);
    if (type !== "video") return screenRefusal("not_visual", "só vídeos e imagens da biblioteca podem ser vistos");
    const durationMs = (await withTimeout(assets.sourceDuration(mediaId))) ?? 0;
    const times = Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) * durationMs) / count));
    const image = await captureMediaFrames(mediaId, times, frames, new AbortController().signal);
    if (!image) return screenRefusal("unreadable", "os quadros desse vídeo não puderam ser lidos");
    return screenOk({ media_id: mediaId, type, duration_ms: durationMs, frames_at_ms: times }, [image]);
  }

  async function look(args: unknown): Promise<ScreenReply> {
    const request = (args ?? {}) as { times_ms?: number[]; count?: number; media_id?: string };
    const marks = flagArg(args, "marks");
    const count = request.count && request.count > 0 ? Math.min(request.count, MAX_LOOK_FRAMES) : DEFAULT_LOOK_FRAMES;
    point({ kind: "frame", x: 0.5, y: 0.5 }, "look");
    try {
      if (request.media_id) return await lookAtMedia(request.media_id, count);
      const doc = store.getState().document;
      const times = lookTimes(doc, { times_ms: request.times_ms, count });
      const { image, notes } = await captureVideo(doc, times, frames, new AbortController().signal, marks ? clipMarkNumbers(doc) : null);
      return screenOk({ frames: notes }, [image]);
    } finally {
      deps.presence.rest();
    }
  }

  function resolveSource(args: unknown): ScreenReply {
    const kind = stringArg(args, "kind") as ClipJobKind | undefined;
    const clipId = stringArg(args, "clipId");
    const found = clipId ? findClip(store.getState().document, clipId) : null;
    if (!found) return screenRefusal("clip_not_found", `o clipe ${clipId ?? "(sem id)"} não existe; leia o projeto de novo com studio_read`);
    if (!kind || !CLIP_JOB_SOURCES[kind]?.(found.clip, found.track)) {
      return screenRefusal("wrong_source", "esse clipe não serve para esse processamento: legendas pedem vídeo ou áudio com fala, limpeza pede áudio e remoção de fundo pede imagem");
    }
    point({ kind: "clip", clipId: found.clip.id }, `job_${kind}`);
    return screenOk({ sourceMediaId: found.clip.assetId });
  }

  function followJob(args: unknown): ScreenReply {
    const follow = parseFollow(args, JOB_PURPOSES);
    if (!follow) return screenRefusal("invalid_job", "o trabalho não pôde ser acompanhado");
    const doc = store.getState().document;
    let target: VideoJobTarget;
    if (follow.purpose === "captions" || follow.purpose === "denoise" || follow.purpose === "cutout") {
      const found = follow.clipId ? findClip(doc, follow.clipId) : null;
      if (!found) return screenRefusal("clip_not_found", `o clipe ${follow.clipId ?? "(sem id)"} não existe mais`);
      target = { clipId: found.clip.id, ...(follow.purpose === "captions" ? { window: captionWindow(found.clip) } : {}) };
      point({ kind: "clip", clipId: found.clip.id }, `job_${follow.purpose}`);
    } else {
      const atMs = follow.atMs ?? view.getState().playheadMs;
      target = { atMs, trackId: follow.trackId, durationMs: follow.durationMs };
      point(follow.trackId ? { kind: "track", trackId: follow.trackId, atMs } : { kind: "time", atMs }, `job_${follow.purpose}`);
    }
    commands.followJob(follow.purpose, follow.job, target);
    deps.presence.rest();
    return screenOk({ following: true });
  }

  return async (command: ScreenCommand): Promise<ScreenReply> => {
    switch (command.name) {
      case "read":
        return read(command.args as ReadArgs);
      case "edit":
        return edit(command.args);
      case "look":
        return look(command.args);
      case "resolve_source":
        return resolveSource(command.args);
      case "follow_job":
        return followJob(command.args);
    }
  };
}
