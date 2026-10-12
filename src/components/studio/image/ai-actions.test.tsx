import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const permissions = vi.hoisted(() => ({ elo: true }));
const handoff = vi.hoisted(() => ({ handOffToElo: vi.fn() }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, permissionsLoading: false, can: (resource: string) => resource !== "ai_chat" || permissions.elo }),
}));
vi.mock("@/components/ai-chat/elo-handoff", () => handoff);
vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: vi.fn(),
  getMediaGenerationAction: vi.fn(),
  listMediaModelsAction: vi.fn(async () => ({ data: [{ id: "img-1", name: "Modelo de imagem", default: true }] })),
}));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));
vi.mock("@/components/studio/canvas/asset-images", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/studio/canvas/asset-images")>();
  return { ...actual, loadAssetImage: vi.fn(async (assetId: string) => ({ src: `blob:${assetId}` }) as HTMLImageElement) };
});
vi.mock("next/dynamic", () => ({ default: () => () => <div data-testid="stage">palco</div> }));

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import type { MediaGenerationJob } from "@/lib/media-generation/types";
import { emptyArtboard, imageDocument, newImageLayer, newShapeLayer, newTextLayer, type Layer, type StudioGroup } from "@/lib/studio/document";
import { DEFAULT_PATTERN, type Pattern } from "@/lib/studio/pattern";
import { createStudioStore } from "@/lib/studio/store";

import { CanvasArea } from "./canvas-area";
import { createImageCommands } from "./commands";
import { EditWithAiDialog } from "./edit-with-ai";
import { createEditorUiStore, ImageEditorContext } from "./editor-state";
import { LayersPanel } from "./panels/layers-panel";

const pt = ptMessages.studio.aiActions;

function job(kind: MediaGenerationJob["kind"]): MediaGenerationJob {
  return { id: `job-${kind}`, kind, status: "queued", referenceMediaIds: [], createdAt: "2026-10-11T00:00:00Z", updatedAt: "2026-10-11T00:00:00Z" };
}

function setup(layers: Layer[], ui: ReactNode = <LayersPanel />, groups?: StudioGroup[]) {
  const store = createStudioStore(imageDocument([{ ...emptyArtboard({ width: 1000, height: 1000 }), layers, ...(groups ? { groups } : {}) }]));
  const editorUi = createEditorUiStore();
  const requestJob = vi.fn(async (input: { kind: MediaGenerationJob["kind"] }) => ({ data: job(input.kind) }));
  const commands = createImageCommands(store, editorUi, { requestJob, naturalSize: vi.fn(async () => ({ width: 500, height: 500 })) });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui: editorUi, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          {ui}
          <EditWithAiDialog />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store, ui: editorUi, commands, requestJob };
}

function openAiMenu(rowName: RegExp) {
  fireEvent.contextMenu(screen.getByRole("button", { name: rowName }));
  fireEvent.click(screen.getByRole("menuitem", { name: pt.menu }));
}

const item = (name: string) => screen.getByRole("menuitem", { name });

const photo = (patch: Partial<Layer> = {}): Layer => ({ ...newImageLayer("foto-1"), id: "foto", ...patch });

beforeEach(() => {
  vi.clearAllMocks();
  permissions.elo = true;
});

describe("the AI group in the image editor context menu", () => {
  it("lists the image actions with their cost hints", { timeout: 15_000 }, () => {
    setup([photo()]);
    openAiMenu(/^Imagem, camada/);
    const names = within(screen.getAllByRole("menu").at(-1)!).getAllByRole("menuitem").map((el) => el.getAttribute("aria-label"));
    expect(names).toEqual([pt.items.removeBackground, pt.items.editImage, pt.items.imageVariation, pt.items.eloAsk]);
    expect(item(pt.items.removeBackground)).toHaveAccessibleDescription(pt.cost.free);
    expect(item(pt.items.editImage)).toHaveAccessibleDescription(pt.cost.paid);
  });

  it("removes the background of the layer and undoes it in one step", { timeout: 15_000 }, async () => {
    const { store, ui, commands, requestJob } = setup([photo()]);
    openAiMenu(/^Imagem, camada/);
    fireEvent.click(item(pt.items.removeBackground));
    expect(requestJob).toHaveBeenCalledWith({ kind: "cutout", sourceMediaId: "foto-1" });
    await waitFor(() => expect(ui.getState().jobs[0]?.created).not.toBeNull());
    await act(() => commands.jobDone(ui.getState().jobs[0].id, "recorte-1"));
    expect(store.getState().document.artboards[0].layers[0].assetId).toBe("recorte-1");
    act(() => store.getState().undo());
    expect(store.getState().document.artboards[0].layers[0].assetId).toBe("foto-1");
  });

  it("keeps a blocked action reachable, explains why and does nothing when chosen", { timeout: 15_000 }, () => {
    const { requestJob } = setup([photo({ locked: true })]);
    openAiMenu(/^Imagem, camada/);
    const blocked = item(pt.items.removeBackground);
    expect(blocked).toHaveAttribute("aria-disabled", "true");
    expect(blocked).not.toHaveAttribute("data-disabled");
    expect(blocked).toHaveAccessibleDescription(pt.blocked.locked);
    expect(blocked).toHaveAttribute("title", pt.blocked.locked);
    fireEvent.click(blocked);
    expect(requestJob).not.toHaveBeenCalled();
  });

  it("blocks a second background removal while one runs for the same layer", { timeout: 15_000 }, async () => {
    const { ui } = setup([photo()]);
    openAiMenu(/^Imagem, camada/);
    fireEvent.click(item(pt.items.removeBackground));
    await waitFor(() => expect(ui.getState().jobs).toHaveLength(1));
    openAiMenu(/^Imagem, camada/);
    expect(item(pt.items.removeBackground)).toHaveAccessibleDescription(pt.blocked.running);
  });

  it("asks for an AI edit through the existing paid form and charges nothing until the person confirms", { timeout: 15_000 }, async () => {
    const { store, ui, commands, requestJob } = setup([photo()]);
    openAiMenu(/^Imagem, camada/);
    fireEvent.click(item(pt.items.editImage));
    const dialog = await screen.findByRole("dialog", { name: ptMessages.studio.image.inspector.image.editWithAi });
    expect(within(dialog).getByText(ptMessages.studio.image.inspector.image.editHint)).toBeInTheDocument();
    const run = within(dialog).getByRole("button", { name: ptMessages.studio.image.inspector.image.editRun });
    expect(run).toBeDisabled();
    expect(requestJob).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "troque o fundo por uma praia" } });
    await waitFor(() => expect(run).toBeEnabled());
    fireEvent.click(run);
    expect(requestJob).toHaveBeenCalledTimes(1);
    expect(requestJob).toHaveBeenCalledWith({ kind: "image", model: "img-1", prompt: "troque o fundo por uma praia", aspect: "square", referenceMediaIds: ["foto-1"] });
    await waitFor(() => expect(ui.getState().jobs[0]?.created).not.toBeNull());
    await act(() => commands.jobDone(ui.getState().jobs[0].id, "editada-1"));
    expect(store.getState().document.artboards[0].layers.map((l) => l.assetId)).toEqual(["foto-1", "editada-1"]);
    act(() => store.getState().undo());
    expect(store.getState().document.artboards[0].layers.map((l) => l.assetId)).toEqual(["foto-1"]);
  });

  it("opens the generator with the image as a reference and a starting prompt for a variation, without generating", { timeout: 15_000 }, async () => {
    const { ui, requestJob } = setup([photo()]);
    openAiMenu(/^Imagem, camada/);
    fireEvent.click(item(pt.items.imageVariation));
    expect(ui.getState().panel).toBe("ai");
    expect(ui.getState().aiDraft.prompt).toBe(pt.prompts.imageVariation);
    await waitFor(() => expect(ui.getState().aiDraft.references).toEqual([{ mediaId: "foto-1", url: "blob:foto-1" }]));
    expect(requestJob).not.toHaveBeenCalled();
  });

  it("hands a text layer to Elo with the selection as context and a prefilled instruction", { timeout: 15_000 }, async () => {
    setup([{ ...newTextLayer("Oferta"), id: "t1" }]);
    openAiMenu(/^Oferta, camada/);
    const names = within(screen.getAllByRole("menu").at(-1)!).getAllByRole("menuitem").map((el) => el.getAttribute("aria-label"));
    expect(names).toEqual([pt.items.eloRewrite, pt.items.eloTranslate, pt.items.eloShorten, pt.items.eloAsk]);
    fireEvent.click(item(pt.items.eloTranslate));
    await waitFor(() =>
      expect(handoff.handOffToElo).toHaveBeenCalledWith({
        projectId: "p-1",
        prompt: `Sobre a seleção no design: "Oferta" (Texto, id t1)\n${pt.prompts.eloTranslate}`,
        attachments: [],
      }),
    );
  });

  it("attaches the image when handing an image layer to Elo", { timeout: 15_000 }, async () => {
    setup([photo()]);
    openAiMenu(/^Imagem, camada/);
    fireEvent.click(item(pt.items.eloAsk));
    await waitFor(() =>
      expect(handoff.handOffToElo).toHaveBeenCalledWith({
        projectId: "p-1",
        prompt: 'Sobre a seleção no design: "Imagem" (Imagem, id foto)\n',
        attachments: [{ mediaId: "foto-1", name: "Imagem", kind: "image", url: "blob:foto-1" }],
      }),
    );
  });

  it("offers only Elo on a shape and explains when the person may not use her", { timeout: 15_000 }, () => {
    permissions.elo = false;
    setup([{ ...newShapeLayer("rect"), id: "r1" }]);
    openAiMenu(/^Retângulo, camada/);
    const ask = item(pt.items.eloAsk);
    expect(ask).toHaveAttribute("aria-disabled", "true");
    expect(ask).toHaveAccessibleDescription(pt.blocked.noElo);
    fireEvent.click(ask);
    expect(handoff.handOffToElo).not.toHaveBeenCalled();
  });

  it("reaches the AI group from the keyboard", { timeout: 15_000 }, () => {
    setup([photo()]);
    fireEvent.contextMenu(screen.getByRole("button", { name: /^Imagem, camada/ }));
    const trigger = screen.getByRole("menuitem", { name: pt.menu });
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    expect(item(pt.items.removeBackground)).toBeInTheDocument();
  });

  it("shows the same group on the canvas menu", { timeout: 15_000 }, () => {
    const { store } = setup([photo()], <CanvasArea />);
    act(() => store.getState().select(["foto"]));
    fireEvent.contextMenu(screen.getAllByTestId("stage")[0]);
    fireEvent.click(screen.getByRole("menuitem", { name: pt.menu }));
    expect(item(pt.items.removeBackground)).toBeInTheDocument();
    expect(item(pt.items.editImage)).toBeInTheDocument();
  });
});

describe("image actions on elements that show a picture", () => {
  const box = { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotation: 0, opacity: 1 };
  const frame = (id: string, groupId?: string): Layer => ({ ...newShapeLayer("rect", box), id, ...(groupId ? { groupId } : {}) });
  const framed = (id: string, assetId: string, groupId?: string): Layer => ({ ...newImageLayer(assetId, box), id, clip: true, crop: { x: 0.1, y: 0.1, w: 0.6, h: 0.6 }, ...(groupId ? { groupId } : {}) });
  const IMAGE_ACTIONS = [pt.items.removeBackground, pt.items.editImage, pt.items.imageVariation, pt.items.eloAsk];

  function openOnCanvas(layers: Layer[], ids: string[], groups?: StudioGroup[]) {
    const editor = setup(layers, <CanvasArea />, groups);
    act(() => editor.store.getState().select(ids));
    fireEvent.contextMenu(screen.getAllByTestId("stage")[0]);
    fireEvent.click(screen.getByRole("menuitem", { name: pt.menu }));
    return editor;
  }

  const offered = () => within(screen.getAllByRole("menu").at(-1)!).getAllByRole("menuitem").map((el) => el.getAttribute("aria-label"));
  const layerOf = (editor: ReturnType<typeof setup>, id: string) => editor.store.getState().document.artboards[0].layers.find((l) => l.id === id)!;

  async function removeBackground(editor: ReturnType<typeof setup>, source: string) {
    fireEvent.click(item(pt.items.removeBackground));
    expect(editor.requestJob).toHaveBeenCalledWith({ kind: "cutout", sourceMediaId: source });
    await waitFor(() => expect(editor.ui.getState().jobs[0]?.created).not.toBeNull());
    editor.ui.setState((s) => ({ jobs: s.jobs.map((j) => ({ ...j, created: { ...j.created!, sourceMediaId: source } })) }));
    await act(() => editor.commands.jobDone(editor.ui.getState().jobs[0].id, "recorte"));
  }

  it("treats a frame holding a photo as the photo and swaps only the picture, keeping frame and crop", { timeout: 15_000 }, async () => {
    const editor = openOnCanvas([frame("f"), framed("p", "foto")], ["f"]);
    expect(offered()).toEqual(IMAGE_ACTIONS);
    await removeBackground(editor, "foto");
    expect(layerOf(editor, "p")).toMatchObject({ assetId: "recorte", clip: true, crop: { x: 0.1, y: 0.1, w: 0.6, h: 0.6 } });
    expect(layerOf(editor, "f").type).toBe("shape");
    act(() => editor.store.getState().undo());
    expect(layerOf(editor, "p").assetId).toBe("foto");
  });

  it("swaps the picture of a shape filled with an image", { timeout: 15_000 }, async () => {
    const shape: Layer = { ...newShapeLayer("rect"), id: "s", pattern: { ...DEFAULT_PATTERN, source: "asset", presetId: "", assetId: "textura" } };
    const editor = openOnCanvas([shape], ["s"]);
    expect(offered()).toEqual(IMAGE_ACTIONS);
    await removeBackground(editor, "textura");
    expect(layerOf(editor, "s").pattern).toMatchObject({ source: "asset", assetId: "recorte", size: DEFAULT_PATTERN.size });
    act(() => editor.store.getState().undo());
    expect(layerOf(editor, "s").pattern?.assetId).toBe("textura");
  });

  it("puts an AI edit of a mockup screen back into the screen in one step", { timeout: 15_000 }, async () => {
    const chrome: Layer = { ...newShapeLayer("rect"), id: "corpo", groupId: "m" };
    const editor = openOnCanvas([chrome, frame("tela", "m"), framed("p", "print", "m")], ["corpo", "tela", "p"], [{ id: "m", baseId: "corpo" }]);
    expect(offered()).toEqual(IMAGE_ACTIONS);
    fireEvent.click(item(pt.items.editImage));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "tela escura" } });
    const run = within(dialog).getByRole("button", { name: ptMessages.studio.image.inspector.image.editRun });
    await waitFor(() => expect(run).toBeEnabled());
    fireEvent.click(run);
    expect(editor.requestJob).toHaveBeenCalledWith(expect.objectContaining({ kind: "image", referenceMediaIds: ["print"] }));
    await waitFor(() => expect(editor.ui.getState().jobs[0]?.created).not.toBeNull());
    editor.ui.setState((s) => ({ jobs: s.jobs.map((j) => ({ ...j, created: { ...j.created!, referenceMediaIds: ["print"] } })) }));
    await act(() => editor.commands.jobDone(editor.ui.getState().jobs[0].id, "editada"));
    const layers = editor.store.getState().document.artboards[0].layers;
    expect(layers.map((l) => l.id)).toEqual(["corpo", "tela", "p"]);
    expect(layerOf(editor, "p")).toMatchObject({ assetId: "editada", clip: true });
    act(() => editor.store.getState().undo());
    expect(layerOf(editor, "p").assetId).toBe("print");
  });

  it("targets the photo of the chosen grid cell", { timeout: 15_000 }, async () => {
    const base: Layer = { ...newShapeLayer("rect"), id: "base", groupId: "grid" };
    const editor = openOnCanvas(
      [base, frame("c1", "grid"), framed("p1", "a", "grid"), frame("c2", "grid"), framed("p2", "b", "grid")],
      ["c2"],
      [{ id: "grid", baseId: "base", layout: { direction: "horizontal", width: "fixed", height: "fixed" } }],
    );
    expect(offered()).toEqual(IMAGE_ACTIONS);
    await removeBackground(editor, "b");
    expect(layerOf(editor, "p2").assetId).toBe("recorte");
    expect(layerOf(editor, "p1").assetId).toBe("a");
  });

  it("offers the image actions on a group with exactly one picture", { timeout: 15_000 }, async () => {
    const editor = openOnCanvas([{ ...newTextLayer("Oferta"), id: "t", groupId: "g" }, { ...newImageLayer("foto"), id: "i", groupId: "g" }], ["t", "i"], [{ id: "g" }]);
    expect(offered()).toEqual(IMAGE_ACTIONS);
    await removeBackground(editor, "foto");
    expect(layerOf(editor, "i").assetId).toBe("recorte");
  });

  it("offers only Elo on a group with several pictures, with every picture attached", { timeout: 15_000 }, async () => {
    openOnCanvas([{ ...newImageLayer("a"), id: "i1", groupId: "g" }, { ...newImageLayer("b"), id: "i2", groupId: "g" }], ["i1", "i2"], [{ id: "g" }]);
    expect(offered()).toEqual([pt.items.eloAsk]);
    fireEvent.click(item(pt.items.eloAsk));
    await waitFor(() => expect(handoff.handOffToElo).toHaveBeenCalledWith(expect.objectContaining({ attachments: [expect.objectContaining({ mediaId: "a" }), expect.objectContaining({ mediaId: "b" })] })));
  });
});

describe("when the element changes before the job finishes", () => {
  async function runCutout(editor: ReturnType<typeof setup>) {
    act(() => editor.store.getState().select(["foto"]));
    void editor.commands.startJob("cutout", { kind: "cutout", sourceMediaId: "foto-1" }, "foto");
    await waitFor(() => expect(editor.ui.getState().jobs[0]?.created).not.toBeNull());
    editor.ui.setState((s) => ({ jobs: s.jobs.map((j) => ({ ...j, created: { ...j.created!, sourceMediaId: "foto-1" } })) }));
    return editor.ui.getState().jobs[0].id;
  }

  it("lands the result as a new layer when the layer was deleted", { timeout: 15_000 }, async () => {
    const editor = setup([photo()]);
    const id = await runCutout(editor);
    act(() => editor.commands.remove());
    await act(() => editor.commands.jobDone(id, "recorte-1"));
    expect(editor.store.getState().document.artboards[0].layers.map((l) => l.assetId)).toEqual(["recorte-1"]);
  });

  it("keeps a replacement picture and lands the result above it", { timeout: 15_000 }, async () => {
    const editor = setup([photo()]);
    const id = await runCutout(editor);
    await act(async () => void (await editor.commands.replaceImage("foto", "outra")));
    await act(() => editor.commands.jobDone(id, "recorte-1"));
    expect(editor.store.getState().document.artboards[0].layers.map((l) => l.assetId)).toEqual(["outra", "recorte-1"]);
  });

  it("keeps a picture replaced inside a shape fill and lands the result above the shape", { timeout: 15_000 }, async () => {
    const pattern: Pattern = { ...DEFAULT_PATTERN, source: "asset", presetId: "", assetId: "textura" };
    const editor = setup([{ ...newShapeLayer("rect"), id: "s", pattern }]);
    void editor.commands.startJob("cutout", { kind: "cutout", sourceMediaId: "textura" }, "s", "pattern");
    await waitFor(() => expect(editor.ui.getState().jobs[0]?.created).not.toBeNull());
    act(() => editor.commands.patchLayers(["s"], { pattern: { ...pattern, assetId: "outra" } }));    await act(() => editor.commands.jobDone(editor.ui.getState().jobs[0].id, "recorte-1"));
    const layers = editor.store.getState().document.artboards[0].layers;
    expect(layers.map((l) => l.pattern?.assetId ?? l.assetId)).toEqual(["outra", "recorte-1"]);
  });

  it("never overwrites the picture when a followed job does not say what it started from", { timeout: 15_000 }, async () => {
    const editor = setup([photo()]);
    let id = "";
    act(() => void (id = editor.commands.followJob("cutout", job("cutout"), "foto")));
    await act(() => editor.commands.jobDone(id, "recorte-1"));
    expect(editor.store.getState().document.artboards[0].layers.map((l) => l.assetId)).toEqual(["foto-1", "recorte-1"]);
  });

  it("keeps editing the layer while its job runs", { timeout: 15_000 }, async () => {
    const editor = setup([photo()]);
    const id = await runCutout(editor);
    act(() => editor.commands.patchLayers(["foto"], { flipX: true }));
    await act(() => editor.commands.jobDone(id, "recorte-1"));
    expect(editor.store.getState().document.artboards[0].layers[0]).toMatchObject({ assetId: "recorte-1", flipX: true });
  });
});
