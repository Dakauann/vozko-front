import { lookValue, unitRgb as rgb, type VfxLook } from "@/lib/studio/vfx";
import {
  barLayout,
  BULGE_DEPTH,
  centerOf,
  cornerPinInverse,
  directionalTaps,
  GLOW_GAIN,
  GLOW_HALF_TAPS,
  GLOW_WEIGHTS,
  glowStep,
  gradientPower,
  MAX_BLUR_TAPS,
  NOISE_CONTRAST,
  NOISE_TIME_CHANNELS,
  noiseTime,
  pinCorners,
  radians,
  reachRadius,
  SOUND_MIN_BAR_PX,
  spinTaps,
  waveShift,
  zoomTaps,
  type FrameSize,
} from "@/lib/studio/vfx-shapes";
import { SOUND_BAR_SLOTS, soundBars } from "@/lib/studio/vfx-sound";

export type Uniforms = Record<string, { value: unknown; type: string; size?: number }>;

export type Values = Record<string, unknown>;

export interface PackProgram {
  body: string;
  uniforms: () => Uniforms;
  values: (look: VfxLook, frame: FrameSize) => Values;
}

export const PACK_PRELUDE = `
uniform float uAmount;

const int MAX_TAPS = ${MAX_BLUR_TAPS};

vec2 framePx() {
  return frameUv() * uFrameSize;
}

vec2 pxUv(vec2 p) {
  return p / uFrameSize;
}

vec2 turned(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

void settle(vec4 source, vec4 result) {
  finalColor = mix(source, result, uMix * uAmount);
}
`;

function f32() {
  return { value: 0, type: "f32" };
}

function i32() {
  return { value: 2, type: "i32" };
}

function vec2() {
  return { value: new Float32Array(2), type: "vec2<f32>" };
}

function vec3() {
  return { value: new Float32Array(3), type: "vec3<f32>" };
}

function floats(size: number) {
  return { value: new Float32Array(size), type: "f32", size };
}

const BLUR_LOOP = `
  vec4 sum = vec4(0.0);
  for (int k = 0; k < MAX_TAPS; k++) {
    if (k >= uTaps) break;
    float t = float(k) / float(uTaps - 1);
    sum += sampleAt(pxUv(TAP_POSITION_AT_T));
  }
  settle(texture(uTexture, vTextureCoord), sum / float(uTaps));
`;

const directionalBlur: PackProgram = {
  body: `
uniform vec2 uDir;
uniform float uLength;
uniform int uTaps;

void main() {
  vec2 p = framePx();
${BLUR_LOOP.replace("TAP_POSITION_AT_T", "p + uDir * ((t - 0.5) * uLength)")}
}
`,
  uniforms: () => ({ uAmount: f32(), uDir: vec2(), uLength: f32(), uTaps: i32() }),
  values: (look) => {
    const turn = radians(lookValue(look, "angle"));
    return { uAmount: lookValue(look, "amount"), uDir: [Math.cos(turn), Math.sin(turn)], uLength: lookValue(look, "length"), uTaps: directionalTaps(look) };
  },
};

const zoomBlur: PackProgram = {
  body: `
uniform vec2 uCenter;
uniform float uLength;
uniform int uTaps;

void main() {
  vec2 p = framePx();
${BLUR_LOOP.replace("TAP_POSITION_AT_T", "p + (uCenter - p) * (uLength * t)")}
}
`,
  uniforms: () => ({ uAmount: f32(), uCenter: vec2(), uLength: f32(), uTaps: i32() }),
  values: (look, frame) => ({ uAmount: lookValue(look, "amount"), uCenter: centerOf(look, frame), uLength: lookValue(look, "length"), uTaps: zoomTaps(look, frame) }),
};

const spinBlur: PackProgram = {
  body: `
uniform vec2 uCenter;
uniform float uArc;
uniform int uTaps;

void main() {
  vec2 p = framePx();
${BLUR_LOOP.replace("TAP_POSITION_AT_T", "uCenter + turned(p - uCenter, (t - 0.5) * uArc)")}
}
`,
  uniforms: () => ({ uAmount: f32(), uCenter: vec2(), uArc: f32(), uTaps: i32() }),
  values: (look, frame) => ({ uAmount: lookValue(look, "amount"), uCenter: centerOf(look, frame), uArc: radians(lookValue(look, "angle")), uTaps: spinTaps(look, frame) }),
};

const GLOW_TAPS = GLOW_HALF_TAPS * 2 + 1;

export const GLOW_ACROSS_BODY = `
uniform float uThreshold;
uniform float uStep;
uniform float uWeights[${GLOW_TAPS}];

void main() {
  vec2 uv = frameUv();
  vec3 sum = vec3(0.0);
  for (int k = -${GLOW_HALF_TAPS}; k <= ${GLOW_HALF_TAPS}; k++) {
    vec4 s = sampleAt(uv + vec2(float(k) * uStep / uFrameSize.x, 0.0));
    vec3 bright = s.a > 0.0 ? max(s.rgb / s.a - uThreshold, 0.0) / max(1e-3, 1.0 - uThreshold) * s.a : vec3(0.0);
    sum += uWeights[k + ${GLOW_HALF_TAPS}] * bright;
  }
  finalColor = vec4(sum, 1.0);
}
`;

export function glowAcrossUniforms(): Uniforms {
  return { uThreshold: f32(), uStep: f32(), uWeights: { value: new Float32Array(GLOW_WEIGHTS), type: "f32", size: GLOW_TAPS } };
}

export function glowAcrossValues(look: VfxLook): Values {
  return { uThreshold: lookValue(look, "threshold"), uStep: glowStep(look) };
}

const glow: PackProgram = {
  body: `
uniform sampler2D uOriginal;
uniform float uStep;
uniform vec3 uTint;
uniform float uWeights[${GLOW_TAPS}];

void main() {
  vec4 source = texture(uOriginal, vTextureCoord);
  vec2 uv = frameUv();
  vec3 light = vec3(0.0);
  for (int k = -${GLOW_HALF_TAPS}; k <= ${GLOW_HALF_TAPS}; k++) {
    light += uWeights[k + ${GLOW_HALF_TAPS}] * sampleAt(uv + vec2(0.0, float(k) * uStep / uFrameSize.y)).rgb;
  }
  vec3 g = min(light * (uAmount * ${GLOW_GAIN.toFixed(1)}) * uTint, vec3(1.0));
  float lit = max(g.r, max(g.g, g.b));
  vec4 glowed = vec4(source.rgb + g - source.rgb * g, source.a + lit - source.a * lit);
  finalColor = mix(source, glowed, uMix);
}
`,
  uniforms: () => ({ uAmount: f32(), uStep: f32(), uTint: vec3(), uWeights: { value: new Float32Array(GLOW_WEIGHTS), type: "f32", size: GLOW_TAPS } }),
  values: (look) => ({ uAmount: lookValue(look, "amount"), uStep: glowStep(look), uTint: rgb(look.colors.color) }),
};

const mosaic: PackProgram = {
  body: `
uniform float uSize;

float cellCenter(float p, float extent) {
  return min(max((floor(p / uSize) + 0.5) * uSize, 0.5), max(0.5, extent - 0.5));
}

void main() {
  vec2 p = framePx();
  settle(texture(uTexture, vTextureCoord), sampleAt(pxUv(vec2(cellCenter(p.x, uFrameSize.x), cellCenter(p.y, uFrameSize.y)))));
}
`,
  uniforms: () => ({ uAmount: f32(), uSize: f32() }),
  values: (look) => ({ uAmount: lookValue(look, "amount"), uSize: lookValue(look, "size") }),
};

const posterize: PackProgram = {
  body: `
uniform float uLevels;

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec3 c = straight(source);
  vec3 q = min(vec3(1.0), floor(c * uLevels + 1e-4) / (uLevels - 1.0));
  finalColor = finish(source, mix(c, q, uAmount));
}
`,
  uniforms: () => ({ uAmount: f32(), uLevels: { value: 2, type: "f32" } }),
  values: (look) => ({ uAmount: lookValue(look, "amount"), uLevels: lookValue(look, "levels") }),
};

const mirror: PackProgram = {
  body: `
uniform vec2 uCenter;
uniform vec2 uNormal;

void main() {
  vec2 p = framePx();
  float d = dot(p - uCenter, uNormal);
  vec2 q = d > 0.0 ? p - 2.0 * d * uNormal : p;
  settle(texture(uTexture, vTextureCoord), sampleAt(pxUv(q)));
}
`,
  uniforms: () => ({ uAmount: f32(), uCenter: vec2(), uNormal: vec2() }),
  values: (look, frame) => {
    const turn = radians(lookValue(look, "angle"));
    return { uAmount: lookValue(look, "amount"), uCenter: centerOf(look, frame), uNormal: [Math.cos(turn), Math.sin(turn)] };
  },
};

const offset: PackProgram = {
  body: `
uniform vec2 uShift;

void main() {
  settle(texture(uTexture, vTextureCoord), sampleAt(fract(frameUv() - uShift)));
}
`,
  uniforms: () => ({ uAmount: f32(), uShift: vec2() }),
  values: (look) => ({ uAmount: lookValue(look, "amount"), uShift: [lookValue(look, "shiftX"), lookValue(look, "shiftY")] }),
};

const WAVE = `
uniform float uHeight;
uniform float uLength;
uniform float uShift;
uniform float uPhase;

float wave(float along) {
  return uHeight * sin(6.28318530718 * (along / uLength - uShift) + uPhase);
}
`;

function waveValues(look: VfxLook): Values {
  return { uAmount: lookValue(look, "amount"), uHeight: lookValue(look, "height"), uLength: lookValue(look, "length"), uShift: waveShift(look), uPhase: radians(lookValue(look, "phase")) };
}

function waveUniforms(): Uniforms {
  return { uAmount: f32(), uHeight: f32(), uLength: { value: 1, type: "f32" }, uShift: f32(), uPhase: f32() };
}

const waveWarp: PackProgram = {
  body: `${WAVE}
uniform vec2 uDir;

void main() {
  vec2 p = framePx();
  float s = wave(dot(p, uDir));
  settle(texture(uTexture, vTextureCoord), sampleAt(pxUv(p + vec2(uDir.y * s, -uDir.x * s))));
}
`,
  uniforms: () => ({ ...waveUniforms(), uDir: vec2() }),
  values: (look) => {
    const turn = radians(lookValue(look, "angle"));
    return { ...waveValues(look), uDir: [Math.cos(turn), Math.sin(turn)] };
  },
};

const RADIAL = `
uniform vec2 uCenter;
uniform float uRadius;
`;

function radialValues(look: VfxLook, frame: FrameSize): Values {
  return { uAmount: lookValue(look, "amount"), uCenter: centerOf(look, frame), uRadius: reachRadius(look, frame) };
}

const ripple: PackProgram = {
  body: `${WAVE}${RADIAL}
void main() {
  vec2 p = framePx();
  vec2 v = p - uCenter;
  float r = length(v);
  vec2 q = p;
  if (r >= 1e-6) {
    float t = uRadius > 0.0 ? min(1.0, r / uRadius) : 1.0;
    float fall = uRadius > 0.0 ? 1.0 - t * t * (3.0 - 2.0 * t) : 0.0;
    q = p - v / r * (wave(r) * fall);
  }
  settle(texture(uTexture, vTextureCoord), sampleAt(pxUv(q)));
}
`,
  uniforms: () => ({ ...waveUniforms(), uCenter: vec2(), uRadius: f32() }),
  values: (look, frame) => ({ ...waveValues(look), ...radialValues(look, frame) }),
};

const twirl: PackProgram = {
  body: `${RADIAL}
uniform float uTurn;

void main() {
  vec2 p = framePx();
  vec2 v = p - uCenter;
  float r = length(v);
  float t = 1.0 - r / max(uRadius, 1e-6);
  float turn = uRadius > 0.0 && r < uRadius ? uTurn * t * t : 0.0;
  settle(texture(uTexture, vTextureCoord), sampleAt(pxUv(uCenter + turned(v, turn))));
}
`,
  uniforms: () => ({ uAmount: f32(), uCenter: vec2(), uRadius: f32(), uTurn: f32() }),
  values: (look, frame) => ({ ...radialValues(look, frame), uTurn: radians(lookValue(look, "angle")) }),
};

const bulge: PackProgram = {
  body: `${RADIAL}
uniform float uHeight;

void main() {
  vec2 p = framePx();
  vec2 v = p - uCenter;
  float r = length(v);
  float t = r / max(uRadius, 1e-6);
  float k = 1.0 - t * t;
  float s = uRadius > 0.0 && r < uRadius ? 1.0 - uHeight * k * k * ${BULGE_DEPTH.toFixed(2)} : 1.0;
  settle(texture(uTexture, vTextureCoord), sampleAt(pxUv(uCenter + v * s)));
}
`,
  uniforms: () => ({ uAmount: f32(), uCenter: vec2(), uRadius: f32(), uHeight: f32() }),
  values: (look, frame) => ({ ...radialValues(look, frame), uHeight: lookValue(look, "height") }),
};

const cornerPin: PackProgram = {
  body: `
uniform float uPin[9];
uniform float uPinValid;

void main() {
  vec2 uv = frameUv();
  vec4 result = vec4(0.0);
  float w = uPin[6] * uv.x + uPin[7] * uv.y + uPin[8];
  if (uPinValid > 0.5 && w > 0.0) {
    vec2 s = vec2(uPin[0] * uv.x + uPin[1] * uv.y + uPin[2], uPin[3] * uv.x + uPin[4] * uv.y + uPin[5]) / w;
    if (s.x >= 0.0 && s.x <= 1.0 && s.y >= 0.0 && s.y <= 1.0) result = sampleAt(s);
  }
  settle(texture(uTexture, vTextureCoord), result);
}
`,
  uniforms: () => ({ uAmount: f32(), uPin: floats(9), uPinValid: f32() }),
  values: (look) => {
    const inverse = cornerPinInverse(look);
    return { uAmount: lookValue(look, "amount"), uPin: inverse ?? new Array(9).fill(0), uPinValid: inverse ? 1 : 0 };
  },
};

const GENERATED = `
vec3 painted(vec4 source, vec3 generated) {
  return mix(straight(source), generated, uAmount);
}
`;

const fractalNoise: PackProgram = {
  body: `${GENERATED}
uniform float uSize;
uniform float uComplexity;
uniform float uContrast;
uniform float uBrightness;
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;

float corner(int x, int y, int z, int octave) {
  return hash4(seed(), x, y, z * ${NOISE_TIME_CHANNELS} + octave);
}

float valueNoise(int octave, vec3 q) {
  vec3 i = floor(q);
  vec3 f = q - i;
  f = f * f * (3.0 - 2.0 * f);
  int x = int(i.x);
  int y = int(i.y);
  int z = int(i.z);
  float near = mix(mix(corner(x, y, z, octave), corner(x + 1, y, z, octave), f.x), mix(corner(x, y + 1, z, octave), corner(x + 1, y + 1, z, octave), f.x), f.y);
  float far = mix(mix(corner(x, y, z + 1, octave), corner(x + 1, y, z + 1, octave), f.x), mix(corner(x, y + 1, z + 1, octave), corner(x + 1, y + 1, z + 1, octave), f.x), f.y);
  return mix(near, far, f.z);
}

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec2 p = framePx();
  int octaves = int(ceil(uComplexity));
  float sum = 0.0;
  float total = 0.0;
  float amp = 1.0;
  float scale = 1.0 / uSize;
  for (int octave = 0; octave < 8; octave++) {
    if (octave >= octaves) break;
    float weight = min(1.0, uComplexity - float(octave)) * amp;
    sum += valueNoise(octave, vec3(p * scale, uTime)) * weight;
    total += weight;
    amp *= 0.5;
    scale *= 2.0;
  }
  float v = clamp((sum / total - 0.5) * uContrast * ${NOISE_CONTRAST.toFixed(1)} + 0.5 + uBrightness, 0.0, 1.0);
  finalColor = finish(source, painted(source, mix(uColorA, uColorB, v)));
}
`,
  uniforms: () => ({ uAmount: f32(), uSize: { value: 1, type: "f32" }, uComplexity: { value: 1, type: "f32" }, uContrast: f32(), uBrightness: f32(), uTime: f32(), uColorA: vec3(), uColorB: vec3() }),
  values: (look) => ({
    uAmount: lookValue(look, "amount"),
    uSize: lookValue(look, "size"),
    uComplexity: lookValue(look, "complexity"),
    uContrast: lookValue(look, "contrast"),
    uBrightness: lookValue(look, "brightness"),
    uTime: noiseTime(look),
    uColorA: rgb(look.colors.color),
    uColorB: rgb(look.colors.color2),
  }),
};

const gradientRamp: PackProgram = {
  body: `${GENERATED}
uniform vec2 uStart;
uniform vec2 uEnd;
uniform float uRadial;
uniform vec3 uColorA;
uniform vec3 uColorB;

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec2 p = framePx();
  vec2 e = uEnd - uStart;
  float span = max(dot(e, e), 1e-6);
  float linear = dot(p - uStart, e) / span;
  float circular = length(p - uStart) / sqrt(span);
  float t = clamp(linear + (circular - linear) * uRadial, 0.0, 1.0);
  finalColor = finish(source, painted(source, mix(uColorA, uColorB, t)));
}
`,
  uniforms: () => ({ uAmount: f32(), uStart: vec2(), uEnd: vec2(), uRadial: f32(), uColorA: vec3(), uColorB: vec3() }),
  values: (look, frame) => ({
    uAmount: lookValue(look, "amount"),
    uStart: [lookValue(look, "x") * frame.width, lookValue(look, "y") * frame.height],
    uEnd: [lookValue(look, "toX") * frame.width, lookValue(look, "toY") * frame.height],
    uRadial: lookValue(look, "radial"),
    uColorA: rgb(look.colors.color),
    uColorB: rgb(look.colors.color2),
  }),
};

const fourColorGradient: PackProgram = {
  body: `${GENERATED}
uniform float uPoints[8];
uniform float uColors[12];
uniform float uPower;
uniform float uDiagonal;

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec2 p = framePx();
  vec3 color = vec3(0.0);
  float total = 0.0;
  for (int k = 0; k < 4; k++) {
    float w = pow(max(length(p - vec2(uPoints[k * 2], uPoints[k * 2 + 1])) / uDiagonal, 1e-3), -uPower);
    color += w * vec3(uColors[k * 3], uColors[k * 3 + 1], uColors[k * 3 + 2]);
    total += w;
  }
  finalColor = finish(source, painted(source, color / total));
}
`,
  uniforms: () => ({ uAmount: f32(), uPoints: floats(8), uColors: floats(12), uPower: { value: 1, type: "f32" }, uDiagonal: { value: 1, type: "f32" } }),
  values: (look, frame) => ({
    uAmount: lookValue(look, "amount"),
    uPoints: pinCorners(look).flatMap(([x, y]) => [x * frame.width, y * frame.height]),
    uColors: [look.colors.color, look.colors.color2, look.colors.color3, look.colors.color4].flatMap((color) => rgb(color)),
    uPower: gradientPower(look),
    uDiagonal: Math.hypot(frame.width, frame.height),
  }),
};

const SOUND_BODY = `
uniform vec4 uBars[${SOUND_BAR_SLOTS / 4}];
uniform float uCount;
uniform float uLeft;
uniform float uSlot;
uniform float uBarWidth;
uniform float uBaseline;
uniform float uReach;
uniform float uRadius;
uniform float uCentered;
uniform vec3 uColorA;
uniform vec3 uColorB;

float barValue(int i) {
  vec4 group = uBars[i / 4];
  int k = i - (i / 4) * 4;
  return k == 0 ? group.x : k == 1 ? group.y : k == 2 ? group.z : group.w;
}

float roundRect(vec2 q, vec2 half_, float radius) {
  float r = min(radius, min(half_.x, half_.y));
  vec2 d = abs(q) - half_ + r;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r;
}

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  vec2 p = framePx();
  int i = uSlot > 0.0 ? int(floor((p.x - uLeft) / uSlot)) : -1;
  if (i < 0 || i >= int(uCount)) {
    finalColor = source;
    return;
  }
  float h = max(${SOUND_MIN_BAR_PX.toFixed(1)}, barValue(i) * uReach);
  float cx = uLeft + (float(i) + 0.5) * uSlot;
  float cy = uCentered > 0.5 ? uBaseline : uBaseline - h * 0.5;
  float cover = clamp(0.5 - roundRect(p - vec2(cx, cy), vec2(uBarWidth * 0.5, h * 0.5), uRadius), 0.0, 1.0);
  float rise = uCentered > 0.5 ? abs(p.y - uBaseline) * 2.0 : uBaseline - p.y;
  float a = cover * uAmount;
  vec3 color = mix(uColorA, uColorB, clamp(rise / max(uReach, 1.0), 0.0, 1.0));
  finalColor = mix(source, vec4(color * a + source.rgb * (1.0 - a), a + source.a * (1.0 - a)), uMix);
}
`;

function soundProgram(): PackProgram {
  return {
    body: SOUND_BODY,
    uniforms: () => ({
      uAmount: f32(),
      uBars: { value: new Float32Array(SOUND_BAR_SLOTS), type: "vec4<f32>", size: SOUND_BAR_SLOTS / 4 },
      uCount: f32(),
      uLeft: f32(),
      uSlot: f32(),
      uBarWidth: f32(),
      uBaseline: f32(),
      uReach: f32(),
      uRadius: f32(),
      uCentered: f32(),
      uColorA: vec3(),
      uColorB: vec3(),
    }),
    values: (look, frame) => {
      const bars = soundBars(look);
      const layout = barLayout(look, frame, bars.length);
      const slots = new Float32Array(SOUND_BAR_SLOTS);
      slots.set(bars);
      return {
        uAmount: lookValue(look, "amount"),
        uBars: slots,
        uCount: bars.length,
        uLeft: layout.left,
        uSlot: layout.slot,
        uBarWidth: layout.barWidth,
        uBaseline: layout.baseline,
        uReach: layout.reach,
        uRadius: layout.radius,
        uCentered: layout.centered ? 1 : 0,
        uColorA: rgb(look.colors.color),
        uColorB: rgb(look.colors.color2),
      };
    },
  };
}

export const PACK_PROGRAMS = {
  glow,
  mosaic,
  posterize,
  mirror,
  offset,
  directionalBlur,
  zoomBlur,
  spinBlur,
  waveWarp,
  ripple,
  twirl,
  bulge,
  cornerPin,
  fractalNoise,
  gradientRamp,
  fourColorGradient,
  audioSpectrum: soundProgram(),
  audioWaveform: soundProgram(),
} satisfies Record<string, PackProgram>;

export type PackKind = keyof typeof PACK_PROGRAMS;
