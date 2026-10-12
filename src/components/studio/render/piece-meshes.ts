import { PerspectiveMesh, type BLEND_MODES, type Filter, type Sprite, type Texture } from "pixi.js";

import type { Quad } from "@/lib/studio/perspective";

const MESH_VERTICES = 12;

export class PieceMeshes {
  private readonly meshes: (PerspectiveMesh | null)[] = [];

  place(k: number, sprite: Sprite, texture: Texture, corners: Quad, look: { alpha: number; blend: BLEND_MODES; filters: Filter[] }): void {
    const home = sprite.parent;
    if (!home) return;
    const mesh = (this.meshes[k] ??= new PerspectiveMesh({ texture, verticesX: MESH_VERTICES, verticesY: MESH_VERTICES }));
    if (mesh.parent !== home) home.addChildAt(mesh, home.getChildIndex(sprite) + 1);
    mesh.texture = texture;
    mesh.setCorners(corners[0].x, corners[0].y, corners[1].x, corners[1].y, corners[2].x, corners[2].y, corners[3].x, corners[3].y);
    mesh.alpha = look.alpha;
    mesh.blendMode = look.blend;
    mesh.visible = true;
    const current = mesh.filters ?? [];
    const changed = !Array.isArray(current) || current.length !== look.filters.length || look.filters.some((filter, i) => current[i] !== filter);
    if (changed) mesh.filters = look.filters.length > 0 ? look.filters : null;
  }

  hide(k: number): void {
    const mesh = this.meshes[k];
    if (mesh) mesh.visible = false;
  }

  trim(count: number): void {
    while (this.meshes.length > count) this.meshes.pop()?.destroy();
  }

  destroy(): void {
    this.trim(0);
  }
}
