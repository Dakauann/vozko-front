import { defaultFilterVert, Filter, GlProgram, Matrix, Sprite, Texture, UniformGroup, type Container, type FilterSystem, type RenderSurface } from "pixi.js";

import { applyAffine, invertHomography, projectHomography, quadReach, scaledHomography, type Affine, type Homography } from "@/lib/studio/perspective";
import type { SceneTilt } from "@/lib/studio/scene/scene";

const REACH_MARGIN_PX = 2;
const EDGE_ON: Homography = [0, 0, 0, 0, 0, 0, 0, 0, 0];

const fragment = `#version 300 es
precision highp float;
precision highp int;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform mat3 uToFrame;
uniform mat3 uFromFrame;
uniform mat3 uUnproject;

void main() {
  vec3 shown = uToFrame * vec3(vTextureCoord, 1.0);
  vec3 plane = uUnproject * vec3(shown.xy, 1.0);
  if (plane.z <= 0.0) {
    finalColor = vec4(0.0);
    return;
  }
  vec2 at = (uFromFrame * vec3(plane.xy / plane.z, 1.0)).xy;
  float inside = step(uInputClamp.x, at.x) * step(uInputClamp.y, at.y) * step(at.x, uInputClamp.z) * step(at.y, uInputClamp.w);
  finalColor = texture(uTexture, clamp(at, uInputClamp.xy, uInputClamp.zw)) * inside;
}
`;

let program: GlProgram | null = null;

function programOf(): GlProgram {
  program ??= GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-tilt" });
  return program;
}

class TiltFilter extends Filter {
  private readonly values: UniformGroup;

  constructor(private readonly frame: Sprite) {
    const values = new UniformGroup({
      uToFrame: { value: new Matrix(), type: "mat3x3<f32>" },
      uFromFrame: { value: new Matrix(), type: "mat3x3<f32>" },
      uUnproject: { value: new Float32Array(9), type: "mat3x3<f32>" },
    });
    super({ glProgram: programOf(), resources: { tiltUniforms: values } });
    this.values = values;
  }

  set(unproject: Homography, padding: number): void {
    const slots = this.values.uniforms.uUnproject as Float32Array;
    slots.set([unproject[0], unproject[3], unproject[6], unproject[1], unproject[4], unproject[7], unproject[2], unproject[5], unproject[8]]);
    this.values.update();
    this.padding = padding;
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const toFrame = this.values.uniforms.uToFrame as Matrix;
    filterManager.calculateSpriteMatrix(toFrame, this.frame);
    (this.values.uniforms.uFromFrame as Matrix).copyFrom(toFrame).invert();
    filterManager.applyFilter(this, input, output, clearMode);
  }
}

function boundsCorners(target: Container): { x: number; y: number }[] {
  const local = target.getLocalBounds();
  target.updateLocalTransform();
  const m = target.localTransform;
  const affine: Affine = [m.a, m.b, m.c, m.d, m.tx, m.ty];
  return [
    { x: local.minX, y: local.minY },
    { x: local.maxX, y: local.minY },
    { x: local.maxX, y: local.maxY },
    { x: local.minX, y: local.maxY },
  ].map((point) => applyAffine(affine, point));
}

function tiltReach(tilt: SceneTilt, corners: readonly { x: number; y: number }[]): number {
  return Math.min(quadReach(corners, corners.map((point) => projectHomography(tilt.matrix, point))), Math.hypot(tilt.width, tilt.height));
}

export class ClipTiltWarp {
  private readonly frame = new Sprite(Texture.WHITE);
  private readonly filter: TiltFilter;
  private key = "";

  constructor() {
    this.frame.renderable = false;
    this.filter = new TiltFilter(this.frame);
  }

  update(tilt: SceneTilt, target: Container, home: Container, screenScale: number): Filter {
    const unproject = invertHomography(scaledHomography(tilt.matrix, tilt.width, tilt.height)) ?? EDGE_ON;
    if (this.frame.parent !== home) home.addChild(this.frame);
    this.frame.position.set(0, 0);
    this.frame.setSize(tilt.width, tilt.height);
    const reach = tiltReach(tilt, boundsCorners(target));
    const key = `${unproject.join(",")}|${reach}|${screenScale}`;
    if (key !== this.key) {
      this.key = key;
      this.filter.set(unproject, Math.ceil(reach * screenScale) + REACH_MARGIN_PX);
    }
    return this.filter;
  }

  destroy(): void {
    this.filter.destroy();
    this.frame.destroy();
  }
}
