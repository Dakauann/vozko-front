import { nullClipFor } from "../../parent-edit";
import { OWN_SOURCE, type LibraryCategory, type LibraryItem } from "../model";
import { previewSvg } from "../preview";

const NULL_MARKUP = previewSvg(`<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4.75" y="4.75" width="14.5" height="14.5" rx="1.5" stroke-dasharray="2.5 2.5"/><path d="M12 8.5v7M8.5 12h7"/></g>`, 24);

const NULL_ITEM: LibraryItem = {
  id: "control-null",
  category: "controls",
  editors: ["video"],
  ratio: 1,
  label: { key: "studio.video.parenting.addNull" },
  hint: { key: "studio.video.parenting.addNullHint" },
  preview: { kind: "svg", markup: NULL_MARKUP },
  source: OWN_SOURCE,
  template: { kind: "clips", build: (ctx) => [nullClipFor(ctx.documentMs, { startMs: ctx.atMs })] },
};

const CONTROL_ITEMS: readonly LibraryItem[] = [NULL_ITEM];

export const CONTROLS_CATEGORY: LibraryCategory = {
  id: "controls",
  panel: "elements",
  label: { key: "studio.video.parenting.controls" },
  tile: "row",
  items: () => CONTROL_ITEMS,
};
