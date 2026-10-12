import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, msOfFrame, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { TrimPreviewOverlay } from "../preview/trim-preview";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    {
      id: "v1",
      kind: "visual",
      clips: [{ ...newMediaClip("image", "img", 0, 2000), id: "a" }, { ...newMediaClip("image", "img2", 2000, 2000), id: "c" }, { ...newMediaClip("image", "img3", 4000, 1000), id: "b" }],
    },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 3000), id: "m" }] },
  ];
  d.durationMs = 5000;
  return d;
}

function clipElement(id: string): HTMLElement {
  return document.querySelector(`[data-clip-id="${id}"]`) as HTMLElement;
}

function timing(editor: ReturnType<typeof renderInEditor>["editor"], id: string) {
  const clip = findClip(editor.store.getState().document, id)!.clip;
  return [clip.startMs, clip.durationMs];
}

describe("Roll tool", () => {
  it("moves the cut between two clips as one undo step and previews both frames while dragging", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100, tool: "roll" }));
    const handle = clipElement("a").querySelector("[data-trim=end]")!;
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 200, clientY: 10 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 100, clientY: 10 });
    expect(editor.view.getState().trimPreview).toEqual({ mode: "roll", clipId: "a", edge: "end" });
    expect(editor.view.getState().dragMode).toBe("roll");
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 100, clientY: 10 });
    expect(timing(editor, "a")).toEqual([0, 1000]);
    expect(timing(editor, "c")).toEqual([1000, 3000]);
    expect(editor.view.getState().trimPreview).toBeNull();
    act(() => editor.store.getState().undo());
    expect(timing(editor, "c")).toEqual([2000, 2000]);
  });

  it("shows the limit it reached on the edge and next to the pointer", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100, tool: "roll" }));
    const handle = clipElement("a").querySelector("[data-trim=end]")!;
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 200, clientY: 10 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 500, clientY: 10 });
    expect(clipElement("a").querySelector("[data-trim=end]")).toHaveAttribute("data-limited", "true");
    expect(screen.getByText("duração mínima")).toBeInTheDocument();
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 500, clientY: 10 });
    expect(timing(editor, "c")).toEqual([3900, 100]);
    expect(clipElement("a").querySelector("[data-trim=end]")).not.toHaveAttribute("data-limited");
  });

  it("rolls the next edit to the playhead and nudges the nearest edit by a frame", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => {
      editor.view.setState({ playheadMs: 3000 });
      editor.commands.rollToPlayhead("end");
    });
    expect(timing(editor, "c")).toEqual([2000, 1000]);
    expect(timing(editor, "b")).toEqual([3000, 2000]);
    act(() => {
      editor.view.setState({ tool: "roll", playheadMs: 2900 });
      editor.store.getState().select(["c"]);
      editor.commands.nudge(-1);
    });
    expect(timing(editor, "b")[0]).toBe(3000 - msOfFrame(1));
    act(() => {
      editor.view.setState({ playheadMs: 5500 });
      editor.commands.rollToPlayhead("start");
    });
    expect(editor.view.getState().notice).toEqual({ key: "trim.noClip", tone: "info" });
  });
});

describe("Slide tool", () => {
  it("slides a clip between its neighbours keeping its content", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100, tool: "slide" }));
    const body = clipElement("c");
    fireEvent.pointerDown(body, { button: 0, pointerId: 1, clientX: 300, clientY: 10 });
    fireEvent.pointerMove(body, { pointerId: 1, clientX: 350, clientY: 10 });
    expect(editor.view.getState().trimPreview).toEqual({ mode: "slide", clipId: "c", edge: "start" });
    fireEvent.pointerUp(body, { pointerId: 1, clientX: 350, clientY: 10 });
    expect(timing(editor, "a")).toEqual([0, 2500]);
    expect(timing(editor, "c")).toEqual([2500, 2000]);
    expect(timing(editor, "b")).toEqual([4500, 500]);
  });

  it("nudges the selected clip with the slide tool and explains a blocked slide", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => {
      editor.view.setState({ tool: "slide" });
      editor.store.getState().select(["c"]);
      editor.commands.nudge(1);
    });
    expect(timing(editor, "c")[0]).toBe(2000 + msOfFrame(1));
    act(() => {
      editor.store.getState().select(["a"]);
      editor.commands.nudge(-1);
    });
    expect(editor.view.getState().notice).toEqual({ key: "trim.video", tone: "error" });
  });
});

describe("Trim preview", () => {
  it("shows the outgoing and incoming frames of a roll and four frames for a slide", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <TrimPreviewOverlay />);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => editor.view.setState({ trimPreview: { mode: "roll", clipId: "a", edge: "end" } }));
    expect(screen.getByRole("status", { name: "Prévia do corte" })).toHaveTextContent("Sai");
    expect(screen.getByRole("status", { name: "Prévia do corte" })).toHaveTextContent("Entra");
    act(() => editor.view.setState({ trimPreview: { mode: "slide", clipId: "c", edge: "start" } }));
    const slide = screen.getByRole("status", { name: "Prévia do deslize" });
    for (const label of ["Início do clipe", "Fim do clipe", "Fim do anterior", "Início do seguinte"]) expect(slide).toHaveTextContent(label);
    act(() => editor.view.setState({ trimPreview: { mode: "roll", clipId: "m", edge: "end" } }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("Shortcuts list", () => {
  it("lists the roll and slide shortcuts", { timeout: 15_000 }, () => {
    renderInEditor(doc(), <Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "Atalhos" }));
    expect(screen.getByText("Levar o corte anterior ao cursor")).toBeInTheDocument();
    expect(screen.getByText("Shift + W")).toBeInTheDocument();
    expect(screen.getByText("Mover corte ou deslizar só este clipe")).toBeInTheDocument();
  });
});
