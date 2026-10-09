import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, newTextLayer, type VideoDocument } from "@/lib/studio/document";
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

  it("tunes the points of a star overlay", () => {
    const d = doc();
    d.tracks[1].clips.push({ ...newOverlayClip(newShapeLayer("star"), 2600, 1000), id: "s" });
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["s"]));
    commit("Pontas", "12");
    commit("Raio interno", "80");
    expect(findClip(editor.store.getState().document, "s")?.clip.layer).toMatchObject({ points: 12, inner: 0.8 });
  });

  it("styles the outline of a shape overlay like the image editor", () => {
    const d = doc();
    d.tracks[1].clips.push({ ...newOverlayClip({ ...newShapeLayer("rect"), stroke: "#ff0000", strokeWidth: 6 }, 2600, 1000), id: "r" });
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["r"]));
    fireEvent.change(screen.getByLabelText("Traço"), { target: { value: "dotted" } });
    fireEvent.click(screen.getByRole("button", { name: "Canto chanfrado" }));
    commit("Deslocamento", "1.5");
    expect(findClip(editor.store.getState().document, "r")?.clip.layer).toMatchObject({ dashArray: [0, 2], lineCap: "round", lineJoin: "bevel", dashOffset: 1.5 });
    expect(screen.queryByLabelText("Limite do bico")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Extremidade quadrada" }));
    expect(findClip(editor.store.getState().document, "r")?.clip.layer?.lineCap).toBe("square");
  });

  it("dashes the outline of a text overlay without offering line caps", () => {
    const d = doc();
    d.tracks[1].clips[0] = { ...newOverlayClip({ ...newTextLayer("Oi"), stroke: "#ffffff", strokeWidth: 4 }, 500, 2000), id: "o" };
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["o"]));
    fireEvent.change(screen.getByLabelText("Traço"), { target: { value: "dashed" } });
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.dashArray).toEqual([3, 2]);
    expect(screen.queryByRole("button", { name: "Extremidade reta" })).not.toBeInTheDocument();
    commit("Limite do bico", "4");
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.miterLimit).toBe(4);
  });

  it("puts arrow heads on an open vector path overlay", () => {
    const d = doc();
    const open = { id: "lp", type: "shape" as const, shape: "path" as const, path: "M0 0 C0 1 1 1 1 0", stroke: "#111111", strokeWidth: 6, transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.3, rotation: 0, opacity: 1 } };
    d.tracks[1].clips.push({ ...newOverlayClip(open, 2600, 1000), id: "p" });
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["p"]));
    fireEvent.click(screen.getByLabelText("Ponta no fim"));
    expect(findClip(editor.store.getState().document, "p")?.clip.layer?.arrowEnd).toBe(true);
  });

  it("hides stroke styling until the overlay has an outline", () => {
    const d = doc();
    d.tracks[1].clips.push({ ...newOverlayClip(newShapeLayer("rect"), 2600, 1000), id: "r" });
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["r"]));
    expect(screen.queryByLabelText("Traço")).not.toBeInTheDocument();
  });

  it("takes a translucent #rrggbbaa color on an overlay and keeps the alpha when the swatch changes", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["o"]));
    const fill = screen.getByRole("textbox", { name: "Cor" });
    fireEvent.change(fill, { target: { value: "FF000080" } });
    fireEvent.blur(fill);
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.fill).toBe("#ff000080");
    fireEvent.change(screen.getByLabelText("Cor", { selector: "input[type=color]" }), { target: { value: "#00ff00" } });
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.fill).toBe("#00ff0080");
  });

  it("keeps the project background opaque", () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    const background = screen.getByRole("textbox", { name: "Cor de fundo" });
    fireEvent.change(background, { target: { value: "#11223344" } });
    fireEvent.blur(background);
    expect(editor.store.getState().document.canvas.background).not.toBe("#11223344");
    fireEvent.change(background, { target: { value: "112233" } });
    fireEvent.blur(background);
    expect(editor.store.getState().document.canvas.background).toBe("#112233");
  });

  it("offsets the shadow of an overlay sideways and down", () => {
    const d = doc();
    d.tracks[1].clips[0] = { ...newOverlayClip({ ...newTextLayer("Oi"), shadow: { color: "#000000", blur: 8, x: 0, y: 4 } }, 500, 2000), id: "o" };
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["o"]));
    commit("Sombra X", "-12");
    commit("Sombra Y", "900");
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.shadow).toEqual({ color: "#000000", blur: 8, x: -12, y: 500 });
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
