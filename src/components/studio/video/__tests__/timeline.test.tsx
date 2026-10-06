import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";


const { countTimelineRender } = vi.hoisted(() => ({ countTimelineRender: vi.fn() }));
vi.mock("../use-track-names", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../use-track-names")>();
  return {
    ...actual,
    useDefaultTrackNames: (...args: Parameters<typeof actual.useDefaultTrackNames>) => {
      countTimelineRender();
      return actual.useDefaultTrackNames(...args);
    },
  };
});

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { formatSmpte } from "@/lib/studio/timeline-view";
import { findClip } from "@/lib/studio/timeline";

import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 2000), id: "a" }, { ...newMediaClip("image", "img2", 5000, 1000), id: "b" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 3000), id: "m" }] },
  ];
  d.durationMs = 6000;
  return d;
}

function clipElement(id: string): HTMLElement {
  return document.querySelector(`[data-clip-id="${id}"]`) as HTMLElement;
}

function drag(element: Element, fromX: number, toX: number, init: Partial<PointerEventInit> = {}) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: fromX, clientY: 10, ...init });
  fireEvent.pointerMove(element, { pointerId: 1, clientX: (fromX + toX) / 2, clientY: 10, ...init });
  fireEvent.pointerMove(element, { pointerId: 1, clientX: toX, clientY: 10, ...init });
  fireEvent.pointerUp(element, { pointerId: 1, clientX: toX, clientY: 10, ...init });
}

describe("Timeline", () => {
  it("updates playback indicators without rendering the track tree", async () => {
    const { editor, container } = renderInEditor(doc(), <Timeline />);
    await act(async () => undefined);
    const renders = countTimelineRender.mock.calls.length;
    act(() => editor.view.setState({ playheadMs: 1500 }));
    act(() => editor.view.setState({ playheadMs: 1800 }));
    expect(countTimelineRender).toHaveBeenCalledTimes(renders);
    expect(container.querySelector('[role="slider"][aria-valuetext]')).toHaveAttribute("aria-valuenow", "1800");
    expect(container.textContent).toContain(formatSmpte(1800));
  });

  it("shows tracks with headers and clips", () => {
    renderInEditor(doc(), <Timeline />);
    expect(screen.getByRole("button", { name: "Bloquear Vídeo 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Silenciar Áudio 1" })).toBeInTheDocument();
    expect(clipElement("a")).toHaveAttribute("aria-label", "Imagem, começa em 0:00.00, dura 0:02.00");
  });

  it("selects on click and adds with Shift", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    fireEvent.pointerDown(clipElement("a"), { button: 0, pointerId: 1, clientX: 10 });
    fireEvent.pointerUp(clipElement("a"), { pointerId: 1, clientX: 10 });
    expect(editor.store.getState().selection).toEqual(["a"]);
    fireEvent.pointerDown(clipElement("m"), { button: 0, pointerId: 2, clientX: 10, shiftKey: true });
    expect(editor.store.getState().selection).toEqual(["a", "m"]);
  });

  it("moves a clip in time as one undo step, snapping off", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100 }));
    drag(clipElement("a"), 10, 260);
    expect(findClip(editor.store.getState().document, "a")?.clip.startMs).toBe(2500);
    act(() => editor.store.getState().undo());
    expect(findClip(editor.store.getState().document, "a")?.clip.startMs).toBe(0);
  });

  it("snaps the moved clip to the edge of another clip", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: true, pxPerSecond: 100, playheadMs: 0 }));
    drag(clipElement("a"), 10, 304);
    expect(findClip(editor.store.getState().document, "a")?.clip.startMs).toBe(3000);
    expect(editor.view.getState().snapGuideMs).toBeNull();
  });

  it("trims the end with the right handle", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100 }));
    drag(clipElement("a").querySelector("[data-trim=end]")!, 200, 300);
    expect(findClip(editor.store.getState().document, "a")?.clip.durationMs).toBe(3000);
  });

  it("does not move clips on a locked track", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100 }));
    fireEvent.click(screen.getByRole("button", { name: "Bloquear Vídeo 1" }));
    expect(editor.store.getState().document.tracks[0].locked).toBe(true);
    drag(clipElement("a"), 10, 260);
    expect(findClip(editor.store.getState().document, "a")?.clip.startMs).toBe(0);
  });

  it("mutes an audio track and adds tracks", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "Silenciar Áudio 1" }));
    expect(editor.store.getState().document.tracks[1].muted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Nova faixa de áudio" }));
    expect(editor.store.getState().document.tracks).toHaveLength(3);
  });

  it("exposes the playhead as a slider", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ playheadMs: 1500 }));
    const slider = screen.getByRole("slider", { name: "Cursor de reprodução" });
    expect(slider).toHaveAttribute("aria-valuetext", "0:01.15");
    expect(slider).toHaveAttribute("aria-valuemax", "6000");
  });
});

describe("Timeline tools", () => {
  it("closes the gaps of the main track when magnetic is turned on", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "Faixa principal magnética" }));
    expect(findClip(editor.store.getState().document, "b")?.clip.startMs).toBe(2000);
    act(() => editor.store.getState().undo());
    expect(findClip(editor.store.getState().document, "b")?.clip.startMs).toBe(5000);
  });

  it("inserts with Ctrl while dragging and pushes the next clips", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100 }));
    drag(clipElement("b"), 510, 110, { ctrlKey: true });
    expect(findClip(editor.store.getState().document, "b")?.clip.startMs).toBe(2000);
    expect(findClip(editor.store.getState().document, "a")?.clip.startMs).toBe(0);
  });

  it("selects and moves a linked pair together", () => {
    const d = doc();
    d.tracks[0].clips[1] = { ...d.tracks[0].clips[1], linkId: "pair" };
    d.tracks[1].clips = [{ ...newMediaClip("audio", "song", 5000, 1000), id: "bs", linkId: "pair" }];
    const { editor } = renderInEditor(d, <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100 }));
    drag(clipElement("b"), 510, 610);
    expect(editor.store.getState().selection.sort()).toEqual(["b", "bs"]);
    expect(findClip(editor.store.getState().document, "bs")?.clip.startMs).toBe(6000);
  });

  it("adds a marker from the toolbar and shows it on the ruler", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ playheadMs: 1200 }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar marcador" }));
    expect(editor.store.getState().document.markers?.map((m) => m.atMs)).toEqual([1200]);
    expect(screen.getByRole("button", { name: "Marcador em 0:01.06" })).toBeInTheDocument();
  });

  it("solos an audio track for the preview only", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "Ouvir só Áudio 1" }));
    expect(editor.view.getState().soloTrackIds).toEqual(["au"]);
    expect(editor.store.getState().document.tracks[1].muted).toBeFalsy();
  });

  it("switches the track height", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    fireEvent.click(screen.getByRole("button", { name: "G" }));
    expect(editor.view.getState().trackHeight).toBe("tall");
  });
});

describe("Timeline editing tools", () => {
  const header = 184;

  it("switches tools from the bar and with the keyboard shortcuts in the store", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    fireEvent.click(screen.getByRole("radio", { name: "Lâmina" }));
    expect(editor.view.getState().tool).toBe("blade");
    expect(screen.getByRole("radio", { name: "Lâmina" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Seleção" }));
    expect(editor.view.getState().tool).toBe("select");
    act(() => editor.commands.cycleTrimTool());
    expect(editor.view.getState().tool).toBe("ripple");
    act(() => editor.commands.cycleTrimTool());
    expect(editor.view.getState().tool).toBe("roll");
  });

  it("cuts the clip under the blade click as one undo step", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100, tool: "blade" }));
    fireEvent.pointerDown(clipElement("a"), { button: 0, pointerId: 1, clientX: header + 100, clientY: 10 });
    const clips = editor.store.getState().document.tracks[0].clips.map((c) => [c.startMs, c.durationMs]);
    expect(clips).toEqual([
      [0, 1000],
      [1000, 1000],
      [5000, 1000],
    ]);
    act(() => editor.store.getState().undo());
    expect(editor.store.getState().document.tracks[0].clips).toHaveLength(2);
  });

  it("cuts every track with Shift and the blade", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100, tool: "blade" }));
    fireEvent.pointerDown(clipElement("a"), { button: 0, pointerId: 1, clientX: header + 150, clientY: 10, shiftKey: true });
    expect(editor.store.getState().document.tracks[0].clips).toHaveLength(3);
    expect(editor.store.getState().document.tracks[1].clips).toHaveLength(2);
  });

  it("moves the whole section after an Alt click as one block", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100 }));
    drag(clipElement("a"), 10, 110, { altKey: true, shiftKey: false });
    const doc2 = editor.store.getState().document;
    expect(findClip(doc2, "a")?.clip.startMs).toBe(1000);
    expect(findClip(doc2, "b")?.clip.startMs).toBe(6000);
    act(() => editor.store.getState().undo());
    expect(findClip(editor.store.getState().document, "b")?.clip.startMs).toBe(5000);
  });

  it("selects a gap and closes it with Delete", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ pxPerSecond: 100 }));
    const lane = document.querySelector('[data-track-id="v1"]') as HTMLElement;
    fireEvent.pointerDown(lane, { button: 0, pointerId: 3, clientX: header + 300, clientY: 10 });
    fireEvent.pointerUp(lane, { pointerId: 3, clientX: header + 300, clientY: 10 });
    expect(editor.view.getState().selectedGap).toEqual({ trackId: "v1", fromMs: 2000, toMs: 5000 });
    act(() => editor.commands.remove(false));
    expect(findClip(editor.store.getState().document, "b")?.clip.startMs).toBe(2000);
  });

  it("enters and leaves focus on a clip", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ viewportPx: 1000 }));
    fireEvent.doubleClick(clipElement("a"));
    expect(editor.view.getState().focus?.clipId).toBe("a");
    expect(screen.getByRole("region", { name: "Foco" })).toHaveTextContent("Foco: Imagem");
    expect(screen.getAllByText("Posição X").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Solo" }));
    expect(editor.view.getState().focus?.solo).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    expect(editor.view.getState().focus).toBeNull();
  });
});

describe("Blade feedback", () => {
  it("shows the cut line with its timecode over the hovered lane", () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    act(() => editor.view.setState({ snapping: false, pxPerSecond: 100, tool: "blade" }));
    fireEvent.pointerMove(clipElement("a"), { pointerId: 1, clientX: 184 + 150, clientY: 10 });
    expect(screen.getByText("00:00:01:15")).toBeInTheDocument();
  });
});
