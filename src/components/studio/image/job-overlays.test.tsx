import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock("framer-motion", async (importOriginal) => ({ ...(await importOriginal<typeof import("framer-motion")>()), useReducedMotion: () => motion.reduced }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, permissionsLoading: false, can: () => true }) }));
vi.mock("@/components/ai-chat/elo-handoff", () => ({ handOffToElo: vi.fn() }));
vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: vi.fn(),
  getMediaGenerationAction: vi.fn(),
  listMediaModelsAction: vi.fn(async () => ({ data: [{ id: "img-1", name: "Modelo", default: true }] })),
}));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { listLibraryAction } from "@/app/actions/medias";
import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import type { MediaGenerationInput, MediaGenerationJob } from "@/lib/media-generation/types";
import { placeholderTransform } from "@/lib/studio/job-overlay";
import { boxStyle } from "@/lib/studio/playback";
import { emptyArtboard, imageDocument, newImageLayer, type Layer } from "@/lib/studio/document";
import { OVERLAY_FAILURE_MS } from "@/lib/studio/job-overlay";
import { createStudioStore } from "@/lib/studio/store";

import { createImageCommands } from "./commands";
import { createEditorUiStore, ImageEditorContext } from "./editor-state";
import { ImageElementGenerator } from "./element-generator";
import { ImageJobOverlays } from "./job-overlays";
import { AiPanel } from "./panels/ai-panel";
import { LayersPanel } from "./panels/layers-panel";
import { UploadsPanel } from "./panels/uploads-panel";

const jobs = ptMessages.studio.image.jobs;

const created: MediaGenerationJob = { id: "srv-1", kind: "cutout", status: "queued", referenceMediaIds: [], sourceMediaId: "foto-1", createdAt: "2026-10-11T00:00:00Z", updatedAt: "2026-10-11T00:00:00Z" };

const tilted: Layer = { ...newImageLayer("foto-1", { x: 0.25, y: 0.5, w: 0.2, h: 0.1, rotation: 30, opacity: 1 }), id: "foto" };

function setup(ui: ReactNode = null, layers: Layer[] = [tilted]) {
  const store = createStudioStore(imageDocument([{ ...emptyArtboard({ width: 1000, height: 1000 }), layers }]));
  const editorUi = createEditorUiStore();
  editorUi.setState({ viewport: { scale: 0.5, x: 10, y: 20 }, container: { width: 1200, height: 800 } });
  const requestJob = vi.fn(async (input: MediaGenerationInput) => ({ data: input.kind === "image" ? { ...created, id: "srv-2", kind: "image" as const, aspect: input.aspect, referenceMediaIds: input.referenceMediaIds ?? [] } : created }));
  const naturalSize = vi.fn(async (assetId: string) => (assetId === "gerada" ? { width: 1920, height: 1080 } : { width: 500, height: 500 }));
  const commands = createImageCommands(store, editorUi, { requestJob, naturalSize });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui: editorUi, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>
          {ui}
          <ImageJobOverlays />
        </TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store, ui: editorUi, commands };
}

const overlay = () => document.querySelector<HTMLElement>('[data-job-overlay="foto"]');

beforeEach(() => {
  motion.reduced = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the in-progress overlay on an image layer", () => {
  it("appears over the layer when the background removal starts from the context menu", { timeout: 15_000 }, async () => {
    setup(<LayersPanel />);
    fireEvent.contextMenu(screen.getByRole("button", { name: /^Imagem, camada/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: ptMessages.studio.aiActions.menu }));
    fireEvent.click(screen.getByRole("menuitem", { name: ptMessages.studio.aiActions.items.removeBackground }));
    await waitFor(() => expect(overlay()).not.toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent(jobs.running.cutout);
  });

  it("appears over the layer when the background removal starts from the AI panel", { timeout: 15_000 }, async () => {
    const { store } = setup(<AiPanel />);
    act(() => store.getState().select(["foto"]));
    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.image.removeBackground.run }));
    await waitFor(() => expect(overlay()).not.toBeNull());
    expect(document.querySelector('[data-studio-ui-only] [role="status"]')).toHaveTextContent(jobs.running.cutout);
  });

  it("appears over the layer for a job Elo started", { timeout: 15_000 }, () => {
    const { commands } = setup();
    act(() => void commands.followJob("cutout", created, "foto"));
    expect(overlay()).not.toBeNull();
    expect(overlay()).toHaveAttribute("data-phase", "running");
  });

  it("draws through the shared AI progress surface, which carries the status", { timeout: 15_000 }, () => {
    const { commands } = setup();
    act(() => void commands.followJob("cutout", created, "foto"));
    const surface = overlay()!.querySelector("[data-ai-progress]")!;
    expect(surface).toHaveAttribute("data-ai-progress", "running");
    expect(surface.querySelector('[role="status"]')).toHaveTextContent(jobs.running.cutout);
  });

  it("sits exactly on the layer's rotated box through pan and zoom", { timeout: 15_000 }, () => {
    const { ui, commands } = setup();
    act(() => void commands.followJob("cutout", created, "foto"));
    const frame = overlay()!.parentElement!;
    expect(frame.style).toMatchObject({ left: "10px", top: "20px", width: "500px", height: "500px" });
    expect(overlay()!.style).toMatchObject({ left: "15%", top: "45%", width: "20%", height: "10%", transform: "rotate(30deg)" });
    act(() => ui.setState({ viewport: { scale: 1, x: -40, y: 5 } }));
    expect(overlay()!.parentElement!.style).toMatchObject({ left: "-40px", top: "5px", width: "1000px", height: "1000px" });
  });

  it("follows the layer while it is dragged, moved and undone, and the layer stays editable", { timeout: 15_000 }, () => {
    const { store, ui, commands } = setup();
    act(() => void commands.followJob("cutout", created, "foto"));
    act(() => ui.setState({ live: { foto: { ...tilted.transform, x: 0.6 } } }));
    expect(overlay()!.style.left).toBe("50%");
    act(() => ui.setState({ live: null }));
    act(() => commands.patchLayers(["foto"], { transform: { ...tilted.transform, x: 0.75 } }));
    expect(overlay()!.style.left).toBe("65%");
    act(() => store.getState().undo());
    expect(overlay()!.style.left).toBe("15%");
  });

  it("goes away when the job finishes", { timeout: 15_000 }, async () => {
    const { ui, commands } = setup();
    let id = "";
    act(() => void (id = commands.followJob("cutout", created, "foto")));
    await act(() => commands.jobDone(id, "recorte"));
    expect(ui.getState().jobs).toEqual([]);
    expect(overlay()).toBeNull();
  });

  it("turns into a brief error with the job's failure message and then clears", { timeout: 15_000 }, () => {
    vi.useFakeTimers();
    const { ui, commands } = setup();
    let id = "";
    act(() => void (id = commands.followJob("cutout", created, "foto")));
    act(() => commands.jobFailed(id, "provider_busy"));
    expect(overlay()).toHaveAttribute("data-phase", "failed");
    expect(screen.getByRole("status")).toHaveTextContent(`${jobs.failed.cutout}. ${jobs.errors.provider_busy}`);
    expect(document.querySelector("[data-job-pill]")).toHaveTextContent(jobs.failed.cutout);
    expect(document.querySelector("[data-job-pill]")).toHaveAttribute("title", `${jobs.failed.cutout}. ${jobs.errors.provider_busy}`);
    act(() => vi.advanceTimersByTime(OVERLAY_FAILURE_MS));
    expect(overlay()).toBeNull();
    expect(ui.getState().jobs).toHaveLength(1);
  });

  it("hides while the layer is gone and never touches the document", { timeout: 15_000 }, () => {
    const { store, commands } = setup();
    const before = store.getState().document;
    act(() => void commands.followJob("cutout", created, "foto"));
    expect(store.getState().document).toBe(before);
    expect(overlay()!.closest("[data-studio-ui-only]")).not.toBeNull();
    expect(overlay()!.closest("[data-studio-canvas]")).toBeNull();
    expect(overlay()!.className).toContain("pointer-events-none");
    act(() => store.getState().select(["foto"]));
    act(() => commands.remove());
    expect(overlay()).toBeNull();
  });

  it("keeps the pill inside a large upright layer and outside once zoomed out", { timeout: 15_000 }, () => {
    const big: Layer = { ...newImageLayer("foto-1", { x: 0.5, y: 0.5, w: 0.6, h: 0.4, rotation: 0, opacity: 1 }), id: "foto" };
    const { ui, commands } = setup(null, [big]);
    act(() => ui.setState({ viewport: { scale: 1, x: 0, y: 0 } }));
    act(() => void commands.followJob("cutout", created, "foto"));
    expect(document.querySelector("[data-job-pill]")).toHaveAttribute("data-job-pill", "inside");
    expect(overlay()!.querySelector("[data-job-pill]")).not.toBeNull();
    act(() => ui.setState({ viewport: { scale: 0.2, x: 0, y: 0 } }));
    expect(document.querySelector("[data-job-pill]")).toHaveAttribute("data-job-pill", "below");
    expect(overlay()!.querySelector("[data-job-pill]")).toBeNull();
  });

  it("anchors the pill outside a rotated layer instead of turning its text", { timeout: 15_000 }, () => {
    const turned: Layer = { ...newImageLayer("foto-1", { x: 0.5, y: 0.3, w: 0.6, h: 0.4, rotation: 90, opacity: 1 }), id: "foto" };
    const { ui, commands } = setup(null, [turned]);
    act(() => ui.setState({ viewport: { scale: 1, x: 0, y: 0 } }));
    act(() => void commands.followJob("cutout", created, "foto"));
    const pill = document.querySelector<HTMLElement>("[data-job-pill]")!;
    expect(pill).toHaveAttribute("data-job-pill", "below");
    expect(pill.style.top).toBe("606px");
    expect(pill.className).toContain("whitespace-nowrap");
  });

  it("shows only a spinner on a tiny layer and reveals the status outside when it is selected", { timeout: 15_000 }, () => {
    const tiny: Layer = { ...newImageLayer("foto-1", { x: 0.5, y: 0.5, w: 0.05, h: 0.05, rotation: 0, opacity: 1 }), id: "foto" };
    const { store, commands } = setup(null, [tiny]);
    act(() => void commands.followJob("cutout", created, "foto"));
    expect(overlay()!.querySelector("[data-job-spinner]")).not.toBeNull();
    expect(document.querySelector("[data-job-pill]")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(jobs.running.cutout);
    act(() => store.getState().select(["foto"]));
    expect(document.querySelector("[data-job-pill]")).toHaveAttribute("data-job-pill", "below");
  });

  it("stands still when the person prefers reduced motion", { timeout: 15_000 }, () => {
    motion.reduced = true;
    const { commands } = setup();
    act(() => void commands.followJob("cutout", created, "foto"));
    expect(overlay()).toHaveAttribute("data-motion", "static");
    expect(overlay()!.querySelector<HTMLElement>("[data-job-sweep]")!.style.animation).toBe("none");
    expect(overlay()!.querySelector(".animate-spin")).toBeNull();
  });
});

describe("the placeholder for a generation that makes a new layer", () => {
  const plain: Layer = { ...newImageLayer("foto-1", { x: 0.25, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }), id: "foto" };
  const generation: MediaGenerationJob = { ...created, id: "srv-3", kind: "image", aspect: "landscape", referenceMediaIds: ["foto-1"], sourceMediaId: undefined };
  const placeholder = () => document.querySelector<HTMLElement>('[data-job-overlay^="placeholder:"]');
  const expected = boxStyle({ transform: placeholderTransform("landscape", { width: 1000, height: 1000 }), opacity: 1, trackIndex: 860 });

  it("shows where Elo's generation from a reference will land, at its aspect, and marks the reference", { timeout: 15_000 }, () => {
    const { store, commands } = setup(null, [plain]);
    const before = store.getState().document;
    act(() => void commands.followJob("generate", generation, null));
    expect(placeholder()!.style).toMatchObject({ left: expected.left, top: expected.top, width: expected.width, height: expected.height });
    expect(document.querySelector('[data-job-reference="foto"]')).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(jobs.running.generate);
    expect(store.getState().document).toBe(before);
  });

  it("does the same for a person's generation from the AI panel", { timeout: 15_000 }, async () => {
    const { ui } = setup(<AiPanel />, [plain]);
    act(() => ui.setState({ aiDraft: { prompt: "a mesma cena na praia", model: "img-1", aspect: "landscape", references: [{ mediaId: "foto-1", url: "blob:foto-1" }] } }));
    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.image.panels.ai.generate }));
    await waitFor(() => expect(placeholder()).not.toBeNull());
    expect(placeholder()!.style.width).toBe(expected.width);
    expect(document.querySelector('[data-job-reference="foto"]')).not.toBeNull();
  });

  it("becomes the real layer in the same spot when the result arrives", { timeout: 15_000 }, async () => {
    const { store, commands } = setup(null, [plain]);
    let id = "";
    act(() => void (id = commands.followJob("generate", generation, null)));
    await act(() => commands.jobDone(id, "gerada"));
    expect(placeholder()).toBeNull();
    expect(document.querySelector("[data-job-reference]")).toBeNull();
    const added = store.getState().document.artboards[0].layers.find((layer) => layer.assetId === "gerada")!;
    expect(added.transform).toEqual(placeholderTransform("landscape", { width: 1000, height: 1000 }));
    act(() => store.getState().undo());
    expect(store.getState().document.artboards[0].layers.map((layer) => layer.id)).toEqual(["foto"]);
  });

  it("shows the failure and then clears, leaving the document alone", { timeout: 15_000 }, () => {
    vi.useFakeTimers();
    const { store, commands } = setup(null, [plain]);
    const before = store.getState().document;
    let id = "";
    act(() => void (id = commands.followJob("generate", generation, null)));
    act(() => commands.jobFailed(id, "provider_busy"));
    expect(placeholder()).toHaveAttribute("data-phase", "failed");
    expect(document.querySelector("[data-job-reference]")).toBeNull();
    act(() => vi.advanceTimersByTime(OVERLAY_FAILURE_MS));
    expect(placeholder()).toBeNull();
    expect(store.getState().document).toBe(before);
  });
});

describe("the AI progress surface outside the canvas", () => {
  const plain: Layer = { ...newImageLayer("foto-1", { x: 0.25, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }), id: "foto" };
  const element: MediaGenerationJob = { ...created, id: "srv-4", kind: "image", aspect: "square", sourceMediaId: undefined };

  it("holds a square placeholder in the element generator while the element is made, then gives way to the layer", { timeout: 15_000 }, async () => {
    const { store, commands } = setup(
      <div data-testid="gerador">
        <ImageElementGenerator categoryId="elements" />
      </div>,
      [plain],
    );
    let id = "";
    act(() => void (id = commands.followJob("element", element, null)));
    const surface = screen.getByTestId("gerador").querySelector<HTMLElement>("[data-ai-progress]")!;
    expect(surface).toHaveAttribute("data-ai-progress", "running");
    expect(surface.className).toContain("aspect-square");
    expect(surface.querySelector('[role="status"]')).toHaveTextContent(jobs.running.element);
    await act(() => commands.jobDone(id, "elemento"));
    expect(screen.getByTestId("gerador").querySelector('[data-ai-progress]')).toBeNull();
    expect(store.getState().document.artboards[0].layers.some((layer) => layer.assetId === "elemento")).toBe(true);
  });

  it("sweeps a status strip in the job list instead of a plain spinner", { timeout: 15_000 }, () => {
    const { commands } = setup(
      <div data-testid="painel">
        <AiPanel />
      </div>,
      [plain],
    );
    act(() => void commands.followJob("generate", { ...element, id: "srv-5", aspect: "landscape" }, null));
    const surface = screen.getByTestId("painel").querySelector<HTMLElement>("[data-ai-progress]")!;
    expect(surface.className).toContain("h-9");
    expect(surface.querySelector('[role="status"]')).toHaveTextContent(jobs.running.generate);
  });

  it("marks the library image a job is working on in the uploads panel, and clears it with the result", { timeout: 15_000 }, async () => {
    vi.mocked(listLibraryAction).mockResolvedValueOnce({ data: [{ id: "foto-1", type: "image", url: "https://cdn/foto-1.png" }] } as never);
    const { commands } = setup(<UploadsPanel />, [plain]);
    const tile = await screen.findByRole("button", { name: ptMessages.studio.image.media.pick });
    expect(tile.querySelector("[data-ai-progress]")).toBeNull();
    let id = "";
    act(() => void (id = commands.followJob("cutout", created, "foto")));
    const surface = tile.querySelector<HTMLElement>("[data-ai-progress]")!;
    expect(surface).toHaveAttribute("data-ai-progress", "running");
    expect(surface.className).toContain("pointer-events-none");
    expect(surface.querySelector('[role="status"]')).toHaveTextContent(jobs.running.cutout);
    expect(tile).not.toBeDisabled();
    await act(() => commands.jobDone(id, "recorte"));
    expect(tile.querySelector("[data-ai-progress]")).toBeNull();
  });
});
