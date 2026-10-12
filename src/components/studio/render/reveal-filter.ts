import { defaultFilterVert, Filter, GlProgram, Matrix, Sprite, Texture, UniformGroup, type Container, type FilterSystem, type RenderSurface } from "pixi.js";

import { BLOCK_SALT, CLOUD_CELLS, CLOUD_HIGH, CLOUD_LOW, CLOUD_OCTAVES, GRADIENT_MAP_CODES, LUMA_WEIGHTS, MIN_SOFTNESS, REVEAL_PATTERN_CODES, type RevealField } from "@/lib/studio/reveal-field";
import type { SceneBox, SceneField } from "@/lib/studio/scene/scene";

function float(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

const fragment = `#version 300 es
precision highp float;
precision highp int;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uMap;
uniform mat3 uToFrame;
uniform vec2 uFrameSize;
uniform float uPattern;
uniform float uMapKind;
uniform float uAngle;
uniform vec2 uOrigin;
uniform float uSize;
uniform float uReverse;
uniform float uProgress;
uniform float uSoftness;
uniform float uInverse;
uniform float uMapReady;

const float CLOUD_CELLS = ${float(CLOUD_CELLS)};
const int CLOUD_OCTAVES = ${CLOUD_OCTAVES};
const float CLOUD_LOW = ${float(CLOUD_LOW)};
const float CLOUD_HIGH = ${float(CLOUD_HIGH)};
const int BLOCK_SALT = ${BLOCK_SALT};
const float MIN_SOFTNESS = ${float(MIN_SOFTNESS)};
const vec3 LUMA = vec3(${LUMA_WEIGHTS.map(float).join(", ")});

uint mix32(uint h, uint v) {
  h = (h ^ v) * 0x85ebca6bu;
  h ^= h >> 13u;
  h *= 0xc2b2ae35u;
  return h ^ (h >> 16u);
}

float hash3(int a, int b, int c) {
  uint h = mix32(mix32(mix32(0x9e3779b9u, uint(a)), uint(b)), uint(c));
  return float(h >> 8u) / 16777216.0;
}

float unit(float value) {
  return clamp(value, 0.0, 1.0);
}

vec2 normalOf(float angle) {
  float r = radians(angle);
  return vec2(cos(r), sin(r));
}

float spanLow(vec2 n) {
  return min(0.0, uFrameSize.x * n.x) + min(0.0, uFrameSize.y * n.y);
}

float spanHigh(vec2 n) {
  return max(0.0, uFrameSize.x * n.x) + max(0.0, uFrameSize.y * n.y);
}

float reach(float origin, float size) {
  return max(origin, 1.0 - origin) * size;
}

float linearValue(vec2 px) {
  vec2 n = normalOf(uAngle);
  float low = spanLow(n);
  float high = spanHigh(n);
  return high > low ? unit((dot(px, n) - low) / (high - low)) : 0.0;
}

float radialValue(vec2 uv) {
  vec2 d = (uv - uOrigin) * uFrameSize;
  float far = length(vec2(reach(uOrigin.x, uFrameSize.x), reach(uOrigin.y, uFrameSize.y)));
  return far > 0.0 ? unit(length(d) / far) : 0.0;
}

float diamondValue(vec2 uv) {
  vec2 d = abs((uv - uOrigin) * uFrameSize);
  float far = reach(uOrigin.x, uFrameSize.x) + reach(uOrigin.y, uFrameSize.y);
  return far > 0.0 ? unit((d.x + d.y) / far) : 0.0;
}

float smoothed(float f) {
  return f * f * (3.0 - 2.0 * f);
}

float valueNoise(int octave, vec2 p) {
  vec2 cell = floor(p);
  vec2 f = p - cell;
  ivec2 c = ivec2(cell);
  float fx = smoothed(f.x);
  float fy = smoothed(f.y);
  float a = hash3(octave, c.x, c.y);
  float b = hash3(octave, c.x + 1, c.y);
  float d = hash3(octave, c.x, c.y + 1);
  float e = hash3(octave, c.x + 1, c.y + 1);
  float top = a + (b - a) * fx;
  float bottom = d + (e - d) * fx;
  return top + (bottom - top) * fy;
}

float cloudValue(vec2 uv) {
  float cell = min(uFrameSize.x, uFrameSize.y) / CLOUD_CELLS;
  if (cell <= 0.0) return 0.0;
  vec2 p = uv * uFrameSize / cell;
  float sum = 0.0;
  float total = 0.0;
  for (int octave = 0; octave < CLOUD_OCTAVES; octave++) {
    float weight = exp2(-float(octave));
    sum += weight * valueNoise(octave, p * exp2(float(octave)));
    total += weight;
  }
  return unit((sum / total - CLOUD_LOW) / (CLOUD_HIGH - CLOUD_LOW));
}

float blindsValue(vec2 px) {
  float band = uSize * min(uFrameSize.x, uFrameSize.y);
  if (band <= 0.0) return 0.0;
  vec2 n = normalOf(uAngle);
  float t = (dot(px, n) - spanLow(n)) / band;
  return t - floor(t);
}

float blocksValue(vec2 px) {
  float block = uSize * min(uFrameSize.x, uFrameSize.y);
  if (block <= 0.0) return 0.0;
  ivec2 c = ivec2(floor(px / block));
  return hash3(BLOCK_SALT, c.x, c.y);
}

float fanValue(vec2 uv) {
  vec2 d = (uv - uOrigin) * uFrameSize;
  float heading = degrees(atan(d.x, -d.y));
  float turn = mod(heading - uAngle + 540.0, 360.0) - 180.0;
  return abs(turn) / 180.0;
}

float imageValue(vec2 uv) {
  if (uMapReady < 0.5) return 1.0;
  vec4 m = texture(uMap, uv);
  vec3 c = m.a > 0.0 ? m.rgb / m.a : vec3(0.0);
  return unit(dot(c, LUMA));
}

float fieldValue(vec2 uv) {
  vec2 px = uv * uFrameSize;
  int pattern = int(uPattern + 0.5);
  if (pattern == ${REVEAL_PATTERN_CODES.gradient}) {
    int kind = int(uMapKind + 0.5);
    float v = kind == ${GRADIENT_MAP_CODES.linear} ? linearValue(px) : kind == ${GRADIENT_MAP_CODES.radial} ? radialValue(uv) : kind == ${GRADIENT_MAP_CODES.diamond} ? diamondValue(uv) : cloudValue(uv);
    return uReverse > 0.5 ? 1.0 - v : v;
  }
  if (pattern == ${REVEAL_PATTERN_CODES.image}) {
    float v = imageValue(uv);
    return uReverse > 0.5 && uMapReady > 0.5 ? 1.0 - v : v;
  }
  if (pattern == ${REVEAL_PATTERN_CODES.blinds}) return blindsValue(px);
  if (pattern == ${REVEAL_PATTERN_CODES.blocks}) return blocksValue(px);
  return fanValue(uv);
}

void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  vec2 uv = clamp((uToFrame * vec3(vTextureCoord, 1.0)).xy, 0.0, 1.0);
  float soft = max(uSoftness, MIN_SOFTNESS);
  float cover = unit((unit(uProgress) * (1.0 + soft) - fieldValue(uv)) / soft);
  finalColor = color * (uInverse > 0.5 ? 1.0 - cover : cover);
}
`;

let program: GlProgram | null = null;

function programOf(): GlProgram {
  program ??= GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-reveal-field" });
  return program;
}

interface FieldValues {
  uPattern: number;
  uMapKind: number;
  uAngle: number;
  uOrigin: [number, number];
  uSize: number;
  uReverse: number;
}

function fieldValues(field: RevealField): FieldValues {
  const base: FieldValues = { uPattern: REVEAL_PATTERN_CODES[field.pattern], uMapKind: 0, uAngle: 0, uOrigin: [0.5, 0.5], uSize: 0, uReverse: 0 };
  switch (field.pattern) {
    case "gradient":
      return { ...base, uMapKind: GRADIENT_MAP_CODES[field.map], uAngle: field.angle, uOrigin: [field.originX, field.originY], uReverse: field.reverse ? 1 : 0 };
    case "image":
      return { ...base, uReverse: field.reverse ? 1 : 0 };
    case "blinds":
      return { ...base, uAngle: field.angle, uSize: field.size };
    case "blocks":
      return { ...base, uSize: field.size };
    case "fan":
      return { ...base, uAngle: field.angle, uOrigin: [field.originX, field.originY] };
  }
}

class RevealFieldFilter extends Filter {
  private readonly values: UniformGroup;

  constructor(private readonly frame: Sprite) {
    const values = new UniformGroup({
      uToFrame: { value: new Matrix(), type: "mat3x3<f32>" },
      uFrameSize: { value: new Float32Array(2), type: "vec2<f32>" },
      uPattern: { value: 0, type: "f32" },
      uMapKind: { value: 0, type: "f32" },
      uAngle: { value: 0, type: "f32" },
      uOrigin: { value: new Float32Array([0.5, 0.5]), type: "vec2<f32>" },
      uSize: { value: 0, type: "f32" },
      uReverse: { value: 0, type: "f32" },
      uProgress: { value: 0, type: "f32" },
      uSoftness: { value: 0, type: "f32" },
      uInverse: { value: 0, type: "f32" },
      uMapReady: { value: 0, type: "f32" },
    });
    super({ glProgram: programOf(), resources: { revealUniforms: values, uMap: Texture.EMPTY.source, uMapSampler: Texture.EMPTY.source.style } });
    this.values = values;
  }

  set(shown: SceneField, inverse: boolean, box: SceneBox, map: Texture | null): void {
    const uniforms = this.values.uniforms as Record<string, unknown>;
    const field = fieldValues(shown.field);
    (uniforms.uFrameSize as Float32Array).set([Math.max(1, box.width), Math.max(1, box.height)]);
    (uniforms.uOrigin as Float32Array).set(field.uOrigin);
    Object.assign(uniforms, { uPattern: field.uPattern, uMapKind: field.uMapKind, uAngle: field.uAngle, uSize: field.uSize, uReverse: field.uReverse, uProgress: shown.progress, uSoftness: shown.softness, uInverse: inverse ? 1 : 0, uMapReady: map ? 1 : 0 });
    const source = (map ?? Texture.EMPTY).source;
    if (this.resources.uMap !== source) {
      this.resources.uMap = source;
      this.resources.uMapSampler = source.style;
    }
    this.values.update();
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    filterManager.calculateSpriteMatrix(this.values.uniforms.uToFrame as Matrix, this.frame);
    this.values.update();
    filterManager.applyFilter(this, input, output, clearMode);
  }
}

export class RevealFieldMask {
  private readonly frame = new Sprite(Texture.WHITE);
  private readonly filter: RevealFieldFilter;

  constructor() {
    this.frame.anchor.set(0.5);
    this.frame.renderable = false;
    this.filter = new RevealFieldFilter(this.frame);
  }

  update(field: SceneField, inverse: boolean, box: SceneBox, map: Texture | null, home: Container): Filter {
    if (this.frame.parent !== home) home.addChild(this.frame);
    this.frame.position.set(box.x, box.y);
    this.frame.angle = box.rotation;
    this.frame.setSize(Math.max(1, box.width), Math.max(1, box.height));
    this.filter.set(field, inverse, box, map);
    return this.filter;
  }

  destroy(): void {
    this.filter.destroy();
    this.frame.destroy();
  }
}
