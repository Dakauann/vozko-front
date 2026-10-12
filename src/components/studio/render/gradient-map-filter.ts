import { BufferImageSource, defaultFilterVert, Filter, GlProgram, UniformGroup } from "pixi.js";

import { gradientMapLut, LUT_SIZE, type GradientMap } from "@/lib/studio/gradient-map";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uLut;
uniform float uIntensity;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float LUT_SIZE = ${LUT_SIZE.toFixed(1)};

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec3 c = clamp(source.rgb / source.a, 0.0, 1.0);
  float x = (floor(dot(c, LUMA) * 255.0 + 0.5) + 0.5) / LUT_SIZE;
  vec3 mapped = texture(uLut, vec2(x, 0.25)).rgb;
  float weight = texture(uLut, vec2(x, 0.75)).r;
  vec3 rgb = mix(c, mapped, uIntensity * weight);
  finalColor = vec4(rgb * source.a, source.a);
}
`;

function lutRows(map: GradientMap): Uint8Array {
  const lut = gradientMapLut(map);
  const rows = new Uint8Array(LUT_SIZE * 2 * 4);
  for (let i = 0; i < LUT_SIZE; i++) {
    rows.set([lut[i * 4], lut[i * 4 + 1], lut[i * 4 + 2], 255], i * 4);
    rows.set([lut[i * 4 + 3], 0, 0, 255], (LUT_SIZE + i) * 4);
  }
  return rows;
}

export class GradientMapFilter extends Filter {
  private readonly values: UniformGroup;
  private readonly lut: BufferImageSource;
  private key = "";

  constructor() {
    const values = new UniformGroup({ uIntensity: { value: 1, type: "f32" } });
    const lut = new BufferImageSource({ resource: new Uint8Array(LUT_SIZE * 2 * 4), width: LUT_SIZE, height: 2, format: "rgba8unorm", alphaMode: "no-premultiply-alpha", scaleMode: "nearest" });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-gradient-map" }), resources: { mapUniforms: values, uLut: lut, uLutSampler: lut.style } });
    this.values = values;
    this.lut = lut;
  }

  set(map: GradientMap): void {
    const key = JSON.stringify([map.stops, map.reverse ?? false, map.interpolation ?? ""]);
    if (key !== this.key) {
      this.key = key;
      this.lut.resource = lutRows(map);
      this.lut.update();
    }
    this.values.uniforms.uIntensity = map.intensity;
    this.values.update();
  }
}
