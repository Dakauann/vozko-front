"use client";

import "pixi.js/advanced-blend-modes";

import {
  autoDetectRenderer,
  BlurFilter,
  ColorMatrixFilter,
  Container,
  extensions,
  FillGradient,
  Graphics,
  ImageSource,
  Rectangle,
  Sprite,
  Texture,
  TilingSprite,
  VideoSource,
  type BLEND_MODES,
  type Filter,
  type Renderer as PixiRenderer,
} from "pixi.js";

import type { Gradient } from "@/lib/studio/document";
import { fitRect } from "@/lib/studio/fit";
import { gradientPaint } from "@/lib/studio/paint";
import { rasterRatio, type Camera, type Renderer, type RenderSources, type VideoPicture, type Viewport } from "@/lib/studio/render/renderer";
import type { Scene, SceneNode } from "@/lib/studio/scene/scene";

import { HueBlend } from "./hue-blend";

extensions.add(HueBlend);

const TEXTURE_BUDGET_BYTES = 256 * 1024 * 1024;
const STALE_FRAMES = 90;
const FRAME_EPSILON = 0.5;
const CHECKER_CELL = 8;
const ARTBOARD_SHADOW_BLUR = 16;
const ARTBOARD_SHADOW_ALPHA = 0.12;

interface CachedTexture {
  texture: Texture;
  bytes: number;
  lastUsed: number;
}

interface VideoTexture {
  texture: Texture;
  picture: VideoPicture;
  lastUsed: number;
}

interface NodeView {
  sprite: Sprite;
  framed: Texture | null;
  matrix: ColorMatrixFilter | null;
  blur: BlurFilter | null;
}

interface RunView {
  container: Container;
  members: Container;
  mask: Sprite;
}

interface BoardView {
  root: Container;
  artboard: Artboard;
  content: Container;
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

function fillGradient(gradient: Gradient, width: number, height: number): FillGradient {
  const paint = gradientPaint(gradient, { x: 0, y: 0, width, height });
  const colorStops = [];
  for (let i = 0; i < paint.stops.length; i += 2) colorStops.push({ offset: paint.stops[i] as number, color: paint.stops[i + 1] as string });
  if (paint.kind === "radial") {
    return new FillGradient({ type: "radial", center: paint.center, innerRadius: 0, outerCenter: paint.center, outerRadius: paint.radius, colorStops, textureSpace: "global" });
  }
  return new FillGradient({ type: "linear", start: paint.start, end: paint.end, colorStops, textureSpace: "global" });
}

class Artboard {
  readonly root = new Container();
  private readonly shadow = new Graphics();
  private readonly fill = new Graphics();
  private readonly checker: TilingSprite;
  readonly clip = new Graphics();
  private key = "";

  constructor() {
    this.shadow.filters = [new BlurFilter({ strength: ARTBOARD_SHADOW_BLUR })];
    this.checker = new TilingSprite({ texture: checkerTexture(), width: 1, height: 1 });
    this.root.addChild(this.shadow, this.fill, this.checker, this.clip);
  }

  update(scene: Scene, camera: Camera): void {
    this.root.visible = Boolean(scene.artboard);
    if (!scene.artboard) return;
    const transparent = !scene.background && !scene.gradient;
    this.checker.visible = transparent;
    this.checker.setSize(scene.width, scene.height);
    this.checker.tileScale.set(1 / Math.max(camera.scale, 0.01));
    const key = `${scene.width}x${scene.height}|${scene.background}|${JSON.stringify(scene.gradient ?? null)}`;
    if (key === this.key) return;
    this.key = key;
    this.shadow.clear().rect(0, 2, scene.width, scene.height).fill({ color: 0x000000, alpha: ARTBOARD_SHADOW_ALPHA });
    this.fill.clear().rect(0, 0, scene.width, scene.height);
    if (scene.gradient) this.fill.fill(fillGradient(scene.gradient, scene.width, scene.height));
    else if (scene.background) this.fill.fill(scene.background);
    this.clip.clear().rect(0, 0, scene.width, scene.height).fill(0xffffff);
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
  private readonly textures = new Map<string, CachedTexture>();
  private readonly loading = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly videos = new Map<string, VideoTexture>();
  private frame = 0;
  private destroyed = false;

  constructor(
    private readonly gpu: PixiRenderer,
    private viewport: Viewport,
    private readonly sources: RenderSources,
    private readonly invalidate: () => void,
  ) {
    this.backend = gpu.name;
  }

  get busy(): boolean {
    return this.loading.size > 0;
  }

  resize(viewport: Viewport): void {
    this.viewport = viewport;
    this.gpu.resize(viewport.width, viewport.height, viewport.resolution);
  }

  render(scenes: readonly Scene[], camera: Camera): void {
    if (this.destroyed) return;
    this.frame += 1;
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
      const sceneBases = new Set(scene.nodes.flatMap((node) => (node.clipOf ? [node.clipOf] : [])));
      for (const base of sceneBases) bases.add(base);
      scene.nodes.forEach((node, index) => {
        present.add(node.id);
        this.draw(node, index, camera, sceneBases, board);
      });
    });
    for (const [id, view] of this.views) if (!present.has(id)) this.drop(id, view);
    for (const [id, run] of this.runs) if (!bases.has(id) || !present.has(id)) this.dropRun(id, run);
    for (const [key, board] of this.boards) if (!shown.has(key)) this.dropBoard(key, board);
    this.evict();
    this.gpu.render({ container: this.world });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const [id, view] of this.views) this.drop(id, view);
    for (const [id, run] of this.runs) this.dropRun(id, run);
    for (const cached of [...this.textures.values(), ...this.videos.values()]) cached.texture.destroy(true);
    this.textures.clear();
    this.videos.clear();
    for (const [key, board] of this.boards) this.dropBoard(key, board);
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
    const artboard = new Artboard();
    const content = new Container({ sortableChildren: true });
    root.addChild(artboard.root, content);
    root.zIndex = order;
    this.world.addChild(root);
    const created = { root, artboard, content };
    this.boards.set(key, created);
    return created;
  }

  private dropBoard(key: string, board: BoardView): void {
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
    const created: NodeView = { sprite, framed: null, matrix: null, blur: null };
    this.views.set(id, created);
    return created;
  }

  private run(baseId: string): RunView {
    const existing = this.runs.get(baseId);
    if (existing) return existing;
    const container = new Container({ sortableChildren: true });
    const members = new Container({ sortableChildren: true });
    const mask = new Sprite(Texture.EMPTY);
    mask.anchor.set(0.5);
    members.zIndex = 1;
    container.addChild(members, mask);
    members.mask = mask;
    const created = { container, members, mask };
    this.runs.set(baseId, created);
    return created;
  }

  private drop(id: string, view: NodeView): void {
    view.framed?.destroy(false);
    view.sprite.destroy();
    this.views.delete(id);
  }

  private dropRun(id: string, run: RunView): void {
    run.members.mask = null;
    const home = run.container.parent;
    for (const child of [...run.container.children, ...run.members.children]) if (child !== run.members && child !== run.mask) home?.addChild(child);
    run.container.destroy({ children: true });
    this.runs.delete(id);
  }

  private parentOf(node: SceneNode, index: number, bases: ReadonlySet<string>, board: BoardView): Container {
    if (node.clipOf) return this.run(node.clipOf).members;
    if (!bases.has(node.id)) return board.content;
    const run = this.run(node.id);
    run.container.zIndex = index;
    run.container.blendMode = (node.blend ?? "normal") as BLEND_MODES;
    if (run.container.parent !== board.content) board.content.addChild(run.container);
    return run.container;
  }

  private draw(node: SceneNode, index: number, camera: Camera, bases: ReadonlySet<string>, board: BoardView): void {
    const view = this.view(node.id);
    const sprite = view.sprite;
    const parent = this.parentOf(node, index, bases, board);
    if (sprite.parent !== parent) parent.addChild(sprite);
    const isBase = bases.has(node.id);
    sprite.zIndex = isBase ? 0 : index;
    const texture = this.textureOf(node, camera);
    if (texture) this.place(view, node, texture);
    else if (node.fit === "fill" && sprite.texture !== Texture.EMPTY) this.position(sprite, node, node.box.width, node.box.height);
    sprite.alpha = node.opacity;
    sprite.blendMode = (isBase ? "normal" : (node.blend ?? "normal")) as BLEND_MODES;
    sprite.visible = node.visible && node.opacity > 0 && sprite.texture !== Texture.EMPTY;
    this.effects(view, node, camera);
    if (isBase) this.mirrorMask(this.run(node.id).mask, sprite);
  }

  private mirrorMask(mask: Sprite, base: Sprite): void {
    mask.texture = base.texture;
    mask.position.copyFrom(base.position);
    mask.angle = base.angle;
    mask.setSize(base.width, base.height);
  }

  private effects(view: NodeView, node: SceneNode, camera: Camera): void {
    const filters: Filter[] = [];
    if (node.colorMatrix) {
      view.matrix ??= new ColorMatrixFilter();
      if (!sameMatrix(view.matrix.matrix as unknown as number[], node.colorMatrix)) view.matrix.matrix = node.colorMatrix as unknown as ColorMatrixFilter["matrix"];
      filters.push(view.matrix);
    }
    if (node.blurPx && node.blurPx > 0) {
      view.blur ??= new BlurFilter();
      view.blur.strength = node.blurPx * camera.scale;
      filters.push(view.blur);
    }
    const current = view.sprite.filters ?? [];
    const changed = !Array.isArray(current) || current.length !== filters.length || filters.some((filter, i) => current[i] !== filter);
    if (changed) view.sprite.filters = filters.length > 0 ? filters : null;
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
    const r = fitRect(size.width, size.height, node.box.width, node.box.height, node.fit);
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
    this.position(sprite, node, r.dw, r.dh);
  }

  private position(sprite: Sprite, node: SceneNode, width: number, height: number): void {
    sprite.position.set(node.box.x, node.box.y);
    sprite.angle = node.box.rotation;
    sprite.setSize(width, height);
  }

  private textureOf(node: SceneNode, camera: Camera): Texture | null {
    const source = node.source;
    if (source.kind === "video") return this.videoTexture(source.clipId, this.sources.video(source));
    if (source.kind === "image") return this.cached(`image:${source.assetId}`, () => this.sources.image(source.assetId));
    const ratio = rasterRatio(node, camera.scale, this.viewport.resolution);
    return this.cached(`raster:${source.key}@${ratio}`, () => this.sources.raster(source, ratio));
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

  private cached(key: string, load: () => Promise<CanvasImageSource | null>): Texture | null {
    const known = this.textures.get(key);
    if (known) {
      known.lastUsed = this.frame;
      return known.texture;
    }
    if (this.loading.has(key) || this.failed.has(key)) return null;
    this.loading.add(key);
    void load().then(
      (image) => this.store(key, image),
      () => this.store(key, null),
    );
    return null;
  }

  private store(key: string, image: CanvasImageSource | null): void {
    this.loading.delete(key);
    if (this.destroyed) return;
    if (!image) {
      this.failed.add(key);
      return;
    }
    const size = sourceSize(image);
    this.textures.set(key, { texture: Texture.from(image as HTMLCanvasElement), bytes: size.width * size.height * 4, lastUsed: this.frame });
    this.invalidate();
  }

  private evict(): void {
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
      this.textures.delete(key);
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
    antialias: true,
    backgroundAlpha: options.transparent ? 0 : 1,
  });
  return new PixiSceneRenderer(gpu, viewport, sources, invalidate);
}
