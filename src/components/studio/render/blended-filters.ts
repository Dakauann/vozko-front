import { defaultFilterVert, Filter, GlProgram, Matrix, Sprite, Texture, TexturePool, UniformGroup, type Container, type FilterSystem, type RenderSurface } from "pixi.js";

import type { SceneBox } from "@/lib/studio/scene/scene";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uOriginal;
uniform sampler2D uCoverage;
uniform highp mat3 uToCoverage;
uniform float uAmount;

void main() {
  highp vec2 at = (uToCoverage * vec3(vTextureCoord, 1.0)).xy;
  float inside = step(0.0, at.x) * step(0.0, at.y) * step(at.x, 1.0) * step(at.y, 1.0);
  float weight = texture(uCoverage, clamp(at, 0.0, 1.0)).a * inside * uAmount;
  finalColor = mix(texture(uOriginal, vTextureCoord), texture(uTexture, vTextureCoord), weight);
}
`;

class BlendFilter extends Filter {
  private readonly values: UniformGroup;
  private inner: readonly Filter[] = [];

  constructor(private readonly frame: Sprite) {
    const values = new UniformGroup({ uToCoverage: { value: new Matrix(), type: "mat3x3<f32>" }, uAmount: { value: 1, type: "f32" } });
    super({
      glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-blended-filters" }),
      resources: { blendUniforms: values, uOriginal: Texture.EMPTY.source, uOriginalSampler: Texture.EMPTY.source.style, uCoverage: Texture.WHITE.source, uCoverageSampler: Texture.WHITE.source.style },
    });
    this.values = values;
  }

  set(inner: readonly Filter[], amount: number, coverage: Texture): void {
    this.inner = inner;
    this.values.uniforms.uAmount = amount;
    if (this.resources.uCoverage !== coverage.source) {
      this.resources.uCoverage = coverage.source;
      this.resources.uCoverageSampler = coverage.source.style;
    }
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const held: Texture[] = [];
    let current = input;
    for (const filter of this.inner) {
      const next = TexturePool.getSameSizeTexture(input);
      filter.apply(filterManager, current, next, true);
      held.push(next);
      current = next;
    }
    filterManager.calculateSpriteMatrix(this.values.uniforms.uToCoverage as Matrix, this.frame);
    this.values.update();
    this.resources.uOriginal = input.source;
    this.resources.uOriginalSampler = input.source.style;
    filterManager.applyFilter(this, current, output, clearMode);
    for (const texture of held) TexturePool.returnTexture(texture);
  }
}

export class BlendedFilters {
  private readonly frame = new Sprite(Texture.WHITE);
  private readonly filter: BlendFilter;

  constructor() {
    this.frame.anchor.set(0.5);
    this.frame.renderable = false;
    this.filter = new BlendFilter(this.frame);
  }

  update(inner: readonly Filter[], amount: number, coverage: Texture, box: SceneBox, home: Container): Filter {
    if (this.frame.parent !== home) home.addChild(this.frame);
    this.frame.texture = coverage;
    this.frame.position.set(box.x, box.y);
    this.frame.angle = box.rotation;
    this.frame.setSize(Math.max(1, box.width), Math.max(1, box.height));
    this.filter.set(inner, amount, coverage);
    return this.filter;
  }

  destroy(): void {
    this.filter.destroy();
    this.frame.destroy();
  }
}
