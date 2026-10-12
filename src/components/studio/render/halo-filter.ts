import { defaultFilterVert, Filter, GlProgram, Matrix, Sprite, Texture, UniformGroup, type Container, type FilterSystem, type RenderSurface } from "pixi.js";

import type { HaloNode } from "@/lib/studio/media-halo";
import type { SceneBox } from "@/lib/studio/scene/scene";

const PADDING_MARGIN_PX = 2;
const MIN_SIDE = 1e-3;

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uHalo;
uniform mat3 uToHalo;
uniform float uOpacity;

void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  vec2 at = (uToHalo * vec3(vTextureCoord, 1.0)).xy;
  vec4 halo = at.x >= 0.0 && at.x <= 1.0 && at.y >= 0.0 && at.y <= 1.0 ? texture(uHalo, at) : vec4(0.0);
  finalColor = color + halo * uOpacity * (1.0 - color.a);
}
`;

let program: GlProgram | null = null;

function programOf(): GlProgram {
  program ??= GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-media-halo" });
  return program;
}

class HaloFilter extends Filter {
  private readonly values: UniformGroup;

  constructor(private readonly frame: Sprite) {
    const values = new UniformGroup({ uToHalo: { value: new Matrix(), type: "mat3x3<f32>" }, uOpacity: { value: 1, type: "f32" } });
    super({ glProgram: programOf(), resources: { haloUniforms: values, uHalo: Texture.EMPTY.source, uHaloSampler: Texture.EMPTY.source.style } });
    this.values = values;
  }

  show(texture: Texture, opacity: number): void {
    this.values.uniforms.uOpacity = opacity;
    if (this.resources.uHalo === texture.source) return;
    this.resources.uHalo = texture.source;
    this.resources.uHaloSampler = texture.source.style;
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    filterManager.calculateSpriteMatrix(this.values.uniforms.uToHalo as Matrix, this.frame);
    this.values.update();
    filterManager.applyFilter(this, input, output, clearMode);
  }
}

export class MediaHalo {
  private readonly frame = new Sprite(Texture.EMPTY);
  private readonly filter: HaloFilter;

  constructor() {
    this.frame.anchor.set(0.5);
    this.frame.renderable = false;
    this.filter = new HaloFilter(this.frame);
  }

  update(halo: HaloNode, texture: Texture, box: SceneBox, home: Container, opacity: number, screenScale: number): Filter {
    if (this.frame.parent !== home) home.addChild(this.frame);
    this.frame.texture = texture;
    this.filter.show(texture, opacity);
    const scaleX = halo.base.width > 0 ? box.width / halo.base.width : 1;
    const scaleY = halo.base.height > 0 ? box.height / halo.base.height : 1;
    this.frame.position.set(box.x, box.y);
    this.frame.angle = box.rotation;
    this.frame.setSize(Math.max(MIN_SIDE, (halo.base.width + 2 * halo.padPx) * scaleX), Math.max(MIN_SIDE, (halo.base.height + 2 * halo.padPx) * scaleY));
    this.filter.padding = Math.ceil(halo.padPx * Math.max(scaleX, scaleY) * screenScale) + PADDING_MARGIN_PX;
    return this.filter;
  }

  destroy(): void {
    this.filter.destroy();
    this.frame.destroy();
  }
}
