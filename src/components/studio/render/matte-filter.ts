import { defaultFilterVert, Filter, GlProgram, Matrix, Texture, TextureMatrix, UniformGroup, type FilterSystem, type RenderSurface, type Sprite } from "pixi.js";

import type { Matte } from "@/lib/studio/matte";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uMatte;
uniform highp mat3 uToMatte;
uniform highp vec4 uMatteClamp;
uniform vec3 uMode;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  highp vec2 at = (uToMatte * vec3(vTextureCoord, 1.0)).xy;
  float inside = step(uMatteClamp.x, at.x) * step(uMatteClamp.y, at.y) * step(at.x, uMatteClamp.z) * step(at.y, uMatteClamp.w);
  vec4 matte = texture(uMatte, at) * (inside * uMode.z);
  float covered = uMode.x > 0.5 ? dot(matte.rgb, LUMA) : matte.a;
  float weight = uMode.y > 0.5 ? 1.0 - covered : covered;
  finalColor = texture(uTexture, vTextureCoord) * weight;
}
`;

export class MatteFilter extends Filter {
  private readonly values: UniformGroup;
  private readonly frameMatrix = new TextureMatrix(Texture.EMPTY);

  constructor(private readonly frame: Sprite) {
    const values = new UniformGroup({
      uToMatte: { value: new Matrix(), type: "mat3x3<f32>" },
      uMatteClamp: { value: new Float32Array(4), type: "vec4<f32>" },
      uMode: { value: new Float32Array([0, 0, 1]), type: "vec3<f32>" },
    });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-matte" }), resources: { matteUniforms: values, uMatte: Texture.EMPTY.source, uMatteSampler: Texture.EMPTY.source.style } });
    this.values = values;
  }

  set(matte: Matte, opacity: number): void {
    (this.values.uniforms.uMode as Float32Array).set([matte.channel === "luma" ? 1 : 0, matte.invert ? 1 : 0, opacity]);
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const texture = this.frame.texture;
    this.frameMatrix.texture = texture;
    this.frameMatrix.update();
    filterManager.calculateSpriteMatrix(this.values.uniforms.uToMatte as Matrix, this.frame).prepend(this.frameMatrix.mapCoord);
    (this.values.uniforms.uMatteClamp as Float32Array).set(this.frameMatrix.uClampFrame);
    this.values.update();
    this.resources.uMatte = texture.source;
    this.resources.uMatteSampler = texture.source.style;
    filterManager.applyFilter(this, input, output, clearMode);
  }
}
