import { Container, Graphics, Rectangle, Texture, type Filter } from "pixi.js";

import type { Camera } from "@/lib/studio/render/renderer";
import type { Scene, SceneNode } from "@/lib/studio/scene/scene";

import { BlendedFilters } from "./blended-filters";
import { CameraView } from "./camera-filter";
import { MaskTexture } from "./clip-mask";
import { ColorChain, type LutLookup } from "./color-chain";
import { fillGradient } from "./fill-gradient";
import { VfxStack } from "./vfx-filter";

export interface EffectContext {
  camera: Camera;
  resolution: number;
  luts: LutLookup;
}

class EffectLayer {
  readonly group = new Container({ sortableChildren: true });
  private readonly backdrop = new Graphics();
  private readonly stack = new VfxStack();
  private readonly color = new ColorChain();
  private readonly view = new CameraView();
  private readonly dose = new BlendedFilters();
  private readonly region = new BlendedFilters();
  private readonly coverage = new MaskTexture();
  private key = "";

  constructor() {
    this.backdrop.zIndex = -1;
    this.group.addChild(this.backdrop);
  }

  update(node: SceneNode, parent: Container, index: number, scene: Scene, at: EffectContext): void {
    if (this.group.parent !== parent) parent.addChild(this.group);
    this.group.zIndex = index;
    const key = `${scene.width}x${scene.height}|${scene.background}|${JSON.stringify(scene.gradient ?? null)}`;
    if (key !== this.key) {
      this.key = key;
      this.backdrop.clear().rect(0, 0, scene.width, scene.height);
      if (scene.gradient) this.backdrop.fill(fillGradient(scene.gradient, scene.width, scene.height));
      else if (scene.background) this.backdrop.fill(scene.background);
      this.group.filterArea = new Rectangle(0, 0, scene.width, scene.height);
    }
    const filters = node.visible ? this.adjustment(node, at) : [];
    this.group.filters = filters.length > 0 ? filters : null;
  }

  destroy(): void {
    this.group.filters = null;
    this.stack.destroy();
    this.color.destroy();
    this.view.destroy();
    this.dose.destroy();
    this.region.destroy();
    this.coverage.destroy();
    this.group.removeChildren();
    this.backdrop.destroy();
    this.group.destroy({ children: false });
  }

  private adjustment(node: SceneNode, at: EffectContext): Filter[] {
    const moved = node.camera ? [this.view.update(node.camera, this.group)] : [];
    const colored = this.color.filters(node, at.luts, at.camera.scale);
    const dosed = colored.length > 0 && node.opacity < 1 ? [this.dose.update(colored, node.opacity, Texture.WHITE, node.box, this.group)] : colored;
    const looks = this.stack.update(node.vfx ?? [], node.box, this.group, { mix: node.opacity, screenScale: at.camera.scale, adjusts: true });
    const chain = [...moved, ...dosed, ...looks];
    if (!node.clipMasks?.length || chain.length === 0) return chain;
    const coverage = this.coverage.update(node.clipMasks, node.box, at.camera.scale * at.resolution);
    return [this.region.update(chain, 1, coverage, node.box, this.group)];
  }
}

export class EffectLayers {
  private readonly layers = new Map<string, EffectLayer>();

  arrange(scene: Scene, content: Container, at: EffectContext): Container[] {
    const homes: Container[] = new Array(scene.nodes.length);
    let current = content;
    for (let index = scene.nodes.length - 1; index >= 0; index--) {
      const node = scene.nodes[index];
      homes[index] = current;
      if (node.source.kind !== "effect") continue;
      const layer = this.layer(node.id);
      layer.update(node, current, index, scene, at);
      current = layer.group;
    }
    return homes;
  }

  prune(present: ReadonlySet<string>): void {
    for (const [id, layer] of this.layers) {
      if (present.has(id)) continue;
      layer.destroy();
      this.layers.delete(id);
    }
  }

  destroy(): void {
    this.prune(new Set());
  }

  private layer(id: string): EffectLayer {
    const known = this.layers.get(id);
    if (known) return known;
    const created = new EffectLayer();
    this.layers.set(id, created);
    return created;
  }
}
