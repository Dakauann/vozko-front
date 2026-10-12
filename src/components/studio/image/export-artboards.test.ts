import { describe, expect, it, vi } from "vitest";

const saveExport = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/studio", () => ({ saveStudioExportAction: saveExport }));

import { emptyArtboard, newShapeLayer, newTextLayer, type Artboard } from "@/lib/studio/document";

import { artboardTitle, exportRequestOf, pdfTitle, rasterizedLayers, saveRendered, type Raster, type RenderedArtboard } from "./export-artboards";

describe("image export requests", () => {
  it("fills the menu defaults and reads what Elo asked for", () => {
    expect(exportRequestOf({})).toEqual({ request: { format: "png", scale: 1, quality: 0.9, transparent: true, preset: "digital" }, scope: "active" });
    expect(exportRequestOf({ format: "jpeg", scale: 2, quality: 0.8, transparent: false, artboards: "all" })).toEqual({ request: { format: "jpeg", scale: 2, quality: 0.8, transparent: false, preset: "digital" }, scope: "all" });
    expect(exportRequestOf({ format: "pdf", preset: "print", artboards: "all" })).toMatchObject({ request: { format: "pdf", preset: "print" }, scope: "all" });
    expect(exportRequestOf({ format: "svg", transparent: false })).toMatchObject({ request: { format: "svg", transparent: false } });
  });

  it("refuses what it cannot make, and options of another format", () => {
    for (const args of [{ format: "gif" }, { scale: 3 }, { format: "png", preset: "print" }, { format: "pdf", scale: 2 }, { format: "svg", quality: 0.8 }, { format: "pdf", preset: "poster" }]) {
      expect(exportRequestOf(args), JSON.stringify(args)).toBeNull();
    }
  });

  it("names a file after the project and, with several artboards, the artboard", () => {
    const names = new Map([["a1", "Feed"]]);
    expect(artboardTitle("Promo", names, 1, "a1")).toBe("Promo");
    expect(artboardTitle("Promo", names, 2, "a1")).toBe("Promo Feed");
  });

  it("names a pdf of several artboards after the project", () => {
    const one = [{ id: "a1" }] as Artboard[];
    expect(pdfTitle("Promo", one, () => "Promo Feed")).toBe("Promo Feed");
    expect(pdfTitle("Promo", [...one, { id: "a2" } as Artboard], () => "x")).toBe("Promo");
  });

  it("counts the layers that go into the file as pixels", () => {
    const board = { ...emptyArtboard({ width: 100, height: 100 }), layers: [newShapeLayer("rect"), newTextLayer("Oi"), newTextLayer("Tchau")] };
    expect(rasterizedLayers([board, board], true)).toBe(4);
  });
});

describe("saving exports", () => {
  const file = (format: RenderedArtboard["format"], type: string): RenderedArtboard => ({ artboardId: "a1", artboardIds: ["a1", "a2"], format, blob: new Blob(["x"], { type }), fileName: `f.${format}`, title: "Promo" });

  it("sends images to the library upload and vector files to the editor export, with the artboards they hold", async () => {
    const uploadRaster = vi.fn(async () => ({ data: { mediaId: "m-png", mediaUrl: "https://x/png" } }));
    saveExport.mockResolvedValueOnce({ data: { mediaId: "m-pdf", mediaUrl: "https://x/pdf" } });
    const raster = { uploadRaster } as unknown as Raster;
    const result = await saveRendered(raster, [file("png", "image/png"), file("pdf", "application/pdf")], "p-1");
    expect(uploadRaster).toHaveBeenCalledWith(expect.any(Blob), "Promo", "f.png");
    expect(saveExport).toHaveBeenCalledWith("p-1", expect.any(Blob), "Promo");
    expect(result).toEqual({
      ok: true,
      saved: [
        { mediaId: "m-png", mediaUrl: "https://x/png", artboardId: "a1", artboardIds: ["a1", "a2"] },
        { mediaId: "m-pdf", mediaUrl: "https://x/pdf", artboardId: "a1", artboardIds: ["a1", "a2"] },
      ],
    });
  });

  it("stops at the first refusal and says why", async () => {
    saveExport.mockResolvedValueOnce({ error: "not a file the editor makes", code: "invalid_export" });
    expect(await saveRendered({} as Raster, [file("svg", "image/svg+xml")], "p-1")).toEqual({ ok: false, reason: "not a file the editor makes" });
  });
});
