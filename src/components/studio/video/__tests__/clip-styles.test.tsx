import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type Clip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { ClipStyleFields } from "../inspector/clip-style-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { renderInEditor } from "./harness";

const IDS = ["c"];

function film(clip: Clip): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...clip, id: "c" }] }];
  d.durationMs = 2000;
  return d;
}

function Styles() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return <ClipStyleFields clip={clip} disabled={false} editor={editor} />;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("layer styles by hand", () => {
  it("gives a video clip an outline and a glow that pulses, and offers only outside effects", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(newMediaClip("video", "vid", 0, 2000)), <Styles />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    expect(screen.queryByRole("button", { name: "Brilho interno" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sombra interna" })).toBeNull();
    expect(screen.queryByText("Preenchimentos")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar contorno" }));
    expect(clip().strokes).toEqual([expect.objectContaining({ type: "solid", align: "outside" })]);
    fireEvent.click(screen.getByRole("button", { name: "Brilho externo" }));
    expect(clip().effects).toEqual([expect.objectContaining({ type: "outer-glow" })]);

    act(() => editor.view.setState({ playheadMs: 200 }));
    fireEvent.click(screen.getByRole("button", { name: "Chave de Desfoque no cursor" }));
    expect(clip().effects?.[0].keyframes?.blur).toEqual([{ atMs: 200, value: 16, easing: "linear" }]);
    act(() => editor.view.setState({ playheadMs: 900 }));
    commit("Desfoque", "40");
    expect(clip().effects?.[0].keyframes?.blur?.map((key) => [key.atMs, key.value])).toEqual([
      [200, 16],
      [900, 40],
    ]);
  });

  it("gives a text fill lists and inner effects like the image editor", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(film(newOverlayClip(newTextLayer("Oferta"), 0, 2000)), <Styles />);
    const layer = () => findClip(editor.store.getState().document, "c")!.clip.layer!;
    fireEvent.click(screen.getByRole("button", { name: "Adicionar preenchimento" }));
    expect(layer().fills?.length).toBeGreaterThan(0);
    expect(layer().fill).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Brilho interno" }));
    expect(layer().effects).toEqual([expect.objectContaining({ type: "inner-glow" })]);
  });
});
