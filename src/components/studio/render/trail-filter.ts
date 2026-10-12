import { AlphaFilter, defaultFilterVert, Filter, GlProgram, Matrix, Sprite, Texture, TexturePool, UniformGroup, type Container, type FilterSystem, type RenderSurface } from "pixi.js";

import { TRAIL_MAP_SIZE, trailReach } from "@/lib/studio/motion-blur";
import type { SceneBox, SceneTrail } from "@/lib/studio/scene/scene";

export const TRAIL_PASS_SAMPLES = 64;

const ROWS_PER_SAMPLE = 2;
const FLOATS_PER_ROW = 4;
const REACH_MARGIN_PX = 2;
const MIN_BOX_PX = 1e-3;

const fragment = `#version 300 es
precision highp float;
precision highp int;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform mat3 uToBox;
uniform mat3 uFromBox;
uniform vec4 uMaps[${TRAIL_PASS_SAMPLES * ROWS_PER_SAMPLE}];
uniform int uCount;
uniform float uWeight;

void main() {
  vec3 box = uToBox * vec3(vTextureCoord, 1.0);
  vec4 sum = vec4(0.0);
  for (int i = 0; i < ${TRAIL_PASS_SAMPLES}; i++) {
    if (i >= uCount) break;
    vec4 across = uMaps[i * 2];
    vec4 down = uMaps[i * 2 + 1];
    vec3 shown = vec3(dot(across.xy, box.xy) + across.z, dot(down.xy, box.xy) + down.z, 1.0);
    vec2 at = (uFromBox * shown).xy;
    float inside = step(uInputClamp.x, at.x) * step(uInputClamp.y, at.y) * step(at.x, uInputClamp.z) * step(at.y, uInputClamp.w);
    sum += texture(uTexture, clamp(at, uInputClamp.xy, uInputClamp.zw)) * inside;
  }
  finalColor = sum * uWeight;
}
`;

let program: GlProgram | null = null;

function programOf(): GlProgram {
  program ??= GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-motion-trail" });
  return program;
}

export class TrailFilter extends Filter {
  private readonly values: UniformGroup;
  private readonly copy = new AlphaFilter({ alpha: 1 });
  private maps: readonly number[] = [];

  constructor(private readonly frame: Sprite) {
    const values = new UniformGroup({
      uToBox: { value: new Matrix(), type: "mat3x3<f32>" },
      uFromBox: { value: new Matrix(), type: "mat3x3<f32>" },
      uMaps: { value: new Float32Array(TRAIL_PASS_SAMPLES * ROWS_PER_SAMPLE * FLOATS_PER_ROW), type: "vec4<f32>", size: TRAIL_PASS_SAMPLES * ROWS_PER_SAMPLE },
      uCount: { value: 0, type: "i32" },
      uWeight: { value: 0, type: "f32" },
    });
    super({ glProgram: programOf(), resources: { trailUniforms: values } });
    this.values = values;
  }

  set(maps: readonly number[], padding: number): void {
    this.maps = maps;
    this.padding = padding;
  }

  private load(first: number, count: number, total: number): void {
    const slots = this.values.uniforms.uMaps as Float32Array;
    for (let i = 0; i < count; i++) {
      const at = (first + i) * TRAIL_MAP_SIZE;
      const row = i * ROWS_PER_SAMPLE * FLOATS_PER_ROW;
      for (let k = 0; k < TRAIL_MAP_SIZE / ROWS_PER_SAMPLE; k++) {
        slots[row + k] = this.maps[at + k];
        slots[row + FLOATS_PER_ROW + k] = this.maps[at + TRAIL_MAP_SIZE / ROWS_PER_SAMPLE + k];
      }
    }
    Object.assign(this.values.uniforms, { uCount: count, uWeight: 1 / total });
    this.values.update();
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const toBox = this.values.uniforms.uToBox as Matrix;
    filterManager.calculateSpriteMatrix(toBox, this.frame);
    (this.values.uniforms.uFromBox as Matrix).copyFrom(toBox).invert();
    const total = this.maps.length / TRAIL_MAP_SIZE;
    if (total <= TRAIL_PASS_SAMPLES) {
      this.load(0, total, total);
      filterManager.applyFilter(this, input, output, clearMode);
      return;
    }
    const sum = TexturePool.getSameSizeTexture(input);
    for (let first = 0; first < total; first += TRAIL_PASS_SAMPLES) {
      this.load(first, Math.min(TRAIL_PASS_SAMPLES, total - first), total);
      this.blendMode = first === 0 ? "normal" : "add";
      filterManager.applyFilter(this, input, sum, first === 0);
    }
    this.blendMode = "normal";
    filterManager.applyFilter(this.copy, sum, output, clearMode);
    TexturePool.returnTexture(sum);
  }

  override destroy(): void {
    this.copy.destroy();
    super.destroy();
  }
}

function spreadOf(drawn: SceneBox, measured: SceneBox): { x: number; y: number } {
  return { x: Math.max(1, drawn.width / Math.max(measured.width, MIN_BOX_PX)), y: Math.max(1, drawn.height / Math.max(measured.height, MIN_BOX_PX)) };
}

export function trailDrawable(trail: SceneTrail): boolean {
  return trail.box.width > MIN_BOX_PX && trail.box.height > MIN_BOX_PX && trail.maps.length >= TRAIL_MAP_SIZE * 2;
}

export class MotionTrailBlur {
  private readonly frame = new Sprite(Texture.WHITE);
  private readonly filter: TrailFilter;

  constructor() {
    this.frame.anchor.set(0.5);
    this.frame.renderable = false;
    this.filter = new TrailFilter(this.frame);
  }

  update(trail: SceneTrail, drawn: SceneBox, home: Container, screenScale: number): Filter {
    if (this.frame.parent !== home) home.addChild(this.frame);
    this.frame.position.set(trail.box.x, trail.box.y);
    this.frame.angle = trail.box.rotation;
    this.frame.setSize(trail.box.width, trail.box.height);
    const reach = trailReach(trail, trail.box.width * screenScale, trail.box.height * screenScale, spreadOf(drawn, trail.box));
    this.filter.set(trail.maps, Math.ceil(reach) + REACH_MARGIN_PX);
    return this.filter;
  }

  destroy(): void {
    this.filter.destroy();
    this.frame.destroy();
  }
}
