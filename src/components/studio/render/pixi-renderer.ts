"use client";

import "pixi.js/advanced-blend-modes";

import {
  AlphaFilter,
  autoDetectRenderer,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  extensions,
  Graphics,
  ImageSource,
  NineSliceSprite,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
  VideoSource,
  type BLEND_MODES,
  type Filter,
  type Renderer as PixiRenderer,
} from "pixi.js";

import type { LutAtlas } from "@/lib/studio/cube-lut";
import { fitRect } from "@/lib/studio/fit";
import { haloRatio, rasterRatio, type Camera, type Renderer, type RenderSources, type VideoPicture, type Viewport } from "@/lib/studio/render/renderer";
import { gestureSplit } from "@/lib/studio/render/gesture-split";
import { outsideView } from "@/lib/studio/render/visibility";
import { SettledScale } from "@/lib/studio/render/settled-scale";
import type { GlyphNode, GlyphsSource, GroupSource, LineNode, MixPart, PixelsSource, RasterSource, Scene, SceneNode, VideoSource as SceneVideoSource } from "@/lib/studio/scene/scene";
import { centerPieces, composeGlyphs, unitPieces, type GlyphSheet, type TilePiece } from "@/lib/studio/glyph-layout";
import { matteGroups, type MatteGroup } from "@/lib/studio/scene/matte-runs";
import { pieceWeights, type PaintPlan } from "@/lib/studio/scene/paint-mix";
import { flowsInLines, SETTLED_LOOK, textUnitFrames, type LaidLine, type Tile, type UnitFrame } from "@/lib/studio/text-animation";

import { Alarm } from "./alarm";
import { BoardCache } from "./board-cache";
import { ChromaFilter } from "./chroma-filter";
import { ClipMask } from "./clip-mask";
import { EffectLayers } from "./effect-layers";
import { fillGradient } from "./fill-gradient";
import { groupCamera, GroupTargets } from "./group-targets";
import { ColorChain, type LutState } from "./color-chain";
import { MixedFrames } from "./frame-mix";
import { HueBlend } from "./hue-blend";
import { LineComposite } from "./line-composite";
import { LumaFilter } from "./luma-filter";
import { MatteFilter } from "./matte-filter";
import { VfxStack } from "./vfx-filter";
import { PixelMask } from "./pixel-mask-filter";
import { RevealFieldMask } from "./reveal-filter";
import { MotionTrailBlur, trailDrawable } from "./trail-filter";
import { ClipTiltWarp } from "./tilt-filter";
import { affineOf, applyAffine, invertAffine, pieceQuad, pieceTilted, type Quad } from "@/lib/studio/perspective";
import { PieceMeshes } from "./piece-meshes";
import { MediaHalo } from "./halo-filter";
import { haloSourceKey, type HaloNode, type SourceSize } from "@/lib/studio/media-halo";
import { WindowedFrames } from "./frame-window";

extensions.add(HueBlend);

const TEXTURE_BUDGET_BYTES = 256 * 1024 * 1024;
const STALE_FRAMES = 90;
const NEXT_FRAME = "#next";
const FRAME_EPSILON = 0.5;
const CHECKER_CELL = 8;
const ARTBOARD_SHADOW_BLUR = 16;
const ARTBOARD_SHADOW_ALPHA = 0.12;
const ARTBOARD_SHADOW_OFFSET = 2;
const ARTBOARD_SHADOW_REACH = Math.ceil((ARTBOARD_SHADOW_BLUR / 2) * 3);
const ARTBOARD_SHADOW_CORE = 4;
const MIN_CAMERA_SCALE = 0.01;
const ANTIALIAS = true;
const GESTURE_REST_MS = 200;

interface CachedTexture {
  texture: Texture;
  bytes: number;
  lastUsed: number;
  release?: () => void;
}

interface PendingLoad {
  controller: AbortController;
  wantedAt: number;
}

interface LaneLoad {
  key: string;
  controller: AbortController;
}

interface Lane<T> {
  shown: { key: string; value: T } | null;
  pending: LaneLoad | null;
  wanted: string;
  failed: string | null;
  lastUsed: number;
  release: (value: T) => void;
}

interface SheetPicture {
  texture: Texture;
  sheet: GlyphSheet;
}

interface VideoTexture {
  texture: Texture;
  picture: VideoPicture;
  lastUsed: number;
}

interface PixelsTexture {
  texture: Texture;
  canvas: HTMLCanvasElement;
  version: number;
  lastUsed: number;
}

interface PiecesView {
  container: Container;
  sprites: Sprite[];
  frames: (Texture | null)[];
  blurs: (BlurFilter | null)[];
  meshes: PieceMeshes;
  isolation: AlphaFilter;
}

interface NodeView {
  sprite: Sprite;
  framed: Texture | null;
  chroma: ChromaFilter | null;
  luma: LumaFilter | null;
  matrix: ColorMatrixFilter | null;
  color: ColorChain | null;
  pieces: PiecesView | null;
  mask: Graphics | null;
  clip: ClipMask | null;
  vfx: VfxStack | null;
  line: LineComposite | null;
  pixelMask: PixelMask | null;
  maskInverse: boolean;
  reveal: RevealFieldMask | null;
  trail: MotionTrailBlur | null;
  tilt: ClipTiltWarp | null;
  halo: MediaHalo | null;
}

interface RunGroup {
  container: Container;
  filter: MatteFilter;
  used: number;
}

interface RunView {
  container: Container;
  frame: Sprite;
  opacity: number;
  groups: Map<number, RunGroup>;
}

interface BoardView {
  root: Container;
  artboard: Artboard;
  content: Container;
  cache: BoardCache;
}

interface FrameSeen {
  camera: string;
  generation: number;
  settled: boolean;
}

const SINGLE_SCENE = "scene";

function sameFrame(texture: Texture | null, frame: Rectangle, source: Texture): boolean {
  if (!texture || texture.source !== source.source) return false;
  const f = texture.frame;
  return Math.abs(f.x - frame.x) < FRAME_EPSILON && Math.abs(f.y - frame.y) < FRAME_EPSILON && Math.abs(f.width - frame.width) < FRAME_EPSILON && Math.abs(f.height - frame.height) < FRAME_EPSILON;
}

function sourceSize(image: CanvasImageSource): { width: number; height: number } {
  if (image instanceof HTMLVideoElement) return { width: image.videoWidth, height: image.videoHeight };
  if (image instanceof HTMLImageElement) return { width: image.naturalWidth, height: image.naturalHeight };
  const sized = image as { width: number; height: number };
  return { width: sized.width, height: sized.height };
}

function reusable(held: VideoPicture, next: VideoPicture): boolean {
  return held instanceof HTMLVideoElement ? held === next : !(next instanceof HTMLVideoElement);
}

function sameMatrix(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) < 1e-6);
}

function checkerTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = CHECKER_CELL * 2;
  canvas.height = CHECKER_CELL * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, CHECKER_CELL, CHECKER_CELL);
  ctx.fillRect(CHECKER_CELL, CHECKER_CELL, CHECKER_CELL, CHECKER_CELL);
  return Texture.from(canvas);
}

function shadowTexture(): Texture {
  const border = ARTBOARD_SHADOW_REACH * 2;
  const side = border * 2 + ARTBOARD_SHADOW_CORE;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const ctx = canvas.getContext("2d")!;
  ctx.shadowColor = "#000000";
  ctx.shadowBlur = ARTBOARD_SHADOW_BLUR;
  ctx.shadowOffsetX = side;
  ctx.fillRect(ARTBOARD_SHADOW_REACH - side, ARTBOARD_SHADOW_REACH, side - ARTBOARD_SHADOW_REACH * 2, side - ARTBOARD_SHADOW_REACH * 2);
  return Texture.from(canvas);
}

class Artboard {
  readonly root = new Container();
  private readonly shadow = new Graphics();
  private readonly halo: NineSliceSprite;
  private readonly fill = new Graphics();
  private readonly checker: TilingSprite;
  readonly clip = new Graphics();
  seeThrough = false;
  private key = "";
  private haloKey = "";

  constructor(shadow: Texture) {
    this.shadow.filters = [new BlurFilter({ strength: ARTBOARD_SHADOW_BLUR })];
    const border = ARTBOARD_SHADOW_REACH * 2;
    this.halo = new NineSliceSprite({ texture: shadow, leftWidth: border, topHeight: border, rightWidth: border, bottomHeight: border });
    this.halo.alpha = ARTBOARD_SHADOW_ALPHA;
    this.checker = new TilingSprite({ texture: checkerTexture(), width: 1, height: 1 });
    this.root.addChild(this.shadow, this.halo, this.fill, this.checker, this.clip);
  }

  private placeHalo(scene: Scene, scale: number): void {
    const key = `${scene.width}x${scene.height}@${scale}`;
    if (key === this.haloKey) return;
    this.haloKey = key;
    this.halo.scale.set(1 / scale);
    this.halo.position.set(-ARTBOARD_SHADOW_REACH / scale, ARTBOARD_SHADOW_OFFSET - ARTBOARD_SHADOW_REACH / scale);
    this.halo.setSize(scene.width * scale + ARTBOARD_SHADOW_REACH * 2, scene.height * scale + ARTBOARD_SHADOW_REACH * 2);
  }

  update(scene: Scene, camera: Camera): void {
    this.root.visible = Boolean(scene.artboard);
    if (!scene.artboard) return;
    const adjusted = scene.nodes.some((node) => node.source.kind === "effect");
    const transparent = !adjusted && !scene.background && !scene.gradient;
    const seeThrough = adjusted || Boolean(scene.gradient);
    this.seeThrough = seeThrough;
    const scale = Math.max(camera.scale, MIN_CAMERA_SCALE);
    this.shadow.visible = seeThrough;
    this.halo.visible = !seeThrough;
    if (!seeThrough) this.placeHalo(scene, scale);
    this.checker.visible = transparent;
    this.checker.setSize(scene.width, scene.height);
    this.checker.tileScale.set(1 / scale);
    const key = `${scene.width}x${scene.height}|${scene.background}|${JSON.stringify(scene.gradient ?? null)}|${adjusted}`;
    if (key === this.key) return;
    this.key = key;
    this.shadow.clear().rect(0, ARTBOARD_SHADOW_OFFSET, scene.width, scene.height).fill({ color: 0x000000, alpha: ARTBOARD_SHADOW_ALPHA });
    this.fill.clear().rect(0, 0, scene.width, scene.height);
    if (adjusted) this.fill.fill({ color: 0x000000, alpha: 0 });
    else if (scene.gradient) this.fill.fill(fillGradient(scene.gradient, scene.width, scene.height));
    else if (scene.background) this.fill.fill(scene.background);
    this.clip.clear().rect(0, 0, scene.width, scene.height).fill(0xffffff);
  }

  paint(shown: boolean): void {
    this.fill.renderable = shown;
    this.checker.renderable = shown;
  }

  showHalo(shown: boolean): void {
    this.halo.renderable = shown;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

class PixiSceneRenderer implements Renderer {
  readonly backend: string;
  private readonly world = new Container({ sortableChildren: true });
  private readonly boards = new Map<string, BoardView>();
  private readonly views = new Map<string, NodeView>();
  private readonly runs = new Map<string, RunView>();
  private matteGroups = new Map<string, MatteGroup>();
  private readonly textures = new Map<string, CachedTexture>();
  private readonly loading = new Map<string, PendingLoad>();
  private readonly failed = new Set<string>();
  private readonly layouts = new Map<string, { lines: LaidLine[]; lastUsed: number }>();
  private readonly sheets = new Map<string, GlyphSheet>();
  private readonly videos = new Map<string, VideoTexture>();
  private readonly pixels = new Map<string, PixelsTexture>();
  private readonly layers = new EffectLayers();
  private readonly groups = new GroupTargets();
  private readonly windows: WindowedFrames;
  private readonly mixes: MixedFrames;
  private readonly luts = new Map<string, { atlas: LutAtlas; lastUsed: number }>();
  private missing = new Set<string>();
  private readonly lanes = new Map<string, Lane<unknown>>();
  private shadowSource: Texture | null = null;
  private frame = 0;
  private destroyed = false;
  private readonly detail = new SettledScale();
  private detailFactor = 1;
  private readonly wake = new Alarm(() => this.redraw());
  private readonly rest = new Alarm(() => this.redraw());
  private generation = 0;
  private cull: { origin: { x: number; y: number }; camera: Camera } | null = null;
  private readonly shownRasters = new Map<string, string[]>();
  private previousNodes = new Map<string, readonly SceneNode[]>();
  private seen: FrameSeen = { camera: "", generation: -1, settled: false };

  constructor(
    private readonly gpu: PixiRenderer,
    private viewport: Viewport,
    private readonly sources: RenderSources,
    private readonly invalidate: () => void,
    private readonly antialias: boolean,
  ) {
    this.backend = gpu.name;
    this.windows = new WindowedFrames(gpu);
    this.mixes = new MixedFrames(gpu);
  }

  get busy(): boolean {
    return this.loading.size > 0 || [...this.lanes.values()].some((lane) => lane.pending !== null || (lane.shown?.key !== lane.wanted && lane.failed !== lane.wanted));
  }

  get missingLuts(): ReadonlySet<string> {
    return this.missing;
  }

  resize(viewport: Viewport): void {
    this.viewport = viewport;
    this.gpu.resize(viewport.width, viewport.height, viewport.resolution);
  }

  render(scenes: readonly Scene[], camera: Camera): void {
    if (this.destroyed) return;
    this.frame += 1;
    this.missing = new Set();
    this.settleDetail(camera.scale);
    this.world.scale.set(camera.scale);
    this.world.position.set(camera.x, camera.y);
    const present = new Set<string>();
    const bases = new Set<string>();
    const shown = new Set<string>();
    scenes.forEach((scene, order) => {
      const key = scene.key ?? SINGLE_SCENE;
      shown.add(key);
      if (!scene.artboard) this.gpu.background.color = scene.background;
      const board = this.board(key, order);
      board.root.position.set(scene.origin?.x ?? 0, scene.origin?.y ?? 0);
      board.artboard.update(scene, camera);
      board.content.mask = scene.artboard ? board.artboard.clip : null;
      this.cull = scene.artboard ? { origin: scene.origin ?? { x: 0, y: 0 }, camera } : null;
      this.compose(scene, board.content, camera, present, bases);
      this.cull = null;
    });
    for (const [id, view] of this.views) if (!present.has(id)) this.drop(id, view);
    for (const [id, run] of this.runs) if (!bases.has(id) || !present.has(id)) this.dropRun(id, run);
    for (const run of this.runs.values()) this.pruneGroups(run);
    this.layers.prune(present);
    this.groups.prune(present);
    for (const [key, board] of this.boards) if (!shown.has(key)) this.dropBoard(key, board);
    this.dropUnwanted();
    this.evict();
    this.cacheStill(scenes, camera);
    this.gpu.render({ container: this.world });
  }

  private cacheStill(scenes: readonly Scene[], camera: Camera): void {
    const cameraKey = `${camera.scale}|${camera.x}|${camera.y}|${this.viewport.width}x${this.viewport.height}@${this.viewport.resolution}|${this.detailFactor}`;
    const steady = this.seen.settled && this.seen.camera === cameraKey && this.seen.generation === this.generation && !this.busy && this.missing.size === 0;
    const keys = scenes.map((scene) => scene.key ?? SINGLE_SCENE);
    const changed = scenes.map((scene, i) => {
      const previous = this.previousNodes.get(keys[i]);
      return !previous || previous.length !== scene.nodes.length || scene.nodes.some((node, n) => node !== previous[n]);
    });
    scenes.forEach((scene, order) => {
      const board = this.boards.get(keys[order]);
      if (!board) return;
      const othersChanged = changed.some((moved, i) => moved && i !== order);
      const split = steady && scene.artboard && !board.artboard.seeThrough ? gestureSplit(scene.nodes, this.previousNodes.get(keys[order]) ?? [], othersChanged) : null;
      const origin = scene.origin ?? { x: 0, y: 0 };
      const layers = split || board.cache.active ? scene.nodes.flatMap((node, index) => {
        const object = this.topOf(node.id, board.content);
        return object ? [{ object, index }] : [];
      }) : [];
      const view = { root: board.root, content: board.content, layers, origin, size: { width: scene.width, height: scene.height }, paint: (shown: boolean) => board.artboard.paint(shown), halo: (shown: boolean) => board.artboard.showHalo(shown) };
      const surface = `${scene.width}x${scene.height}|${scene.background}|${JSON.stringify(scene.gradient ?? null)}`;
      board.cache.apply(view, split, scene.nodes.length, `${cameraKey}|${this.generation}|${origin.x},${origin.y}|${surface}`, camera, this.viewport);
    });
    this.rest.set([...this.boards.values()].some((board) => board.cache.active) ? GESTURE_REST_MS : null);
    this.previousNodes = new Map(scenes.map((scene, i) => [keys[i], scene.nodes]));
    this.seen = { camera: cameraKey, generation: this.generation, settled: !this.busy && this.missing.size === 0 };
  }

  private topOf(id: string, content: Container): Container | null {
    const view = this.views.get(id);
    let object: Container | null = view ? (view.pieces?.container ?? view.sprite) : null;
    while (object && object.parent !== content) object = object.parent;
    return object;
  }

  private settleDetail(scale: number): void {
    const reading = this.detail.at(scale, performance.now());
    this.detailFactor = scale > 0 ? reading.scale / scale : 1;
    this.wake.set(reading.wakeInMs);
  }

  private readonly redraw = (): void => {
    if (!this.destroyed) this.invalidate();
  };

  private rasterScale(camera: Camera): number {
    return camera.scale * this.detailFactor;
  }

  private compose(scene: Scene, content: Container, camera: Camera, present: Set<string>, bases: Set<string>): void {
    const sceneBases = new Set(scene.nodes.flatMap((node) => (node.clipOf ? [node.clipOf] : [])));
    for (const base of sceneBases) bases.add(base);
    const homes = this.layers.arrange(scene, content, { camera, resolution: this.viewport.resolution, luts: this.lutState });
    const outer = this.matteGroups;
    this.matteGroups = matteGroups(scene.nodes);
    scene.nodes.forEach((node, index) => {
      present.add(node.id);
      if (node.source.kind === "group") this.composeGroup(node, node.source, camera, present, bases);
      if (node.source.kind !== "effect") this.draw(node, index, camera, sceneBases, homes[index]);
    });
    this.matteGroups = outer;
  }

  private composeGroup(node: SceneNode, source: GroupSource, camera: Camera, present: Set<string>, bases: Set<string>): void {
    const inner = groupCamera(node, source.scene, camera, this.viewport.resolution);
    this.compose(source.scene, this.groups.container(node.id, inner.scale), inner, present, bases);
    this.groups.draw(this.gpu, node.id, source.scene, inner.scale, this.viewport.resolution);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.wake.set(null);
    this.rest.set(null);
    for (const pending of this.loading.values()) pending.controller.abort();
    for (const id of [...this.lanes.keys()]) this.dropLane(id);
    this.loading.clear();
    for (const [id, view] of this.views) this.drop(id, view);
    for (const [id, run] of this.runs) this.dropRun(id, run);
    this.layers.destroy();
    this.groups.destroy();
    this.windows.destroy();
    this.mixes.destroy();
    for (const cached of [...this.textures.values(), ...this.videos.values(), ...this.pixels.values()]) cached.texture.destroy(true);
    for (const cached of this.textures.values()) cached.release?.();
    this.textures.clear();
    this.videos.clear();
    for (const [key, board] of this.boards) this.dropBoard(key, board);
    this.shadowSource?.destroy(true);
    this.world.destroy({ children: true });
    this.gpu.destroy({ removeView: false });
  }

  private board(key: string, order: number): BoardView {
    const existing = this.boards.get(key);
    if (existing) {
      existing.root.zIndex = order;
      return existing;
    }
    const root = new Container();
    const artboard = new Artboard((this.shadowSource ??= shadowTexture()));
    const content = new Container({ sortableChildren: true });
    root.addChild(artboard.root, content);
    root.zIndex = order;
    this.world.addChild(root);
    const created = { root, artboard, content, cache: new BoardCache(this.gpu, this.antialias) };
    this.boards.set(key, created);
    return created;
  }

  private dropBoard(key: string, board: BoardView): void {
    board.cache.destroy();
    board.content.mask = null;
    board.artboard.destroy();
    board.root.destroy({ children: false });
    this.boards.delete(key);
  }

  private view(id: string): NodeView {
    const existing = this.views.get(id);
    if (existing) return existing;
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    const created: NodeView = { sprite, framed: null, chroma: null, luma: null, matrix: null, color: null, pieces: null, mask: null, clip: null, vfx: null, line: null, pixelMask: null, maskInverse: false, reveal: null, trail: null, tilt: null, halo: null };
    this.views.set(id, created);
    return created;
  }

  private run(baseId: string): RunView {
    const existing = this.runs.get(baseId);
    if (existing) return existing;
    const container = new Container({ sortableChildren: true });
    const frame = new Sprite(Texture.EMPTY);
    frame.anchor.set(0.5);
    frame.renderable = false;
    container.addChild(frame);
    const created: RunView = { container, frame, opacity: 1, groups: new Map() };
    this.runs.set(baseId, created);
    return created;
  }

  private runGroup(group: MatteGroup): Container {
    const run = this.run(group.base);
    let held = run.groups.get(group.order);
    if (!held) {
      held = { container: new Container({ sortableChildren: true }), filter: new MatteFilter(run.frame), used: this.frame };
      held.container.zIndex = 1 + group.order;
      held.container.filters = [held.filter];
      run.groups.set(group.order, held);
    }
    held.used = this.frame;
    held.filter.set(group.matte, run.opacity);
    const home = run.frame.parent;
    if (home && held.container.parent !== home) home.addChild(held.container);
    return held.container;
  }

  private dropGroup(group: RunGroup, home: Container | null): void {
    for (const child of [...group.container.children]) home?.addChild(child);
    group.container.filters = null;
    group.filter.destroy();
    group.container.destroy();
  }

  private pruneGroups(run: RunView): void {
    for (const [order, group] of run.groups) {
      if (group.used === this.frame) continue;
      this.dropGroup(group, run.frame.parent);
      run.groups.delete(order);
    }
  }

  private drop(id: string, view: NodeView): void {
    this.shownRasters.delete(id);
    this.dropPieces(view);
    view.mask?.destroy();
    view.framed?.destroy(false);
    view.sprite.destroy();
    view.clip?.destroy();
    view.vfx?.destroy();
    view.line?.destroy();
    view.pixelMask?.destroy();
    view.reveal?.destroy();
    view.trail?.destroy();
    view.tilt?.destroy();
    view.color?.destroy();
    view.halo?.destroy();
    this.views.delete(id);
  }

  private dropPieces(view: NodeView): void {
    if (!view.pieces) return;
    for (const frame of view.pieces.frames) frame?.destroy(false);
    view.pieces.container.destroy({ children: true });
    view.pieces = null;
  }

  private dropRun(id: string, run: RunView): void {
    const home = run.container.parent;
    for (const group of run.groups.values()) this.dropGroup(group, home);
    run.frame.destroy();
    for (const child of [...run.container.children]) home?.addChild(child);
    run.container.destroy();
    this.runs.delete(id);
  }

  private parentOf(node: SceneNode, index: number, bases: ReadonlySet<string>, content: Container): Container {
    const group = node.clipOf ? this.matteGroups.get(node.id) : undefined;
    if (group) return this.runGroup(group);
    if (!bases.has(node.id)) return content;
    const run = this.run(node.id);
    run.container.zIndex = index;
    run.container.blendMode = (node.blend ?? "normal") as BLEND_MODES;
    if (run.container.parent !== content) content.addChild(run.container);
    return run.container;
  }

  private draw(node: SceneNode, index: number, camera: Camera, bases: ReadonlySet<string>, content: Container): void {
    const view = this.view(node.id);
    const sprite = view.sprite;
    const isBase = bases.has(node.id);
    const parent = this.parentOf(node, index, bases, content);
    const home = this.clipHome(view, node, parent, isBase ? 0 : index, isBase, camera);
    if (view.clip) this.applyFilters(view.clip.holder, [...this.haloFilters(view, node, camera, view.clip.holder), ...this.trailFilters(view, node, camera, view.clip.holder), ...this.tiltFilters(view, node, camera, view.clip.holder)]);
    const blend = (isBase || home !== parent ? "normal" : (node.blend ?? "normal")) as BLEND_MODES;
    if (sprite.parent !== home) home.addChild(sprite);
    if (isBase) this.seatRun(this.run(node.id), home);
    if (node.glyphs) {
      sprite.mask = null;
      this.drawGlyphs(view, node, node.glyphs, index, camera, home, blend);
      this.applyMask(view, view.pieces!.container, node, home);
      return;
    }
    if ((node.mix || node.text) && !node.line && node.source.kind === "raster" && !isBase) {
      sprite.mask = null;
      this.drawRasterPieces(view, node, node.source, index, camera, home, blend);
      this.applyMask(view, view.pieces!.container, node, home);
      return;
    }
    this.dropPieces(view);
    sprite.zIndex = isBase ? 0 : index;
    const texture = node.line ? this.lineTexture(view, node, node.line, camera) : this.textureOf(node, camera);
    if (texture) this.place(view, node, texture);
    else if (node.fit === "fill" && sprite.texture !== Texture.EMPTY) this.position(sprite, node, node.box.width, node.box.height);
    sprite.alpha = node.opacity;
    sprite.blendMode = blend;
    sprite.visible = node.visible && node.opacity > 0 && sprite.texture !== Texture.EMPTY;
    this.effects(view, node, camera);
    if (isBase) this.mirrorFrame(this.run(node.id), sprite, node.opacity);
    else this.applyMask(view, sprite, node, home);
  }

  private clipHome(view: NodeView, node: SceneNode, parent: Container, zIndex: number, isBase: boolean, camera: Camera): Container {
    if (!node.clipMasks?.length) {
      view.clip?.release(parent);
      view.clip = null;
      return parent;
    }
    const clip = (view.clip ??= new ClipMask());
    if (clip.holder.parent !== parent) parent.addChild(clip.holder);
    clip.holder.zIndex = zIndex;
    clip.holder.blendMode = (isBase ? "normal" : (node.blend ?? "normal")) as BLEND_MODES;
    clip.update(node.clipMasks, node.box, camera.scale * this.viewport.resolution);
    return clip.inner;
  }

  private seatRun(run: RunView, home: Container): void {
    if (run.frame.parent !== home) home.addChild(run.frame);
    for (const group of run.groups.values()) if (group.container.parent !== home) home.addChild(group.container);
  }

  private applyMask(view: NodeView, target: Container, node: SceneNode, parent: Container): void {
    const reveal = node.reveal;
    if (!reveal?.polygon) {
      if (!view.mask) return;
      target.mask = null;
      view.mask.destroy();
      view.mask = null;
      return;
    }
    const shape = (view.mask ??= new Graphics());
    if (shape.parent !== parent) parent.addChild(shape);
    shape.clear();
    if (reveal.polygon.length >= 6) shape.poly([...reveal.polygon]).fill(0xffffff);
    shape.pivot.set(reveal.box.width / 2, reveal.box.height / 2);
    shape.position.set(reveal.box.x, reveal.box.y);
    shape.angle = reveal.box.rotation;
    if (target.mask === shape && view.maskInverse === reveal.inverse) return;
    target.setMask({ mask: shape, inverse: reveal.inverse });
    view.maskInverse = reveal.inverse;
  }

  private mirrorFrame(run: RunView, base: Sprite, opacity: number): void {
    const frame = run.frame;
    run.opacity = opacity;
    frame.texture = base.texture;
    frame.position.copyFrom(base.position);
    frame.angle = base.angle;
    frame.scale.copyFrom(base.scale);
  }

  private drawRasterPieces(view: NodeView, node: SceneNode, source: RasterSource, index: number, camera: Camera, parent: Container, blend: BLEND_MODES): void {
    const parts: readonly MixPart[] = node.mix ?? [{ source, weight: 1 }];
    const ratio = rasterRatio(node, this.rasterScale(camera), this.viewport.resolution);
    const layers = parts.map((part, index) => ({ texture: this.rasterTexture(node, part.source, index, ratio), weight: part.weight }));
    const space = { width: source.widthPx, height: source.heightPx };
    this.drawPieces(view, node, layers, unitPieces(this.unitFrames(node, source) ?? [], space.width, space.height), space, space, index, camera, parent, blend, node.textPaint);
  }

  private drawGlyphs(view: NodeView, node: SceneNode, glyphs: GlyphNode, index: number, camera: Camera, parent: Container, blend: BLEND_MODES): void {
    const ratio = rasterRatio(node, this.rasterScale(camera), this.viewport.resolution);
    const sheets = glyphs.parts.map((part, index) => (node.live ? this.liveSheet(node, part.source, index, ratio) : this.glyphSheet(part.source, ratio)));
    const sheet = sheets.find((loaded) => loaded !== null)?.sheet;
    const pieces = sheet ? centerPieces(composeGlyphs(glyphs.run, sheet), glyphs.frame.width, glyphs.frame.height) : [];
    const layers = glyphs.parts.map((part, i) => ({ texture: sheets[i]?.texture ?? null, weight: part.weight }));
    this.drawPieces(view, node, layers, pieces, sheet ?? glyphs.frame, glyphs.frame, index, camera, parent, blend, glyphs.plan);
  }

  private liveSheet(node: SceneNode, source: GlyphsSource, part: number, ratio: number): SheetPicture | null {
    const load = (signal: AbortSignal) =>
      this.sources.glyphs(source, ratio, signal).then((picture) => (picture ? { texture: Texture.from(picture.image as HTMLCanvasElement), sheet: picture.sheet } : null));
    return this.latest<SheetPicture>(`${node.id}#glyphs${part}`, `glyphs:${source.key}@${ratio}`, load, (picture) => picture.texture.destroy(true));
  }

  private rasterTexture(node: SceneNode, source: RasterSource, part: number, ratio: number): Texture | null {
    const key = `raster:${source.key}@${ratio}`;
    const load = (signal: AbortSignal) => this.sources.raster(source, ratio, signal);
    if (!node.live) return this.visibleRaster(node, part, key, load);
    return this.latest<Texture>(`${node.id}#raster${part}`, key, (signal) => load(signal).then((image) => (image ? Texture.from(image as HTMLCanvasElement) : null)), (texture) => texture.destroy(true));
  }

  private visibleRaster(node: SceneNode, part: number, key: string, load: (signal: AbortSignal) => Promise<CanvasImageSource | null>): Texture | null {
    const shown = this.shownRasters.get(node.id) ?? [];
    const held = shown[part];
    const kept = held && held !== key && !this.textures.has(key) ? this.textures.get(held) : undefined;
    if (kept && this.cull && outsideView(node.box, this.cull.origin, this.cull.camera, this.viewport)) {
      kept.lastUsed = this.frame;
      return kept.texture;
    }
    const texture = this.cached(key, load);
    if (texture && held !== key) {
      const next = [...shown];
      next[part] = key;
      this.shownRasters.set(node.id, next);
    }
    return texture;
  }

  private latest<T>(id: string, key: string, load: (signal: AbortSignal) => Promise<T | null>, release: (value: T) => void): T | null {
    const known = this.lanes.get(id) as Lane<T> | undefined;
    const lane: Lane<T> = known ?? { shown: null, pending: null, wanted: key, failed: null, lastUsed: this.frame, release };
    if (!known) this.lanes.set(id, lane as Lane<unknown>);
    lane.wanted = key;
    lane.lastUsed = this.frame;
    if (lane.shown?.key !== key && !lane.pending && lane.failed !== key) {
      const pending: LaneLoad = { key, controller: new AbortController() };
      lane.pending = pending;
      void load(pending.controller.signal).then(
        (value) => this.settleLane(lane, pending, value),
        () => this.settleLane(lane, pending, null),
      );
    }
    return lane.shown?.value ?? null;
  }

  private settleLane<T>(lane: Lane<T>, pending: LaneLoad, value: T | null): void {
    if (lane.pending !== pending) {
      if (value !== null) lane.release(value);
      return;
    }
    lane.pending = null;
    if (value === null) lane.failed = pending.key;
    else {
      if (lane.shown) lane.release(lane.shown.value);
      lane.shown = { key: pending.key, value };
      this.generation += 1;
    }
    if (!this.destroyed) this.invalidate();
  }

  private dropLane(id: string): void {
    const lane = this.lanes.get(id);
    if (!lane) return;
    lane.pending?.controller.abort();
    lane.pending = null;
    if (lane.shown) lane.release(lane.shown.value);
    lane.shown = null;
    this.lanes.delete(id);
  }

  private glyphSheet(source: GlyphsSource, ratio: number): { texture: Texture; sheet: GlyphSheet } | null {
    const key = `glyphs:${source.key}@${ratio}`;
    const known = this.textures.get(key);
    const sheet = this.sheets.get(key);
    if (known && sheet) {
      known.lastUsed = this.frame;
      return { texture: known.texture, sheet };
    }
    this.request(key, (signal) => this.sources.glyphs(source, ratio, signal), (picture) => {
      const size = sourceSize(picture.image);
      this.textures.set(key, { texture: Texture.from(picture.image as HTMLCanvasElement), bytes: size.width * size.height * 4, lastUsed: this.frame });
      this.sheets.set(key, picture.sheet);
    });
    return null;
  }

  private drawPieces(view: NodeView, node: SceneNode, layers: readonly { texture: Texture | null; weight: number }[], tiles: readonly TilePiece[], space: { width: number; height: number }, frame: { width: number; height: number }, index: number, camera: Camera, parent: Container, blend: BLEND_MODES, plan?: PaintPlan): void {
    view.sprite.visible = false;
    const pieces = (view.pieces ??= { container: new Container(), sprites: [], frames: [], blurs: [], meshes: new PieceMeshes(), isolation: new AlphaFilter({ alpha: 1 }) });
    if (pieces.container.parent !== parent) parent.addChild(pieces.container);
    pieces.container.zIndex = index;
    this.ensurePieces(pieces, layers.length * tiles.length, layers.length > 1 ? "add" : "normal");
    const shared = layers.map((layer) => layer.weight);
    const weightsOf = tiles.map((piece) => (plan && piece.tints ? pieceWeights(plan, piece.tints, layers.length) : shared));
    const loadedOf = weightsOf.map((weights) => layers.reduce((sum, layer, p) => sum + (layer.texture ? weights[p] : 0), 0));
    const stretchX = frame.width > 0 ? node.box.width / frame.width : 1;
    const stretchY = frame.height > 0 ? node.box.height / frame.height : 1;
    const placement = affineOf({ x: node.box.x, y: node.box.y, rotation: node.box.rotation, scaleX: stretchX * (node.flipX ? -1 : 1), scaleY: stretchY * (node.flipY ? -1 : 1) });
    const back = invertAffine(placement);
    let shown = false;
    layers.forEach((layer, p) => {
      const texture = layer.texture;
      tiles.forEach((piece, u) => {
        const k = p * tiles.length + u;
        const sprite = pieces.sprites[k];
        const weight = weightsOf[u][p];
        const tilted = Boolean(node.lens) && pieceTilted(piece);
        const corners = tilted && node.lens && back ? pieceQuad(piece, placement, node.lens) : null;
        const drawn = Boolean(texture) && weight > 0 && piece.opacity > 0 && (!tilted || corners !== null);
        sprite.visible = drawn && !tilted;
        if (!texture || !drawn) {
          pieces.meshes.hide(k);
          return;
        }
        shown = true;
        sprite.texture = this.pieceTexture(pieces, k, texture, piece.tile, space);
        sprite.alpha = (weight / loadedOf[u]) * piece.opacity;
        sprite.position.set(piece.x, piece.y);
        sprite.setSize(piece.width, piece.height);
        sprite.angle = piece.rotation;
        const blur = this.pieceBlur(pieces, k, piece.blurPx * camera.scale * stretchX);
        if (corners && back) {
          pieces.meshes.place(k, sprite, sprite.texture, corners.map((point) => applyAffine(back, point)) as unknown as Quad, { alpha: sprite.alpha, blend: sprite.blendMode, filters: blur });
          return;
        }
        pieces.meshes.hide(k);
        this.applyFilters(sprite, blur);
      });
    });
    pieces.container.position.set(node.box.x, node.box.y);
    pieces.container.angle = node.box.rotation;
    pieces.container.scale.set(stretchX * (node.flipX ? -1 : 1), stretchY * (node.flipY ? -1 : 1));
    pieces.container.alpha = node.opacity;
    pieces.container.blendMode = blend;
    pieces.container.visible = node.visible && node.opacity > 0 && shown;
    const filters = this.effectFilters(view, node, camera);
    this.applyFilters(pieces.container, filters.length > 0 ? filters : [pieces.isolation]);
  }

  private ensurePieces(pieces: PiecesView, count: number, blend: BLEND_MODES): void {
    while (pieces.sprites.length < count) {
      const sprite = new Sprite(Texture.EMPTY);
      sprite.anchor.set(0.5);
      pieces.container.addChild(sprite);
      pieces.sprites.push(sprite);
      pieces.frames.push(null);
      pieces.blurs.push(null);
    }
    while (pieces.sprites.length > count) {
      pieces.sprites.pop()!.destroy();
      pieces.frames.pop()?.destroy(false);
      pieces.blurs.pop();
    }
    pieces.meshes.trim(count);
    for (const sprite of pieces.sprites) sprite.blendMode = blend;
  }

  private unitFrames(node: SceneNode, source: RasterSource): UnitFrame[] | null {
    if (!node.text) return [{ tile: { x: 0, y: 0, width: source.widthPx, height: source.heightPx }, look: SETTLED_LOOK }];
    const lines = flowsInLines(source.layer) ? this.layoutOf(source) : [];
    return lines ? textUnitFrames(node.text, lines, source.widthPx, source.heightPx, source.layer.align || "left") : null;
  }

  private pieceTexture(pieces: PiecesView, k: number, texture: Texture, tile: Tile, space: { width: number; height: number }): Texture {
    const scaleX = texture.frame.width / space.width;
    const scaleY = texture.frame.height / space.height;
    const x = Math.max(0, tile.x * scaleX);
    const y = Math.max(0, tile.y * scaleY);
    const frame = new Rectangle(x, y, Math.max(1, Math.min(texture.frame.width - x, tile.width * scaleX)), Math.max(1, Math.min(texture.frame.height - y, tile.height * scaleY)));
    if (!sameFrame(pieces.frames[k], frame, texture)) {
      pieces.frames[k]?.destroy(false);
      pieces.frames[k] = new Texture({ source: texture.source, frame });
    }
    return pieces.frames[k]!;
  }

  private pieceBlur(pieces: PiecesView, k: number, strength: number): Filter[] {
    if (strength <= FRAME_EPSILON) return [];
    const blur = (pieces.blurs[k] ??= new BlurFilter());
    blur.strength = strength;
    return [blur];
  }

  private layoutOf(source: RasterSource): readonly LaidLine[] | null {
    const key = `layout:${source.key}`;
    const known = this.layouts.get(key);
    if (known) {
      known.lastUsed = this.frame;
      return known.lines;
    }
    this.request(key, () => this.sources.textLayout(source), (lines) => this.layouts.set(key, { lines, lastUsed: this.frame }));
    return null;
  }

  private effects(view: NodeView, node: SceneNode, camera: Camera): void {
    this.applyFilters(view.sprite, this.effectFilters(view, node, camera));
  }

  private applyFilters(target: Container, filters: Filter[]): void {
    const current = target.filters ?? [];
    const changed = !Array.isArray(current) || current.length !== filters.length || filters.some((filter, i) => current[i] !== filter);
    if (changed) target.filters = filters.length > 0 ? filters : null;
  }

  private effectFilters(view: NodeView, node: SceneNode, camera: Camera): Filter[] {
    const filters: Filter[] = [];
    if (node.chroma) {
      view.chroma ??= new ChromaFilter();
      view.chroma.set(node.chroma, Boolean(node.keyMatte) && !node.lumaKey);
      filters.push(view.chroma);
    }
    if (node.lumaKey) {
      view.luma ??= new LumaFilter();
      view.luma.set(node.lumaKey, Boolean(node.keyMatte));
      filters.push(view.luma);
    }
    if (node.colorMatrix) {
      view.matrix ??= new ColorMatrixFilter();
      if (!sameMatrix(view.matrix.matrix as unknown as number[], node.colorMatrix)) view.matrix.matrix = node.colorMatrix as unknown as ColorMatrixFilter["matrix"];
      filters.push(view.matrix);
    }
    if (node.grade || node.gradientMap || (node.blurPx ?? 0) > 0) filters.push(...(view.color ??= new ColorChain()).filters(node, this.lutState, camera.scale));
    return [...filters, ...this.maskFilters(view, node), ...this.vfxFilters(view, node, camera), ...(view.clip ? [] : this.haloFilters(view, node, camera, view.sprite)), ...this.revealFilters(view, node), ...(view.clip ? [] : this.trailFilters(view, node, camera, view.pieces?.container ?? view.sprite)), ...(view.clip ? [] : this.tiltFilters(view, node, camera, view.pieces?.container ?? view.sprite))];
  }

  private haloFilters(view: NodeView, node: SceneNode, camera: Camera, target: Container): Filter[] {
    const halo = node.halo;
    const home = target.parent;
    if (!halo || !home) {
      view.halo?.destroy();
      view.halo = null;
      return [];
    }
    const texture = this.haloTexture(node, halo, camera);
    if (!texture) return [];
    view.halo ??= new MediaHalo();
    return [view.halo.update(halo, texture, node.box, home, node.opacity, camera.scale)];
  }

  private haloTexture(node: SceneNode, halo: HaloNode, camera: Camera): Texture | null {
    const sized = halo.picture.kind === "rect" && halo.picture.fit === "contain";
    const source = sized ? this.videoSize(node) : null;
    if (sized && !source) return null;
    const ratio = haloRatio(node, halo, this.rasterScale(camera), this.viewport.resolution);
    const key = `halo:${haloSourceKey(halo, source)}@${ratio}`;
    const load = (signal: AbortSignal) => this.sources.halo(halo, source, ratio, signal);
    if (!halo.live) return this.cached(key, load);
    return this.latest<Texture>(`${node.id}#halo`, key, (signal) => load(signal).then((image) => (image ? Texture.from(image as HTMLCanvasElement) : null)), (texture) => texture.destroy(true));
  }

  private videoSize(node: SceneNode): SourceSize | null {
    if (node.source.kind !== "video") return null;
    const picture = this.sources.video(node.source);
    if (!picture) return null;
    const width = picture instanceof HTMLVideoElement ? picture.videoWidth : picture.displayWidth;
    const height = picture instanceof HTMLVideoElement ? picture.videoHeight : picture.displayHeight;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  private trailFilters(view: NodeView, node: SceneNode, camera: Camera, target: Container): Filter[] {
    const home = target.parent;
    if (!node.trail || !home || !trailDrawable(node.trail)) {
      view.trail?.destroy();
      view.trail = null;
      return [];
    }
    view.trail ??= new MotionTrailBlur();
    return [view.trail.update(node.trail, node.box, home, camera.scale)];
  }

  private tiltFilters(view: NodeView, node: SceneNode, camera: Camera, target: Container): Filter[] {
    const home = target.parent;
    if (node.tilt && home) return [(view.tilt ??= new ClipTiltWarp()).update(node.tilt, target, home, camera.scale)];
    view.tilt?.destroy();
    view.tilt = null;
    return [];
  }

  private revealFilters(view: NodeView, node: SceneNode): Filter[] {
    const home = (view.pieces?.container ?? view.sprite).parent;
    const field = node.reveal?.field;
    if (!node.reveal || !field || !home) {
      view.reveal?.destroy();
      view.reveal = null;
      return [];
    }
    const pattern = field.field;
    const map = pattern.pattern === "image" ? this.picture(pattern.assetId) : null;
    view.reveal ??= new RevealFieldMask();
    return [view.reveal.update(field, node.reveal.inverse, node.reveal.box, map, home)];
  }

  private maskFilters(view: NodeView, node: SceneNode): Filter[] {
    const home = (view.pieces?.container ?? view.sprite).parent;
    const texture = node.pixelMask ? this.pixelsTexture(node.pixelMask.source) : null;
    if (!node.pixelMask || !texture || !home) {
      view.pixelMask?.destroy();
      view.pixelMask = null;
      return [];
    }
    view.pixelMask ??= new PixelMask();
    return [view.pixelMask.update(node.pixelMask, texture, node.box, home)];
  }

  private pixelsTexture(source: PixelsSource): Texture | null {
    const picture = this.sources.pixels(source);
    if (!picture) return null;
    const known = this.pixels.get(source.key);
    if (known && known.canvas === picture.canvas) {
      known.lastUsed = this.frame;
      if (known.version !== picture.version) {
        known.version = picture.version;
        known.texture.source.update();
        this.generation += 1;
      }
      return known.texture;
    }
    known?.texture.destroy(true);
    const texture = new Texture({ source: new ImageSource({ resource: picture.canvas }) });
    this.pixels.set(source.key, { texture, canvas: picture.canvas, version: picture.version, lastUsed: this.frame });
    return texture;
  }

  private vfxFilters(view: NodeView, node: SceneNode, camera: Camera): Filter[] {
    const home = (view.pieces?.container ?? view.sprite).parent;
    if (!node.vfx?.length || !home) {
      view.vfx?.destroy();
      view.vfx = null;
      return [];
    }
    view.vfx ??= new VfxStack();
    return view.vfx.update(node.vfx, node.vfxFrame ?? node.box, home, { mix: 1, screenScale: camera.scale, adjusts: false });
  }

  private place(view: NodeView, node: SceneNode, texture: Texture): void {
    const sprite = view.sprite;
    if (node.fit === "fill") {
      sprite.texture = texture;
      this.position(sprite, node, node.box.width, node.box.height);
      return;
    }
    const size = { width: texture.source.pixelWidth, height: texture.source.pixelHeight };
    if (size.width <= 0 || size.height <= 0) return;
    const fitWidth = node.fitBox?.width ?? node.box.width;
    const fitHeight = node.fitBox?.height ?? node.box.height;
    const r = fitRect(size.width, size.height, fitWidth, fitHeight, node.fit);
    if (node.fit === "cover") {
      const frame = new Rectangle(r.sx, r.sy, r.sw, r.sh);
      if (!sameFrame(view.framed, frame, texture)) {
        view.framed?.destroy(false);
        view.framed = new Texture({ source: texture.source, frame });
      }
      sprite.texture = view.framed!;
      this.position(sprite, node, node.box.width, node.box.height);
      return;
    }
    sprite.texture = texture;
    this.position(sprite, node, (r.dw * node.box.width) / fitWidth, (r.dh * node.box.height) / fitHeight);
  }

  private position(sprite: Sprite, node: SceneNode, width: number, height: number): void {
    sprite.position.set(node.box.x, node.box.y);
    sprite.angle = node.box.rotation;
    sprite.setSize(width, height);
    sprite.scale.set(Math.abs(sprite.scale.x) * (node.flipX ? -1 : 1), Math.abs(sprite.scale.y) * (node.flipY ? -1 : 1));
  }

  private lineTexture(view: NodeView, node: SceneNode, line: LineNode, camera: Camera): Texture | null {
    if (node.source.kind !== "raster") return null;
    const source = node.source;
    const ratio = rasterRatio(node, this.rasterScale(camera), this.viewport.resolution);
    const parts: readonly MixPart[] = line.fill ? (node.mix ?? [{ source, weight: 1 }]) : [];
    const layers = parts.flatMap((part, index) => {
      const texture = this.rasterTexture(node, part.source, index, ratio);
      return texture ? [{ image: texture.source.resource as CanvasImageSource, weight: part.weight, id: texture.uid }] : [];
    });
    return (view.line ??= new LineComposite()).draw(line, source, ratio, layers);
  }

  private mixedTexture(source: SceneVideoSource, base: Texture | null): Texture | null {
    const blend = base && source.frameMix ? this.sources.videoBlend(source) : null;
    const next = blend ? this.videoTexture(`${source.clipId}${NEXT_FRAME}`, blend.picture) : null;
    return blend && next && base ? this.mixes.draw(source.clipId, base, next, blend.weight, this.frame) : base;
  }

  private readonly lutState = (assetId: string): LutState => {
    const key = `lut:${assetId}`;
    const known = this.luts.get(key);
    if (known) {
      known.lastUsed = this.frame;
      return known.atlas;
    }
    if (this.failed.has(key)) {
      this.missing.add(assetId);
      return "missing";
    }
    this.request(key, () => this.sources.lut(assetId), (atlas) => this.luts.set(key, { atlas, lastUsed: this.frame }), true);
    return "loading";
  };

  private textureOf(node: SceneNode, camera: Camera): Texture | null {
    const source = node.source;
    if (source.kind === "video") {
      const texture = this.mixedTexture(source, this.videoTexture(source.clipId, this.sources.video(source)));
      return texture && source.window ? this.windows.draw(source.clipId, texture, source.window, this.frame) : texture;
    }
    if (source.kind === "image") return this.picture(source.assetId);
    if (source.kind === "effect" || source.kind === "glyphs") return null;
    if (source.kind === "group") return this.groups.texture(node.id);
    if (source.kind === "pixels") return this.pixelsTexture(source);
    const ratio = rasterRatio(node, this.rasterScale(camera), this.viewport.resolution);
    return this.rasterTexture(node, source, 0, ratio);
  }

  private videoTexture(clipId: string, picture: VideoPicture | null): Texture | null {
    if (!picture) return null;
    const known = this.videos.get(clipId);
    if (known && reusable(known.picture, picture)) {
      known.lastUsed = this.frame;
      const changed = known.picture !== picture;
      if (changed) {
        known.texture.source.resource = picture;
        known.picture = picture;
      }
      if (changed || picture instanceof HTMLVideoElement) known.texture.source.update();
      return known.texture;
    }
    known?.texture.destroy(true);
    const texture = new Texture({ source: picture instanceof HTMLVideoElement ? this.elementSource(picture) : new ImageSource({ resource: picture }) });
    this.videos.set(clipId, { texture, picture, lastUsed: this.frame });
    return texture;
  }

  private elementSource(video: HTMLVideoElement): VideoSource {
    const source = new VideoSource({ resource: video, autoPlay: false, autoLoad: false });
    source.autoUpdate = false;
    return source;
  }

  private picture(assetId: string): Texture | null {
    return this.cached(`image:${assetId}`, () => this.sources.image(assetId), () => this.sources.releaseImage(assetId));
  }

  private cached(key: string, load: (signal: AbortSignal) => Promise<CanvasImageSource | null>, release?: () => void): Texture | null {
    const known = this.textures.get(key);
    if (known) {
      known.lastUsed = this.frame;
      return known.texture;
    }
    this.request(
      key,
      load,
      (image) => {
        const size = sourceSize(image);
        this.textures.set(key, { texture: Texture.from(image as HTMLCanvasElement, true), bytes: size.width * size.height * 4, lastUsed: this.frame, release });
      },
      false,
      release,
    );
    return null;
  }

  private request<T>(key: string, load: (signal: AbortSignal) => Promise<T | null>, keep: (value: T) => void, announceFailure = false, discard?: () => void): void {
    const pending = this.loading.get(key);
    if (pending) {
      pending.wantedAt = this.frame;
      return;
    }
    if (this.failed.has(key)) return;
    const started: PendingLoad = { controller: new AbortController(), wantedAt: this.frame };
    this.loading.set(key, started);
    void load(started.controller.signal).then(
      (value) => this.settle(key, started, value, keep, announceFailure, discard),
      () => this.settle(key, started, null, keep, announceFailure),
    );
  }

  private settle<T>(key: string, started: PendingLoad, value: T | null, keep: (value: T) => void, announceFailure: boolean, discard?: () => void): void {
    if (this.destroyed || this.loading.get(key) !== started) {
      if (value !== null) discard?.();
      return;
    }
    this.loading.delete(key);
    if (value === null) {
      this.failed.add(key);
      if (announceFailure) this.invalidate();
      return;
    }
    keep(value);
    this.generation += 1;
    this.invalidate();
  }

  private dropUnwanted(): void {
    for (const [key, pending] of this.loading) {
      if (pending.wantedAt === this.frame) continue;
      pending.controller.abort();
      this.loading.delete(key);
    }
  }

  private evict(): void {
    this.windows.prune(this.frame, STALE_FRAMES);
    this.mixes.prune(this.frame, STALE_FRAMES);
    for (const [key, lut] of this.luts) if (this.frame - lut.lastUsed > STALE_FRAMES) this.luts.delete(key);
    for (const [id, lane] of this.lanes) if (this.frame - lane.lastUsed > STALE_FRAMES) this.dropLane(id);
    for (const [key, layout] of this.layouts) if (this.frame - layout.lastUsed > STALE_FRAMES) this.layouts.delete(key);
    for (const [key, cached] of this.pixels) {
      if (this.frame - cached.lastUsed <= STALE_FRAMES) continue;
      cached.texture.destroy(true);
      this.pixels.delete(key);
    }
    for (const [clipId, cached] of this.videos) {
      if (this.frame - cached.lastUsed <= STALE_FRAMES) continue;
      cached.texture.destroy(true);
      this.videos.delete(clipId);
    }
    let total = [...this.textures.values()].reduce((sum, cached) => sum + cached.bytes, 0);
    if (total <= TEXTURE_BUDGET_BYTES) return;
    const oldest = [...this.textures.entries()].filter(([, cached]) => this.frame - cached.lastUsed > STALE_FRAMES).sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
    for (const [key, cached] of oldest) {
      if (total <= TEXTURE_BUDGET_BYTES) break;
      cached.texture.destroy(true);
      cached.release?.();
      this.textures.delete(key);
      this.sheets.delete(key);
      total -= cached.bytes;
    }
  }
}

export interface PixiRendererOptions {
  transparent: boolean;
}

export async function createPixiRenderer(canvas: HTMLCanvasElement, viewport: Viewport, sources: RenderSources, invalidate: () => void, options: PixiRendererOptions = { transparent: false }): Promise<Renderer> {
  const gpu = await autoDetectRenderer({
    preference: ["webgl"],
    canvas,
    width: viewport.width,
    height: viewport.height,
    resolution: viewport.resolution,
    autoDensity: false,
    antialias: ANTIALIAS,
    useBackBuffer: true,
    backgroundAlpha: options.transparent ? 0 : 1,
  });
  return new PixiSceneRenderer(gpu, viewport, sources, invalidate, ANTIALIAS);
}
