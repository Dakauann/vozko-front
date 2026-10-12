import { defaultFilterVert, Filter, GlProgram, UniformGroup } from "pixi.js";

import { CHROMA_KNEE, type HueUniforms } from "@/lib/studio/hue-secondary";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uRange;
uniform vec2 uAdjust;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float CHROMA_KNEE = ${CHROMA_KNEE.toFixed(4)};

float hueOf(vec3 c, float high, float chroma) {
  float h;
  if (high == c.r) h = (c.g - c.b) / chroma;
  else if (high == c.g) h = (c.b - c.r) / chroma + 2.0;
  else h = (c.r - c.g) / chroma + 4.0;
  h /= 6.0;
  return h < 0.0 ? h + 1.0 : h;
}

float weightOf(float h) {
  float gap = abs(h - uRange.x);
  float distance = min(gap, 1.0 - gap);
  if (distance <= uRange.y) return 1.0;
  if (uRange.z <= 0.0) return 0.0;
  float t = clamp(1.0 - (distance - uRange.y) / uRange.z, 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

float channelOf(float n, float h, float s, float v) {
  float k = mod(n + h * 6.0, 6.0);
  return v - v * s * max(0.0, min(min(k, 4.0 - k), 1.0));
}

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec3 c = clamp(source.rgb / source.a, 0.0, 1.0);
  float high = max(max(c.r, c.g), c.b);
  float chroma = high - min(min(c.r, c.g), c.b);
  vec3 shown = c;
  float weight = 0.0;
  if (chroma > 0.0) {
    float h = hueOf(c, high, chroma);
    weight = weightOf(h) * clamp(chroma / CHROMA_KNEE, 0.0, 1.0);
    if (weight > 0.0 && (uAdjust.x != 0.0 || uAdjust.y != 0.0)) {
      float turned = fract(h + uAdjust.x * weight);
      float s = clamp((chroma / high) * (1.0 + uAdjust.y * weight), 0.0, 1.0);
      shown = vec3(channelOf(5.0, turned, s, high), channelOf(3.0, turned, s, high), channelOf(1.0, turned, s, high));
    }
  }
  float amount = uRange.w * (1.0 - weight);
  if (amount > 0.0) {
    float l = dot(shown, LUMA);
    shown = clamp(shown + (l - shown) * amount, 0.0, 1.0);
  }
  finalColor = vec4(shown * source.a, source.a);
}
`;

export class HueFilter extends Filter {
  private readonly values: UniformGroup;

  constructor() {
    const values = new UniformGroup({
      uRange: { value: new Float32Array([0, 0, 0, 0]), type: "vec4<f32>" },
      uAdjust: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
    });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-hue-secondary", preferredFragmentPrecision: "highp" }), resources: { hueUniforms: values } });
    this.values = values;
  }

  set(u: HueUniforms): void {
    (this.values.uniforms.uRange as Float32Array).set([u.center, u.half, u.soft, u.desaturate]);
    (this.values.uniforms.uAdjust as Float32Array).set([u.shift, u.saturation]);
    this.values.update();
  }
}
