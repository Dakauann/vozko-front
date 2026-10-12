import { act, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }),
  listLibraryAction: vi.fn().mockResolvedValue({ data: [{ id: "photo-1", type: "image", url: "https://cdn.test/photo-1.jpg" }] }),
  uploadMediaAction: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "u-1" }));

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { imageDocument, newShapeLayer, type Layer } from "@/lib/studio/document";
import { settleImage } from "@/lib/studio/image-settle";
import { createStudioStore } from "@/lib/studio/store";

import { createImageCommands } from "./commands";
import { createEditorUiStore, ImageEditorContext } from "./editor-state";
import { useImageCanvasDrop } from "./library-adapter";
import { UploadsPanel } from "./panels/uploads-panel";
import { PHOTO_DRAG_TYPE } from "./photo-drag";

const FRAME: Layer = { ...newShapeLayer("ellipse", { x: 0.25, y: 0.5, w: 0.3, h: 0.3, rotation: 0, opacity: 1 }), id: "frame" };

function Canvas() {
  const drop = useImageCanvasDrop();
  return <div data-testid="canvas" onDragOver={drop.onDragOver} onDrop={drop.onDrop} />;
}

function setup(selection: string[] = []) {
  const doc = imageDocument([{ id: "post", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers: [FRAME] }]);
  const store = createStudioStore(doc, { settle: settleImage });
  const ui = createEditorUiStore();
  ui.setState({ artboardId: "post" });
  const naturalSize = vi.fn(async () => ({ width: 2000, height: 1000 }));
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize });
  if (selection.length > 0) store.getState().select(selection);
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          <Canvas />
          <UploadsPanel />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store, layers: () => store.getState().document.artboards[0].layers };
}

function dropPhoto(x: number, y: number) {
  const canvas = screen.getByTestId("canvas");
  const dataTransfer = { types: [PHOTO_DRAG_TYPE], getData: (type: string) => (type === PHOTO_DRAG_TYPE ? "photo-1" : ""), dropEffect: "" };
  fireEvent.dragOver(canvas, { dataTransfer });
  const drop = createEvent.drop(canvas, { dataTransfer });
  Object.defineProperty(drop, "clientX", { value: x });
  Object.defineProperty(drop, "clientY", { value: y });
  act(() => {
    fireEvent(canvas, drop);
  });
}

describe("dropping a photo on the image canvas", () => {
  it("fills the frame under the pointer with a clipped, cover cropped photo", { timeout: 15_000 }, async () => {
    const { layers } = setup();
    dropPhoto(250, 500);
    await waitFor(() => expect(layers()).toHaveLength(2));
    const [frame, photo] = layers();
    expect(frame.id).toBe("frame");
    expect(photo).toMatchObject({ type: "image", assetId: "photo-1", clip: true, transform: FRAME.transform, crop: { x: 0.25, y: 0, w: 0.5, h: 1 } });
  });

  it("swaps the photo when a second one lands on a filled frame", { timeout: 15_000 }, async () => {
    const { layers } = setup();
    dropPhoto(250, 500);
    await waitFor(() => expect(layers()).toHaveLength(2));
    dropPhoto(250, 500);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(layers()).toHaveLength(2);
  });

  it("places a plain photo at the pointer away from frames", { timeout: 15_000 }, async () => {
    const { layers } = setup();
    dropPhoto(800, 200);
    await waitFor(() => expect(layers()).toHaveLength(2));
    expect(layers()[1]).toMatchObject({ type: "image", assetId: "photo-1" });
    expect(layers()[1].clip).toBeUndefined();
    expect(layers()[1].transform).toMatchObject({ x: 0.8, y: 0.2 });
  });
});

describe("the uploads panel", () => {
  it("tells how to fill frames and fills the selected frame on click", { timeout: 15_000 }, async () => {
    const { layers } = setup(["frame"]);
    expect(screen.getByText(ptMessages.studio.image.panels.uploads.fillHint)).toBeTruthy();
    const pick = await screen.findByRole("button", { name: ptMessages.studio.image.media.pick });
    expect(pick.getAttribute("draggable")).toBe("true");
    const written: Record<string, string> = {};
    fireEvent.dragStart(pick, { dataTransfer: { setData: (type: string, value: string) => (written[type] = value), effectAllowed: "" } });
    expect(written[PHOTO_DRAG_TYPE]).toBe("photo-1");
    fireEvent.click(pick);
    await waitFor(() => expect(layers()).toHaveLength(2));
    expect(layers()[1]).toMatchObject({ clip: true, assetId: "photo-1" });
  });

  it("asks to drag photos onto frames when no frame is selected", { timeout: 15_000 }, () => {
    setup();
    expect(screen.getByText(ptMessages.studio.image.panels.uploads.dragHint)).toBeTruthy();
  });
});
