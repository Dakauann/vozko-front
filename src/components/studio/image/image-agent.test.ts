import { describe, expect, it, vi } from "vitest";

import type { ScreenCommand, ScreenReply } from "@/lib/aichat/screen";
import { emptyArtboard, imageDocument, newImageLayer, newShapeLayer, newTextLayer, type ImageDocument, type Layer, type StudioGroup } from "@/lib/studio/document";
import { layerOf } from "@/lib/studio/artboards";
import { DEFAULT_PATTERN, type Pattern } from "@/lib/studio/pattern";
import { createStudioStore } from "@/lib/studio/store";

import { createAgentPresence } from "../agent/presence";
import { createImageCommands } from "./commands";
import { createEditorUiStore } from "./editor-state";
import { createImageAgent } from "./image-agent";

const rasterize = vi.hoisted(() => ({
  rasterizeLayers: vi.fn(async () => new Blob(["x"], { type: "image/png" })),
  uploadRaster: vi.fn(async () => ({ data: { mediaId: "m-1", mediaUrl: "https://x/m-1.png" } })),
  RasterTimeoutError: class extends Error {},
}));

vi.mock("@/components/studio/canvas/rasterize", () => rasterize);

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async (id: string) => ({ id, description: `Foto ${id}`, url: "", previewUrl: "", createdAt: "", type: "image" })),
}));

const vectors = vi.hoisted(() => ({
  renderPdf: vi.fn(async () => new Blob(["%PDF-"], { type: "application/pdf" })),
  renderSvg: vi.fn(async () => new Blob(["<svg "], { type: "image/svg+xml" })),
}));

vi.mock("./vector-export", () => vectors);

const saveExport = vi.hoisted(() => vi.fn(async () => ({ data: { mediaId: "v-1", mediaUrl: "https://x/v-1" } })));

vi.mock("@/app/actions/studio", () => ({ saveStudioExportAction: saveExport }));

function doc(): ImageDocument {
  return imageDocument([{ ...emptyArtboard({ width: 1080, height: 1080 }), layers: [{ ...newShapeLayer("rect"), id: "bg" }, { ...newTextLayer("Oi"), id: "t" }, { ...newShapeLayer("rect"), id: "photo-frame" }] }]);
}

function twoArtboards(): ImageDocument {
  return imageDocument([...doc().artboards, { ...emptyArtboard({ width: 1080, height: 1920 }), layers: [{ ...newTextLayer("Story"), id: "s" }] }]);
}

function setup(document: ImageDocument = doc()) {
  const store = createStudioStore(document);
  const ui = createEditorUiStore();
  const naturalSize = vi.fn(async () => ({ width: 800, height: 400 }));
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize });
  const agent = createImageAgent({ store, ui, commands, naturalSize, presence: createAgentPresence(), label: (a) => a, reduceMotion: () => true, projectId: "p-1", projectName: "Projeto", exportTitle: () => "Projeto" });
  const run = (name: ScreenCommand["name"], args?: unknown): Promise<ScreenReply> => agent({ id: "cmd", name, projectId: "p-1", args });
  return { store, ui, commands, run };
}

describe("Elo exporting artboards", () => {
  it("renders the open artboard into the library and says where it went", async () => {
    const { run, store } = setup();
    const reply = await run("export", { format: "jpeg", quality: 0.8 });
    expect(rasterize.rasterizeLayers).toHaveBeenCalledWith(expect.any(Array), expect.any(Number), expect.any(Number), expect.objectContaining({ mimeType: "image/jpeg", quality: 0.8 }));
    expect(rasterize.uploadRaster).toHaveBeenCalledWith(expect.any(Blob), "Projeto", "projeto.jpg");
    expect(reply).toMatchObject({ ok: true, data: { saved: [{ media_id: "m-1", url: "https://x/m-1.png", artboard_id: store.getState().document.artboards[0].id }] } });
  });

  it("puts every artboard in one pdf, saved through the editor export, and says how many layers became pixels", async () => {
    const { run, store } = setup(twoArtboards());
    const ids = store.getState().document.artboards.map((a) => a.id);
    const reply = await run("export", { format: "pdf", preset: "print", artboards: "all" });
    expect(vectors.renderPdf).toHaveBeenCalledWith(expect.anything(), store.getState().document.artboards, "Projeto", expect.objectContaining({ preset: "print", transparent: true }));
    expect(saveExport).toHaveBeenCalledWith("p-1", expect.any(Blob), "Projeto");
    expect(reply).toEqual({ ok: true, data: { saved: [{ media_id: "v-1", url: "https://x/v-1", artboard_ids: ids }], raster_layers: 2 } });
  });

  it("writes one svg per artboard", async () => {
    const { run } = setup(twoArtboards());
    vectors.renderSvg.mockClear();
    const reply = await run("export", { format: "svg", artboards: "all" });
    expect(vectors.renderSvg).toHaveBeenCalledTimes(2);
    expect(reply).toMatchObject({ ok: true, data: { saved: [{ media_id: "v-1" }, { media_id: "v-1" }] } });
  });

  it("refuses an export it cannot make", async () => {
    const { run } = setup();
    expect(await run("export", { format: "gif" })).toMatchObject({ ok: false, error: { code: "invalid_export" } });
    expect(await run("export", { format: "svg", scale: 2 })).toMatchObject({ ok: false, error: { code: "invalid_export" } });
  });
});

describe("Elo in the image editor", () => {
  it("composes in one undoable step", async () => {
    const { store, run } = setup();
    const reply = await run("edit", {
      operations: [
        { op: "add_image", ref: "p", media_id: "11111111-1111-4111-8111-111111111111" },
        { op: "update_layer", layer_id: "t", text: "Promoção", y: 0.2 },
        { op: "order_layers", layer_ids: ["@p"], direction: "back" },
      ],
    });
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    const created = (reply.data as { created: Record<string, string[]> }).created.p[0];
    expect(store.getState().document.artboards[0].layers[0].id).toBe(created);
    expect(layerOf(store.getState().document, "t")).toMatchObject({ text: "Promoção" });
    store.getState().undo();
    expect(layerOf(store.getState().document, created)).toBeUndefined();
    expect(layerOf(store.getState().document, "t")?.text).toBe("Oi");
  });

  it("changes nothing when the turn never lets the batch go, and claims only once the batch is ready", async () => {
    const { store, ui, commands } = setup();
    const agent = createImageAgent({ store, ui, commands, naturalSize: vi.fn(async () => ({ width: 800, height: 400 })), presence: createAgentPresence(), label: (a) => a, reduceMotion: () => true, projectId: "p-1", projectName: "Projeto", exportTitle: () => "Projeto" });
    const before = store.getState().document;
    const denied = vi.fn(async () => false);
    const late = await agent({ id: "cmd", name: "edit", projectId: "p-1", args: { operations: [{ op: "update_layer", layer_id: "t", text: "Tarde" }] }, claim: denied });
    expect(late).toMatchObject({ ok: false, error: { code: "expired" } });
    expect(store.getState().document).toBe(before);
    const refused = await agent({ id: "cmd-2", name: "edit", projectId: "p-1", args: { operations: [{ op: "update_layer", layer_id: "nada", text: "x" }] }, claim: denied });
    expect(refused).toMatchObject({ ok: false, error: { code: "operation_refused" } });
    expect(denied).toHaveBeenCalledTimes(1);
    const allowed = await agent({ id: "cmd-3", name: "edit", projectId: "p-1", args: { operations: [{ op: "update_layer", layer_id: "t", text: "Agora" }] }, claim: async () => true });
    expect(allowed.ok).toBe(true);
    expect(layerOf(store.getState().document, "t")?.text).toBe("Agora");
  });

  it("tells Elo which fields it ignored instead of failing the batch", async () => {
    const { store, run } = setup();
    const reply = await run("edit", { operations: [{ op: "update_layer", layer_ids: ["t", "bg"], fill: "#111111", font_size: 0.1 }] });
    expect(reply.ok).toBe(true);
    if (!reply.ok) return;
    expect((reply.data as { ignored: string[] }).ignored).toEqual(["operação 1 (update_layer): camada bg: font_size só vale para camadas de texto"]);
    expect(layerOf(store.getState().document, "t")).toMatchObject({ fill: "#111111", fontSize: 0.1 });
  });

  it("leaves ignored out of a clean reply", async () => {
    const { run } = setup();
    const reply = await run("edit", { operations: [{ op: "update_layer", layer_id: "t", text: "Oi de novo" }] });
    expect(reply.ok && "ignored" in (reply.data as object)).toBe(false);
  });

  it("drops what it locks from the selection, like a person locking it would", async () => {
    const { store, run } = setup();
    store.getState().select(["bg", "t"]);
    const reply = await run("edit", { operations: [{ op: "set_locked", layer_ids: ["bg"], locked: true }] });
    expect(reply.ok).toBe(true);
    expect(store.getState().selection).toEqual(["t"]);
  });

  it("reads every artboard with its layers bottom first", async () => {
    const { run } = setup();
    const reply = await run("read");
    if (!reply.ok) throw new Error(reply.error.message);
    const outline = reply.data as { active_artboard: string; artboards: { id: string; layers: { id: string }[] }[] };
    expect(outline.artboards).toHaveLength(1);
    expect(outline.active_artboard).toBe(outline.artboards[0].id);
    expect(outline.artboards[0].layers.map((l) => l.id)).toEqual(["bg", "t", "photo-frame"]);
  });

  it("adds the measured alerts to an artboard read when something is off, and nothing when all is well", async () => {
    const { store, run } = setup();
    const before = await run("read");
    if (!before.ok) throw new Error(before.error.message);
    const clean = (before.data as { artboards: { alerts?: string[] }[] }).artboards[0];
    store.getState().apply((doc) => ({ ...doc, artboards: doc.artboards.map((artboard) => ({ ...artboard, layers: [...artboard.layers, { id: "card", type: "shape" as const, shape: "rect" as const, fill: "#ffffff", transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.3, rotation: 0, opacity: 1 }, effects: [{ id: "s", type: "drop-shadow" as const, color: "#000000", opacity: 1, x: 0, y: 20, blur: 2, spread: 0 }] }] })) }));
    const reply = await run("read");
    if (!reply.ok) throw new Error(reply.error.message);
    const board = (reply.data as { artboards: { alerts?: string[] }[] }).artboards[0];
    expect(board.alerts?.some((line) => line.startsWith("aviso: a sombra de card está quase opaca"))).toBe(true);
    expect(clean.alerts?.some((line) => line.includes("card"))).toBeFalsy();
  });

  it("makes a version on a new artboard and edits the copy in one batch, which undoes in one step", async () => {
    const { store, run } = setup();
    const reply = await run("edit", {
      operations: [
        { op: "duplicate_artboard", ref: "v2", name: "Versão escura", width: 1080, height: 1920 },
        { op: "update_artboard", artboard_id: "@v2", background: "#111111" },
        { op: "update_layer", layer_id: "@v2/t", text: "Agora no story", fill: "#ffffff" },
      ],
    });
    if (!reply.ok) throw new Error(reply.error.message);
    const data = reply.data as { created: Record<string, string[]>; copies: Record<string, string> };
    const [original, copy] = store.getState().document.artboards;
    expect(copy).toMatchObject({ id: data.created.v2[0], name: "Versão escura", canvas: { width: 1080, height: 1920, background: "#111111" } });
    expect(copy.layers.find((l) => l.id === data.copies.t)).toMatchObject({ text: "Agora no story", fill: "#ffffff" });
    expect(original.layers.find((l) => l.id === "t")?.text).toBe("Oi");
    store.getState().undo();
    expect(store.getState().document.artboards).toHaveLength(1);
  });

  it("puts new elements on the artboard the person is working on", async () => {
    const { store, ui, run } = setup();
    await run("edit", { operations: [{ op: "add_artboard", width: 500, height: 500 }] });
    const second = store.getState().document.artboards[1].id;
    expect(ui.getState().artboardId).toBe(second);
    const reply = await run("edit", { operations: [{ op: "add_text", text: "Aqui" }] });
    if (!reply.ok) throw new Error(reply.error.message);
    expect(store.getState().document.artboards[1].layers.map((l) => l.text)).toEqual(["Aqui"]);
  });

  it("only hands over an image layer for background removal and follows the job", async () => {
    const { ui, run } = setup();
    expect(await run("resolve_source", { kind: "cutout", layerId: "t" })).toMatchObject({ ok: false });
    expect(await run("follow_job", { job: { id: "job-1", kind: "image", status: "queued" }, purpose: "image" })).toMatchObject({ ok: true });
    expect(ui.getState().jobs.at(-1)).toMatchObject({ purpose: "generate", layerId: null, created: { id: "job-1" } });
  });
});

describe("Elo removing backgrounds and editing what an element shows", () => {
  const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotation: 0, opacity: 1 };
  const frame = (id: string, groupId?: string): Layer => ({ ...newShapeLayer("rect", box), id, ...(groupId ? { groupId } : {}) });
  const framed = (id: string, assetId: string, groupId?: string): Layer => ({ ...newImageLayer(assetId, box), id, clip: true, ...(groupId ? { groupId } : {}) });
  const pattern: Pattern = { ...DEFAULT_PATTERN, source: "asset", presetId: "", assetId: "textura" };

  function shows(layers: Layer[], groups?: StudioGroup[]) {
    return setup(imageDocument([{ ...emptyArtboard({ width: 1000, height: 1000 }), layers, ...(groups ? { groups } : {}) }]));
  }

  const layer = (editor: ReturnType<typeof setup>, id: string) => layerOf(editor.store.getState().document, id)!;

  it("removes the background of the photo inside a frame and lands it as the manual action does, in one undo step", async () => {
    const editor = shows([frame("f"), framed("p", "foto")]);
    expect(await editor.run("resolve_source", { kind: "cutout", layerId: "f" })).toEqual({ ok: true, data: { sourceMediaId: "foto" } });
    expect(await editor.run("follow_job", { job: { id: "job-1", kind: "cutout", status: "queued", sourceMediaId: "foto" }, purpose: "cutout", layerId: "f" })).toMatchObject({ ok: true });
    const [job] = editor.ui.getState().jobs;
    expect(job).toMatchObject({ purpose: "cutout", layerId: "p", slot: "asset", startedFrom: "foto", byAgent: true });
    await editor.commands.jobDone(job.id, "recorte");
    expect(layer(editor, "p")).toMatchObject({ assetId: "recorte", clip: true });
    expect(layer(editor, "f").type).toBe("shape");
    editor.store.getState().undo();
    expect(layer(editor, "p").assetId).toBe("foto");
  });

  it("removes the background of a shape image fill in place", async () => {
    const editor = shows([{ ...newShapeLayer("rect"), id: "s", pattern }]);
    expect(await editor.run("resolve_source", { kind: "cutout", layerId: "s" })).toEqual({ ok: true, data: { sourceMediaId: "textura" } });
    await editor.run("follow_job", { job: { id: "job-1", kind: "cutout", status: "queued", sourceMediaId: "textura" }, purpose: "cutout", layerId: "s" });
    const [job] = editor.ui.getState().jobs;
    expect(job).toMatchObject({ purpose: "cutout", layerId: "s", slot: "pattern" });
    await editor.commands.jobDone(job.id, "recorte");
    expect(layer(editor, "s").pattern).toMatchObject({ source: "asset", assetId: "recorte", size: DEFAULT_PATTERN.size });
  });

  it("sends an AI edit of a grid cell photo back into the same cell", async () => {
    const base: Layer = { ...newShapeLayer("rect"), id: "base", groupId: "grid" };
    const editor = shows([base, frame("c1", "grid"), framed("p1", "a", "grid"), frame("c2", "grid"), framed("p2", "b", "grid")], [{ id: "grid", baseId: "base", layout: { direction: "horizontal", width: "fixed", height: "fixed" } }]);
    expect(await editor.run("resolve_source", { kind: "image", layerId: "c2" })).toEqual({ ok: true, data: { sourceMediaId: "b" } });
    await editor.run("follow_job", { job: { id: "job-2", kind: "image", status: "queued", referenceMediaIds: ["b", "estilo"] }, purpose: "image", layerId: "c2" });
    const [job] = editor.ui.getState().jobs;
    expect(job).toMatchObject({ purpose: "edit", layerId: "p2", startedFrom: "b" });
    await editor.commands.jobDone(job.id, "editada");
    expect(layer(editor, "p2").assetId).toBe("editada");
    expect(layer(editor, "p1").assetId).toBe("a");
    expect(editor.store.getState().document.artboards[0].layers).toHaveLength(5);
  });

  it("lands an AI edit of a plain image layer above it, like the manual edit", async () => {
    const editor = shows([{ ...newImageLayer("foto", box), id: "i" }]);
    await editor.run("follow_job", { job: { id: "job-3", kind: "image", status: "queued", referenceMediaIds: ["foto"] }, purpose: "image", layerId: "i" });
    await editor.commands.jobDone(editor.ui.getState().jobs[0].id, "editada");
    expect(editor.store.getState().document.artboards[0].layers.map((l) => l.assetId)).toEqual(["foto", "editada"]);
  });

  it("refuses what shows no picture, shows several, or is locked for a background removal", async () => {
    const two: Layer = { ...newShapeLayer("rect"), id: "two", pattern, fills: [{ type: "pattern", opacity: 1, pattern: { ...pattern, assetId: "papel" } }] };
    const editor = shows([frame("vazia"), two, { ...frame("f"), locked: true }, framed("p", "foto")]);
    expect(await editor.run("resolve_source", { kind: "cutout", layerId: "vazia" })).toMatchObject({ ok: false, error: { code: "wrong_source" } });
    expect(await editor.run("resolve_source", { kind: "cutout", layerId: "two" })).toMatchObject({ ok: false, error: { code: "wrong_source" } });
    expect(await editor.run("resolve_source", { kind: "cutout", layerId: "nada" })).toMatchObject({ ok: false, error: { code: "wrong_source" } });
    expect(await editor.run("resolve_source", { kind: "captions", layerId: "f" })).toMatchObject({ ok: false, error: { code: "wrong_source" } });
    expect(await editor.run("follow_job", { job: { id: "job-4", kind: "cutout", status: "queued" }, purpose: "cutout", layerId: "vazia" })).toMatchObject({ ok: false });
    expect(editor.ui.getState().jobs).toEqual([]);
  });

  it("refuses a background removal on a locked picture and allows an AI edit, which lands above it", async () => {
    const editor = shows([{ ...newImageLayer("foto", box), id: "i", locked: true }]);
    expect(await editor.run("resolve_source", { kind: "cutout", layerId: "i" })).toMatchObject({ ok: false, error: { code: "locked" } });
    expect(await editor.run("resolve_source", { kind: "image", layerId: "i" })).toEqual({ ok: true, data: { sourceMediaId: "foto" } });
  });
});
