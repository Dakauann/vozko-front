import { defaultFilterVert, Filter, GlProgram, UniformGroup } from "pixi.js";

import { chromaOf, hexRgb, type ChromaKey } from "@/lib/studio/chroma-key";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform vec2 uKey;
uniform vec3 uParams;
uniform float uMatte;

const vec3 CB = vec3(-0.100644, -0.338572, 0.439216);
const vec3 CR = vec3(0.439216, -0.398942, -0.040274);
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float OFFSET = 0.501961;

vec3 straight(vec4 sampled) {
  return sampled.a > 0.0 ? sampled.rgb / sampled.a : vec3(0.0);
}

float keyDistance(vec2 uv) {
  vec3 c = straight(texture(uTexture, uv));
  return distance(uKey, vec2(dot(c, CB), dot(c, CR)) + OFFSET);
}

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = uMatte > 0.5 ? vec4(0.0, 0.0, 0.0, 1.0) : source;
    return;
  }
  vec2 h = uInputSize.zw * 0.5;
  float d = keyDistance(vTextureCoord);
  d += 2.0 * (keyDistance(vTextureCoord + vec2(-h.x, h.y)) + keyDistance(vTextureCoord + h) + keyDistance(vTextureCoord - h) + keyDistance(vTextureCoord + vec2(h.x, -h.y)));
  float base = d / 9.0 - uParams.x;
  float alpha = pow(clamp(base / uParams.y, 0.0, 1.0), 1.5);
  float spill = pow(clamp(base / uParams.z, 0.0, 1.0), 1.5);
  vec3 c = straight(source);
  float l = dot(c, LUMA);
  c = mix(vec3(l), c, spill);
  float a = source.a * alpha;
  finalColor = uMatte > 0.5 ? vec4(vec3(a), 1.0) : vec4(c * a, a);
}
`;

export class ChromaFilter extends Filter {
  private readonly values: UniformGroup;

  constructor() {
    const values = new UniformGroup({
      uKey: { value: new Float32Array([0, 0]), type: "vec2<f32>" },
      uParams: { value: new Float32Array([0.4, 0.08, 0.1]), type: "vec3<f32>" },
      uMatte: { value: 0, type: "f32" },
    });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-chroma" }), resources: { chromaUniforms: values } });
    this.values = values;
  }

  set(key: ChromaKey, matte: boolean): void {
    const uniforms = this.values.uniforms;
    (uniforms.uKey as Float32Array).set(chromaOf(hexRgb(key.color)));
    (uniforms.uParams as Float32Array).set([key.similarity, key.smoothness, key.spill]);
    uniforms.uMatte = matte ? 1 : 0;
    this.values.update();
  }
}
