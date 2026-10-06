import { describe, expect, it } from "vitest";

import { emptyImageDocument, newImageLayer, newShapeLayer, newTextLayer } from "./document";
import {
  commitText,
  DEFAULT_FILTERS,
  exportFileName,
  FILTER_PRESETS,
  isDefaultFilters,
  jobErrorCode,
  rasterBackground,
  replaceImageAsset,
  visibleLayers,
} from "./image-edits";
import { layerIssue } from "./validate";

const canvas = { width: 1000, height: 500 };

describe("commitText", () => {
  it("updates the text of the layer", () => {
    const layer = { ...newTextLayer("Oi"), id: "t" };
    const doc = { ...emptyImageDocument(canvas), layers: [layer] };
    expect(commitText(doc, "t", "Olá").layers[0].text).toBe("Olá");
  });

  it("removes the layer when the text is left blank", () => {
    const layer = { ...newTextLayer("Oi"), id: "t" };
    const doc = { ...emptyImageDocument(canvas), layers: [layer] };
    expect(commitText(doc, "t", "  \n").layers).toEqual([]);
  });

  it("keeps the document when nothing changed", () => {
    const layer = { ...newTextLayer("Oi"), id: "t" };
    const doc = { ...emptyImageDocument(canvas), layers: [layer] };
    expect(commitText(doc, "t", "Oi")).toBe(doc);
  });
});

describe("filters", () => {
  it("ships presets the validation accepts and knows the neutral set", () => {
    for (const preset of FILTER_PRESETS) expect(layerIssue({ ...newImageLayer("m"), filters: preset.filters })).toBeNull();
    expect(isDefaultFilters(undefined)).toBe(true);
    expect(isDefaultFilters(DEFAULT_FILTERS)).toBe(true);
    expect(isDefaultFilters({ ...DEFAULT_FILTERS, blur: 2 })).toBe(false);
  });
});

describe("replaceImageAsset", () => {
  it("swaps the asset, drops the crop and fits the new image in the old box", () => {
    const layer = { ...newImageLayer("old", { x: 0.3, y: 0.5, w: 0.2, h: 0.4, rotation: 10, opacity: 0.8 }), crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } };
    const next = replaceImageAsset(layer, "new", { width: 400, height: 200 }, canvas);
    expect(next.assetId).toBe("new");
    expect(next.crop).toBeUndefined();
    expect(next.transform?.x).toBe(0.3);
    expect(next.transform?.rotation).toBe(10);
    expect(next.transform?.opacity).toBe(0.8);
    expect((next.transform?.w ?? 0) * canvas.width).toBeCloseTo(200);
    expect((next.transform?.h ?? 0) * canvas.height).toBeCloseTo(100);
  });
});

describe("rasterBackground", () => {
  it("paints the canvas color when there is one", () => {
    expect(rasterBackground("#112233", "png", true)).toBe("#112233");
    expect(rasterBackground("#112233", "jpeg", false)).toBe("#112233");
  });

  it("keeps a transparent canvas transparent only for PNG when asked", () => {
    expect(rasterBackground("", "png", true)).toBeUndefined();
    expect(rasterBackground("", "png", false)).toBe("#ffffff");
    expect(rasterBackground("", "jpeg", true)).toBe("#ffffff");
  });
});

describe("exportFileName", () => {
  it("builds a safe file name with the scale and extension", () => {
    expect(exportFileName("Promoção de Verão!", "png", 1)).toBe("promocao-de-verao.png");
    expect(exportFileName("Promoção de Verão!", "jpeg", 2)).toBe("promocao-de-verao@2x.jpg");
    expect(exportFileName("  ", "png", 1)).toBe("estudio.png");
  });
});

describe("visibleLayers", () => {
  it("drops hidden layers", () => {
    const shown = newShapeLayer("rect");
    const hidden = { ...newShapeLayer("rect"), hidden: true };
    expect(visibleLayers([shown, hidden])).toEqual([shown]);
  });
});

describe("jobErrorCode", () => {
  it("keeps codes the editor explains and folds the rest into unknown", () => {
    expect(jobErrorCode("too_many_jobs")).toBe("too_many_jobs");
    expect(jobErrorCode("poll_failed")).toBe("poll_failed");
    expect(jobErrorCode("weird")).toBe("unknown");
    expect(jobErrorCode(undefined)).toBe("unknown");
  });
});
