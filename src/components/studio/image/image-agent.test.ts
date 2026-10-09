import { describe, expect, it, vi } from "vitest";

import type { ScreenCommand, ScreenReply } from "@/lib/aichat/screen";
import { emptyArtboard, imageDocument, newShapeLayer, newTextLayer, type ImageDocument } from "@/lib/studio/document";
import { layerOf } from "@/lib/studio/artboards";
import { createStudioStore } from "@/lib/studio/store";

import { createAgentPresence } from "../agent/presence";
import { createImageCommands } from "./commands";
import { createEditorUiStore } from "./editor-state";
import { createImageAgent } from "./image-agent";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async (id: string) => ({ id, description: `Foto ${id}`, url: "", previewUrl: "", createdAt: "", type: "image" })),
}));

function doc(): ImageDocument {
  return imageDocument([{ ...emptyArtboard({ width: 1080, height: 1080 }), layers: [{ ...newShapeLayer("rect"), id: "bg" }, { ...newTextLayer("Oi"), id: "t" }, { ...newShapeLayer("rect"), id: "photo-frame" }] }]);
}

function setup() {
  const store = createStudioStore(doc());
  const ui = createEditorUiStore();
  const naturalSize = vi.fn(async () => ({ width: 800, height: 400 }));
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize });
  const agent = createImageAgent({ store, ui, commands, naturalSize, presence: createAgentPresence(), label: (a) => a, reduceMotion: () => true });
  const run = (name: ScreenCommand["name"], args?: unknown): Promise<ScreenReply> => agent({ id: "cmd", name, projectId: "p-1", args });
  return { store, ui, run };
}

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
