import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { documentIssue } from "@/lib/studio/validate";

import { Inspector } from "../inspector/inspector";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("video", "vid", 0, 4000), id: "a" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip({ ...newTextLayer("Oferta de hoje"), fill: "#ffffff" }, 0, 3000), id: "o" }] },
  ];
  d.durationMs = 4000;
  return d;
}

type Editor = ReturnType<typeof renderInEditor>["editor"];

const textOf = (editor: Editor) => findClip(editor.store.getState().document, "o")!.clip;

function openAnimators(editor: Editor) {
  act(() => editor.store.getState().select(["o"]));
  fireEvent.click(screen.getByRole("tab", { name: "Animação" }));
}

describe("text animators by hand", () => {
  it("adds a preset from the gallery as plain values and edits its selector", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    openAnimators(editor);
    fireEvent.click(screen.getByRole("button", { name: "Cascata" }));
    const [animator] = textOf(editor).textAnimators!;
    expect(animator).toMatchObject({ unit: "char", properties: { opacity: 0 }, selector: { kind: "range", shape: "rampUp" } });
    expect(animator.keyframes?.offset).toHaveLength(2);
    const detail = screen.getByRole("group", { name: "Animador aberto" });
    fireEvent.change(within(detail).getByLabelText("Ordem"), { target: { value: "centerOut" } });
    fireEvent.change(within(detail).getByLabelText("Forma"), { target: { value: "smooth" } });
    fireEvent.change(within(detail).getByLabelText("Unidade"), { target: { value: "word" } });
    expect(textOf(editor).textAnimators![0]).toMatchObject({ unit: "word", selector: { order: "centerOut", shape: "smooth" } });
    expect(within(detail).getByRole("img", { name: /Quanto cada uma das 3 unidades/ })).toBeInTheDocument();
    expect(documentIssue("video", editor.store.getState().document)).toBeNull();
  });

  it("builds a custom animator, adds and removes properties and keys a selector value", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    openAnimators(editor);
    fireEvent.click(screen.getByRole("button", { name: "Novo animador" }));
    const detail = screen.getByRole("group", { name: "Animador aberto" });
    fireEvent.change(within(detail).getByLabelText("Adicionar propriedade"), { target: { value: "rotation" } });
    expect(textOf(editor).textAnimators![0].properties).toEqual({ opacity: 0, rotation: 30 });
    fireEvent.click(within(detail).getByRole("button", { name: "Tirar Opacidade" }));
    expect(textOf(editor).textAnimators![0].properties).toEqual({ rotation: 30 });
    const rotation = within(detail).getByLabelText("Rotação");
    fireEvent.change(rotation, { target: { value: "-45" } });
    fireEvent.blur(rotation);
    expect(textOf(editor).textAnimators![0].properties.rotation).toBe(-45);
    act(() => editor.view.setState({ playheadMs: 500 }));
    fireEvent.click(within(detail).getByRole("button", { name: "Chave de Deslocamento" }));
    expect(textOf(editor).textAnimators![0].keyframes?.offset?.length).toBe(1);
  });

  it("switches to a looping wiggle, reorders and removes animators", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    openAnimators(editor);
    fireEvent.click(screen.getByRole("button", { name: "Onda" }));
    fireEvent.click(screen.getByRole("button", { name: "Letras tremendo" }));
    const ids = textOf(editor).textAnimators!.map((animator) => animator.id);
    const detail = screen.getByRole("group", { name: "Animador aberto" });
    expect(within(detail).getByLabelText("Oscilações por segundo")).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole("button", { name: "Subir na lista" }));
    expect(textOf(editor).textAnimators!.map((animator) => animator.id)).toEqual([ids[1], ids[0]]);
    fireEvent.change(within(detail).getByLabelText("Seletor"), { target: { value: "range" } });
    expect(textOf(editor).textAnimators![0].selector.kind).toBe("range");
    fireEvent.click(within(screen.getByRole("group", { name: "Animador aberto" })).getByRole("button", { name: "Remover animador" }));
    expect(textOf(editor).textAnimators!.map((animator) => animator.id)).toEqual([ids[0]]);
  });

  it("disables the color sweep on a text without a solid fill", { timeout: 15_000 }, () => {
    const d = doc();
    d.tracks[1].clips[0].layer = { ...d.tracks[1].clips[0].layer!, gradient: { kind: "linear", from: "#ff0000", to: "#0000ff", angle: 0 } };
    const { editor } = renderInEditor(d, <Inspector />);
    openAnimators(editor);
    expect(screen.getByRole("button", { name: "Faixa de cor" })).toBeDisabled();
  });
});
