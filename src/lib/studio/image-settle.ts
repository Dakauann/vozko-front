import { settleLayouts, type HugMeasure } from "./auto-layout";
import { settleComponents } from "./component-edits";
import type { ImageDocument } from "./document";
import { settleStyles } from "./shared-styles";

export function settleImage(before: ImageDocument, after: ImageDocument, measure?: HugMeasure): ImageDocument {
  return settleLayouts(before, settleStyles(before, settleComponents(before, after)), measure);
}
