import type { Layer } from "../document";
import { paintsFillArea, type LineState } from "../line-animation";
import type { LineNode, RasterSource } from "./scene";

export function lineNode(line: LineState, layer: Layer, source: RasterSource, color: string): LineNode {
  const placed = { ...layer, transform: source.layer.transform };
  const key = JSON.stringify([line.resolved, { ...placed, id: undefined }, source.widthPx, source.heightPx, color, line.step]);
  return { key, layer: placed, resolved: line.resolved, color, step: line.step, fill: paintsFillArea(layer) };
}
