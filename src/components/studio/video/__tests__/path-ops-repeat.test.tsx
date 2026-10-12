import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newOverlayClip, newShapeLayer, type VideoDocument } from "@/lib/studio/document";
import type { OffsetOp } from "@/lib/studio/path-ops";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { VideoPathOpFields } from "../inspector/path-op-fields";
import { RepeatFields } from "../inspector/repeat-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { renderInEditor } from "./harness";

const IDS = ["c"];

function doc(): VideoDocument {
  const d = emptyVideoDocument("square");
  const star = { ...newShapeLayer("star", { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 }), id: "l", fill: "#ffcc00" };
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newOverlayClip(star, 0, 2000, { x: 0.5, y: 0.5, w: 0.2, h: 0.2, rotation: 0, opacity: 1 }), id: "c" }] }];
  d.durationMs = 2000;
  return d;
}

function Fields() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return (
    <>
      <VideoPathOpFields clip={clip} disabled={false} editor={editor} />
      <RepeatFields clip={clip} disabled={false} editor={editor} />
    </>
  );
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("path operators and the repeater by hand", () => {
  it("applies a preset, adds an operator, keys its distance and reorders the stack", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Fields />);
    const ops = () => findClip(editor.store.getState().document, "c")!.clip.layer!.pathOps ?? [];

    fireEvent.click(screen.getByTitle("Aplicar Borda ondulada"));
    expect(ops().map((op) => op.kind)).toEqual(["zigZag"]);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Deslocar contorno" }));
    expect(ops().map((op) => op.kind)).toEqual(["zigZag", "offset"]);

    act(() => editor.view.setState({ playheadMs: 0 }));
    commit("Distância", "0");
    fireEvent.click(screen.getByRole("button", { name: "Chave em Distância" }));
    act(() => editor.view.setState({ playheadMs: 1000 }));
    commit("Distância", "24");
    expect((ops()[1] as OffsetOp).keyframes?.amount?.map((key) => [key.atMs, key.value])).toEqual([
      [0, 0],
      [1000, 24],
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Subir" }));
    expect(ops().map((op) => op.kind)).toEqual(["offset", "zigZag"]);
    fireEvent.click(screen.getByRole("button", { name: "Esconder" }));
    expect(ops()[0].hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(ops().map((op) => op.kind)).toEqual(["zigZag"]);
  });

  it("starts a repeater from a preset, changes the step, keys the shift and removes it", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Fields />);
    const repeat = () => findClip(editor.store.getState().document, "c")!.clip.repeat;

    fireEvent.click(screen.getByTitle("Aplicar Rastro"));
    expect(repeat()).toMatchObject({ mode: "linear", copies: 5, order: "below" });
    commit("Passo X", "120");
    expect(repeat()?.x).toBe(120);

    act(() => editor.view.setState({ playheadMs: 0 }));
    fireEvent.click(screen.getByRole("button", { name: "Chave em Deslizar" }));
    act(() => editor.view.setState({ playheadMs: 1500 }));
    commit("Deslizar", "2");
    expect(repeat()?.keyframes?.shift?.map((key) => [key.atMs, key.value])).toEqual([
      [0, 0],
      [1500, 2],
    ]);

    fireEvent.change(screen.getByLabelText("Modo"), { target: { value: "radial" } });
    expect(repeat()?.mode).toBe("radial");
    expect(repeat()?.keyframes).toBeUndefined();
    const section = screen.getByLabelText("Posições").closest("section") ?? document.body;
    expect(within(section as HTMLElement).getByLabelText("Raio")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remover repetição" }));
    expect(repeat()).toBeUndefined();
  });
});
