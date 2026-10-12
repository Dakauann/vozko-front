import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { visualPlan } from "@/lib/studio/playback";
import { findClip } from "@/lib/studio/timeline";

import { Inspector } from "../inspector/inspector";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

const pt = ptMessages.studio.video.behaviors;

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  const photo = {
    ...newMediaClip("image", "img", 0, 4000),
    id: "photo",
    transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.2, rotation: 0, opacity: 1 },
    keyframes: { x: [{ atMs: 0, value: 0.3, easing: "linear" as const }, { atMs: 1000, value: 0.6, easing: "linear" as const }] },
  };
  d.tracks = [
    { id: "v1", kind: "visual", clips: [photo] },
    { id: "a1", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 4000), id: "song" }] },
  ];
  d.durationMs = 4000;
  return d;
}

function behaviorsOf(d: VideoDocument) {
  return findClip(d, "photo")!.clip.behaviors ?? [];
}

function section() {
  return screen.getByRole("region", { name: pt.title });
}

function openAnimation() {
  const rendered = renderInEditor(doc(), <Inspector />);
  act(() => rendered.editor.store.getState().select(["photo"]));
  fireEvent.click(screen.getByRole("tab", { name: ptMessages.studio.inspector.groups.animation }));
  return rendered;
}

describe("behaviors by hand", () => {
  it("adds a wiggle on the chosen property, edits it and removes it", { timeout: 15_000 }, () => {
    const { editor } = openAnimation();
    fireEvent.change(within(section()).getByLabelText(pt.property), { target: { value: "rotation" } });
    fireEvent.click(within(section()).getByRole("button", { name: pt.kinds.wiggle }));
    const [wiggle] = behaviorsOf(editor.store.getState().document);
    expect(wiggle).toMatchObject({ kind: "wiggle", property: "rotation", frequency: 2, amount: 5 });
    expect(within(section()).getByRole("button", { name: pt.kinds.wiggle })).toBeDisabled();

    const frequency = within(section()).getByLabelText(pt.fields.frequency);
    fireEvent.change(frequency, { target: { value: "6" } });
    fireEvent.keyDown(frequency, { key: "Enter" });
    expect(behaviorsOf(editor.store.getState().document)[0]).toMatchObject({ frequency: 6 });

    fireEvent.click(within(section()).getByRole("button", { name: pt.fields.newSeed }));
    expect(behaviorsOf(editor.store.getState().document)[0]).toMatchObject({ frequency: 6 });

    fireEvent.click(within(section()).getByRole("button", { name: pt.remove }));
    expect(behaviorsOf(editor.store.getState().document)).toEqual([]);
  });

  it("spins with one click, loops the keys with a mode and reacts to the sound track", { timeout: 15_000 }, () => {
    const { editor } = openAnimation();
    fireEvent.click(within(section()).getByRole("button", { name: pt.spin }));
    expect(visualPlan(editor.store.getState().document, 2000, 0)[0].transform.rotation).toBeCloseTo(180, 9);

    fireEvent.change(within(section()).getByLabelText(pt.property), { target: { value: "x" } });
    fireEvent.click(within(section()).getByRole("button", { name: pt.kinds.loop }));
    fireEvent.change(within(section()).getByLabelText(pt.fields.mode), { target: { value: "pingpong" } });
    expect(behaviorsOf(editor.store.getState().document).find((behavior) => behavior.kind === "loop")).toMatchObject({ mode: "pingpong", side: "out" });
    expect(visualPlan(editor.store.getState().document, 1500, 0)[0].transform.x).toBeCloseTo(0.45, 9);

    fireEvent.change(within(section()).getByLabelText(pt.property), { target: { value: "scale" } });
    fireEvent.click(within(section()).getByRole("button", { name: pt.kinds.audioReact }));
    expect(behaviorsOf(editor.store.getState().document).find((behavior) => behavior.kind === "audioReact")).toMatchObject({ property: "scale", trackId: "a1" });
  });

  it("bakes a behavior into ordinary keys", { timeout: 15_000 }, async () => {
    const { editor } = openAnimation();
    fireEvent.click(within(section()).getByRole("button", { name: pt.spin }));
    fireEvent.click(within(section()).getByRole("button", { name: pt.bake }));
    await waitFor(() => expect(behaviorsOf(editor.store.getState().document)).toEqual([]));
    const keys = findClip(editor.store.getState().document, "photo")!.clip.keyframes!.rotation!;
    expect(keys.length).toBeGreaterThan(100);
    expect(keys.at(-1)!.value).toBeCloseTo(360, 6);
  });
});

describe("behaviors in the focus lanes and the graph", () => {
  it("marks the lane with the behavior and draws the behaved curve dashed", { timeout: 15_000 }, () => {
    const start = doc();
    start.tracks[0].clips[0].behaviors = [{ id: "shake", kind: "wiggle", property: "x", frequency: 3, amount: 0.05, seed: 4 }];
    const { editor, container } = renderInEditor(start, <Timeline />);
    act(() => editor.commands.enterFocus("photo"));
    act(() => editor.view.setState({ pxPerSecond: 100 }));
    expect(screen.getByRole("img", { name: "Tremor em Posição X" })).toBeInTheDocument();
    expect(container.querySelector('[data-behavior-trace="x"] polyline')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gráfico" }));
    expect(container.querySelector('[data-graph-behavior="x"]')).not.toBeNull();
    expect(screen.getByText(pt.graphTrace)).toBeInTheDocument();
  });
});
