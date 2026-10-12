import { alignmentMisses, layoutItems, nested, type LayoutItem } from "@/lib/studio/agent/alignment";
import { alignmentGuides } from "@/lib/studio/agent/layout-report";
import type { PerceptionShape } from "@/lib/studio/agent/perception";
import { imageScene } from "@/lib/studio/agent/scene";
import { estimateTextWidth } from "@/lib/studio/agent/text-ink";
import type { ImageSurface } from "@/lib/studio/document";

function crosses(guide: Extract<PerceptionShape, { kind: "guide" }>, item: LayoutItem): boolean {
  const [[x0, y0], [x1, y1]] = [guide.from, guide.to];
  const { left, right, top, bottom } = item.box;
  if (x0 === x1) return left < x0 && x0 < right && Math.min(y0, y1) < bottom && Math.max(y0, y1) > top;
  return top < y0 && y0 < bottom && Math.min(x0, x1) < right && Math.max(x0, x1) > left;
}

export function guideCrossings(surface: ImageSurface): number {
  const items = layoutItems(imageScene(surface), estimateTextWidth);
  return alignmentMisses(items).reduce((sum, miss) => {
    const involved = [miss.off, miss.neighbor, ...miss.members];
    const unrelated = items.filter((item) => !involved.some((member) => member === item || nested(member, item)));
    const guides = alignmentGuides(miss, items).filter((shape): shape is Extract<PerceptionShape, { kind: "guide" }> => shape.kind === "guide");
    return sum + guides.filter((guide) => unrelated.some((item) => crosses(guide, item))).length;
  }, 0);
}
