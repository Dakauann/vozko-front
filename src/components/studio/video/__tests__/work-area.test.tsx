import { fireEvent, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import { Preview } from "../preview/preview";
import { Transport } from "../preview/transport";
import { TimelineBar } from "../timeline/timeline-bar";
import { renderInEditor, stubPreviewLayout } from "./harness";

const transport = ptMessages.studio.video.transport;
const bar = ptMessages.studio.video.timeline.bar;
const AREA = { width: 848, height: 498 };

function doc(): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 4000), id: "c" }] }];
  d.durationMs = 4000;
  return d;
}

function frame(): HTMLElement {
  return document.querySelector("[data-studio-preview-frame]") as HTMLElement;
}

function area(): HTMLElement {
  return document.querySelector("[data-studio-preview]") as HTMLElement;
}

let restore: () => void = () => undefined;

beforeAll(() => {
  restore = stubPreviewLayout({ area: AREA, frame: AREA });
});

afterAll(() => restore());

describe("work area by hand", () => {
  it("marks in and out from the timeline bar, plays the range and clears it", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <TimelineBar onAddTrack={() => undefined} />);
    editor.playback.seek(1000);
    fireEvent.click(screen.getByRole("button", { name: bar.markIn }));
    editor.playback.seek(2500);
    fireEvent.click(screen.getByRole("button", { name: bar.markOut }));
    expect(editor.view.getState().range).toEqual({ inMs: 1000, outMs: 2500 });
    fireEvent.click(screen.getByRole("button", { name: bar.clearRange }));
    expect(editor.view.getState().range).toEqual({ inMs: null, outMs: null });
  });

  it("loops, plays only the marked range, picks the preview quality and shows the transparency grid", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Transport />);
    const playRange = screen.getByRole("button", { name: transport.playRange });
    expect(playRange).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: transport.loop }));
    expect(editor.view.getState().loop).toBe(true);
    expect(screen.getByRole("button", { name: transport.loop }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(screen.getByRole("button", { name: `Qualidade da pré-visualização: ${transport.qualities.full}` }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: transport.qualities.quarter }));
    expect(editor.view.getState().previewQuality).toBe("quarter");
    fireEvent.click(screen.getByRole("button", { name: transport.transparencyGrid }));
    expect(editor.view.getState().transparencyGrid).toBe(true);
  });

  it("paints the grid behind the frame instead of the film background", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    expect(frame().style.backgroundImage).toBe("");
    editor.commands.toggleTransparencyGrid();
    return vi.waitFor(() => expect(frame().style.backgroundImage).toContain("data:image/svg+xml"));
  });
});

describe("preview zoom and pan", () => {
  it("fits by default with a small margin, zooms from the menu and fits again", { timeout: 15_000 }, async () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    expect(frame().style.width).toBe("800px");
    expect(frame().style.left).toBe("24px");
    fireEvent.keyDown(screen.getByRole("button", { name: /^Zoom: / }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "100%" }));
    expect(editor.view.getState()).toMatchObject({ previewFit: false, previewViewport: { scale: 1 } });
    await vi.waitFor(() => expect(frame().style.width).toBe("1920px"));
    fireEvent.keyDown(screen.getByRole("button", { name: /^Zoom: / }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: transport.fit }));
    await vi.waitFor(() => expect(frame().style.width).toBe("800px"));
  });

  it("zooms around the pointer with Ctrl and the wheel and pans with the wheel once zoomed", { timeout: 15_000 }, async () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    fireEvent.wheel(area(), { deltaY: 40, deltaX: 0 });
    expect(editor.view.getState().previewFit).toBe(true);
    fireEvent.wheel(area(), { deltaY: -200, ctrlKey: true, clientX: 424, clientY: 249 });
    const zoomed = editor.view.getState().previewViewport;
    expect(editor.view.getState().previewFit).toBe(false);
    expect(zoomed.scale).toBeGreaterThan(800 / 1920);
    fireEvent.wheel(area(), { deltaY: 30, deltaX: 10 });
    expect(editor.view.getState().previewViewport).toEqual({ ...zoomed, x: zoomed.x - 10, y: zoomed.y - 30 });
    await vi.waitFor(() => expect(frame().style.left).toBe(`${Math.round(zoomed.x - 10)}px`));
  });

  it("pans with space and drag without toggling playback, and a space tap still plays", { timeout: 15_000 }, async () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    editor.commands.zoomPreview(1);
    const start = editor.view.getState().previewViewport;
    fireEvent.pointerEnter(area());
    fireEvent.keyDown(area(), { key: " ", code: "Space" });
    fireEvent.pointerDown(area(), { button: 0, pointerId: 3, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(area(), { pointerId: 3, clientX: 160, clientY: 80 });
    fireEvent.pointerUp(area(), { pointerId: 3, clientX: 160, clientY: 80 });
    fireEvent.keyUp(area(), { key: " ", code: "Space" });
    expect(editor.view.getState().previewViewport).toEqual({ ...start, x: start.x + 60, y: start.y - 20 });
    expect(editor.view.getState().playing).toBe(false);
    const toggle = vi.spyOn(editor.playback, "toggle").mockImplementation(() => undefined);
    fireEvent.keyDown(area(), { key: " ", code: "Space" });
    fireEvent.keyUp(area(), { key: " ", code: "Space" });
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("refits when the room changes while fitted and keeps a manual zoom", { timeout: 15_000 }, async () => {
    const { editor } = renderInEditor(doc(), <Preview />);
    editor.view.setState({ previewContainer: { width: 1648, height: 998 } });
    await vi.waitFor(() => expect(frame().style.width).toBe("1600px"));
    editor.commands.zoomPreview(0.5);
    editor.view.setState({ previewContainer: AREA });
    await vi.waitFor(() => expect(frame().style.width).toBe("960px"));
  });
});
