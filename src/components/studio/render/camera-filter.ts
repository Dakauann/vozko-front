import { Sprite, Texture, type Container, type Filter } from "pixi.js";

import type { SceneTrail } from "@/lib/studio/scene/scene";

import { TrailFilter } from "./trail-filter";

export class CameraView {
  private readonly frame = new Sprite(Texture.WHITE);
  private readonly filter: TrailFilter;

  constructor() {
    this.frame.anchor.set(0.5);
    this.frame.renderable = false;
    this.filter = new TrailFilter(this.frame);
  }

  update(camera: SceneTrail, home: Container): Filter {
    if (this.frame.parent !== home) home.addChild(this.frame);
    this.frame.position.set(camera.box.x, camera.box.y);
    this.frame.angle = camera.box.rotation;
    this.frame.setSize(camera.box.width, camera.box.height);
    this.filter.set(camera.maps, 0);
    return this.filter;
  }

  destroy(): void {
    this.filter.destroy();
    this.frame.destroy();
  }
}
