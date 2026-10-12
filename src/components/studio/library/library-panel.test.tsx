import { act, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, onTestFinished, vi } from "vitest";

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  fetchMediaFileAction: vi.fn().mockResolvedValue({ data: null, error: "offline" }),
  listLibraryAction: vi.fn().mockResolvedValue({ data: [] }),
  uploadMediaAction: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "u-1" }));

import { TooltipProvider } from "@/components/ui/tooltip";
import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, imageDocument } from "@/lib/studio/document";
import { settleImage } from "@/lib/studio/image-settle";
import { createStudioStore } from "@/lib/studio/store";

import { createImageCommands } from "../image/commands";
import { createEditorUiStore, ImageEditorContext } from "../image/editor-state";
import { canvasDropSpot } from "../image/library-adapter";
import { ElementsPanel } from "../image/panels/elements-panel";
import { TextPanel } from "../image/panels/text-panel";
import { renderInEditor } from "../video/__tests__/harness";
import { frameDropSpot } from "../video/library-adapter";
import { ElementsPanel as VideoElementsPanel } from "../video/panels/elements-panel";
import { TextPanel as VideoTextPanel } from "../video/panels/text-panel";
import { Timeline } from "../video/timeline/timeline";
import { SHAPES_CATEGORY } from "@/lib/studio/library/builtin/shapes";
import type { LibraryItem } from "@/lib/studio/library/model";

import { LIBRARY_DRAG_TYPE } from "./drag";
import { LibraryPanel, type LibraryAdapter } from "./library-panel";

const t = ptMessages.studio.library;

function imageSetup(panel: "elements" | "text" = "elements") {
  const doc = imageDocument([{ id: "post", x: 0, y: 0, canvas: { width: 1000, height: 1000, background: "#ffffff" }, layers: [] }]);
  const store = createStudioStore(doc, { settle: settleImage });
  const ui = createEditorUiStore();
  ui.setState({ artboardId: "post" });
  const commands = createImageCommands(store, ui, { requestJob: vi.fn(), naturalSize: vi.fn() });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ImageEditorContext.Provider value={{ store, ui, commands, projectId: "p-1", projectName: "Projeto" }}>
        <TooltipProvider>{panel === "elements" ? <ElementsPanel /> : <TextPanel />}</TooltipProvider>
      </ImageEditorContext.Provider>
    </NextIntlClientProvider>,
  );
  return { store, layers: () => store.getState().document.artboards[0].layers };
}

function search(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: t.searchLabel }), { target: { value } });
}

describe("the library panel in the image editor", () => {
  it("inserts a shape on the active artboard and lists it under Recentes until cleared", { timeout: 15_000 }, () => {
    const { layers } = imageSetup();
    expect(window.localStorage.getItem("studio-library:recent:u-1")).toBeNull();
    expect(screen.queryByRole("heading", { name: t.recent })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.items.rect }));
    expect(layers()).toHaveLength(1);
    expect(layers()[0]).toMatchObject({ type: "shape", shape: "rect", fill: "#3b82f6" });
    const recent = screen.getByRole("group", { name: t.recent });
    expect(within(recent).getByRole("button", { name: t.items.rect })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("studio-library:recent:u-1")!)).toEqual(["shape-rect"]);
    fireEvent.click(screen.getByRole("button", { name: t.clearRecent }));
    expect(screen.queryByRole("group", { name: t.recent })).toBeNull();
  });

  it("inserts a striped table from the Tabelas category", { timeout: 15_000 }, async () => {
    const { layers } = imageSetup();
    const tile = await screen.findByRole("button", { name: t.items.tableStriped });
    fireEvent.click(tile);
    await waitFor(() => expect(layers()).toHaveLength(1));
    expect(layers()[0]).toMatchObject({ type: "table" });
  });

  it("searches every category without accents and says when nothing matches", { timeout: 15_000 }, async () => {
    imageSetup();
    await waitFor(() => expect(screen.getByRole("group", { name: t.categories.icons })).toBeTruthy(), { timeout: 10_000 });
    search("coracao");
    const hearts = screen.getAllByRole("button", { name: ptMessages.studio.vectors.names.heart }).map((tile) => tile.getAttribute("data-library-item"));
    expect(hearts.slice(0, 3)).toEqual(["shape-heart", "icon-heart", "icon-heart-regular"]);
    expect(hearts).toContain("frame-heart");
    expect(screen.queryByRole("button", { name: t.items.rect })).toBeNull();
    search("heart");
    expect(screen.getAllByRole("button", { name: ptMessages.studio.vectors.names.heart }).length).toBeGreaterThan(0);
    search("zzzz");
    expect(screen.getByRole("status").textContent).toContain(t.noResults.replace("{query}", "zzzz"));
    fireEvent.click(screen.getByRole("button", { name: t.clearSearch }));
    expect(screen.getByRole("button", { name: t.items.rect })).toBeTruthy();
  });

  it("opens a whole category, filters it by subcategory and comes back", { timeout: 15_000 }, () => {
    imageSetup();
    fireEvent.click(screen.getByRole("button", { name: t.seeAllIn.replace("{name}", t.categories.shapes) }));
    const view = screen.getByRole("region", { name: t.categories.shapes });
    expect(document.activeElement?.getAttribute("aria-label")).toBe(t.back);
    expect(within(view).getByRole("button", { name: ptMessages.studio.vectors.names.seal })).toBeTruthy();
    fireEvent.click(within(view).getByRole("button", { name: t.subcategories.lines }));
    expect(within(view).getByRole("button", { name: t.items.doubleArrow })).toBeTruthy();
    expect(within(view).queryByRole("button", { name: t.items.rect })).toBeNull();
    fireEvent.click(within(view).getByRole("button", { name: t.back }));
    expect(screen.queryByRole("button", { name: t.back })).toBeNull();
    expect(screen.getByRole("button", { name: t.items.rect })).toBeTruthy();
  });

  it("keeps one tile in the tab order and moves through the grid with the arrow keys", { timeout: 15_000 }, () => {
    imageSetup();
    const shapes = screen.getByRole("group", { name: t.categories.shapes });
    const tiles = within(shapes).getAllByRole("button");
    expect(tiles.filter((tile) => tile.tabIndex === 0)).toHaveLength(1);
    act(() => tiles[0].focus());
    fireEvent.keyDown(tiles[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(tiles[1]);
    fireEvent.keyDown(tiles[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(tiles[5]);
    fireEvent.keyDown(tiles[5], { key: "Home" });
    expect(document.activeElement).toBe(tiles[0]);
    expect(tiles[0].tabIndex).toBe(0);
  });

  it("carries the item id when a tile is dragged", { timeout: 15_000 }, () => {
    imageSetup();
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByRole("button", { name: t.items.ellipse }), { dataTransfer: { setData, effectAllowed: "" } });
    expect(setData).toHaveBeenCalledWith(LIBRARY_DRAG_TYPE, "shape-ellipse");
  });

  it("adds text blocks from the text panel with their sample words", { timeout: 15_000 }, () => {
    const { layers } = imageSetup("text");
    expect(screen.queryByRole("button", { name: t.items.counter })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.items.heading }));
    expect(layers()[0]).toMatchObject({ type: "text", text: t.samples.heading, fill: "#111111" });
  });

  it("adds a text box from the action at the top of the text panel", { timeout: 15_000 }, () => {
    const { layers } = imageSetup("text");
    const action = screen.getByRole("button", { name: t.items.textBox });
    expect(screen.getByRole("region", { name: t.categories.textBox }).firstElementChild?.firstElementChild).toBe(action);
    fireEvent.click(action);
    expect(layers()[0]).toMatchObject({ type: "text", text: t.samples.textBox, fill: "#111111" });
  });

  it("inserts a text combination as one named group of editable layers", { timeout: 15_000 }, () => {
    const { store, layers } = imageSetup("text");
    expect(within(screen.getByRole("group", { name: t.categories.textCombos })).getAllByRole("button").length).toBe(6);
    fireEvent.click(screen.getByRole("button", { name: "Atitude ousada" }));
    expect(layers().map((layer) => layer.text)).toEqual(["ATITUDE ousada", "Para quem não espera"]);
    expect(new Set(layers().map((layer) => layer.groupId)).size).toBe(1);
    expect(store.getState().document.artboards[0].groups?.[0]).toMatchObject({ name: "Atitude ousada" });
    expect(layers()[0]).toMatchObject({ fontId: "archivo-black", fill: "#111111", runs: [{ start: 8, end: 14, fontId: "dm-serif-display", italic: true, fill: "#ff4d2e" }] });
  });

  it("finds combinations by their words in the person's language and opens them by group", { timeout: 15_000 }, () => {
    imageSetup("text");
    search("aniversario");
    expect(screen.getByRole("button", { name: "Feliz aniversário" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: t.clearSearch }));
    fireEvent.click(screen.getByRole("button", { name: t.seeAllIn.replace("{name}", t.categories.textCombos) }));
    const view = screen.getByRole("region", { name: t.categories.textCombos });
    fireEvent.click(within(view).getByRole("button", { name: t.subcategories.combos.promos }));
    expect(within(view).getByRole("button", { name: "Black Friday" })).toBeTruthy();
    expect(within(view).queryByRole("button", { name: "Feliz aniversário" })).toBeNull();
  });
});

describe("drop spots", () => {
  it("maps a canvas point to the artboard under it, or to none", () => {
    const doc = imageDocument([{ id: "b", x: 100, y: 50, canvas: { width: 400, height: 200, background: "#ffffff" }, layers: [] }]);
    expect(canvasDropSpot(doc, { x: 300, y: 100 })).toEqual({ artboardId: "b", x: 0.5, y: 0.25 });
    expect(canvasDropSpot(doc, { x: 0, y: 0 })).toBeNull();
  });

  it("maps a preview point to a frame fraction", () => {
    expect(frameDropSpot({ left: 10, top: 20, width: 200, height: 400 }, 60, 120)).toEqual({ x: 0.25, y: 0.25 });
    expect(frameDropSpot({ left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({});
  });
});

describe("the library panel in the video editor", () => {
  it("inserts an icon overlay at the playhead in white", { timeout: 15_000 }, async () => {
    const { editor, container } = renderInEditor(emptyVideoDocument("story"), <VideoElementsPanel />);
    act(() => editor.view.setState({ playheadMs: 1500 }));
    const star = await waitFor(() => {
      const tile = container.querySelector<HTMLElement>('[data-library-item="icon-star"]');
      if (!tile) throw new Error("the icons are still loading");
      return tile;
    });
    fireEvent.click(star);
    const clip = editor.store.getState().document.tracks.flatMap((track) => track.clips)[0];
    expect(clip).toMatchObject({ type: "overlay", startMs: 1500 });
    expect(clip.layer).toMatchObject({ type: "icon", iconId: "star", fill: "#ffffff" });
  });

  it("inserts a text combination from the Texto tab as linked overlays in white", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(emptyVideoDocument("story"), <VideoTextPanel />);
    act(() => editor.view.setState({ playheadMs: 500 }));
    fireEvent.click(screen.getByRole("button", { name: "Moderno" }));
    const clips = editor.store.getState().document.tracks.flatMap((track) => track.clips);
    expect(clips).toHaveLength(2);
    expect(new Set(clips.map((clip) => clip.linkId)).size).toBe(1);
    expect(clips.every((clip) => clip.startMs === 500 && clip.layer?.fill === "#ffffff")).toBe(true);
  });

  it("drops a library item on a timeline lane at that time", { timeout: 15_000 }, async () => {
    const doc = emptyVideoDocument("story");
    const trackId = doc.tracks[1].id;
    const { editor, container } = renderInEditor(doc, <Timeline />);
    const lane = container.querySelector<HTMLElement>(`[data-track-id="${trackId}"]`)!;
    const dataTransfer = { types: [LIBRARY_DRAG_TYPE], getData: (type: string) => (type === LIBRARY_DRAG_TYPE ? "shape-heart" : ""), dropEffect: "" };
    fireEvent.dragOver(lane, { dataTransfer });
    const drop = createEvent.drop(lane, { dataTransfer });
    Object.defineProperty(drop, "clientX", { value: 0 });
    fireEvent(lane, drop);
    await waitFor(() => expect(editor.store.getState().document.tracks.flatMap((track) => track.clips)).toHaveLength(1));
    const track = editor.store.getState().document.tracks.find((candidate) => candidate.clips.length > 0)!;
    expect(track.id).toBe(trackId);
    expect(track.clips[0].layer).toMatchObject({ shape: "path" });
  });
});

function lazyItem(load: () => Promise<void>): LibraryItem {
  let ready = false;
  const shape = (SHAPES_CATEGORY.items() as readonly LibraryItem[])[0];
  const item: LibraryItem = {
    ...shape,
    id: "shape-lazy",
    assets: {
      loaded: () => ready,
      load: () =>
        load().then(() => {
          ready = true;
        }),
    },
  };
  return item;
}

function panelWith(item: LibraryItem) {
  const insert = vi.fn<(inserted: LibraryItem) => boolean>(() => true);
  const adapter: LibraryAdapter = { editor: "image", insert, extras: new Map([["shapes", [item]]]) };
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LibraryPanel panel="elements" adapter={adapter} searchPlaceholder="buscar" />
    </NextIntlClientProvider>,
  );
  return insert;
}

function tileOf(id: string): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-library-item="${id}"]`)!;
}

describe("the first click on a library tile", () => {
  it("keeps the preview under the pointer when the press focuses a tile, so the click lands", { timeout: 15_000 }, () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    const { layers } = imageSetup();
    const tile = screen.getByRole("button", { name: t.items.rounded });
    const pressed = tile.querySelector("svg rect")!;
    fireEvent.pointerDown(pressed);
    fireEvent.focus(tile);
    expect(pressed.isConnected).toBe(true);
    expect(tile.querySelector("svg rect")).toBe(pressed);
    fireEvent.click(pressed);
    expect(layers()).toHaveLength(1);
  });

  it("inserts a cold item once its assets load, once even when clicked twice", async () => {
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (finish = resolve));
    const item = lazyItem(() => gate);
    const insert = panelWith(item);
    fireEvent.click(tileOf(item.id));
    fireEvent.click(tileOf(item.id));
    expect(insert).not.toHaveBeenCalled();
    await act(async () => finish());
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1));
    expect(insert).toHaveBeenCalledWith(item);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says why when the item cannot load and inserts nothing", async () => {
    const item = lazyItem(() => Promise.reject(new Error("offline")));
    const insert = panelWith(item);
    fireEvent.click(tileOf(item.id));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(t.insertFailed.replace("{name}", ptMessages.studio.library.items.rect));
    expect(insert).not.toHaveBeenCalled();
  });
});
