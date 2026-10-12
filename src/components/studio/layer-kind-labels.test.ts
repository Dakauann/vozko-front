import { describe, expect, it } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import { SHAPE_KINDS, type LayerType } from "@/lib/studio/document";

const LOCALES = { pt, en, es, de };

const IMAGE_LAYER_TYPES = Object.keys({ image: true, text: true, shape: true, icon: true, instance: true, paint: true, chart: true, table: true, qr: true } satisfies Record<LayerType, true>) as LayerType[];

const OVERLAY_LAYER_TYPES: LayerType[] = ["image", "text", "icon", "chart", "table", "qr"];

describe("layer kind names", () => {
  it.each(Object.entries(LOCALES))("names every image layer kind and shape in %s", (_, messages) => {
    const kinds = messages.studio.image.layerKinds as unknown as Record<string, unknown> & { shape: Record<string, unknown> };
    for (const type of IMAGE_LAYER_TYPES.filter((type) => type !== "shape")) expect(typeof kinds[type], type).toBe("string");
    for (const shape of SHAPE_KINDS) expect(typeof kinds.shape[shape], shape).toBe("string");
  });

  it.each(Object.entries(LOCALES))("names every overlay layer kind and shape on the video timeline in %s", (_, messages) => {
    const types = messages.studio.video.timeline.clipTypes as unknown as Record<string, unknown> & { shapes: Record<string, unknown> };
    for (const type of OVERLAY_LAYER_TYPES) expect(typeof types[type], type).toBe("string");
    for (const shape of SHAPE_KINDS) expect(typeof types.shapes[shape], shape).toBe("string");
  });
});
