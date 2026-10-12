import { newImageLayer, newMediaClip, newStudioId, type CanvasSize, type Clip, type ImageSurface, type StudioGroup, type VideoDocument } from "../document";
import { onScreenFloor, placeStack } from "../edits";
import { closestAspect, squareTransform } from "../geometry";
import { pasteLayers } from "../layers";
import { DEFAULT_OVERLAY_MS, overlayClip } from "../media-clips";
import { placeClips as placeOnTracks } from "../timeline";
import { importedMedia } from "./asset-import";
import { supports } from "./catalog";
import { frameSlotLayer } from "./frame-shapes";
import { FULL_AREA, gridLayers, type GridArea } from "./grid-layout";
import { LIBRARY_INK, type LibraryContext, type LibraryEditor, type LibraryItem, type LibraryLayers, type LibrarySlot } from "./model";
import { placeClips, placeLayers, recolorLayer, type ColorChange, type LibraryBox } from "./placement";
import { mockupLayers } from "./mockup";
import { lastFrameMs, stickerStill } from "./sticker-still";

export const FRAME_SHARE = 0.5;

export const ASSET_SHARE = 0.3;

export interface LibraryRequest {
  canvas: CanvasSize;
  locale: string;
  text: (slot: LibrarySlot) => string;
  box?: LibraryBox;
  colors?: readonly ColorChange[];
  name?: string;
}

export interface LibraryClipRequest extends LibraryRequest {
  atMs: number;
  documentMs: number;
  durationMs?: number;
}

export type Placed<T> = { document: T; ids: string[] };

function contextOf(editor: LibraryEditor, request: LibraryRequest): LibraryContext {
  return { editor, canvas: request.canvas, ink: LIBRARY_INK[editor], locale: request.locale, text: request.text };
}

export function assetsReady(item: LibraryItem): boolean {
  return item.assets?.loaded() ?? true;
}

export function readyItem(item: LibraryItem): Promise<boolean> {
  if (!item.assets || item.assets.loaded()) return Promise.resolve(true);
  return item.assets.load().then(
    () => assetsReady(item),
    () => false,
  );
}

export function slotsOf(item: LibraryItem): readonly LibrarySlot[] {
  return item.template.slots ?? [];
}

function ratioTransform(canvas: CanvasSize, ratio: number, share: number) {
  return ratio >= 1 ? squareTransform(canvas, share, share / ratio) : squareTransform(canvas, share * ratio, share);
}

function gridArea(box: LibraryBox | undefined): GridArea | null {
  const w = box?.w ?? box?.h;
  const h = box?.h ?? box?.w;
  return w === undefined || h === undefined ? null : { x: box?.x ?? 0.5, y: box?.y ?? 0.5, w, h };
}

function named(groups: readonly StudioGroup[], name: string | undefined): StudioGroup[] {
  return groups.map((group) => (name && !group.parentId && !group.name ? { ...group, name } : group));
}

function imageBuilt(item: LibraryItem, request: LibraryRequest): { built: LibraryLayers; placed: boolean } | null {
  const template = item.template;
  switch (template.kind) {
    case "layers":
      return { built: template.build(contextOf("image", request)), placed: false };
    case "frame":
      return { built: { layers: [frameSlotLayer(template.shape, ratioTransform(request.canvas, item.ratio, FRAME_SHARE))] }, placed: false };
    case "grid":
      return { built: gridLayers(template.root, request.canvas, gridArea(request.box) ?? FULL_AREA), placed: true };
    case "sticker": {
      const clips = linked(template.build({ ...contextOf("image", request), atMs: 0, documentMs: template.durationMs, durationMs: template.durationMs }));
      const still = stickerStill(clips, closestAspect(request.canvas.width, request.canvas.height), lastFrameMs(template.durationMs));
      return still ? { built: { layers: still }, placed: false } : null;
    }
    case "mockup":
      return { built: mockupLayers(template.design, request.canvas), placed: false };
    case "asset": {
      const mediaId = importedMedia(item.id);
      return mediaId ? { built: { layers: [newImageLayer(mediaId, ratioTransform(request.canvas, item.ratio, ASSET_SHARE))] }, placed: false } : null;
    }
    case "clips":
      return null;
  }
}

export function imageContent(item: LibraryItem, request: LibraryRequest): LibraryLayers | null {
  const made = supports(item, "image") && assetsReady(item) ? imageBuilt(item, request) : null;
  if (!made) return null;
  const { built } = made;
  const colors = request.colors ?? [];
  const recolored = built.layers.map((layer) => recolorLayer(layer, colors));
  const layers = made.placed ? recolored : placeLayers(recolored, request.canvas, request.box ?? {});
  if (built.groups && built.groups.length > 0) return { layers, groups: named(built.groups, request.name) };
  if (layers.length < 2) return { layers };
  const group = { id: newStudioId("g"), ...(request.name ? { name: request.name } : {}) };
  return { layers: layers.map((layer) => ({ ...layer, groupId: group.id })), groups: [group] };
}

function linked(clips: Clip[]): Clip[] {
  if (clips.length < 2) return clips;
  const linkId = newStudioId("k");
  return clips.map((clip) => ({ ...clip, linkId }));
}

function builtClips(item: LibraryItem, request: LibraryClipRequest): Clip[] | null {
  const context = { ...contextOf("video", request), atMs: request.atMs, documentMs: request.documentMs };
  const template = item.template;
  switch (template.kind) {
    case "clips":
      return template.build(context);
    case "sticker":
      return linked(template.build({ ...context, durationMs: Math.round(request.durationMs ?? template.durationMs) }));
    case "layers":
      return linked(template.build(context).layers.map((layer) => overlayClip(layer, request.atMs)));
    case "asset": {
      const mediaId = importedMedia(item.id);
      return mediaId ? [{ ...newMediaClip("image", mediaId, request.atMs, DEFAULT_OVERLAY_MS), fit: "contain", transform: ratioTransform(request.canvas, item.ratio, ASSET_SHARE) }] : null;
    }
    case "frame":
    case "grid":
    case "mockup":
      return null;
  }
}

export function videoClips(item: LibraryItem, request: LibraryClipRequest): Clip[] | null {
  const built = supports(item, "video") && assetsReady(item) ? builtClips(item, request) : null;
  if (!built) return null;
  const colors = request.colors ?? [];
  const clips = built.map((clip) => (clip.layer ? { ...clip, layer: recolorLayer(clip.layer, colors) } : clip));
  return placeClips(clips, request.canvas, request.box ?? {});
}

export function insertImageContent(surface: ImageSurface, content: LibraryLayers): Placed<ImageSurface> {
  return pasteLayers(surface, content.layers, 0, content.groups ?? []);
}

export function insertVideoClips(doc: VideoDocument, clips: readonly Clip[], trackId?: string): Placed<VideoDocument> | null {
  if (clips.length === 0) return null;
  if (clips.length === 1) return placeOnTracks(doc, clips, trackId);
  const index = trackId ? doc.tracks.findIndex((track) => track.id === trackId) : -1;
  const floor = index >= 0 ? index - 1 : onScreenFloor(doc, clips[0].startMs, clips[0].durationMs);
  return placeStack(doc, clips, floor);
}
