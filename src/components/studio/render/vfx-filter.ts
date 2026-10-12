import { Container, defaultFilterVert, Filter, GlProgram, Matrix, Sprite, Texture, TexturePool, UniformGroup, type FilterSystem, type RenderSurface } from "pixi.js";

import type { SceneBox } from "@/lib/studio/scene/scene";
import {
  CHROMATIC_REACH,
  flareFlicker,
  flareGhosts,
  FLARE_GHOSTS,
  glitchBurst,
  grainFrame,
  isDrawnLook,
  leakBlobs,
  LEAK_BLOBS,
  lookValue,
  shakeAt,
  shakeCover,
  unitRgb as rgb,
  type DrawnLook,
  type DrawnVfxKind,
  type VfxLook,
} from "@/lib/studio/vfx";
import { lookReach, radians } from "@/lib/studio/vfx-shapes";

import { GLOW_ACROSS_BODY, glowAcrossUniforms, glowAcrossValues, PACK_PRELUDE, PACK_PROGRAMS, type PackKind, type Uniforms, type Values } from "./vfx-pack-programs";

type OriginalKind = Exclude<DrawnVfxKind, PackKind>;

function isPackKind(kind: DrawnVfxKind): kind is PackKind {
  return kind in PACK_PROGRAMS;
}

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform mat3 uToFrame;
uniform mat3 uFromFrame;
uniform vec2 uFrameSize;
uniform float uMix;
uniform float uSeed;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

uint mix32(uint h, uint v) {
  h = (h ^ v) * 0x85ebca6bu;
  h ^= h >> 13u;
  h *= 0xc2b2ae35u;
  return h ^ (h >> 16u);
}

float hash4(int a, int b, int c, int d) {
  uint h = mix32(mix32(mix32(mix32(0x9e3779b9u, uint(a)), uint(b)), uint(c)), uint(d));
  return float(h >> 8u) / 16777216.0;
}

int seed() {
  return int(uSeed);
}

vec2 frameUv() {
  return (uToFrame * vec3(vTextureCoord, 1.0)).xy;
}

vec4 sampleAt(vec2 uv) {
  vec2 coord = (uFromFrame * vec3(uv, 1.0)).xy;
  return texture(uTexture, clamp(coord, uInputClamp.xy, uInputClamp.zw));
}

vec3 straight(vec4 c) {
  return c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
}

vec4 finish(vec4 source, vec3 color) {
  return vec4(mix(straight(source), clamp(color, 0.0, 1.0), uMix) * source.a, source.a);
}

vec3 screen(vec3 base, vec3 light) {
  return 1.0 - (1.0 - base) * (1.0 - clamp(light, 0.0, 1.0));
}
`;

const BODIES: Record<OriginalKind, string> = {
  grain: `
uniform float uAmount;
uniform float uSize;
uniform float uFrame;
uniform float uChroma;

float tri(int x, int y, int channel) {
  int key = int(uFrame) * 3 + channel;
  return hash4(seed(), x, y, key) + hash4(seed() + 7919, x, y, key) - 1.0;
}

float grainAt(vec2 p, int channel) {
  vec2 cell = floor(p);
  vec2 f = p - cell;
  f = f * f * (3.0 - 2.0 * f);
  int x = int(cell.x);
  int y = int(cell.y);
  return mix(mix(tri(x, y, channel), tri(x + 1, y, channel), f.x), mix(tri(x, y + 1, channel), tri(x + 1, y + 1, channel), f.x), f.y);
}

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec3 c = straight(source);
  vec2 p = frameUv() * uFrameSize / uSize;
  float mono = grainAt(p, 0);
  vec3 n = uChroma > 0.0 ? mix(vec3(mono), vec3(mono, grainAt(p, 1), grainAt(p, 2)), uChroma) : vec3(mono);
  float l = dot(c, LUMA);
  float response = 0.35 + 2.6 * l * (1.0 - l);
  finalColor = finish(source, c + n * uAmount * 0.35 * response);
}
`,
  lightLeak: `
uniform float uAmount;
uniform float uBlobs[${LEAK_BLOBS * 5}];
uniform vec3 uColorA;
uniform vec3 uColorB;

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec2 p = frameUv() * uFrameSize;
  vec3 light = vec3(0.0);
  for (int i = 0; i < ${LEAK_BLOBS}; i++) {
    float d = distance(p, vec2(uBlobs[i * 5], uBlobs[i * 5 + 1])) / max(uBlobs[i * 5 + 2], 1.0);
    light += mix(uColorA, uColorB, uBlobs[i * 5 + 3]) * exp(-d * d * 2.2) * uBlobs[i * 5 + 4];
  }
  light = 1.0 - exp(-light * 1.4);
  finalColor = finish(source, screen(straight(source), light * uAmount));
}
`,
  glitch: `
uniform float uAmount;
uniform float uStrength;
uniform float uSlot;
uniform float uSplit;
uniform float uBand;
uniform float uScanlines;

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  vec2 uv = frameUv();
  vec2 p = uv * uFrameSize;
  int slot = int(uSlot);
  float bandHeight = max(1.0, uBand * uFrameSize.y);
  int band = int(floor(p.y / bandHeight));
  int block = int(floor(p.y / (bandHeight * 3.7)));
  float shift = 0.0;
  if (uStrength > 0.0) {
    if (hash4(seed(), band, slot, 11) < 0.3 + 0.4 * uAmount) shift += (hash4(seed(), band, slot, 12) - 0.5) * 0.24 * uAmount * uFrameSize.x * uStrength;
    if (hash4(seed(), block, slot, 13) < 0.15 * uAmount) shift += (hash4(seed(), block, slot, 14) - 0.5) * 0.25 * uAmount * uFrameSize.x * uStrength;
  }
  vec2 base = uv + vec2(shift / uFrameSize.x, 0.0);
  vec2 offset = vec2(uSplit * (0.25 + 0.75 * uStrength) / uFrameSize.x, 0.0);
  vec4 r = sampleAt(base + offset);
  vec4 g = sampleAt(base);
  vec4 b = sampleAt(base - offset);
  float line = 0.5 + 0.5 * cos(p.y * 2.0943951);
  vec4 glitched = vec4(vec3(r.r, g.g, b.b) * (1.0 - uScanlines * 0.3 * line), max(g.a, max(r.a, b.a)));
  finalColor = mix(source, glitched, uMix);
}
`,
  particles: `
uniform float uAmount;
uniform float uCount;
uniform float uSize;
uniform float uSpeed;
uniform float uAngle;
uniform float uSoftness;
uniform float uTwinkle;
uniform float uTime;
uniform vec3 uColor;

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec2 p = frameUv() * uFrameSize;
  vec2 dir = vec2(cos(uAngle), sin(uAngle));
  float area = uFrameSize.x * uFrameSize.y;
  float cover = 0.0;
  for (int layer = 0; layer < 3; layer++) {
    float depth = float(layer);
    float cellSize = sqrt(area / max(1.0, uCount / 3.0)) * (0.8 + 0.25 * depth);
    float radius = min(uSize * (0.6 + 0.3 * depth), cellSize * 0.45);
    vec2 q = p - dir * uSpeed * uFrameSize.y * 0.12 * (0.6 + 0.4 * depth) * uTime;
    vec2 cell = floor(q / cellSize);
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 id = cell + vec2(float(i), float(j));
        int ix = int(id.x);
        int iy = int(id.y);
        float h1 = hash4(seed(), ix, iy, layer * 8 + 1);
        float h2 = hash4(seed(), ix, iy, layer * 8 + 2);
        float h3 = hash4(seed(), ix, iy, layer * 8 + 3);
        float phase = h3 * 6.2831853;
        vec2 wobble = vec2(sin(uTime * (0.7 + h1) + phase), cos(uTime * (0.9 + h2) + phase)) * cellSize * 0.06;
        vec2 center = (id + vec2(h1, h2) * 0.5 + 0.25) * cellSize + wobble;
        float d = length(q - center);
        float edge = radius * (1.0 - uSoftness * 0.9);
        float a = 1.0 - smoothstep(edge, radius + 0.75, d);
        float twinkle = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (2.0 + 3.0 * h3) + phase * 3.0));
        cover = max(cover, a * twinkle * (0.55 + 0.225 * depth));
      }
    }
  }
  vec3 c = straight(source);
  finalColor = finish(source, mix(c, uColor, cover * uAmount));
}
`,
  lensFlare: `
uniform float uAmount;
uniform vec2 uSource;
uniform float uSize;
uniform float uGhosts;
uniform float uStreak;
uniform vec3 uColor;
uniform float uGhost[${FLARE_GHOSTS * 4}];

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec2 p = frameUv() * uFrameSize;
  float m = min(uFrameSize.x, uFrameSize.y);
  float reach = m * uSize;
  float d = distance(p, uSource) / reach;
  float ring = (d - 0.32) * 18.0;
  vec3 light = uColor * (exp(-d * 18.0) * 1.2 + exp(-d * 4.0) * 0.35 + exp(-ring * ring) * 0.12);
  vec2 axis = uFrameSize * 0.5 - uSource;
  for (int i = 0; i < ${FLARE_GHOSTS}; i++) {
    vec2 at = uSource + axis * (1.0 + uGhost[i * 4]);
    float gd = distance(p, at) / max(uGhost[i * 4 + 1] * reach, 1.0);
    float disk = (1.0 - smoothstep(0.7, 1.0, gd)) * (0.6 + 0.4 * gd);
    vec3 hue = mix(uColor, uColor.bgr * vec3(0.6, 0.9, 1.2), uGhost[i * 4 + 3]);
    light += hue * disk * uGhost[i * 4 + 2] * 0.25 * uGhosts;
  }
  float across = abs(p.x - uSource.x) / reach;
  float down = abs(p.y - uSource.y) / m;
  light += uColor * exp(-down * 140.0) * exp(-across * 1.6) * 0.8 * uStreak;
  finalColor = finish(source, screen(straight(source), light * uAmount));
}
`,
  shake: `
uniform vec2 uOffset;
uniform float uTurn;
uniform float uZoom;

void main() {
  vec2 p = frameUv() * uFrameSize - uFrameSize * 0.5 - uOffset;
  float c = cos(-uTurn);
  float s = sin(-uTurn);
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y) / uZoom;
  finalColor = sampleAt((q + uFrameSize * 0.5) / uFrameSize);
}
`,
  vignette: `
uniform float uAmount;
uniform float uSize;
uniform float uSoftness;
uniform float uRoundness;
uniform vec3 uColor;

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec2 uv = frameUv();
  float shortSide = min(uFrameSize.x, uFrameSize.y);
  vec2 q = (uv - 0.5) * 2.0 * (1.0 + uRoundness * (uFrameSize / shortSide - 1.0));
  float weight = smoothstep(uSize, uSize + uSoftness, length(q) / 1.41421356);
  finalColor = finish(source, mix(straight(source), uColor, weight * uAmount));
}
`,
  chromaticAberration: `
uniform float uShift;
uniform float uRadial;
uniform float uTurn;

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  vec2 uv = frameUv();
  vec2 p = uv * uFrameSize;
  float shortSide = min(uFrameSize.x, uFrameSize.y);
  vec2 dir = mix(vec2(cos(uTurn), sin(uTurn)), (p - uFrameSize * 0.5) / (shortSide * 0.5), uRadial);
  vec2 offset = dir * uShift / uFrameSize;
  vec4 r = sampleAt(uv + offset);
  vec4 g = sampleAt(uv);
  vec4 b = sampleAt(uv - offset);
  finalColor = mix(source, vec4(r.r, g.g, b.b, max(g.a, max(r.a, b.a))), uMix);
}
`,
};

const OWN_UNIFORMS: Record<OriginalKind, () => Uniforms> = {
  grain: () => ({ uAmount: f32(), uSize: f32(), uFrame: f32(), uChroma: f32() }),
  lightLeak: () => ({ uAmount: f32(), uBlobs: { value: new Float32Array(LEAK_BLOBS * 5), type: "f32", size: LEAK_BLOBS * 5 }, uColorA: vec3(), uColorB: vec3() }),
  glitch: () => ({ uAmount: f32(), uStrength: f32(), uSlot: f32(), uSplit: f32(), uBand: f32(), uScanlines: f32() }),
  particles: () => ({ uAmount: f32(), uCount: f32(), uSize: f32(), uSpeed: f32(), uAngle: f32(), uSoftness: f32(), uTwinkle: f32(), uTime: f32(), uColor: vec3() }),
  lensFlare: () => ({ uAmount: f32(), uSource: { value: new Float32Array(2), type: "vec2<f32>" }, uSize: f32(), uGhosts: f32(), uStreak: f32(), uColor: vec3(), uGhost: { value: new Float32Array(FLARE_GHOSTS * 4), type: "f32", size: FLARE_GHOSTS * 4 } }),
  shake: () => ({ uOffset: { value: new Float32Array(2), type: "vec2<f32>" }, uTurn: f32(), uZoom: { value: 1, type: "f32" } }),
  vignette: () => ({ uAmount: f32(), uSize: f32(), uSoftness: f32(), uRoundness: f32(), uColor: vec3() }),
  chromaticAberration: () => ({ uShift: f32(), uRadial: f32(), uTurn: f32() }),
};

function f32() {
  return { value: 0, type: "f32" };
}

function vec3() {
  return { value: new Float32Array(3), type: "vec3<f32>" };
}

const programs = new Map<string, GlProgram>();

function compiled(name: string, body: string): GlProgram {
  const known = programs.get(name);
  if (known) return known;
  const program = GlProgram.from({ vertex: defaultFilterVert, fragment: PRELUDE + body, name: `studio-vfx-${name}` });
  programs.set(name, program);
  return program;
}

function programOf(kind: DrawnVfxKind): GlProgram {
  return compiled(kind, isPackKind(kind) ? PACK_PRELUDE + PACK_PROGRAMS[kind].body : BODIES[kind]);
}

function uniformsOf(kind: DrawnVfxKind): Uniforms {
  return isPackKind(kind) ? PACK_PROGRAMS[kind].uniforms() : OWN_UNIFORMS[kind]();
}

export interface VfxPlacement {
  width: number;
  height: number;
  mix: number;
  screenScale: number;
  adjusts: boolean;
}

function valuesOf(look: DrawnLook, at: VfxPlacement): Values {
  return isPackKind(look.kind) ? PACK_PROGRAMS[look.kind].values(look, at) : ownValues({ ...look, kind: look.kind }, at);
}

function ownValues(look: VfxLook & { kind: OriginalKind }, at: VfxPlacement): Values {
  const v = (name: Parameters<typeof lookValue>[1]) => lookValue(look, name);
  switch (look.kind) {
    case "grain":
      return { uAmount: v("amount"), uSize: v("size"), uFrame: grainFrame(look), uChroma: v("chroma") };
    case "lightLeak":
      return { uAmount: v("amount"), uBlobs: leakBlobs(look, at.width, at.height).flatMap((blob) => [blob.x, blob.y, blob.radius, blob.tone, blob.weight]), uColorA: rgb(look.colors.color), uColorB: rgb(look.colors.color2) };
    case "glitch": {
      const burst = glitchBurst(look);
      return { uAmount: v("amount"), uStrength: burst.strength, uSlot: burst.slot, uSplit: v("split"), uBand: v("size"), uScanlines: v("scanlines") };
    }
    case "particles":
      return { uAmount: v("amount"), uCount: v("count"), uSize: v("size"), uSpeed: v("speed"), uAngle: radians(v("angle")), uSoftness: v("softness"), uTwinkle: v("twinkle"), uTime: look.timeMs / 1000, uColor: rgb(look.colors.color) };
    case "lensFlare":
      return {
        uAmount: v("amount") * flareFlicker(look),
        uSource: [v("x") * at.width, v("y") * at.height],
        uSize: v("size"),
        uGhosts: v("ghosts"),
        uStreak: v("streak"),
        uColor: rgb(look.colors.color),
        uGhost: flareGhosts(look).flatMap((ghost) => [ghost.along, ghost.radius, ghost.strength, ghost.tint]),
      };
    case "shake": {
      const offset = shakeAt(look, at.width, at.height);
      const zoom = shakeCover(look, at.width, at.height);
      return { uOffset: [offset.dx * at.mix, offset.dy * at.mix], uTurn: radians(offset.rotation * at.mix), uZoom: 1 + (zoom - 1) * at.mix };
    }
    case "vignette":
      return { uAmount: v("amount"), uSize: v("size"), uSoftness: v("softness"), uRoundness: v("roundness"), uColor: rgb(look.colors.color) };
    case "chromaticAberration":
      return { uShift: v("amount") * CHROMATIC_REACH, uRadial: v("radial"), uTurn: radians(v("angle")) };
  }
}

function assign(group: UniformGroup, values: Values): void {
  const uniforms = group.uniforms as Values;
  for (const [name, value] of Object.entries(values)) {
    const slot = uniforms[name];
    if (slot instanceof Float32Array) slot.set(value as number[]);
    else uniforms[name] = value;
  }
  group.update();
}

class GlowAcross extends Filter {
  readonly own: UniformGroup;

  constructor(base: UniformGroup) {
    const own = new UniformGroup(glowAcrossUniforms() as never);
    super({ glProgram: compiled("glowAcross", PACK_PRELUDE + GLOW_ACROSS_BODY), resources: { vfxFrame: base, vfxOwn: own } });
    this.own = own;
  }
}

export class VfxFilter extends Filter {
  private readonly base: UniformGroup;
  private readonly own: UniformGroup;
  private readonly across: GlowAcross | null;

  constructor(
    readonly kind: DrawnVfxKind,
    private readonly frame: Sprite,
  ) {
    const base = new UniformGroup({
      uToFrame: { value: new Matrix(), type: "mat3x3<f32>" },
      uFromFrame: { value: new Matrix(), type: "mat3x3<f32>" },
      uFrameSize: { value: new Float32Array(2), type: "vec2<f32>" },
      uMix: { value: 1, type: "f32" },
      uSeed: { value: 0, type: "f32" },
    });
    const own = new UniformGroup(uniformsOf(kind) as never);
    const extra = kind === "glow" ? { uOriginal: Texture.EMPTY.source, uOriginalSampler: Texture.EMPTY.source.style } : {};
    super({ glProgram: programOf(kind), resources: { vfxFrame: base, vfxOwn: own, ...extra } });
    this.base = base;
    this.own = own;
    this.across = kind === "glow" ? new GlowAcross(base) : null;
  }

  set(look: DrawnLook, at: VfxPlacement): void {
    assign(this.base, { uFrameSize: [at.width, at.height], uMix: at.mix, uSeed: look.seed });
    assign(this.own, valuesOf(look, at));
    if (this.across) assign(this.across.own, glowAcrossValues(look));
    this.padding = at.adjusts ? 0 : Math.ceil(lookReach(look, at) * at.screenScale);
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const uniforms = this.base.uniforms as { uToFrame: Matrix; uFromFrame: Matrix };
    filterManager.calculateSpriteMatrix(uniforms.uToFrame, this.frame);
    uniforms.uFromFrame.copyFrom(uniforms.uToFrame).invert();
    this.base.update();
    if (!this.across) {
      filterManager.applyFilter(this, input, output, clearMode);
      return;
    }
    const light = TexturePool.getSameSizeTexture(input);
    filterManager.applyFilter(this.across, input, light, true);
    this.resources.uOriginal = input.source;
    this.resources.uOriginalSampler = input.source.style;
    filterManager.applyFilter(this, light, output, clearMode);
    TexturePool.returnTexture(light);
  }

  override destroy(): void {
    this.across?.destroy();
    super.destroy();
  }
}

export class VfxStack {
  private readonly frame = new Sprite(Texture.WHITE);
  private filters: VfxFilter[] = [];

  constructor() {
    this.frame.anchor.set(0.5);
    this.frame.renderable = false;
  }

  update(looks: readonly VfxLook[], box: SceneBox, home: Container, at: Omit<VfxPlacement, "width" | "height">): Filter[] {
    if (this.frame.parent !== home) home.addChild(this.frame);
    this.frame.position.set(box.x, box.y);
    this.frame.angle = box.rotation;
    this.frame.setSize(Math.max(1, box.width), Math.max(1, box.height));
    this.filters = looks.filter(isDrawnLook).map((look, i) => {
      const known = this.filters[i];
      const filter = known?.kind === look.kind ? known : new VfxFilter(look.kind, this.frame);
      if (filter !== known) known?.destroy();
      filter.set(look, { ...at, width: box.width, height: box.height });
      return filter;
    });
    return this.filters;
  }

  destroy(): void {
    for (const filter of this.filters) filter.destroy();
    this.filters = [];
    this.frame.destroy();
  }
}
