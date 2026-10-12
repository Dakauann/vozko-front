import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, newOverlayClip, newPathLayer, newTextLayer, type VideoDocument } from "@/lib/studio/document";
import { rampSpeed } from "@/lib/studio/retime";
import { findClip } from "@/lib/studio/timeline";
import { formatTimecode } from "@/lib/studio/timeline-view";

import { Inspector } from "../inspector/inspector";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

const pt = ptMessages.studio.video;

function commitText(field: HTMLElement, value: string) {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

function markerDoc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 6000), id: "a" }] }];
  d.durationMs = 6000;
  d.markers = [
    { id: "m1", atMs: 1000, label: "Gancho" },
    { id: "m2", atMs: 4000 },
  ];
  return d;
}

describe("markers by hand", () => {
  it("moves a marker by typing its time or bringing it to the playhead, and refuses a taken spot", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(markerDoc(), <Timeline />);
    const markers = () => editor.store.getState().document.markers ?? [];
    fireEvent.click(screen.getByRole("button", { name: pt.timeline.markers.named.replace("{label}", "Gancho").replace("{time}", formatTimecode(1000)) }));
    const dialog = screen.getByRole("dialog");
    commitText(within(dialog).getByRole("textbox", { name: pt.timeline.markers.time }), "2.5");
    expect(markers().find((marker) => marker.id === "m1")?.atMs).toBe(2500);

    commitText(within(dialog).getByRole("textbox", { name: pt.timeline.markers.time }), "4");
    expect(markers().find((marker) => marker.id === "m1")?.atMs).toBe(2500);
    expect(within(dialog).getByRole("alert").textContent).toBe(pt.timeline.markers.taken);

    act(() => editor.view.setState({ playheadMs: 3200 }));
    fireEvent.click(within(dialog).getByRole("button", { name: pt.timeline.markers.toPlayhead }));
    expect(markers().find((marker) => marker.id === "m1")).toMatchObject({ atMs: 3200, label: "Gancho" });
  });
});

function shapeDoc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newOverlayClip(newPathLayer("M 0 0 L 1 0 L 0.5 1 Z"), 0, 3000), id: "p" }] }];
  d.durationMs = 3000;
  return d;
}

describe("vector shapes by hand", () => {
  it("edits the SVG path of a vector shape, refuses a broken one and makes overlaps hollow", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(shapeDoc(), <Inspector />);
    const layer = () => findClip(editor.store.getState().document, "p")!.clip.layer!;
    act(() => editor.store.getState().select(["p"]));
    const path = screen.getByRole("textbox", { name: pt.layer.path });
    commitText(path, "M 0 0 L 1 1 L 0 1 Z");
    expect(layer().path).toBe("M 0 0 L 1 1 L 0 1 Z");

    commitText(path, "oops");
    expect(layer().path).toBe("M 0 0 L 1 1 L 0 1 Z");
    expect(path.getAttribute("aria-invalid")).toBe("true");

    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.studio.vectors.inspector.fillRule }));
    expect(layer().fillRule).toBe("evenodd");
    fireEvent.click(screen.getByRole("checkbox", { name: ptMessages.studio.vectors.inspector.fillRule }));
    expect(layer().fillRule).toBeUndefined();
  });
});

describe("disabling clips by hand", () => {
  it("turns the selected clips off and on from the inspector", { timeout: 15_000 }, () => {
    const d = markerDoc();
    d.tracks[0].clips.push({ ...newMediaClip("image", "img", 6000, 2000), id: "b", disabled: true });
    d.durationMs = 8000;
    const { editor } = renderInEditor(d, <Inspector />);
    const disabled = (id: string) => findClip(editor.store.getState().document, id)!.clip.disabled;
    act(() => editor.store.getState().select(["a", "b"]));
    const toggle = screen.getByRole("checkbox", { name: pt.inspector.disabled }) as HTMLInputElement;
    expect(toggle.indeterminate).toBe(true);
    fireEvent.click(toggle);
    expect([disabled("a"), disabled("b")]).toEqual([true, true]);
    fireEvent.click(screen.getByRole("checkbox", { name: pt.inspector.disabled }));
    expect([disabled("a"), disabled("b")]).toEqual([undefined, undefined]);
  });
});

describe("stroke style by hand", () => {
  it("types a custom dash pattern, refuses a broken one and rounds the ends of a text outline", { timeout: 15_000 }, () => {
    const d = shapeDoc();
    d.tracks.push({ id: "v2", kind: "visual", clips: [{ ...newOverlayClip({ ...newTextLayer("Oferta"), stroke: "#000000", strokeWidth: 2, dashArray: [3, 2] }, 0, 3000), id: "t" }] });
    const { editor } = renderInEditor(d, <Inspector />);
    const layer = () => findClip(editor.store.getState().document, "t")!.clip.layer!;
    act(() => editor.store.getState().select(["t"]));
    const pattern = screen.getByRole("textbox", { name: ptMessages.studio.vectors.stroke.pattern });
    commitText(pattern, "6 3 1 3");
    expect(layer().dashArray).toEqual([6, 3, 1, 3]);
    expect((screen.getByRole("combobox", { name: ptMessages.studio.vectors.stroke.dash }) as HTMLSelectElement).value).toBe("custom");

    commitText(pattern, "0 0");
    expect(layer().dashArray).toEqual([6, 3, 1, 3]);
    expect(pattern.getAttribute("aria-invalid")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.vectors.stroke.cap.round }));
    expect(layer().lineCap).toBe("round");
  });
});

function speedDoc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    {
      id: "v1",
      kind: "visual",
      clips: [
        {
          ...newMediaClip("video", "vid", 0, 4000),
          id: "a",
          keyframes: {
            opacity: [
              { atMs: 0, value: 0, easing: "linear" },
              { atMs: 1000, value: 1, easing: "linear" },
            ],
          },
        },
        { ...newMediaClip("video", "vid2", 4000, 2000), id: "b" },
      ],
    },
  ];
  d.durationMs = 6000;
  return d;
}

describe("clip speed options by hand", () => {
  const speed = pt.speed;
  const clipOf = (editor: ReturnType<typeof renderInEditor>["editor"], id: string) => findClip(editor.store.getState().document, id)!.clip;

  it("retimes to a length without pushing the next clip or stretching the animation", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(speedDoc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.speed }));
    fireEvent.click(screen.getByRole("checkbox", { name: speed.ripple }));
    fireEvent.click(screen.getByRole("checkbox", { name: speed.stretchKeys }));
    commitText(screen.getByRole("textbox", { name: speed.targetDuration }), "2");
    expect(clipOf(editor, "a")).toMatchObject({ speed: 2, durationMs: 2000 });
    expect(clipOf(editor, "a").keyframes?.opacity?.map((key) => key.atMs)).toEqual([0, 1000]);
    expect(clipOf(editor, "b").startMs).toBe(4000);
  });

  it("ramps in the chosen number of steps along the chosen curve", { timeout: 15_000 }, () => {
    const expected = rampSpeed(speedDoc(), "a", { atMs: 1000, rampMs: 1000, toSpeed: 0.5, steps: 2, easing: "linear" }, () => undefined);
    if (!expected.ok) throw new Error("refused");
    const { editor } = renderInEditor(speedDoc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["a"]);
      editor.view.setState({ playheadMs: 1000 });
    });
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.speed }));
    fireEvent.change(screen.getByRole("combobox", { name: speed.ramp.mode }), { target: { value: "steps" } });
    commitText(screen.getByRole("textbox", { name: speed.ramp.target }), "0.5");
    commitText(screen.getByRole("textbox", { name: speed.ramp.duration }), "1");
    commitText(screen.getByRole("textbox", { name: speed.ramp.steps }), "2");
    fireEvent.click(within(screen.getByRole("group", { name: speed.ramp.easing })).getByRole("button", { name: pt.keyframes.easings.linear }));
    fireEvent.click(screen.getByRole("button", { name: speed.ramp.apply }));
    const speeds = (doc: VideoDocument) => doc.tracks[0].clips.filter((clip) => clip.assetId === "vid").map((clip) => [clip.durationMs, clip.speed ?? 1]);
    expect(speeds(editor.store.getState().document)).toEqual(speeds(expected.document));
  });

  it("freezes a frame for the chosen length", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(speedDoc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["a"]);
      editor.view.setState({ playheadMs: 1500 });
    });
    fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.speed }));
    commitText(screen.getByRole("textbox", { name: speed.freezeDuration }), "1");
    fireEvent.click(screen.getByRole("button", { name: speed.freeze }));
    expect(editor.store.getState().document.tracks[0].clips.find((clip) => clip.freeze)?.durationMs).toBe(1000);
  });
});

describe("ducking by hand", () => {
  it("takes the ducking off a track in one click", { timeout: 15_000 }, () => {
    const d = emptyVideoDocument("story");
    d.tracks = [
      { id: "voice", kind: "audio", name: "Voz", clips: [{ ...newMediaClip("audio", "talk", 0, 2000), id: "v" }] },
      { id: "music", kind: "audio", name: "Música", clips: [{ ...newMediaClip("audio", "song", 0, 2000), id: "m" }], ducking: { triggerTrackIds: ["voice"], reduceDb: 12, attackMs: 200, releaseMs: 400, holdMs: 200, sensitivity: 0.5 } },
    ];
    d.durationMs = 2000;
    const { editor } = renderInEditor(d, <Timeline />);
    fireEvent.click(screen.getByRole("button", { name: pt.trackSound.open.replace("{name}", "Música") }));
    fireEvent.click(screen.getByRole("button", { name: pt.trackSound.clear }));
    expect(editor.store.getState().document.tracks.find((track) => track.id === "music")?.ducking).toBeUndefined();
  });
});
