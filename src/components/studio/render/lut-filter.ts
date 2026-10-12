import { BufferImageSource, defaultFilterVert, Filter, GlProgram, UniformGroup } from "pixi.js";

import { LUT_WARNING, type LutAtlas } from "@/lib/studio/cube-lut";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uLut;
uniform vec3 uDomainMin;
uniform vec3 uDomainMax;
uniform vec3 uShape;
uniform vec2 uAtlas;

vec3 lattice(float r, float g, float b) {
  float x = mod(b, uShape.y) * uShape.x + r;
  float y = floor(b / uShape.y) * uShape.x + g;
  return texture(uLut, (vec2(x, y) + 0.5) / uAtlas).rgb;
}

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec3 c = clamp(source.rgb / source.a, 0.0, 1.0);
  float top = uShape.x - 1.0;
  vec3 p = clamp((c - uDomainMin) / (uDomainMax - uDomainMin), 0.0, 1.0) * top;
  vec3 i0 = min(floor(p), vec3(top));
  vec3 f = p - i0;
  vec3 i1 = min(i0 + 1.0, vec3(top));
  vec3 c00 = lattice(i0.r, i0.g, i0.b) * (1.0 - f.r) + lattice(i1.r, i0.g, i0.b) * f.r;
  vec3 c10 = lattice(i0.r, i1.g, i0.b) * (1.0 - f.r) + lattice(i1.r, i1.g, i0.b) * f.r;
  vec3 c01 = lattice(i0.r, i0.g, i1.b) * (1.0 - f.r) + lattice(i1.r, i0.g, i1.b) * f.r;
  vec3 c11 = lattice(i0.r, i1.g, i1.b) * (1.0 - f.r) + lattice(i1.r, i1.g, i1.b) * f.r;
  vec3 c0 = c00 * (1.0 - f.g) + c10 * f.g;
  vec3 c1 = c01 * (1.0 - f.g) + c11 * f.g;
  vec3 looked = c0 * (1.0 - f.b) + c1 * f.b;
  vec3 rgb = c + (looked - c) * uShape.z;
  finalColor = vec4(rgb * source.a, source.a);
}
`;

export class LutFilter extends Filter {
  private readonly values: UniformGroup;
  private readonly table: BufferImageSource;
  private atlas: LutAtlas | null = null;

  constructor() {
    const values = new UniformGroup({
      uDomainMin: { value: new Float32Array([0, 0, 0]), type: "vec3<f32>" },
      uDomainMax: { value: new Float32Array([1, 1, 1]), type: "vec3<f32>" },
      uShape: { value: new Float32Array([2, 2, 1]), type: "vec3<f32>" },
      uAtlas: { value: new Float32Array([2, 2]), type: "vec2<f32>" },
    });
    const table = new BufferImageSource({ resource: new Uint8Array(16), width: 2, height: 2, format: "rgba8unorm", alphaMode: "no-premultiply-alpha", scaleMode: "nearest" });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-lut", preferredFragmentPrecision: "highp" }), resources: { lutUniforms: values, uLut: table, uLutSampler: table.style } });
    this.values = values;
    this.table = table;
  }

  set(atlas: LutAtlas, intensity: number): void {
    if (atlas !== this.atlas) {
      this.atlas = atlas;
      this.table.resource = atlas.data;
      this.table.resize(atlas.width, atlas.height);
      this.table.update();
      (this.values.uniforms.uDomainMin as Float32Array).set(atlas.domainMin);
      (this.values.uniforms.uDomainMax as Float32Array).set(atlas.domainMax);
      (this.values.uniforms.uAtlas as Float32Array).set([atlas.width, atlas.height]);
    }
    (this.values.uniforms.uShape as Float32Array).set([atlas.size, atlas.columns, intensity]);
    this.values.update();
  }
}

const warningFragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec3 uWarningColor;
uniform vec2 uWarningBand;

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  float band = mod(floor((floor(gl_FragCoord.x) + floor(gl_FragCoord.y)) / uWarningBand.x), 2.0) < 0.5 ? uWarningBand.y : 0.0;
  finalColor = vec4(mix(source.rgb, uWarningColor * source.a, band), source.a);
}
`;

export class LutWarningFilter extends Filter {
  constructor() {
    const values = new UniformGroup({
      uWarningColor: { value: new Float32Array(LUT_WARNING.color), type: "vec3<f32>" },
      uWarningBand: { value: new Float32Array([LUT_WARNING.bandPx, LUT_WARNING.strength]), type: "vec2<f32>" },
    });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: warningFragment, name: "studio-lut-warning" }), resources: { warningUniforms: values } });
  }
}
