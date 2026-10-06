import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { Inspector } from "../inspector/inspector";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 1000, 4000), id: "a" }] }];
  d.durationMs = 5000;
  return d;
}

function clipA(editor: ReturnType<typeof renderInEditor>["editor"]) {
  return findClip(editor.store.getState().document, "a")!.clip;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("keyframe inspector", () => {
  it("adds and removes a key with the diamond and navigates between keys", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["a"]);
      editor.view.setState({ playheadMs: 1000 });
    });
    fireEvent.click(screen.getByRole("button", { name: "Animar Opacidade" }));
    act(() => editor.view.setState({ playheadMs: 3000 }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar quadro-chave de Opacidade no cursor" }));
    expect(clipA(editor).keyframes?.opacity).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Quadro-chave anterior de Opacidade" }));
    expect(editor.view.getState().playheadMs).toBe(1000);
    fireEvent.click(screen.getByRole("button", { name: "Remover quadro-chave de Opacidade no cursor" }));
    expect(clipA(editor).keyframes?.opacity).toHaveLength(1);
  });

  it("stops animating after a confirm and keeps the current value", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["a"]);
      editor.view.setState({ playheadMs: 2000 });
    });
    fireEvent.click(screen.getByRole("button", { name: "Animar Rotação" }));
    commit("Rotação", "45");
    fireEvent.click(screen.getByRole("button", { name: "Parar de animar Rotação" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Parar de animar" }));
    expect(clipA(editor).keyframes).toBeUndefined();
    expect(clipA(editor).transform.rotation).toBe(45);
  });

  it("asks to move the playhead into the clip before keying", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => {
      editor.store.getState().select(["a"]);
      editor.view.setState({ playheadMs: 0 });
    });
    fireEvent.click(screen.getByRole("button", { name: "Animar Escala" }));
    expect(clipA(editor).keyframes).toBeUndefined();
    expect(editor.view.getState().notice?.key).toBe("keyframeOutside");
  });

  it("applies an entrance preset", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    fireEvent.change(screen.getByLabelText("Animação de entrada"), { target: { value: "slideUp" } });
    expect(clipA(editor)).toMatchObject({ motionIn: { edge: "bottom", durationMs: 500 }, fadeInMs: 500 });
  });
});

describe("keyframe marks on the timeline", () => {
  it("draws a diamond per key time and seeks to it", () => {
    const d = doc();
    d.tracks[0].clips[0].keyframes = { x: [{ atMs: 1000, value: 0.2, easing: "linear" }], opacity: [{ atMs: 3000, value: 1, easing: "linear" }] };
    const { editor } = renderInEditor(d, <Timeline />);
    const marks = screen.getAllByRole("button", { name: /Ir para o quadro-chave/ });
    expect(marks).toHaveLength(2);
    fireEvent.click(marks[1]);
    expect(editor.view.getState().playheadMs).toBe(4000);
  });
});
