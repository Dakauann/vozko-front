"use client";

import { getMediaAction } from "@/app/actions/medias";
import { screenOk, screenRefusal, type ScreenCommand, type ScreenHandler, type ScreenReply } from "@/lib/aichat/screen";
import { artboardById, artboardOfLayer, layerOf } from "@/lib/studio/artboards";
import { planBatch, parseOperations, type AgentFocus } from "@/lib/studio/agent/batch";
import { imageDesignChecks } from "@/lib/studio/agent/design-check";
import { applyImageOperation, IMAGE_ID_FIELDS, IMAGE_OPERATIONS, imageIds, type ImageOperation } from "@/lib/studio/agent/image-ops";
import { imageMarkTargets, type MarkTarget } from "@/lib/studio/agent/marks";
import { documentChanges, imageOutline, outlineLayer, type OutlineContext, type OutlineDetail } from "@/lib/studio/agent/outline";
import type { Artboard, CanvasSize, ImageDocument } from "@/lib/studio/document";
import { STUDIO_ICON_IDS } from "@/components/studio/canvas/icon-catalog";
import { layerJobSource } from "@/lib/studio/job-sources";
import { newlyLocked } from "@/lib/studio/layers";
import { clipTypeForMedia } from "@/lib/studio/media-clips";
import { parseDocument } from "@/lib/studio/validate";

import { flagArg, ignoredOf, INTERRUPTED, invalidResultRefusal, pageHidden, parseFollow, planRefusal, stringArg, withTimeout } from "../agent/agent-common";
import { captureArtboard, captureArtboards, captureLibraryImage } from "../agent/frame-capture";
import type { AgentPresence } from "../agent/presence";
import { replaySteps, stepDelay } from "../agent/replay";
import { imageTarget } from "../agent/targets";
import { measureText } from "../agent/text-measure";
import type { ImageCommands } from "./commands";
import { currentArtboard, type EditorUiStore } from "./editor-state";
import type { StudioEditorStore } from "@/lib/studio/store";

const JOB_PURPOSES = ["image", "cutout"] as const;
const ALL_ARTBOARDS = "all";

export interface ImageAgentDeps {
  store: StudioEditorStore<ImageDocument>;
  ui: EditorUiStore;
  commands: ImageCommands;
  naturalSize: (assetId: string) => Promise<CanvasSize>;
  presence: AgentPresence;
  label: (action: string) => string;
  reduceMotion: () => boolean;
}

function assetIds(doc: ImageDocument): string[] {
  return [...new Set(doc.artboards.flatMap((a) => a.layers.map((l) => l.assetId)).filter((id): id is string => Boolean(id)))];
}

function focusedArtboard(doc: ImageDocument, focus: AgentFocus): string | null {
  if (focus.kind === "artboard") return focus.artboardId;
  return focus.kind === "layer" ? (artboardOfLayer(doc, focus.layerId)?.id ?? null) : null;
}

function touchedArtboards(before: ImageDocument, after: ImageDocument): Artboard[] {
  return after.artboards.filter((a) => before.artboards.find((b) => b.id === a.id) !== a);
}

function artboardChecks(before: ImageDocument, after: ImageDocument): string[] {
  const touched = touchedArtboards(before, after);
  return touched.flatMap((artboard) => imageDesignChecks(artboard, measureText).map((line) => (after.artboards.length > 1 ? `prancheta ${artboard.id}: ${line}` : line)));
}

function sheetMarks(artboards: readonly Artboard[], marked: boolean): MarkTarget[][] {
  let next = 1;
  return artboards.map((artboard) => {
    if (!marked) return [];
    const targets = imageMarkTargets(artboard, next);
    next += targets.length;
    return targets;
  });
}

export function createImageAgent(deps: ImageAgentDeps): ScreenHandler {
  const { store, ui, commands } = deps;
  const names = new Map<string, { name: string; type: string }>();
  let lastSeen: ImageDocument | null = null;

  const point = (focus: AgentFocus, action: string) => {
    const target = imageTarget(focus, store.getState().document, ui.getState().viewport);
    deps.presence.point(target?.point ?? null, deps.label(action), target?.outline ?? null);
  };

  const learnNames = async (ids: readonly string[]) => {
    const unknown = ids.filter((id) => !names.has(id));
    await withTimeout(
      Promise.all(
        unknown.map(async (id) => {
          const media = await getMediaAction(id);
          if (media) names.set(id, { name: media.description || "imagem", type: media.type });
        }),
      ),
    );
  };

  const outlineContext = (detail: OutlineDetail): OutlineContext => ({
    detail,
    icons: STUDIO_ICON_IDS,
    asset: (id) => names.get(id),
    playheadMs: 0,
    selection: store.getState().selection,
    activeArtboard: currentArtboard(store, ui).id,
    jobs: ui.getState().jobs.map((job) => ({ jobId: job.created?.id ?? job.id, purpose: job.purpose, status: job.error ? "failed" : "running", ...(job.error ? { error: job.error } : {}) })),
  });

  async function read(args: unknown): Promise<ScreenReply> {
    const detail: OutlineDetail = stringArg(args, "detail") === "full" ? "full" : "summary";
    const doc = store.getState().document;
    point({ kind: "canvas" }, "read");
    await learnNames(assetIds(doc));
    const outline = imageOutline(doc, { ...outlineContext(detail), changes: lastSeen ? documentChanges(lastSeen, doc) : null });
    lastSeen = doc;
    deps.presence.rest();
    return screenOk(outline);
  }

  async function edit(args: unknown): Promise<ScreenReply> {
    const parsed = parseOperations<ImageOperation>(args, IMAGE_OPERATIONS);
    if (!parsed.ok) return screenRefusal("invalid_batch", parsed.reason);
    const media = [...new Set(parsed.operations.filter((op) => (op.op === "add_image" || op.op === "replace_image") && op.media_id).map((op) => op.media_id!))];
    const sizes = new Map<string, CanvasSize>();
    await withTimeout(
      Promise.all(
        media.map(async (id) => {
          const size = await deps.naturalSize(id).catch(() => undefined);
          if (size) sizes.set(id, size);
        }),
      ),
    );
    const base = store.getState().document;
    const context = { naturalSize: (id: string) => sizes.get(id), icons: STUDIO_ICON_IDS, activeArtboard: currentArtboard(store, ui).id };
    const plan = planBatch(base, parsed.operations, (doc, op) => applyImageOperation(doc, op, context), IMAGE_ID_FIELDS, imageIds);
    if (!plan.ok) return planRefusal(plan);
    const invalid = invalidResultRefusal(plan.steps, parsed.operations, (doc) => parseDocument("image", doc));
    if (invalid) return invalid;
    const outcome = await replaySteps(base, plan.steps, {
      store,
      presence: deps.presence,
      locate: (focus, doc) => imageTarget(focus, doc, ui.getState().viewport),
      label: (step) => deps.label(step.label),
      onStep: (step) => {
        if (step.select) commands.select(step.select);
        const artboardId = focusedArtboard(step.document, step.focus);
        if (artboardId) commands.ensureVisible(artboardId);
      },
      delayMs: stepDelay(plan.steps.length, deps.reduceMotion()),
      hidden: pageHidden,
    });
    if (outcome === "interrupted") return INTERRUPTED;
    const after = store.getState().document;
    const released = new Set(newlyLocked({ layers: base.artboards.flatMap((a) => a.layers) }, { layers: after.artboards.flatMap((a) => a.layers) }, store.getState().selection));
    if (released.size > 0) commands.select(store.getState().selection.filter((id) => !released.has(id)));
    lastSeen = after;
    await learnNames(media);
    const summary = outlineContext("summary");
    const changed = plan.changed.flatMap((id) => {
      const home = artboardOfLayer(after, id);
      const layer = home?.layers.find((l) => l.id === id);
      return home && layer ? [{ ...outlineLayer(layer, home.layers.indexOf(layer), summary), artboard: home.id }] : [];
    });
    const copies = Object.keys(plan.copies).length > 0 ? { copies: plan.copies } : {};
    return screenOk({ applied: plan.steps.length, created: plan.created, changed, ...copies, ...ignoredOf(plan), checks: artboardChecks(base, after) });
  }

  async function lookAt(args: unknown): Promise<ScreenReply> {
    const doc = store.getState().document;
    const marked = flagArg(args, "marks");
    const target = stringArg(args, "artboard_id");
    if (target === ALL_ARTBOARDS) {
      point({ kind: "canvas" }, "look");
      const marks = sheetMarks(doc.artboards, marked);
      const shots = doc.artboards.map((artboard, index) => ({ surface: artboard, label: artboard.name ? `${index + 1} · ${artboard.name}` : String(index + 1), marks: marks[index] }));
      const legend = marked ? { marks: marks.flatMap((targets, index) => targets.map(({ n, id }) => ({ n, id, artboard: doc.artboards[index].id }))) } : {};
      const artboards = doc.artboards.map((a, index) => ({ n: index + 1, id: a.id, ...(a.name ? { name: a.name } : {}), width: a.canvas.width, height: a.canvas.height }));
      return screenOk({ artboards, ...legend }, [await captureArtboards(shots)]);
    }
    const artboard = target ? artboardById(doc, target) : currentArtboard(store, ui);
    if (!artboard) return screenRefusal("artboard_not_found", `a prancheta ${target} não existe; leia o projeto com studio_read`);
    commands.ensureVisible(artboard.id);
    point({ kind: "artboard", artboardId: artboard.id }, "look");
    const marks = marked ? imageMarkTargets(artboard) : [];
    const legend = marks.length > 0 ? { marks: marks.map(({ n, id }) => ({ n, id })) } : {};
    return screenOk({ artboard_id: artboard.id, width: artboard.canvas.width, height: artboard.canvas.height, ...legend }, [await captureArtboard(artboard, marks)]);
  }

  async function look(args: unknown): Promise<ScreenReply> {
    const mediaId = stringArg(args, "media_id");
    try {
      if (!mediaId) return await lookAt(args);
      point({ kind: "canvas" }, "look");
      const media = await withTimeout(getMediaAction(mediaId));
      if (!media || clipTypeForMedia(media.type) !== "image") return screenRefusal("not_image", "no editor de imagem só dá para ver imagens da biblioteca");
      return screenOk({ media_id: mediaId }, [await captureLibraryImage(mediaId)]);
    } finally {
      deps.presence.rest();
    }
  }

  function resolveSource(args: unknown): ScreenReply {
    const layerId = stringArg(args, "layerId");
    const source = layerJobSource(layerId ? layerOf(store.getState().document, layerId) : undefined);
    if (stringArg(args, "kind") !== "cutout" || !source) return screenRefusal("wrong_source", "a remoção de fundo pede uma camada de imagem existente");
    point({ kind: "layer", layerId: layerId! }, "job_cutout");
    return screenOk({ sourceMediaId: source });
  }

  function followJob(args: unknown): ScreenReply {
    const follow = parseFollow(args, JOB_PURPOSES);
    if (!follow) return screenRefusal("invalid_job", "o trabalho não pôde ser acompanhado");
    if (follow.purpose === "cutout" && !(follow.layerId && layerOf(store.getState().document, follow.layerId))) {
      return screenRefusal("layer_not_found", "a camada não existe mais");
    }
    commands.followJob(follow.purpose === "image" ? "generate" : "cutout", follow.job, follow.purpose === "cutout" ? follow.layerId! : null);
    point(follow.layerId ? { kind: "layer", layerId: follow.layerId } : { kind: "canvas" }, `job_${follow.purpose}`);
    deps.presence.rest();
    return screenOk({ following: true });
  }

  return async (command: ScreenCommand): Promise<ScreenReply> => {
    switch (command.name) {
      case "read":
        return read(command.args);
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
