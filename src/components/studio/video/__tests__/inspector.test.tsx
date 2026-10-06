import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, newOverlayClip, newTextLayer, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

import { Inspector } from "../inspector/inspector";
import { renderInEditor } from "./harness";

function doc(locked = false): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", locked, clips: [{ ...newMediaClip("video", "vid", 0, 4000), id: "a" }] },
    { id: "v2", kind: "visual", clips: [{ ...newOverlayClip(newTextLayer("Oi"), 500, 2000), id: "o" }] },
    { id: "au", kind: "audio", clips: [{ ...newMediaClip("audio", "song", 0, 4000), id: "m" }] },
  ];
  d.durationMs = 4000;
  return d;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("Inspector", () => {
  it("shows the project when nothing is selected", () => {
    renderInEditor(doc(), <Inspector />);
    expect(screen.getByText("Selecione um clipe na linha do tempo ou na pré-visualização para editar.")).toBeInTheDocument();
  });

  it("edits transform and fades with clamping", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    commit("Posição X", "150");
    commit("Entrada", "9");
    const clip = findClip(editor.store.getState().document, "a")!.clip;
    expect(clip.transform.x).toBe(1);
    expect(clip.fadeInMs).toBe(4000);
  });

  it("changes the fit of a media clip", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    fireEvent.click(screen.getByRole("button", { name: "Caber inteiro" }));
    expect(findClip(editor.store.getState().document, "a")?.clip.fit).toBe("contain");
  });

  it("shows volume for audio clips", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["m"]));
    const volume = screen.getByLabelText("Volume");
    fireEvent.change(volume, { target: { value: "150" } });
    expect(findClip(editor.store.getState().document, "m")?.clip.volume).toBe(1.5);
    expect(screen.queryByLabelText("Posição X")).not.toBeInTheDocument();
  });

  it("disables fields on a locked track", () => {
    const { editor } = renderInEditor(doc(true), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    expect(screen.getByLabelText("Início")).toBeDisabled();
    expect(screen.getByText("Esta faixa está bloqueada. Desbloqueie para editar.")).toBeInTheDocument();
  });
});
