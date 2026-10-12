import { defaultFilterVert, Filter, GlProgram, UniformGroup } from "pixi.js";

import type { LumaKey } from "@/lib/studio/luma-key";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec3 uKey;
uniform float uMatte;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = uMatte > 0.5 ? vec4(0.0, 0.0, 0.0, 1.0) : source;
    return;
  }
  vec3 c = source.rgb / source.a;
  float luma = dot(c, LUMA);
  float distance = uKey.x > 0.5 ? 1.0 - luma : luma;
  float a = source.a * clamp((distance - uKey.y) / uKey.z, 0.0, 1.0);
  finalColor = uMatte > 0.5 ? vec4(vec3(a), 1.0) : vec4(c * a, a);
}
`;

export class LumaFilter extends Filter {
  private readonly values: UniformGroup;

  constructor() {
    const values = new UniformGroup({
      uKey: { value: new Float32Array([0, 0.1, 0.1]), type: "vec3<f32>" },
      uMatte: { value: 0, type: "f32" },
    });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-luma-key" }), resources: { lumaUniforms: values } });
    this.values = values;
  }

  set(key: LumaKey, matte: boolean): void {
    (this.values.uniforms.uKey as Float32Array).set([key.mode === "light" ? 1 : 0, key.threshold, key.softness]);
    this.values.uniforms.uMatte = matte ? 1 : 0;
    this.values.update();
  }
}
