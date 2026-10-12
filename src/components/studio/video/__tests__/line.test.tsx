import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newOverlayClip, newShapeLayer, type Layer, type VideoDocument } from "@/lib/studio/document";
import { LINE_DEFAULTS } from "@/lib/studio/line-animation";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { LineFields } from "../inspector/line-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { renderInEditor } from "./harness";

const IDS = ["c"];

function doc(layer: Layer = newShapeLayer("line")): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newOverlayClip(layer, 0, 2000), id: "c" }] }];
  d.durationMs = 2000;
  return d;
}

function Line() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return <LineFields clip={clip} disabled={false} editor={editor} />;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("line animation by hand", () => {
  it("draws the stroke on with two keys, wobbles it with a wave and turns groups off with their keys", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Line />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;

    fireEvent.click(screen.getByLabelText("Desenhar o traço"));
    expect(clip().line?.trim).toEqual(LINE_DEFAULTS.trim);
    act(() => editor.view.setState({ playheadMs: 0 }));
    commit("Fim do traço", "0");
    expect(clip().line?.trim?.end).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Chave de Fim do traço no cursor" }));
    expect(clip().keyframes?.trimEnd).toEqual([{ atMs: 0, value: 0, easing: "linear" }]);
    act(() => editor.view.setState({ playheadMs: 1000 }));
    commit("Fim do traço", "100");
    expect(clip().keyframes?.trimEnd?.map((key) => [key.atMs, key.value])).toEqual([
      [0, 0],
      [1000, 1],
    ]);

    fireEvent.click(screen.getByLabelText("Onda"));
    commit("Velocidade da onda", "2.5");
    expect(clip().line?.wave).toMatchObject({ mode: "bend", speed: 2.5 });
    fireEvent.change(screen.getByLabelText("Tipo de onda"), { target: { value: "width" } });
    expect(clip().line?.wave?.mode).toBe("width");

    fireEvent.click(screen.getByLabelText("Desenhar o traço"));
    expect(clip().line?.trim).toBeUndefined();
    expect(clip().keyframes?.trimEnd).toBeUndefined();
    expect(clip().line?.wave).toBeDefined();
  });

  it("sets the wiggle seed and the sequential trim", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Line />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    fireEvent.click(screen.getByLabelText("Tremor"));
    commit("Semente do tremor", "42");
    expect(clip().line?.wiggle?.seed).toBe(42);
    fireEvent.click(screen.getByLabelText("Desenhar o traço"));
    fireEvent.click(screen.getByLabelText("Desenhar os traços um depois do outro"));
    expect(clip().line?.trim?.sequential).toBe(true);
  });

  it("explains why a shape without an outline cannot animate its stroke", { timeout: 15_000 }, () => {
    renderInEditor(doc(newShapeLayer("rect")), <Line />);
    expect(screen.getByText("Só linhas e formas com contorno animam o traço. Tire a sombra e os efeitos da camada para ligar.")).toBeTruthy();
    expect((screen.getByLabelText("Onda") as HTMLInputElement).disabled).toBe(true);
  });
});
