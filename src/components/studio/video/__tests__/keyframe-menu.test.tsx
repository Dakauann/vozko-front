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

import { KeyframeDialogs } from "../timeline/keyframe-dialogs";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 4000), id: "a" }] }];
  d.tracks[0].clips[0].keyframes = {
    x: [
      { atMs: 1000, value: 0.2, easing: "linear" },
      { atMs: 3000, value: 0.8, easing: "linear" },
    ],
  };
  d.durationMs = 4000;
  return d;
}

function keyLeft(name: RegExp): number {
  return parseFloat((screen.getByLabelText(name) as HTMLElement).style.left);
}

describe("keyframe menu", () => {
  it("removes a key, adds one on an empty spot and eases the selected keys", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    const keys = () => findClip(editor.store.getState().document, "a")!.clip.keyframes?.x ?? [];
    act(() => editor.commands.enterFocus("a"));
    act(() => editor.view.setState({ pxPerSecond: 100 }));
    const lanes = screen.getByRole("group", { name: "Faixas de quadros-chave" });

    fireEvent.contextMenu(lanes, { clientX: keyLeft(/Posição X.*3000/), clientY: 5 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Remover quadro-chave/ }));
    expect(keys().map((key) => key.atMs)).toEqual([1000]);

    const oneKey = keyLeft(/Posição X.*1000/);
    fireEvent.contextMenu(lanes, { clientX: oneKey * 2, clientY: 5 });
    fireEvent.click(screen.getByRole("menuitem", { name: /Adicionar quadro-chave de Posição X aqui/ }));
    expect(keys().map((key) => key.atMs)).toEqual([1000, 2000]);

    act(() => editor.view.setState({ selectedKeys: [{ property: "x", atMs: 1000 }] }));
    act(() => editor.commands.easeKeys("easeInOut"));
    expect(keys()[0].easing).toBe("easeInOut");
  });

  it("removes every key at a moment from the clip diamonds", { timeout: 15_000 }, () => {
    const d = doc();
    d.tracks[0].clips[0].keyframes!.opacity = [{ atMs: 1000, value: 0.5, easing: "linear" }];
    const { editor } = renderInEditor(d, <Timeline />);
    const [first] = screen.getAllByRole("button", { name: /Ir para o quadro-chave/ });
    fireEvent.contextMenu(first);
    fireEvent.click(screen.getByRole("menuitem", { name: "Remover os quadros-chave deste instante" }));
    const keyframes = findClip(editor.store.getState().document, "a")!.clip.keyframes;
    expect(keyframes?.x?.map((key) => key.atMs)).toEqual([3000]);
    expect(keyframes?.opacity).toBeUndefined();
  });
});

describe("keyframe ease and assistants", () => {
  it("eases the selected key from the menu and the shortcut command", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    const keys = () => findClip(editor.store.getState().document, "a")!.clip.keyframes?.x ?? [];
    act(() => editor.commands.enterFocus("a"));
    act(() => editor.view.setState({ pxPerSecond: 100 }));
    const lanes = screen.getByRole("group", { name: "Faixas de quadros-chave" });
    fireEvent.contextMenu(lanes, { clientX: keyLeft(/Posição X.*1000/), clientY: 5 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Suavizar" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Suavizar a saída/ }));
    expect(keys()[0].easing).toBe("cubic-bezier(0.333,0,0.667,0.667)");
    act(() => editor.view.setState({ selectedKeys: [{ property: "x", atMs: 3000 }] }));
    act(() => editor.commands.easeSides("in"));
    expect(keys()[0].easing).toBe("cubic-bezier(0.333,0,0.667,1)");
  });

  it("sets speed and influence in the velocity dialog", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), (
      <>
        <Timeline />
        <KeyframeDialogs />
      </>
    ));
    const keys = () => findClip(editor.store.getState().document, "a")!.clip.keyframes?.x ?? [];
    act(() => editor.commands.enterFocus("a"));
    act(() => editor.view.setState({ selectedKeys: [{ property: "x", atMs: 1000 }] }));
    act(() => editor.commands.openKeyDialog("velocity"));
    fireEvent.change(screen.getByLabelText("Velocidade por segundo"), { target: { value: "0,6" } });
    fireEvent.change(screen.getByLabelText("Influência (%)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(keys()[0].easing).toBe("cubic-bezier(0.5,1,0.667,0.667)");
    expect(editor.view.getState().keyDialog).toBeNull();
  });

  it("stretches, nudges and reverses the selected keys", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), (
      <>
        <Timeline />
        <KeyframeDialogs />
      </>
    ));
    const keys = () => findClip(editor.store.getState().document, "a")!.clip.keyframes?.x ?? [];
    act(() => editor.commands.enterFocus("a"));
    act(() => editor.view.setState({ selectedKeys: [{ property: "x", atMs: 1000 }, { property: "x", atMs: 3000 }] }));
    act(() => editor.commands.openKeyDialog("stretch"));
    fireEvent.change(screen.getByLabelText("Duração (%)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    expect(keys().map((key) => key.atMs)).toEqual([1000, 2000]);
    act(() => editor.commands.nudgeKeysOrJumpMarker(1, 1));
    expect(keys().map((key) => key.atMs)).toEqual([1033, 2033]);
    act(() => editor.commands.reverseKeys());
    expect(keys().map((key) => [key.atMs, key.value])).toEqual([
      [1033, 0.8],
      [2033, 0.2],
    ]);
  });
});
