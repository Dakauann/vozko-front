import { defaultFilterVert, Filter, GlProgram, UniformGroup } from "pixi.js";

import type { GradeUniforms } from "@/lib/studio/color-grade";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uGain;
uniform vec3 uBalance;
uniform float uContrast;
uniform vec4 uTone;
uniform vec2 uSaturation;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 toDisplay(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec3 c = source.rgb / source.a;
  c = toDisplay(clamp(toLinear(c) * uGain * uBalance, 0.0, 1.0));
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  float l = dot(c, LUMA);
  float dark = 1.0 - l;
  float toned = clamp(l + uTone.x * l * dark * dark + uTone.y * l * l * dark + uTone.z * dark * dark * dark + uTone.w * l * l * l, 0.0, 1.0);
  c = l > 0.0001 ? clamp(c * (toned / l), 0.0, 1.0) : clamp(c + (toned - l), 0.0, 1.0);
  float middle = dot(c, LUMA);
  float spread = max(max(c.r, c.g), c.b) - min(min(c.r, c.g), c.b);
  float saturation = uSaturation.x * (1.0 + uSaturation.y * (1.0 - spread));
  c = clamp(middle + (c - middle) * saturation, 0.0, 1.0);
  finalColor = vec4(c * source.a, source.a);
}
`;

export class GradeFilter extends Filter {
  private readonly values: UniformGroup;

  constructor() {
    const values = new UniformGroup({
      uGain: { value: 1, type: "f32" },
      uBalance: { value: new Float32Array([1, 1, 1]), type: "vec3<f32>" },
      uContrast: { value: 1, type: "f32" },
      uTone: { value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>" },
      uSaturation: { value: new Float32Array([1, 0]), type: "vec2<f32>" },
    });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-grade" }), resources: { gradeUniforms: values } });
    this.values = values;
  }

  set(u: GradeUniforms): void {
    const uniforms = this.values.uniforms;
    uniforms.uGain = u.gain;
    (uniforms.uBalance as Float32Array).set(u.balance);
    uniforms.uContrast = u.contrast;
    (uniforms.uTone as Float32Array).set(u.tone);
    (uniforms.uSaturation as Float32Array).set([u.saturation, u.vibrance]);
    this.values.update();
  }
}
