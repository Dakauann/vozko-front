import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, newNullClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { Inspector } from "../inspector/inspector";
import { renderInEditor } from "./harness";

const inspector = ptMessages.studio.video.inspector;
const keyHere = (name: string) => ptMessages.studio.video.keyframes.keyHere.replace("{name}", name);

function doc(locked = false): VideoDocument {
  const d = emptyVideoDocument("landscape");
  d.tracks = [
    { id: "v1", kind: "visual", locked, clips: [{ ...newMediaClip("image", "pic", 0, 4000), id: "a" }] },
    { id: "v2", kind: "visual", clips: [{ ...newNullClip(0, 4000), id: "n" }] },
  ];
  d.durationMs = 4000;
  return d;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("3D rotation by hand", () => {
  it("turns a clip in depth from the 3D rotation section", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    commit(inspector.rotationY, "45");
    commit(inspector.rotationX, "-20");
    expect(findClip(editor.store.getState().document, "a")!.clip).toMatchObject({ rotationX: -20, rotationY: 45 });
    commit(inspector.rotationY, "0");
    expect(findClip(editor.store.getState().document, "a")!.clip.rotationY).toBeUndefined();
  });

  it("keys the turn at the playhead with the diamond and then edits the key", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    act(() => editor.view.setState({ playheadMs: 1000 }));
    fireEvent.click(screen.getByRole("button", { name: keyHere(inspector.rotationY) }));
    commit(inspector.rotationY, "90");
    expect(findClip(editor.store.getState().document, "a")!.clip.keyframes?.rotationY).toEqual([{ atMs: 1000, value: 90, easing: "linear" }]);
  });

  it("offers no 3D rotation on a null and keeps it read only on a locked track", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(true), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    expect(screen.getByLabelText(inspector.rotationX)).toBeDisabled();
    act(() => editor.store.getState().select(["n"]));
    expect(screen.queryByLabelText(inspector.rotationX)).not.toBeInTheDocument();
  });

  it("sets the project perspective with nothing selected, flat included, inside its range", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    expect(screen.getByLabelText(inspector.perspectiveAngle)).toHaveValue("40");
    commit(inspector.perspectiveAngle, "0");
    expect(editor.store.getState().document.canvas.perspective).toBe(0);
    commit(inspector.perspectiveAngle, "500");
    expect(editor.store.getState().document.canvas.perspective).toBe(120);
    act(() => editor.commands.setPerspective(-5));
    expect(editor.store.getState().document.canvas.perspective).toBe(120);
  });
});
