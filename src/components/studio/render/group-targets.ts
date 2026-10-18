import { Container, RenderTexture, type Renderer } from "pixi.js";

import type { Camera } from "@/lib/studio/render/renderer";
import type { Scene, SceneNode } from "@/lib/studio/scene/scene";

const MAX_GROUP_SIDE_PX = 4096;
const MIN_GROUP_SCALE = 0.01;

interface GroupTarget {
  container: Container;
  texture: RenderTexture | null;
}

export function groupCamera(node: SceneNode, scene: Scene, camera: Camera, resolution: number): Camera {
  const reach = Math.max(node.box.width / scene.width, node.box.height / scene.height);
  const ceiling = MAX_GROUP_SIDE_PX / (Math.max(scene.width, scene.height) * resolution);
  return { scale: Math.max(MIN_GROUP_SCALE, Math.min(camera.scale * reach, ceiling)), x: 0, y: 0 };
}

export class GroupTargets {
  private readonly targets = new Map<string, GroupTarget>();

  container(id: string, scale: number): Container {
    const known = this.targets.get(id);
    const target = known ?? { container: new Container({ sortableChildren: true }), texture: null };
    if (!known) this.targets.set(id, target);
    target.container.scale.set(scale);
    return target.container;
  }

  draw(gpu: Renderer, id: string, scene: Scene, scale: number, resolution: number): void {
    const target = this.targets.get(id);
    if (!target) return;
    const width = Math.max(1, Math.round(scene.width * scale));
    const height = Math.max(1, Math.round(scene.height * scale));
    if (!target.texture) target.texture = RenderTexture.create({ width, height, resolution, antialias: true });
    else if (target.texture.width !== width || target.texture.height !== height || target.texture.source.resolution !== resolution) target.texture.resize(width, height, resolution);
    gpu.render({ container: target.container, target: target.texture, clear: true, clearColor: [0, 0, 0, 0] });
  }

  texture(id: string): RenderTexture | null {
    return this.targets.get(id)?.texture ?? null;
  }

  prune(present: ReadonlySet<string>): void {
    for (const [id, target] of this.targets) {
      if (present.has(id)) continue;
      target.texture?.destroy(true);
      target.container.destroy({ children: true });
      this.targets.delete(id);
    }
  }

  destroy(): void {
    this.prune(new Set());
  }
}
