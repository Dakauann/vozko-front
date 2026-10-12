import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { MaskFields } from "../inspector/mask-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { renderInEditor } from "./harness";

const IDS = ["c"];

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 2000), id: "c" }] }];
  d.durationMs = 2000;
  return d;
}

function Masks() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return <MaskFields clip={clip} disabled={false} editor={editor} />;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("masks by hand", () => {
  it("adds a mask, shapes it, keys it at the playhead, turns on the matte and removes it", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Masks />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    expect(screen.getByText("Sem máscaras. A máscara mostra só uma parte do clipe.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar máscara: Elipse" }));
    expect(clip().masks).toEqual([expect.objectContaining({ shape: "ellipse" })]);
    commit("Largura", "60");
    expect(clip().masks![0].w).toBeCloseTo(0.6);
    fireEvent.change(screen.getByLabelText("Modo"), { target: { value: "subtract" } });
    expect(clip().masks![0].mode).toBe("subtract");
    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "star" } });
    expect(clip().masks![0]).toMatchObject({ shape: "star", points: 5 });
    commit("Pontas", "7");
    expect(clip().masks![0].points).toBe(7);

    act(() => editor.view.setState({ playheadMs: 500 }));
    fireEvent.click(screen.getByRole("button", { name: "Chave de Opacidade no cursor" }));
    expect(clip().masks![0].keyframes?.opacity).toEqual([{ atMs: 500, value: 1, easing: "linear" }]);
    act(() => editor.view.setState({ playheadMs: 1500 }));
    commit("Opacidade", "40");
    expect(clip().masks![0].keyframes?.opacity?.map((k) => [k.atMs, k.value])).toEqual([
      [500, 1],
      [1500, 0.4],
    ]);

    fireEvent.click(screen.getByLabelText("Recortar pelo clipe de baixo"));
    expect(clip().matte).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Remover máscara" }));
    expect(clip().masks).toBeUndefined();
  });

  it("reorders masks", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Masks />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    fireEvent.click(screen.getByRole("button", { name: "Adicionar máscara: Retângulo" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar máscara: Coração" }));
    expect(clip().masks!.map((m) => m.shape)).toEqual(["rectangle", "heart"]);
    fireEvent.click(screen.getByRole("button", { name: "Subir máscara" }));
    expect(clip().masks!.map((m) => m.shape)).toEqual(["heart", "rectangle"]);
  });
});
