import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { counterRange, counterText, counterValueAt } from "@/lib/studio/counter";
import { emptyVideoDocument, newOverlayClip, newTextLayer, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { CounterFields } from "../inspector/counter-fields";
import { TextPathFields } from "../inspector/text-path-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { TextPanel } from "../panels/text-panel";
import { renderInEditor } from "./harness";

const IDS = ["c"];

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [{ ...newOverlayClip({ ...newTextLayer("Oferta"), curve: 0.4 }, 0, 3000), id: "c" }] }];
  d.durationMs = 3000;
  return d;
}

function Sections() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return (
    <>
      <CounterFields clip={clip} disabled={false} editor={editor} />
      <TextPathFields clip={clip} disabled={false} editor={editor} />
    </>
  );
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("counters by hand", () => {
  it("turns a text into a counter, retargets the count, formats it and removes it", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Sections />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;

    fireEvent.click(screen.getByRole("button", { name: "Contar números" }));
    expect(clip().counter).toMatchObject({ locale: "pt-BR", decimals: 0, grouping: true });
    expect(counterRange(clip())).toMatchObject({ from: 0, to: 10_000, startMs: 0 });

    commit("Até", "2500");
    commit("Duração", "1");
    expect(counterRange(clip())).toMatchObject({ to: 2500, durationMs: 1000 });

    commit("Casas decimais", "1");
    commit("Antes do número", "R$ ");
    commit("Depois do número", " mil");
    fireEvent.change(screen.getByLabelText("Separadores"), { target: { value: "en-US" } });
    expect(counterText(clip().counter!, counterValueAt(clip(), 1000))).toBe("R$ 2,500.0 mil");
    expect(screen.getByText("Mostra agora: R$ 0.0 mil")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Parar a contagem" }));
    expect(clip().keyframes?.counter).toBeUndefined();
    expect(clip().counter?.value).toBe(2500);

    act(() => editor.view.setState({ playheadMs: 500 }));
    fireEvent.click(screen.getByRole("button", { name: "Chave do valor no cursor" }));
    expect(clip().keyframes?.counter).toEqual([{ atMs: 500, value: 2500, easing: "linear" }]);

    fireEvent.click(screen.getByRole("button", { name: "Remover contador" }));
    expect(clip().counter).toBeUndefined();
    expect(clip().keyframes?.counter).toBeUndefined();
  });
});

describe("text on a path by hand", () => {
  it("puts curved text on an arc, changes shape, keys the position and takes it off", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Sections />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;

    fireEvent.click(screen.getByRole("button", { name: "Colocar num caminho" }));
    expect(clip().textPath).toMatchObject({ shape: "arc", bend: 0.4, offset: 0.5, align: "center" });
    expect(clip().layer?.curve).toBeUndefined();

    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "custom" } });
    expect(clip().textPath?.shape).toBe("custom");
    expect(clip().textPath?.path).toMatch(/^M/);

    fireEvent.change(screen.getByLabelText("Forma"), { target: { value: "circle" } });
    fireEvent.change(screen.getByLabelText("Âncora do texto"), { target: { value: "start" } });
    fireEvent.click(screen.getByLabelText("Letras em pé"));
    fireEvent.click(screen.getByLabelText("Inverter o sentido"));
    expect(clip().textPath).toEqual({ shape: "circle", offset: 0.5, align: "start", upright: true, reverse: true });

    fireEvent.click(screen.getByRole("button", { name: "Chave da posição no cursor" }));
    act(() => editor.view.setState({ playheadMs: 2000 }));
    commit("Posição no caminho", "150");
    expect(clip().keyframes?.pathOffset?.map((key) => [key.atMs, key.value])).toEqual([
      [0, 0.5],
      [2000, 1.5],
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Tirar do caminho" }));
    expect(clip().textPath).toBeUndefined();
    expect(clip().keyframes).toBeUndefined();
  });
});

describe("counter preset", () => {
  it("inserts a counting text from the text panel", { timeout: 15_000 }, () => {
    const empty = emptyVideoDocument("story");
    const { editor } = renderInEditor(empty, <TextPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Contador" }));
    const inserted = editor.store.getState().document.tracks.flatMap((track) => track.clips).find((item) => item.counter);
    expect(inserted?.layer?.type).toBe("text");
    expect(counterRange(inserted!)).toMatchObject({ from: 0, to: 10_000 });
  });
});
