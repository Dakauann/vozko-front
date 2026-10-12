import { BufferImageSource, defaultFilterVert, Filter, GlProgram } from "pixi.js";

import { CURVE_TABLE_SIZE, curvesLut, type ColorCurves } from "@/lib/studio/color-curves";

const fragment = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uCurves;

const float TABLE_SIZE = ${CURVE_TABLE_SIZE.toFixed(1)};

void main() {
  vec4 source = texture(uTexture, vTextureCoord);
  if (source.a <= 0.0) {
    finalColor = source;
    return;
  }
  vec3 c = clamp(source.rgb / source.a, 0.0, 1.0);
  vec3 at = (floor(c * 255.0 + 0.5) + 0.5) / TABLE_SIZE;
  vec3 mapped = vec3(texture(uCurves, vec2(at.r, 0.5)).r, texture(uCurves, vec2(at.g, 0.5)).g, texture(uCurves, vec2(at.b, 0.5)).b);
  finalColor = vec4(mapped * source.a, source.a);
}
`;

export class CurvesFilter extends Filter {
  private readonly table: BufferImageSource;
  private key = "";

  constructor() {
    const table = new BufferImageSource({ resource: new Uint8Array(CURVE_TABLE_SIZE * 4), width: CURVE_TABLE_SIZE, height: 1, format: "rgba8unorm", alphaMode: "no-premultiply-alpha", scaleMode: "nearest" });
    super({ glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment, name: "studio-curves", preferredFragmentPrecision: "highp" }), resources: { uCurves: table, uCurvesSampler: table.style } });
    this.table = table;
  }

  set(curves: ColorCurves): void {
    const key = JSON.stringify(curves);
    if (key === this.key) return;
    this.key = key;
    this.table.resource = curvesLut(curves);
    this.table.update();
  }
}
