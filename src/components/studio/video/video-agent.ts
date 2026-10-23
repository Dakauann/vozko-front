"use client";

import { STUDIO_ICON_IDS } from "@/components/studio/canvas/icon-catalog";
import { EXPIRED_REPLY, mayApply, screenOk, screenRefusal, type ScreenCommand, type ScreenHandler, type ScreenReply } from "@/lib/aichat/screen";
import { planBatch, parseOperations } from "@/lib/studio/agent/batch";
import { videoDesignChecks } from "@/lib/studio/agent/design-check";
import { followTime } from "@/lib/studio/agent/follow";
import { cutMiddles, lookFrameCount, lookPlan, lookRequestOf, motionWindows, REGION_RULE, regionOf, type RegionBox } from "@/lib/studio/agent/frames";
import { lookViewOf, VIEW_RULE } from "@/lib/studio/agent/look-views";
import { momentsTarget } from "@/lib/studio/agent/look-target";
import { listenPlan, listenRequestOf } from "@/lib/studio/agent/listen";
import { clipMarkNumbers } from "@/lib/studio/agent/marks";
import { videoLookReports } from "@/lib/studio/agent/look-reports";
import { documentChanges, outlineClip, videoOutline, type OutlineContext, type OutlineDetail } from "@/lib/studio/agent/outline";
import { applyVideoOperation, VIDEO_ID_FIELDS, VIDEO_OPERATIONS, videoIds, type VideoOperation } from "@/lib/studio/agent/video-ops";
import { autoKeySamples } from "@/lib/studio/agent/chroma-ops";
import { trackPlans } from "@/lib/studio/agent/track-ops";
import type { TrackOutcome } from "@/lib/studio/tracking/track-outcome";
import { trackWithin } from "../media/point-tracker";
import { keySampleId, type KeySample } from "@/lib/studio/chroma-detect";
import { trackLoudness } from "@/lib/studio/loudness";
import { videoExportRequestOf } from "@/lib/studio/animated-export";
import { videoCanvasSize, type VideoDocument } from "@/lib/studio/document";
import { CLIP_JOB_SOURCES, clipJobSource, clipJobTarget, type ClipJobKind } from "@/lib/studio/job-sources";
import { clipTypeForMedia } from "@/lib/studio/media-clips";
import { nestedClips, rootMsAt } from "@/lib/studio/group-scope";
import { soundAssetIds } from "@/lib/studio/playback";
import { findClip, isClipPickable } from "@/lib/studio/timeline";
import { parseDocument } from "@/lib/studio/validate";
import { workArea } from "@/lib/studio/work-area";

import type { ScreenReveal } from "@/components/ai-chat/screen-bridge";
import { appliedReport, concurrentOf, flagArg, ignoredOf, invalidResultRefusal, libraryFor, pageHidden, parseFollow, planRefusal, seenReply, stringArg, withTimeout } from "../agent/agent-common";
import type { LibraryLookup } from "@/lib/studio/agent/element-ops";
import { captureLibraryImage, captureMediaFrames, captureVideo, type VideoCapture } from "../agent/frame-capture";
import type { AgentPresence } from "../agent/presence";
import { replaySteps, stepDelay } from "@/components/coworker/replay";
import { momentTicks, videoTarget } from "../agent/targets";
import { measureText } from "../agent/text-measure";
import type { AgentFollower } from "./agent-follow";
import { listenTo } from "./agent-listen";
import { sampleKeyColor } from "./clip-key-color";
import { exportStatus, exportSummary, type VideoExporter } from "./export/video-exporter";
import type { VideoEditorContextValue } from "./editor-context";
import { readCaptions } from "./job-placement";
import { lutReadable, LutUnavailableError, readableLuts } from "../canvas/lut-files";
import { firstUnreadableLut, lutSpanOf, videoLutUses } from "@/lib/studio/lut-uses";
import { LUT_LOST, LUT_REFUSAL_CODE, lutRefusalReason } from "@/lib/studio/agent/lut-refusal";
import { reactLevels } from "./react-levels";
import { presetLibrary, type SaveRefusal } from "./preset-library";
import { presetIdsOf } from "@/lib/studio/agent/preset-ops";
import { presetSummary } from "@/lib/studio/animation-presets";
import { logoMediaIds, shortLinksOf } from "@/lib/studio/agent/qr-ops";
import { assetNaturalSize } from "../canvas/asset-images";
import { lottieLookupFor } from "./lottie-files";
import { VIDEO_JOB_PURPOSES, type VideoJobTarget } from "./view-store";

const SAVE_CODES: Record<SaveRefusal, string> = { missing: "preset_missing", notVisual: "preset_not_visual", nothing: "preset_nothing", name: "preset_name", failed: "preset_failed" };

const SAVE_REFUSALS: Record<SaveRefusal, string> = {
  missing: "o clipe não existe; leia o projeto de novo com studio_read",
  notVisual: "só clipes com imagem (vídeo, imagem, texto, forma, ícone, grupo ou nulo) têm animação para salvar",
  nothing: "o clipe não tem animação para salvar: nenhuma chave de posição, escala, rotação, opacidade ou desfoque, nem comportamento, entrada, saída, animador de texto, efeito ou desfoque de movimento",
  name: "o nome precisa ter de 1 a 120 caracteres",
  failed: "o servidor não guardou a predefinição; nada foi salvo; tente de novo",
};

const LIBRARY_LIMIT = 20;
const TRACK_BUDGET_MS = 20_000;
const MAX_LISTED_MOTION = 24;
const APPROXIMATE_FRAMES =
  "estes quadros saíram simplificados porque a renderização de vídeo do navegador não está disponível: transições, desfoque, animação de texto, cores animadas e correção de cor não aparecem neles; confira posição e opacidade pelos valores em frames";

interface VideoAgentDeps {
  editor: Omit<VideoEditorContextValue, "projectId" | "studio">;
  exporter: Pick<VideoExporter, "store" | "start" | "busy">;
  presence: AgentPresence;
  follower: Pick<AgentFollower, "toward">;
  captionTrackName: string;
  label: (action: string) => string;
  reduceMotion: () => boolean;
  library?: () => Promise<LibraryLookup>;
}

type ReadArgs = { detail?: OutlineDetail };

function assetIds(doc: VideoDocument): string[] {
  return [...new Set([...nestedClips(doc.tracks)].flatMap(({ clip }) => (clip.assetId ? [clip.assetId] : [])))];
}

export function createVideoAgent(deps: VideoAgentDeps): ScreenHandler {
  const { store, view, assets, commands, frames } = deps.editor;
  let lastSeen: VideoDocument | null = null;

  const point = (focus: Parameters<typeof videoTarget>[0], action: string) => {
    const target = videoTarget(focus, store.getState().document, view.getState().pxPerSecond);
    deps.presence.point(target?.point ?? null, deps.label(action), target?.outline ?? null);
  };

  const filmPlayhead = () => {
    const { groupPath, playheadMs } = view.getState();
    return Math.round(rootMsAt(store.getState().document, groupPath, playheadMs));
  };

  const measureLoudness = (doc: VideoDocument) => withTimeout(Promise.all(soundAssetIds(doc).map((id) => deps.editor.audio.loudness(id))));

  const outlineContext = (detail: OutlineDetail): OutlineContext => {
    const entries = assets.store.getState().assets;
    return {
      detail,
      asset: (id) => {
        const entry = entries[id];
        return entry?.media ? { name: entry.media.description || "mídia", type: entry.media.type, durationMs: entry.durationMs } : undefined;
      },
      playheadMs: filmPlayhead(),
      selection: store.getState().selection,
      jobs: view.getState().jobs.map((job) => ({ jobId: job.created?.id ?? job.id, purpose: job.purpose, status: job.state, ...(job.error ? { error: job.error.code } : {}) })),
      library: assets.store
        .getState()
        .library.medias.slice(0, LIBRARY_LIMIT)
        .map((media) => ({ media_id: media.id, name: media.description || "mídia", type: media.type })),
      icons: STUDIO_ICON_IDS,
      trackLoudness: (trackId) => trackLoudness(store.getState().document, trackId, (id) => deps.editor.audio.loudnessOf(id), (id) => deps.editor.audio.speechOf(id)),
    };
  };

  async function read(args: ReadArgs): Promise<ScreenReply> {
    const detail: OutlineDetail = args?.detail === "full" ? "full" : "summary";
    const doc = store.getState().document;
    point({ kind: "time", atMs: view.getState().playheadMs }, "read");
    await withTimeout(Promise.all([...assetIds(doc).map((id) => assets.ensure(id)), ...(detail === "full" ? [assets.loadLibrary()] : [])]));
    await measureLoudness(doc);
    const outline = videoOutline(doc, { ...outlineContext(detail), changes: lastSeen ? documentChanges(lastSeen, doc) : null });
    lastSeen = doc;
    deps.presence.rest();
    const exported = exportSummary(exportStatus(deps.exporter.store.getState(), doc));
    const area = workArea(view.getState().range, doc.durationMs);
    const openGroup = view.getState().groupPath.at(-1);
    const measured = videoLookReports("render", doc, cutMiddles(doc), null, measureText).data;
    return screenOk({ ...outline, ...measured, ...(area ? { work_area: { from_ms: area.startMs, to_ms: area.endMs } } : {}), ...(exported ? { export: exported } : {}), ...(openGroup ? { open_group: openGroup } : {}) });
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
    if (operations.some((op) => op.op === "bake_ducking" || (op.op === "normalize_loudness" && op.track_id))) await withTimeout(Promise.all(soundAssetIds(doc).map((id) => deps.editor.audio.analysis(id))));
    if (operations.some((op) => op.op === "normalize_loudness" || op.op === "mark_beats")) await measureLoudness(doc);
    const keyColors = new Map<string, string>();
    await withTimeout(
      Promise.all(
        autoKeySamples(doc, operations, view.getState().playheadMs).map(async (sample) => {
          const color = await sampleKeyColor(sample, frames, new AbortController().signal);
          if (color) keyColors.set(keySampleId(sample), color);
        }),
      ),
    );
    const tracks = new Map<string, TrackOutcome>();
    const deadline = Date.now() + TRACK_BUDGET_MS;
    for (const plan of trackPlans(doc, operations, view.getState().playheadMs)) {
      point({ kind: "clip", clipId: plan.clipId }, "track");
      tracks.set(plan.key, await trackWithin(plan.assetId, plan.request, deadline - Date.now(), new AbortController().signal));
    }
    const logos = new Map<string, { width: number; height: number }>();
    await withTimeout(
      Promise.all(
        logoMediaIds(operations).map(async (id) => {
          const size = await assetNaturalSize(id).catch(() => undefined);
          if (size) logos.set(id, size);
        }),
      ),
    );
    return { durations, captions, keyColors, tracks, logos };
  }

  async function edit(command: ScreenCommand): Promise<ScreenReply> {
    const args = command.args;
    const parsed = parseOperations<VideoOperation>(args, VIDEO_OPERATIONS);
    if (!parsed.ok) return screenRefusal("invalid_batch", parsed.reason);
    if (view.getState().groupPath.length > 0) commands.closeGroup(view.getState().groupPath.length);
    const { durations, captions, keyColors, tracks, logos } = await facts(parsed.operations);
    const shortLinks = shortLinksOf(args);
    const luts = await readableLuts(parsed.operations);
    const lottieIds = parsed.operations.flatMap((op) => (op.op === "import_lottie" && op.media_id ? [op.media_id] : []));
    const lotties = lottieIds.length > 0 ? await withTimeout(lottieLookupFor(lottieIds, assets)) : undefined;
    const presets = presetIdsOf(parsed.operations).length > 0 ? await withTimeout(presetLibrary.load(true)) : null;
    if (parsed.operations.some((op) => op.op === "bake_behavior")) await withTimeout(reactLevels.preload(soundAssetIds(store.getState().document)));
    const entries = assets.store.getState().assets;
    const ctx = {
      playheadMs: view.getState().playheadMs,
      magnetic: view.getState().magnetic,
      mediaType: (id: string) => (entries[id]?.media ? clipTypeForMedia(entries[id]!.media!.type) : null),
      sourceDuration: (id: string) => durations.get(id),
      captions: (id: string) => captions.get(id),
      captionTrackName: deps.captionTrackName,
      icons: STUDIO_ICON_IDS,
      speech: (id: string) => deps.editor.audio.speechOf(id),
      loudness: (id: string) => deps.editor.audio.loudnessOf(id),
      keyColor: (sample: KeySample) => keyColors.get(keySampleId(sample)),
      isLut: (id: string) => luts.has(id),
      trackOutcome: (key: string) => tracks.get(key),
      levels: (doc: VideoDocument) => reactLevels.current(doc),
      library: await libraryFor(parsed.operations, deps.library, STUDIO_ICON_IDS),
      presets: presets ? { ok: true as const, find: presetLibrary.find } : { ok: false as const },
      naturalSize: (id: string) => logos.get(id),
      shortLinkUrl: (id: string) => shortLinks.get(id),
      ...(lotties ? { lottie: lotties } : {}),
    };
    const base = store.getState().document;
    const plan = planBatch(base, parsed.operations, (doc, op) => applyVideoOperation(doc, op, ctx), VIDEO_ID_FIELDS, videoIds);
    if (!plan.ok) return planRefusal(plan, parsed.operations);
    const invalid = invalidResultRefusal(plan.steps, parsed.operations, (doc) => parseDocument("video", doc));
    if (invalid) return invalid;
    if (!(await mayApply(command))) return EXPIRED_REPLY;
    const outcome = await replaySteps(base, plan.steps, {
      store,
      presence: deps.presence,
      locate: (focus, doc) => videoTarget(focus, doc, view.getState().pxPerSecond),
      label: (step) => deps.label(step.label),
      onStep: (step, together) => {
        if (!together) return;
        const at = step.seekMs ?? followTime(step.focus, step.document, view.getState().playheadMs);
        if (at !== null) deps.follower.toward(at);
        if (step.select) store.getState().select(step.select);
      },
      valid: (doc) => parseDocument("video", doc).ok,
      delayMs: stepDelay(plan.steps.length, deps.reduceMotion()),
      quiet: view.getState().playing,
      hidden: pageHidden,
    });
    const after = store.getState().document;
    const kept = store.getState().selection.filter((id) => isClipPickable(after, id));
    if (kept.length !== store.getState().selection.length) store.getState().select(kept);
    lastSeen = after;
    const summary = outlineContext("summary");
    const changed = plan.changed.map((id) => findClip(after, id)).flatMap((found) => (found ? [{ track_id: found.track.id, ...outlineClip(found.clip, summary) }] : []));
    return screenOk({ ...appliedReport(plan, parsed.operations, outcome), created: plan.created, changed, ...ignoredOf(plan), ...concurrentOf(outcome), duration_ms: after.durationMs, checks: videoDesignChecks(after, measureText) });
  }

  async function savePreset(command: ScreenCommand): Promise<ScreenReply> {
    const args = command.args;
    const clipId = stringArg(args, "clip_id");
    const name = stringArg(args, "name") ?? "";
    if (!clipId) return screenRefusal("invalid_preset", "informe clip_id");
    if (!(await mayApply(command))) return EXPIRED_REPLY;
    point({ kind: "clip", clipId }, "preset");
    try {
      const saved = await presetLibrary.save(store.getState().document, clipId, name, stringArg(args, "description"));
      if (!saved.ok) return screenRefusal(SAVE_CODES[saved.reason], SAVE_REFUSALS[saved.reason]);
      return screenOk({ preset_id: saved.preset.id, name: saved.preset.name, ...presetSummary(saved.preset.animation), skipped: saved.skipped });
    } finally {
      deps.presence.rest();
    }
  }

  async function lookAtMedia(mediaId: string, count: number): Promise<ScreenReply> {
    const entry = await withTimeout(assets.ensure(mediaId));
    const type = entry?.media ? clipTypeForMedia(entry.media.type) : null;
    if (type === "image") return seenReply(deps.presence, { media_id: mediaId, type }, await captureLibraryImage(mediaId), { kind: "media" });
    if (type !== "video") return screenRefusal("not_visual", "só vídeos e imagens da biblioteca podem ser vistos");
    const durationMs = (await withTimeout(assets.sourceDuration(mediaId))) ?? 0;
    const times = Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) * durationMs) / count));
    const image = await captureMediaFrames(mediaId, times, frames, new AbortController().signal);
    if (!image) return screenRefusal("unreadable", "os quadros desse vídeo não puderam ser lidos");
    return seenReply(deps.presence, { media_id: mediaId, type, duration_ms: durationMs, frames_at_ms: times }, image, { kind: "media" });
  }

  const pointAtLook = (doc: VideoDocument, times: readonly number[], region: RegionBox | null) => {
    const { pxPerSecond, groupPath } = view.getState();
    const focus = region ? { kind: "frame" as const, x: region.left + region.width / 2, y: region.top + region.height / 2, w: region.width, h: region.height } : { kind: "frame" as const, x: 0.5, y: 0.5 };
    const target = videoTarget(focus, doc, pxPerSecond);
    deps.presence.point(target?.point ?? null, deps.label("look"), target?.outline ?? null, groupPath.length === 0 ? momentTicks(times, pxPerSecond) : []);
  };

  async function look(args: unknown): Promise<ScreenReply> {
    const request = lookRequestOf(args);
    const mediaId = stringArg(args, "media_id");
    const region = regionOf(request.region);
    if (request.region && !region) return screenRefusal("invalid_region", REGION_RULE);
    const view = lookViewOf(request.view);
    if (!view) return screenRefusal("invalid_view", VIEW_RULE);
    point({ kind: "frame", x: 0.5, y: 0.5 }, "look");
    try {
      if (mediaId) return await lookAtMedia(mediaId, lookFrameCount(request.count));
      const doc = store.getState().document;
      const plan = lookPlan(doc, request);
      if (!plan.ok) return screenRefusal("invalid_look", plan.reason);
      pointAtLook(doc, plan.times, region);
      const uses = videoLutUses(doc, lutSpanOf(plan.times));
      const blocked = await firstUnreadableLut(uses, lutReadable);
      if (blocked) return screenRefusal(LUT_REFUSAL_CODE, lutRefusalReason(blocked));
      const marks = flagArg(args, "marks") ? clipMarkNumbers(doc) : null;
      const windowed = Boolean(request.focus_id) || request.from_ms !== undefined;
      const reports = videoLookReports(view, doc, plan.times, windowed ? { fromMs: Math.min(...plan.times), toMs: Math.max(...plan.times) } : null, measureText);
      let capture: VideoCapture;
      try {
        capture = await captureVideo(doc, { times: plan.times, dense: plan.dense, region, marks, view, shapes: reports.shapes }, frames, new AbortController().signal);
      } catch (error) {
        if (!(error instanceof LutUnavailableError)) throw error;
        const lost = uses.find((use) => use.assetId === error.assetId);
        return screenRefusal(LUT_REFUSAL_CODE, lost ? lutRefusalReason(lost) : LUT_LOST);
      }
      const motion = plan.windows.length > 0 ? { windows: plan.windows } : { motion: motionWindows(doc).slice(0, MAX_LISTED_MOTION) };
      const data = { frames: capture.notes, ...motion, ...reports.data, ...(view === "render" ? {} : { view }), ...(region ? { region: request.region } : {}), ...(capture.approximate ? { approximate: APPROXIMATE_FRAMES } : {}) };
      return seenReply(deps.presence, data, capture.image, momentsTarget(plan.times));
    } finally {
      deps.presence.rest();
    }
  }

  async function listen(args: unknown): Promise<ScreenReply> {
    const doc = store.getState().document;
    const plan = listenPlan(doc, listenRequestOf(args));
    if (!plan.ok) return screenRefusal(plan.code, plan.reason);
    point({ kind: "time", atMs: plan.fromMs }, "listen");
    try {
      return screenOk(await listenTo(doc, plan));
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
    return screenOk({ sourceMediaId: clipJobSource(kind, found.clip) });
  }

  function exportVideo(args: unknown): ScreenReply {
    const doc = store.getState().document;
    const request = videoExportRequestOf((args ?? {}) as Record<string, unknown>, videoCanvasSize(doc), doc.durationMs);
    if (!request) {
      return screenRefusal(
        "invalid_export",
        `format vai em mp4, gif, webp, png ou jpeg; width de 120 até a largura do vídeo, fps de 5 a 30, colors de 2 a 256 e dither só no gif, quality de 0.5 a 1 só no webp ou jpeg, loop de 0 a 65535; from_ms e to_ms (só em mp4, gif ou webp) inteiros com 0 <= from_ms < to_ms <= ${doc.durationMs}; png e jpeg pedem at_ms inteiro de 0 a ${Math.max(0, doc.durationMs - 1)}`,
      );
    }
    if (deps.exporter.busy()) return screenRefusal("export_busy", "uma exportação já está em andamento; acompanhe em studio_read, no campo export");
    void deps.exporter.start(request);
    return screenOk({ started: true, format: request.format, follow: "studio_read mostra o andamento e o media_id final no campo export" });
  }

  function followJob(args: unknown): ScreenReply {
    const follow = parseFollow(args, VIDEO_JOB_PURPOSES);
    if (!follow) return screenRefusal("invalid_job", "o trabalho não pôde ser acompanhado");
    const doc = store.getState().document;
    let target: VideoJobTarget;
    if (follow.purpose === "captions" || follow.purpose === "denoise" || follow.purpose === "cutout") {
      const found = follow.clipId ? findClip(doc, follow.clipId) : null;
      if (!found) return screenRefusal("clip_not_found", `o clipe ${follow.clipId ?? "(sem id)"} não existe mais`);
      target = clipJobTarget(follow.purpose, found.clip);
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
        return edit(command);
      case "look":
        return look(command.args);
      case "resolve_source":
        return resolveSource(command.args);
      case "follow_job":
        return followJob(command.args);
      case "export":
        return exportVideo(command.args);
      case "listen":
        return listen(command.args);
      case "save_preset":
        return savePreset(command);
      case "create_project":
      case "open_design":
        return screenRefusal("not_editor", "o editor não cria nem abre projetos; quem faz isso é a aba da conversa");
    }
  };
}

export function createVideoReveal({ view, commands, playback }: Pick<VideoAgentDeps["editor"], "view" | "commands" | "playback">): ScreenReveal {
  return (target) => {
    if (target.kind !== "moments") return;
    const open = view.getState().groupPath.length;
    if (open > 0) commands.closeGroup(open);
    playback.seek(target.fromMs);
  };
}
