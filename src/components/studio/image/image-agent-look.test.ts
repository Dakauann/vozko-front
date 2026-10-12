import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyArtboard, imageDocument, newImageLayer, newShapeLayer, newTextLayer, type ImageDocument } from "@/lib/studio/document";
import { createStudioStore } from "@/lib/studio/store";

import { createAgentPresence, type AgentPresenceState } from "../agent/presence";
import { placed } from "../agent/test-placement";
import { createImageCommands } from "./commands";
import { createEditorUiStore } from "./editor-state";
import { createImageAgent, createImageReveal } from "./image-agent";
import { captureArtboard, captureArtboards, captureBackdrop } from "../agent/frame-capture";

const SHOT = "data:image/jpeg;base64,U0hPVA==";
const seenDuringCapture = vi.hoisted(() => ({ state: null as AgentPresenceState | null, read: (() => null) as () => AgentPresenceState | null }));

vi.mock("../agent/frame-capture", () => {
  const capture = async () => {
    seenDuringCapture.state = seenDuringCapture.read();
    return SHOT;
  };
  const backdrop = async () => ({ data: new Uint8ClampedArray(4 * 4 * 4).fill(245), width: 4, height: 4 });
  return { captureArtboard: vi.fn(capture), captureArtboards: vi.fn(capture), captureLibraryImage: vi.fn(capture), captureBackdrop: vi.fn(backdrop) };
});

vi.mock("../canvas/lut-files", async (importOriginal) => ({ ...(await importOriginal<typeof import("../canvas/lut-files")>()), lutReadable: async (id: string) => id !== "lost-look" }));

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async (id: string) => ({ id, description: id, url: "", previewUrl: "", createdAt: "", type: "image" })),
}));

function boards(): ImageDocument {
  const first = { ...emptyArtboard({ width: 1000, height: 500 }), id: "ab-1", x: 0, y: 0, layers: [{ ...newShapeLayer("rect"), id: "r" }] };
  const second = { ...emptyArtboard({ width: 1000, height: 500 }), id: "ab-2", name: "Capa", x: 1200, y: 0, layers: [] };
  return imageDocument([first, second]);
}

function setup() {
  const store = createStudioStore(boards());
  const ui = createEditorUiStore();
  const naturalSize = vi.fn(async () => ({ width: 800, height: 400 }));
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize });
  const presence = createAgentPresence();
  seenDuringCapture.read = () => presence.store.getState();
  const agent = createImageAgent({ store, ui, commands, naturalSize, presence, label: (action) => action, reduceMotion: () => true, projectId: "p-1", projectName: "Projeto", exportTitle: () => "Projeto" });
  return { store, ui, commands, presence, look: (args: unknown) => agent({ id: "cmd", name: "look", projectId: "p-1", args }) };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Elo looking at artboards", () => {
  it("refuses to look at an artboard whose photo uses a LUT that cannot be read, naming the layer", async () => {
    const { store, look } = setup();
    store.getState().apply((doc) => ({ ...doc, artboards: doc.artboards.map((artboard) => (artboard.id === "ab-2" ? { ...artboard, layers: [{ ...newImageLayer("photo"), id: "hero", name: "Foto", color: { lut: { assetId: "lost-look" } } }] } : artboard)) }));
    vi.mocked(captureArtboard).mockClear();
    vi.mocked(captureArtboards).mockClear();
    for (const artboard_id of ["ab-2", "all"]) {
      const reply = await look({ artboard_id });
      expect(reply).toMatchObject({ ok: false, error: { code: "lut_unavailable" } });
      expect(JSON.stringify(reply)).toContain("hero (Foto)");
    }
    expect(await look({ artboard_id: "ab-1" })).toMatchObject({ ok: true });
    expect(captureArtboards).not.toHaveBeenCalled();
    expect(captureArtboard).toHaveBeenCalledTimes(1);
  });

  it("points at the artboard she looks at and names it by its place and name", async () => {
    placed("data-studio-canvas", { left: 0, top: 0, width: 800, height: 600 });
    const { ui, presence, look } = setup();
    ui.setState({ viewport: { scale: 0.25, x: 0, y: 0 } });
    const reply = await look({ artboard_id: "ab-2" });
    expect(reply).toMatchObject({ ok: true, images: [SHOT], target: { kind: "artboard", artboardId: "ab-2", n: 2, name: "Capa" } });
    expect(seenDuringCapture.state).toMatchObject({ visible: true, label: "look", outline: { left: 300, top: 0, width: 250, height: 125 } });
    expect(presence.shots.store.getState().shots[0]).toMatchObject({ image: SHOT, target: { kind: "artboard", artboardId: "ab-2" } });
  });

  it("outlines only the zoomed part when she looks closer", async () => {
    placed("data-studio-canvas", { left: 0, top: 0, width: 800, height: 600 });
    const { ui, look } = setup();
    ui.setState({ viewport: { scale: 0.25, x: 0, y: 0 } });
    await look({ artboard_id: "ab-1", region: { x: 0.25, y: 0.5, w: 0.5, h: 0.5 } });
    expect(seenDuringCapture.state!.outline).toEqual({ left: 0, top: 31.25, width: 125, height: 62.5 });
  });

  it("names a look at the whole sheet without pointing at one artboard", async () => {
    const { look } = setup();
    expect(await look({ artboard_id: "all" })).toMatchObject({ ok: true, target: { kind: "artboards" } });
  });

  it("draws the wireframe with every layer numbered and lists each layer's kind", async () => {
    const { look } = setup();
    vi.mocked(captureArtboard).mockClear();
    const reply = await look({ artboard_id: "ab-1", view: "wireframe" });
    expect(reply).toMatchObject({ ok: true, data: { view: "wireframe", marks: [{ n: 1, id: "r", kind: "shape" }] } });
    expect(vi.mocked(captureArtboard).mock.calls[0][1]).toMatchObject({ view: "wireframe", numbered: true, targets: [{ id: "r" }] });
  });

  it("reports shared edges and the angles of tilted layers with the guides view", async () => {
    const { store, look } = setup();
    store.getState().apply((doc) => ({
      ...doc,
      artboards: doc.artboards.map((artboard) =>
        artboard.id === "ab-1"
          ? {
              ...artboard,
              layers: [
                { ...newShapeLayer("rect"), id: "a", transform: { x: 0.3, y: 0.3, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } },
                { ...newShapeLayer("rect"), id: "b", transform: { x: 0.3, y: 0.7, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } },
                { ...newShapeLayer("rect"), id: "band", transform: { x: 0.5, y: 0.5, w: 1.3, h: 0.1, rotation: -10, opacity: 1 } },
              ],
            }
          : artboard,
      ),
    }));
    const reply = await look({ artboard_id: "ab-1", view: "guides" });
    expect(reply).toMatchObject({ ok: true, data: { view: "guides", guides: { angles: [{ degrees: -10, ids: ["band"] }] } } });
    expect(JSON.stringify(reply)).toContain('"ids":["a","b"]');
  });

  it("reads the light of every shadow with the depth view and draws one arrow per shadow", async () => {
    const { store, look } = setup();
    const card = (id: string, x: number, y: number) => ({ ...newShapeLayer("rect"), id, fill: "#ffffff", transform: { x, y: 0.5, w: 0.2, h: 0.4, rotation: 0, opacity: 1 }, effects: [{ id: "s", type: "drop-shadow" as const, color: "#000000", opacity: 0.25, x: 0, y, blur: 20, spread: 0 }] });
    store.getState().apply((doc) => ({ ...doc, artboards: doc.artboards.map((artboard) => (artboard.id === "ab-1" ? { ...artboard, layers: [card("a", 0.2, 12), card("b", 0.5, 12), card("c", 0.8, -12)] } : artboard)) }));
    vi.mocked(captureArtboard).mockClear();
    const reply = await look({ artboard_id: "ab-1", view: "depth" });
    expect(reply).toMatchObject({ ok: true, data: { view: "depth", depth: { light: expect.stringMatching(/^3 sombras/), findings: [expect.stringMatching(/^aviso: a sombra de c cai para cima/)] } } });
    const overlay = vi.mocked(captureArtboard).mock.calls[0][1];
    expect(overlay?.shapes?.filter((shape) => shape.kind === "arrow")).toHaveLength(3);
  });

  it("adds the measured layout to the guides view and draws its problems", async () => {
    const { store, look } = setup();
    store.getState().apply((doc) => ({
      ...doc,
      artboards: doc.artboards.map((artboard) =>
        artboard.id === "ab-1"
          ? {
              ...artboard,
              layers: [
                { ...newShapeLayer("rect"), id: "a", transform: { x: 0.3, y: 0.3, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } },
                { ...newShapeLayer("rect"), id: "b", transform: { x: 0.3, y: 0.7, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } },
                { ...newShapeLayer("rect"), id: "c", transform: { x: 0.31, y: 0.5, w: 0.2, h: 0.1, rotation: 0, opacity: 1 } },
              ],
            }
          : artboard,
      ),
    }));
    vi.mocked(captureArtboard).mockClear();
    const reply = await look({ artboard_id: "ab-1", view: "guides" });
    expect(reply).toMatchObject({ ok: true, data: { layout: { findings: expect.arrayContaining([expect.stringMatching(/^aviso: c está 10 px fora da linha de a, b/)]) } } });
    expect(vi.mocked(captureArtboard).mock.calls[0][1]?.shapes?.length).toBeGreaterThan(0);
  });

  it("brings the measured depth and layout problems into a plain look as short alerts, and nothing when all is well", async () => {
    const { store, look } = setup();
    const shadowed = { ...newShapeLayer("rect"), id: "r", fill: "#ffffff", transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.3, rotation: 0, opacity: 1 }, effects: [{ id: "s", type: "drop-shadow" as const, color: "#000000", opacity: 1, x: 0, y: 20, blur: 2, spread: 0 }] };
    store.getState().apply((doc) => ({ ...doc, artboards: doc.artboards.map((artboard) => (artboard.id === "ab-1" ? { ...artboard, layers: [shadowed] } : artboard)) }));
    const reply = await look({ artboard_id: "ab-1" });
    expect(reply).toMatchObject({ ok: true, data: { alerts: expect.arrayContaining([expect.stringMatching(/^aviso: a sombra de r está quase opaca/)]) } });
    expect(JSON.stringify(await look({ artboard_id: "ab-2" }))).not.toContain("alerts");
  });

  it("zooms onto one layer with focus_id and refuses a layer that is not there", async () => {
    const { store, look } = setup();
    store.getState().apply((doc) => ({ ...doc, artboards: doc.artboards.map((artboard) => (artboard.id === "ab-1" ? { ...artboard, layers: [{ ...newShapeLayer("rect"), id: "r", transform: { x: 0.25, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 } }] } : artboard)) }));
    vi.mocked(captureArtboard).mockClear();
    const reply = await look({ focus_id: "r" });
    expect(reply).toMatchObject({ ok: true, data: { artboard_id: "ab-1", focus_id: "r", region: { x: 0.25, y: 0.5, w: 0.3, h: 0.3 } } });
    expect(vi.mocked(captureArtboard).mock.calls[0][2]).toMatchObject({ left: 0.1, width: 0.3 });
    expect(await look({ focus_id: "gone" })).toMatchObject({ ok: false, error: { code: "layer_not_found" } });
    expect(await look({ focus_id: "r", region: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } })).toMatchObject({ ok: false, error: { code: "invalid_region" } });
  });

  it("refuses a view it does not know", async () => {
    const { look } = setup();
    expect(await look({ view: "xray" })).toMatchObject({ ok: false, error: { code: "invalid_view" } });
  });

  it("measures text contrast on the rendered pixels behind each text", async () => {
    const { store, look } = setup();
    store.getState().apply((doc) => ({ ...doc, artboards: doc.artboards.map((artboard) => (artboard.id === "ab-1" ? { ...artboard, layers: [{ ...newTextLayer("Oferta"), id: "t", fill: "#ffffff", fontSize: 0.05, transform: { x: 0.5, y: 0.5, w: 0.6, h: 0.2, rotation: 0, opacity: 1 } }] } : artboard)) }));
    vi.mocked(captureBackdrop).mockClear();
    const reply = await look({ artboard_id: "ab-1" });
    expect(captureBackdrop).toHaveBeenCalledTimes(1);
    expect(reply).toMatchObject({ ok: true, data: { legibility: [expect.stringMatching(/^erro: o texto t /)] } });
    vi.mocked(captureBackdrop).mockClear();
    await look({ artboard_id: "ab-2" });
    expect(captureBackdrop).not.toHaveBeenCalled();
  });

  it("selects and brings the artboard into view when the reader asks, and ignores one that is gone", () => {
    const { store, ui, commands } = setup();
    const reveal = createImageReveal({ store, commands });
    reveal({ kind: "artboard", artboardId: "ab-2", n: 2 });
    expect(store.getState().selection).toEqual(["ab-2"]);
    expect(ui.getState().artboardId).toBe("ab-2");
    reveal({ kind: "artboard", artboardId: "gone", n: 9 });
    expect(store.getState().selection).toEqual(["ab-2"]);
  });
});
