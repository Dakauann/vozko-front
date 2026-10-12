import { defaultFilterVert, Filter, GlProgram, Matrix, Sprite, Texture, UniformGroup, type Container, type FilterSystem, type RenderSurface } from "pixi.js";

import { rotate } from "@/lib/studio/crop";
import type { PixelMaskNode, SceneBox } from "@/lib/studio/scene/scene";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uMask;
uniform mat3 uToMask;

void main() {
  vec4 color = texture(uTexture, vTextureCoord);
  vec2 at = (uToMask * vec3(vTextureCoord, 1.0)).xy;
  float hidden = at.x >= 0.0 && at.x <= 1.0 && at.y >= 0.0 && at.y <= 1.0 ? texture(uMask, at).a : 0.0;
  finalColor = color * (1.0 - hidden);
}
`;

class PixelMaskFilter extends Filter {
  private readonly values: UniformGroup;

  constructor(private readonly frame: Sprite) {
    const values = new UniformGroup({ uToMask: { value: new Matrix(), type: "mat3x3<f32>" } });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-pixel-mask" }), resources: { maskUniforms: values, uMask: Texture.EMPTY.source, uMaskSampler: Texture.EMPTY.source.style } });
    this.values = values;
  }

  show(texture: Texture): void {
    if (this.resources.uMask === texture.source) return;
    this.resources.uMask = texture.source;
    this.resources.uMaskSampler = texture.source.style;
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    filterManager.calculateSpriteMatrix(this.values.uniforms.uToMask as Matrix, this.frame);
    this.values.update();
    filterManager.applyFilter(this, input, output, clearMode);
  }
}

export class PixelMask {
  private readonly frame = new Sprite(Texture.EMPTY);
  private readonly filter: PixelMaskFilter;

  constructor() {
    this.frame.anchor.set(0.5);
    this.frame.renderable = false;
    this.filter = new PixelMaskFilter(this.frame);
  }

  update(mask: PixelMaskNode, texture: Texture, box: SceneBox, home: Container): Filter {
    if (this.frame.parent !== home) home.addChild(this.frame);
    this.frame.texture = texture;
    this.filter.show(texture);
    const offset = rotate({ x: (mask.rect.x + mask.rect.width / 2 - 0.5) * box.width, y: (mask.rect.y + mask.rect.height / 2 - 0.5) * box.height }, box.rotation);
    this.frame.position.set(box.x + offset.x, box.y + offset.y);
    this.frame.angle = box.rotation;
    this.frame.setSize(Math.max(1e-3, mask.rect.width * box.width), Math.max(1e-3, mask.rect.height * box.height));
    this.frame.scale.set(Math.abs(this.frame.scale.x) * (mask.flipX ? -1 : 1), Math.abs(this.frame.scale.y) * (mask.flipY ? -1 : 1));
    return this.filter;
  }

  destroy(): void {
    this.filter.destroy();
    this.frame.destroy();
  }
}
