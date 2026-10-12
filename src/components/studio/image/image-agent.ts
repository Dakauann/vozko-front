"use client";

import { getMediaAction } from "@/app/actions/medias";
import { EXPIRED_REPLY, mayApply, screenOk, screenRefusal, type ScreenCommand, type ScreenHandler, type ScreenReply } from "@/lib/aichat/screen";
import { artboardById, artboardOfLayer } from "@/lib/studio/artboards";
import { aiActionsFor, type AiActionId, type AiBlockReason } from "@/lib/studio/ai-actions";
import { planBatch, parseOperations, type AgentFocus } from "@/lib/studio/agent/batch";
import { imageDesignChecks, imageQrChecks } from "@/lib/studio/agent/design-check";
import { applyImageOperation, autoKeySources, IMAGE_ID_FIELDS, IMAGE_OPERATIONS, imageIds, type ImageOperation } from "@/lib/studio/agent/image-ops";
import { layerKeySource } from "@/lib/studio/chroma-detect";
import { lookRequestOf, REGION_RULE, regionOf } from "@/lib/studio/agent/frames";
import { artboardTarget } from "@/lib/studio/agent/look-target";
import { imageMarkTargets, type MarkTarget } from "@/lib/studio/agent/marks";
import { focusRegion, guideReport, lookViewOf, VIEW_RULE } from "@/lib/studio/agent/look-views";
import { legibilityReport } from "@/lib/studio/agent/legibility";
import { lookReports } from "@/lib/studio/agent/look-reports";
import { documentChanges, imageOutline, outlineLayer, type OutlineContext, type OutlineDetail } from "@/lib/studio/agent/outline";
import type { Artboard, CanvasSize, ImageDocument, ImageSurface, Layer } from "@/lib/studio/document";
import { perceivedSurface, resolvedArtboards, resolvedSurface } from "@/lib/studio/components";
import type { HugMeasure } from "@/lib/studio/auto-layout";
import { STUDIO_ICON_IDS } from "@/components/studio/canvas/icon-catalog";
import { newlyLocked } from "@/lib/studio/layers";
import { clipTypeForMedia } from "@/lib/studio/media-clips";
import { parseDocument } from "@/lib/studio/validate";

import type { ScreenReveal } from "@/components/ai-chat/screen-bridge";
import { appliedReport, concurrentOf, flagArg, ignoredOf, invalidResultRefusal, libraryFor, pageHidden, parseFollow, planRefusal, seenReply, spreadReport, stringArg, withTimeout } from "../agent/agent-common";
import type { LibraryLookup } from "@/lib/studio/agent/element-ops";
import { captureArtboard, captureArtboards, captureBackdrop, captureLibraryImage } from "../agent/frame-capture";
import { assetKeyColor } from "../canvas/key-color";
import type { AgentPresence } from "../agent/presence";
import { replaySteps, stepDelay } from "../agent/replay";
import { imageRegionTarget, imageTarget } from "../agent/targets";
import { measureText } from "../agent/text-measure";
import { imageAiTarget, type ImageAiTarget } from "./ai-actions";
import type { ImageCommands } from "./commands";
import { currentArtboard, type EditorUiStore } from "./editor-state";
import { LutBlockedError, lutReadable, readableLuts } from "../canvas/lut-files";
import { firstUnreadableLut, surfaceLutUses } from "@/lib/studio/lut-uses";
import { LUT_REFUSAL_CODE, lutRefusalReason } from "@/lib/studio/agent/lut-refusal";
import type { StudioEditorStore } from "@/lib/studio/store";
import { exportFailure, exportRequestOf, loadRaster, rasterizedLayers, renderExport, saveRendered, type ExportFailureKey, type RenderedArtboard } from "./export-artboards";
import { isRasterFormat, visibleLayers } from "@/lib/studio/image-edits";
import { logoMediaIds, shortLinksOf } from "@/lib/studio/agent/qr-ops";

const JOB_PURPOSES = ["image", "cutout"] as const;
const SOURCE_ACTIONS: Readonly<Record<string, AiActionId>> = { cutout: "removeBackground", image: "editImage" };
const WRONG_SOURCE = "o elemento precisa mostrar uma única imagem: camada de imagem, moldura ou tela com foto, célula de grade ou forma com um preenchimento de imagem";
const SOURCE_BLOCKS: Record<AiBlockReason, string> = {
  locked: "a camada da imagem está travada; destrave com set_locked antes",
  loading: "a imagem desse elemento ainda não está na biblioteca; tente de novo",
  running: "esse elemento já tem esse trabalho rodando; acompanhe com studio_jobs",
  busy: "o limite de trabalhos ao mesmo tempo foi atingido; espere um terminar",
  noElo: "o usuário não tem acesso à Elo",
};
const ALL_ARTBOARDS = "all";

const EXPORT_FAILURES: Record<ExportFailureKey, string> = {
  "errors.font": "uma fonte do projeto não carregou; tente de novo",
  "errors.asset": "uma imagem do projeto não está mais na biblioteca; troque ou remova a camada",
  "errors.timeout": "a prancheta demorou demais para desenhar; tente de novo",
  "errors.render": "a prancheta não pôde ser desenhada",
  "errors.lut": "um LUT de uma camada não pôde ser lido",
};

async function lutRefusal(surfaces: readonly ImageSurface[]): Promise<ScreenReply | null> {
  const blocked = await firstUnreadableLut(surfaces.flatMap(surfaceLutUses), lutReadable);
  return blocked ? screenRefusal(LUT_REFUSAL_CODE, lutRefusalReason(blocked)) : null;
}

async function measuredLegibility(surface: ImageSurface): Promise<string[]> {
  if (!visibleLayers(surface.layers).some((layer) => layer.type === "text" && layer.text?.trim())) return [];
  return legibilityReport(surface, await captureBackdrop(surface));
}

export interface ImageAgentDeps {
  store: StudioEditorStore<ImageDocument>;
  ui: EditorUiStore;
  commands: ImageCommands;
  naturalSize: (assetId: string) => Promise<CanvasSize>;
  presence: AgentPresence;
  label: (action: string) => string;
  reduceMotion: () => boolean;
  projectId: string;
  projectName: string;
  exportTitle: (artboardId: string) => string;
  measure?: HugMeasure;
  library?: () => Promise<LibraryLookup>;
}

function assetIds(doc: ImageDocument): string[] {
  return [...new Set(doc.artboards.flatMap((a) => a.layers.map((l) => l.assetId)).filter((id): id is string => Boolean(id)))];
}

function focusedArtboard(doc: ImageDocument, focus: AgentFocus): string | null {
  if (focus.kind === "artboard") return focus.artboardId;
  return focus.kind === "layer" ? (artboardOfLayer(doc, focus.layerId)?.id ?? null) : null;
}

function changedArtboards(doc: ImageDocument, ids: readonly string[]): { id: string; x: number; y: number; width: number; height: number }[] {
  return ids.flatMap((id) => {
    const artboard = artboardById(doc, id);
    return artboard ? [{ id, x: artboard.x, y: artboard.y, width: artboard.canvas.width, height: artboard.canvas.height }] : [];
  });
}

function touchedArtboards(before: ImageDocument, after: ImageDocument): Artboard[] {
  return after.artboards.filter((a) => before.artboards.find((b) => b.id === a.id) !== a);
}

function artboardChecks(before: ImageDocument, after: ImageDocument): string[] {
  const touched = touchedArtboards(before, after);
  return touched.flatMap((artboard) => [...imageDesignChecks(resolvedSurface(after, artboard), measureText), ...imageQrChecks(artboard)].map((line) => (after.artboards.length > 1 ? `prancheta ${artboard.id}: ${line}` : line)));
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
    return screenOk({ ...outline, artboards: outline.artboards.map((board, index) => ({ ...board, ...lookReports("render", perceivedSurface(doc, doc.artboards[index]), measureText).data })) });
  }

  async function edit(command: ScreenCommand): Promise<ScreenReply> {
    const args = command.args;
    const parsed = parseOperations<ImageOperation>(args, IMAGE_OPERATIONS);
    if (!parsed.ok) return screenRefusal("invalid_batch", parsed.reason);
    const media = [...new Set([...parsed.operations.filter((op) => (op.op === "add_image" || op.op === "replace_image" || op.op === "fill_frame" || op.op === "set_overrides") && op.media_id).map((op) => op.media_id!), ...logoMediaIds(parsed.operations)])];
    const shortLinks = shortLinksOf(args);
    const sizes = new Map<string, CanvasSize>();
    await withTimeout(
      Promise.all(
        media.map(async (id) => {
          const size = await deps.naturalSize(id).catch(() => undefined);
          if (size) sizes.set(id, size);
        }),
      ),
    );
    const keyColors = new Map<string, string>();
    await withTimeout(
      Promise.all(
        [...autoKeySources(store.getState().document, parsed.operations)].map(async ([source, picture]) => {
          const color = picture.assetId ? await assetKeyColor(picture.assetId, picture.crop) : null;
          if (color) keyColors.set(source, color);
        }),
      ),
    );
    const base = store.getState().document;
    const keyColor = (layer: Layer) => {
      const source = layerKeySource(layer);
      return source ? keyColors.get(source) : undefined;
    };
    const library = await libraryFor(parsed.operations, deps.library, STUDIO_ICON_IDS);
    const luts = await readableLuts(parsed.operations);
    const context = { naturalSize: (id: string) => sizes.get(id), icons: STUDIO_ICON_IDS, activeArtboard: currentArtboard(store, ui).id, keyColor, measure: deps.measure, library, isLut: (id: string) => luts.has(id), shortLinkUrl: (id: string) => shortLinks.get(id) };
    const plan = planBatch(base, parsed.operations, (doc, op) => applyImageOperation(doc, op, context), IMAGE_ID_FIELDS, imageIds);
    if (!plan.ok) return planRefusal(plan, parsed.operations);
    const invalid = invalidResultRefusal(plan.steps, parsed.operations, (doc) => parseDocument("image", doc));
    if (invalid) return invalid;
    if (!(await mayApply(command))) return EXPIRED_REPLY;
    const outcome = await replaySteps(base, plan.steps, {
      store,
      presence: deps.presence,
      locate: (focus, doc) => imageTarget(focus, doc, ui.getState().viewport),
      label: (step) => deps.label(step.label),
      onStep: (step, together) => {
        if (!together) return;
        if (step.select) commands.select(step.select);
        const artboardId = focusedArtboard(step.document, step.focus);
        if (artboardId) commands.ensureVisible(artboardId);
      },
      valid: (doc) => parseDocument("image", doc).ok,
      delayMs: stepDelay(plan.steps.length, deps.reduceMotion()),
      hidden: pageHidden,
    });
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
    const boards = changedArtboards(after, plan.changed);
    return screenOk({
      ...appliedReport(plan, parsed.operations, outcome),
      created: plan.created,
      changed,
      ...(boards.length > 0 ? { artboards: boards } : {}),
      ...spreadReport(plan),
      ...copies,
      ...ignoredOf(plan),
      ...concurrentOf(outcome),
      checks: artboardChecks(base, after),
    });
  }

  async function lookAt(args: unknown): Promise<ScreenReply> {
    const doc = store.getState().document;
    const marked = flagArg(args, "marks");
    const request = lookRequestOf(args);
    const view = lookViewOf(request.view);
    if (!view) return screenRefusal("invalid_view", VIEW_RULE);
    const numbered = marked || view === "wireframe";
    const outlined = numbered || view !== "render";
    const focusId = request.focus_id;
    const focusHome = focusId ? artboardOfLayer(doc, focusId) : undefined;
    const focusLayer = focusId ? focusHome?.layers.find((layer) => layer.id === focusId) : undefined;
    if (focusId && !focusLayer) return screenRefusal("layer_not_found", `a camada ${focusId} não existe; leia o projeto com studio_read`);
    if (focusId && request.region) return screenRefusal("invalid_region", "focus_id já aproxima a camada; use focus_id ou region, um de cada vez");
    const target = focusHome ? focusHome.id : stringArg(args, "artboard_id");
    const asked = focusHome && focusLayer ? focusRegion(focusLayer.transform, focusHome.canvas) : request.region;
    const region = regionOf(asked);
    if (asked && !region) return screenRefusal("invalid_region", REGION_RULE);
    if (region && target === ALL_ARTBOARDS) return screenRefusal("invalid_region", "region aproxima uma prancheta só; escolha a prancheta em artboard_id");
    const viewData = view === "render" ? {} : { view };
    if (target === ALL_ARTBOARDS) {
      point({ kind: "canvas" }, "look");
      const marks = sheetMarks(doc.artboards, outlined);
      const shots = doc.artboards.map((artboard, index) => {
        const surface = resolvedSurface(doc, artboard);
        const shapes = view === "render" ? [] : lookReports(view, perceivedSurface(doc, artboard), measureText).shapes;
        return { surface, label: artboard.name ? `${index + 1} · ${artboard.name}` : String(index + 1), overlay: { view, targets: marks[index], numbered, shapes } };
      });
      const refused = await lutRefusal(shots.map((shot) => shot.surface));
      if (refused) return refused;
      const legend = numbered ? { marks: marks.flatMap((targets, index) => targets.map(({ n, id, kind }) => ({ n, id, kind, artboard: doc.artboards[index].id }))) } : {};
      const artboards = doc.artboards.map((a, index) => ({ n: index + 1, id: a.id, ...(a.name ? { name: a.name } : {}), width: a.canvas.width, height: a.canvas.height }));
      return seenReply(deps.presence, { artboards, ...viewData, ...legend }, await captureArtboards(shots), { kind: "artboards" });
    }
    const artboard = target ? artboardById(doc, target) : currentArtboard(store, ui);
    if (!artboard) return screenRefusal("artboard_not_found", `a prancheta ${target} não existe; leia o projeto com studio_read`);
    commands.ensureVisible(artboard.id);
    if (region) {
      const zoomed = imageRegionTarget(doc, artboard.id, region, ui.getState().viewport);
      deps.presence.point(zoomed?.point ?? null, deps.label("look"), zoomed?.outline ?? null);
    } else point({ kind: "artboard", artboardId: artboard.id }, "look");
    const targets = outlined ? imageMarkTargets(artboard) : [];
    const legend = numbered ? { marks: targets.map(({ n, id, kind }) => ({ n, id, kind })) } : {};
    const guides = view === "guides" ? { guides: guideReport(targets, artboard.canvas) } : {};
    const zoom = region ? { ...(focusId ? { focus_id: focusId } : {}), region: asked } : {};
    const surface = resolvedSurface(doc, artboard);
    const refused = await lutRefusal([surface]);
    if (refused) return refused;
    const reports = lookReports(view, perceivedSurface(doc, artboard), measureText);
    const image = await captureArtboard(surface, { view, targets, numbered, shapes: reports.shapes }, region);
    const legibility = view === "wireframe" ? [] : await measuredLegibility(surface);
    const read = legibility.length > 0 ? { legibility } : {};
    return seenReply(deps.presence, { artboard_id: artboard.id, width: artboard.canvas.width, height: artboard.canvas.height, ...viewData, ...zoom, ...legend, ...guides, ...reports.data, ...read }, image, artboardTarget(doc.artboards, artboard));
  }

  async function look(args: unknown): Promise<ScreenReply> {
    const mediaId = stringArg(args, "media_id");
    try {
      if (!mediaId) return await lookAt(args);
      point({ kind: "canvas" }, "look");
      const media = await withTimeout(getMediaAction(mediaId));
      if (!media || clipTypeForMedia(media.type) !== "image") return screenRefusal("not_image", "no editor de imagem só dá para ver imagens da biblioteca");
      return seenReply(deps.presence, { media_id: mediaId }, await captureLibraryImage(mediaId), { kind: "media" });
    } finally {
      deps.presence.rest();
    }
  }

  function pictureOf(layerId: string | undefined): ImageAiTarget | null {
    const artboard = layerId ? artboardOfLayer(store.getState().document, layerId) : undefined;
    const layer = artboard?.layers.find((candidate) => candidate.id === layerId);
    return artboard && layer ? imageAiTarget(artboard, [layer], ui.getState().jobs, true) : null;
  }

  function resolveSource(args: unknown): ScreenReply {
    const layerId = stringArg(args, "layerId");
    const kind = stringArg(args, "kind");
    const target = pictureOf(layerId);
    const action = kind && Object.hasOwn(SOURCE_ACTIONS, kind) ? SOURCE_ACTIONS[kind] : undefined;
    const state = target?.source ? aiActionsFor(target.subject).find((candidate) => candidate.definition.id === action) : undefined;
    if (!target?.source?.assetId || !state) return screenRefusal("wrong_source", WRONG_SOURCE);
    if (state.reason) return screenRefusal(state.reason, SOURCE_BLOCKS[state.reason]);
    point({ kind: "layer", layerId: layerId! }, `job_${kind}`);
    return screenOk({ sourceMediaId: target.source.assetId });
  }

  async function exportImage(args: unknown): Promise<ScreenReply> {
    const parsed = exportRequestOf((args ?? {}) as Record<string, unknown>);
    if (!parsed) return screenRefusal("invalid_export", "format vai em png, jpeg, pdf ou svg; scale (1 ou 2) e quality (0.5 a 1) só em png e jpeg; preset (digital ou print) só no pdf; artboards em active ou all");
    const doc = store.getState().document;
    const targets = resolvedArtboards(doc, parsed.scope === "all" ? doc.artboards : [currentArtboard(store, ui)]);
    point({ kind: "canvas" }, "export");
    try {
      const raster = await loadRaster();
      let rendered: RenderedArtboard[];
      try {
        rendered = await renderExport(raster, targets, parsed.request, (artboard) => deps.exportTitle(artboard.id), deps.projectName);
      } catch (failure) {
        if (failure instanceof LutBlockedError) return screenRefusal(LUT_REFUSAL_CODE, lutRefusalReason(failure.use));
        return screenRefusal("export_failed", EXPORT_FAILURES[exportFailure(failure, raster).key]);
      }
      const result = await saveRendered(raster, rendered, deps.projectId);
      if (!result.ok) return screenRefusal("upload_failed", `o arquivo não foi salvo na biblioteca: ${result.reason}`);
      const saved = result.saved.map((media) => ({ media_id: media.mediaId, url: media.mediaUrl, ...(media.artboardIds.length > 1 ? { artboard_ids: media.artboardIds } : { artboard_id: media.artboardId }) }));
      return screenOk(isRasterFormat(parsed.request.format) ? { saved } : { saved, raster_layers: rasterizedLayers(targets, parsed.request.transparent) });
    } finally {
      deps.presence.rest();
    }
  }

  function followJob(args: unknown): ScreenReply {
    const follow = parseFollow(args, JOB_PURPOSES);
    if (!follow) return screenRefusal("invalid_job", "o trabalho não pôde ser acompanhado");
    if (follow.purpose === "image" && !follow.layerId) {
      commands.followJob("generate", follow.job, null);
    } else {
      const source = pictureOf(follow.layerId)?.source;
      if (!source) return screenRefusal("layer_not_found", "o elemento não existe mais ou não mostra uma única imagem");
      commands.followJob(follow.purpose === "cutout" ? "cutout" : "edit", follow.job, source.layerId, source.slot);
    }
    point(follow.layerId ? { kind: "layer", layerId: follow.layerId } : { kind: "canvas" }, `job_${follow.purpose}`);
    deps.presence.rest();
    return screenOk({ following: true });
  }

  return async (command: ScreenCommand): Promise<ScreenReply> => {
    switch (command.name) {
      case "read":
        return read(command.args);
      case "edit":
        return edit(command);
      case "look":
        return look(command.args);
      case "resolve_source":
        return resolveSource(command.args);
      case "follow_job":
        return followJob(command.args);
      case "export":
        return exportImage(command.args);
      case "listen":
        return screenRefusal("not_video", "o som só existe em projetos de vídeo");
      case "save_preset":
        return screenRefusal("not_video", "predefinições de animação só existem em projetos de vídeo");
      case "create_project":
        return screenRefusal("not_editor", "o editor não cria projetos; quem cria é a aba da conversa");
    }
  };
}

export function createImageReveal({ store, commands }: Pick<ImageAgentDeps, "store" | "commands">): ScreenReveal {
  return (target) => {
    if (target.kind !== "artboard" || !artboardById(store.getState().document, target.artboardId)) return;
    commands.selectArtboard(target.artboardId, false);
    commands.focusArtboard(target.artboardId);
    commands.ensureVisible(target.artboardId);
  };
}
