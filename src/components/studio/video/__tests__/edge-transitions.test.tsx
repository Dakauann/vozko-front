import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { addTransition, findTransition } from "@/lib/studio/transitions";

import { Inspector } from "../inspector/inspector";
import { renderInEditor } from "./harness";

const motion = ptMessages.studio.video.motion;
const transitions = ptMessages.studio.video.transitions;

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img-a", 0, 2000), id: "a" }, { ...newMediaClip("image", "img-b", 2000, 2000), id: "b" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 500, 2000), id: "o" }] },
  ];
  d.durationMs = 4000;
  return d;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

function openAnimation() {
  fireEvent.click(screen.getByRole("tab", { name: "Animação" }));
}

function pickEdge(side: "entrance" | "exit", name: string) {
  fireEvent.click(screen.getByRole("button", { name: motion[side] }));
  const group = within(screen.getByRole("group", { name: motion.transitionsGroup }).parentElement!);
  fireEvent.click(group.getByRole("button", { name }));
}

describe("entrance and exit transitions by hand", { timeout: 15_000 }, () => {
  it("picks a transition from the entrance gallery, tunes it and goes back to a fade", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["o"]));
    openAnimation();
    pickEdge("entrance", transitions.kinds.venetianBlinds);
    expect(findClip(editor.store.getState().document, "o")!.clip.transitionIn).toMatchObject({ kind: "venetianBlinds", size: 0.1 });
    commit(transitions.options.size, "25");
    commit(transitions.options.softness, "40");
    expect(findClip(editor.store.getState().document, "o")!.clip.transitionIn).toMatchObject({ size: 0.25, softness: 0.4 });
    fireEvent.click(screen.getByRole("button", { name: motion.entrance }));
    fireEvent.click(within(screen.getByRole("group", { name: motion.effectsGroup })).getByRole("button", { name: motion.presets.fade }));
    const clip = findClip(editor.store.getState().document, "o")!.clip;
    expect(clip.transitionIn).toBeUndefined();
    expect(clip.fadeInMs).toBeGreaterThan(0);
  });

  it("sets an exit gradient wipe with a preset map and its own options", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["o"]));
    openAnimation();
    pickEdge("exit", transitions.kinds.gradientWipe);
    fireEvent.change(screen.getByLabelText(transitions.options.map), { target: { value: "radial" } });
    expect(findClip(editor.store.getState().document, "o")!.clip.transitionOut).toMatchObject({ kind: "gradientWipe", map: "radial" });
    expect(screen.getByLabelText(transitions.options.originX)).toBeInTheDocument();
    expect(screen.queryByLabelText(transitions.options.angle)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(transitions.options.reverseMap));
    expect(findClip(editor.store.getState().document, "o")!.clip.transitionOut?.reverse).toBe(true);
  });

  it("explains and blocks transitions on an edge joined by a cut transition", () => {
    const joined = addTransition(doc(), { fromClipId: "a", toClipId: "b", kind: "dissolve" });
    if (!joined.ok) throw new Error(joined.reason);
    const { editor } = renderInEditor(joined.document, <Inspector />);
    act(() => editor.store.getState().select(["b"]));
    openAnimation();
    fireEvent.click(screen.getByRole("button", { name: motion.entrance }));
    expect(screen.getByText(motion.coveredIn)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: transitions.kinds.wipe })).toBeDisabled();
  });

  it("edits the new options of a cut transition in the transition inspector", () => {
    const placed = addTransition(doc(), { fromClipId: "a", toClipId: "b", kind: "blockDissolve" });
    if (!placed.ok) throw new Error(placed.reason);
    const { editor } = renderInEditor(placed.document, <Inspector />);
    act(() => editor.commands.selectTransition(placed.transitionId));
    commit(transitions.options.size, "12");
    expect(findTransition(editor.store.getState().document, placed.transitionId)!.transition.size).toBe(0.12);
    fireEvent.change(screen.getByRole("combobox", { name: transitions.kind }), { target: { value: "radialWipe" } });
    commit(transitions.options.softness, "30");
    expect(findTransition(editor.store.getState().document, placed.transitionId)!.transition).toMatchObject({ kind: "radialWipe", softness: 0.3 });
  });
});
