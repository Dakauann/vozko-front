import { act, fireEvent, screen, within } from "@testing-library/react";
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

function commitBox(name: string, value: string) {
  const input = screen.getByRole("textbox", { name });
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

function openTab(name: string) {
  fireEvent.click(screen.getByRole("tab", { name }));
}

describe("Inspector", () => {
  it("shows the project when nothing is selected", { timeout: 15_000 }, () => {
    renderInEditor(doc(), <Inspector />);
    expect(screen.getByText("Selecione um clipe na linha do tempo ou na pré-visualização para editar.")).toBeInTheDocument();
  });

  it("edits transform and fades with clamping", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    commit("Posição X", "150");
    commit("Entrada", "9");
    const clip = findClip(editor.store.getState().document, "a")!.clip;
    expect(clip.transform.x).toBe(1);
    expect(clip.fadeInMs).toBe(4000);
  });

  it("tunes the points of a star overlay", { timeout: 15_000 }, () => {
    const d = doc();
    d.tracks[1].clips.push({ ...newOverlayClip(newShapeLayer("star"), 2600, 1000), id: "s" });
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["s"]));
    commit("Pontas", "12");
    commit("Raio interno", "80");
    expect(findClip(editor.store.getState().document, "s")?.clip.layer).toMatchObject({ points: 12, inner: 0.8 });
  });

  it("styles the outline of a shape overlay like the image editor", { timeout: 15_000 }, () => {
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

  it("dashes the outline of a text overlay and rounds the ends of its dashes", { timeout: 15_000 }, () => {
    const d = doc();
    d.tracks[1].clips[0] = { ...newOverlayClip({ ...newTextLayer("Oi"), stroke: "#ffffff", strokeWidth: 4 }, 500, 2000), id: "o" };
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["o"]));
    fireEvent.change(screen.getByLabelText("Traço"), { target: { value: "dashed" } });
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.dashArray).toEqual([3, 2]);
    fireEvent.click(screen.getByRole("button", { name: "Extremidade redonda" }));
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.lineCap).toBe("round");
    commit("Limite do bico", "4");
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.miterLimit).toBe(4);
  });

  it("picks a line end style on an open vector path overlay", { timeout: 15_000 }, () => {
    const d = doc();
    const open = { id: "lp", type: "shape" as const, shape: "path" as const, path: "M0 0 C0 1 1 1 1 0", stroke: "#111111", strokeWidth: 6, transform: { x: 0.5, y: 0.5, w: 0.3, h: 0.3, rotation: 0, opacity: 1 } };
    d.tracks[1].clips.push({ ...newOverlayClip(open, 2600, 1000), id: "p" });
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["p"]));
    const end = screen.getAllByLabelText("Fim").find((field) => field.querySelector('option[value="dot"]'))!;
    fireEvent.change(end, { target: { value: "dot" } });
    expect(findClip(editor.store.getState().document, "p")?.clip.layer).toMatchObject({ arrowEnd: true, arrowEndKind: "dot" });
  });

  it("hides stroke styling until the overlay has an outline", { timeout: 15_000 }, () => {
    const d = doc();
    d.tracks[1].clips.push({ ...newOverlayClip(newShapeLayer("rect"), 2600, 1000), id: "r" });
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["r"]));
    expect(screen.queryByLabelText("Traço")).not.toBeInTheDocument();
  });

  it("takes a translucent #rrggbbaa color on an overlay and keeps the alpha when the swatch changes", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["o"]));
    const fill = screen.getByRole("textbox", { name: "Cor" });
    fireEvent.change(fill, { target: { value: "FF000080" } });
    fireEvent.blur(fill);
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.fill).toBe("#ff000080");
    fireEvent.change(screen.getByLabelText("Cor", { selector: "input[type=color]" }), { target: { value: "#00ff00" } });
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.fill).toBe("#00ff0080");
  });

  it("keeps the project background opaque", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    const background = screen.getByRole("textbox", { name: "Cor de fundo" });
    fireEvent.change(background, { target: { value: "#11223344" } });
    fireEvent.blur(background);
    expect(editor.store.getState().document.canvas.background).not.toBe("#11223344");
    fireEvent.change(background, { target: { value: "112233" } });
    fireEvent.blur(background);
    expect(editor.store.getState().document.canvas.background).toBe("#112233");
  });

  it("offsets the shadow of an overlay sideways and down", { timeout: 15_000 }, () => {
    const d = doc();
    d.tracks[1].clips[0] = { ...newOverlayClip({ ...newTextLayer("Oi"), shadow: { color: "#000000", blur: 8, x: 0, y: 4 } }, 500, 2000), id: "o" };
    const { editor } = renderInEditor(d, <Inspector />);
    act(() => editor.store.getState().select(["o"]));
    commit("Sombra X", "-12");
    commit("Sombra Y", "900");
    expect(findClip(editor.store.getState().document, "o")?.clip.layer?.shadow).toEqual({ color: "#000000", blur: 8, x: -12, y: 500 });
  });

  it("changes the fit of a media clip", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    fireEvent.click(screen.getByRole("button", { name: "Caber inteiro" }));
    expect(findClip(editor.store.getState().document, "a")?.clip.fit).toBe("contain");
  });

  it("shows volume for audio clips", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["m"]));
    const volume = screen.getByLabelText("Volume");
    fireEvent.change(volume, { target: { value: "150" } });
    expect(findClip(editor.store.getState().document, "m")?.clip.volume).toBe(1.5);
    expect(screen.queryByLabelText("Posição X")).not.toBeInTheDocument();
  });

  it("disables fields on a locked track", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(true), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    expect(screen.getByLabelText("Início")).toBeDisabled();
    expect(screen.getByText("Esta faixa está bloqueada. Desbloqueie para editar.")).toBeInTheDocument();
  });
});

describe("inspector tabs per clip type", () => {
  const tabs = () => screen.queryAllByRole("tab").map((tab) => tab.textContent);

  it("offers only the categories that fit the selected clips", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    expect(tabs()).toEqual(["Básico", "Animação", "Cor", "Efeitos", "Recorte", "Velocidade"]);
    act(() => editor.store.getState().select(["o"]));
    expect(tabs()).toEqual(["Básico", "Animação", "Efeitos", "Recorte"]);
    act(() => editor.store.getState().select(["m"]));
    expect(tabs()).toEqual(["Básico", "Animação", "Velocidade"]);
    expect(screen.getByRole("region", { name: "Som" })).toBeInTheDocument();
    act(() => editor.store.getState().select(["a", "o"]));
    expect(tabs()).toEqual(["Básico", "Animação"]);
  });

  it("keeps fields disabled on a locked track in every tab", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(true), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    openTab("Velocidade");
    expect(screen.getByRole("textbox", { name: "Velocidade" })).toBeDisabled();
    expect(screen.getByText("Esta faixa está bloqueada. Desbloqueie para editar.")).toBeVisible();
  });
});

describe("text animation by hand", () => {
  const textOf = (editor: ReturnType<typeof renderInEditor>["editor"]) => findClip(editor.store.getState().document, "o")!.clip;

  it("animates a text in by word, retimes it, and takes the animation off", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["o"]));
    openTab("Animação");
    fireEvent.change(screen.getByLabelText("Chegada do texto"), { target: { value: "rise" } });
    expect(textOf(editor).textIn).toMatchObject({ unit: "word", style: "rise", durationMs: 400 });
    fireEvent.change(screen.getByLabelText("Chegada por"), { target: { value: "char" } });
    expect(textOf(editor).textIn).toMatchObject({ unit: "char", style: "rise", durationMs: 300, staggerMs: 35 });
    commit("Intervalo da chegada", "0.1");
    expect(textOf(editor).textIn?.staggerMs).toBe(100);
    fireEvent.click(within(screen.getByRole("group", { name: "Curva da chegada" })).getByRole("button", { name: "Mola" }));
    expect(textOf(editor).textIn?.easing).toBe("spring");
    fireEvent.change(screen.getByLabelText("Saída do texto"), { target: { value: "typewriter" } });
    expect(textOf(editor).textOut).toMatchObject({ unit: "char", style: "typewriter" });
    fireEvent.change(screen.getByLabelText("Chegada do texto"), { target: { value: "none" } });
    expect(textOf(editor).textIn).toBeUndefined();
  });

  it("offers text animation only on texts", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    expect(screen.queryByLabelText("Chegada do texto")).not.toBeInTheDocument();
  });
});

describe("clip speed by hand", () => {
  const clipOf = (editor: ReturnType<typeof renderInEditor>["editor"], id: string) => findClip(editor.store.getState().document, id)!.clip;

  it("speeds a video up, reverses it, keeps its tone and freezes a frame", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    openTab("Velocidade");
    commitBox("Velocidade", "2");
    expect(clipOf(editor, "a")).toMatchObject({ speed: 2, durationMs: 2000 });
    fireEvent.click(screen.getByRole("button", { name: "0,5×" }));
    expect(clipOf(editor, "a")).toMatchObject({ speed: 0.5, durationMs: 8000 });
    fireEvent.click(screen.getByLabelText("De trás para frente"));
    expect(clipOf(editor, "a").reverse).toBe(true);
    fireEvent.click(screen.getByLabelText("Manter o tom do som"));
    expect(clipOf(editor, "a").preservePitch).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Congelar quadro no cursor" }));
    expect(editor.store.getState().document.tracks[0].clips.some((clip) => clip.freeze)).toBe(true);
  });

  it("ramps the speed from the playhead", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    act(() => editor.view.setState({ playheadMs: 1000 }));
    openTab("Velocidade");
    fireEvent.change(screen.getByLabelText("Tipo de rampa"), { target: { value: "steps" } });
    commit("Velocidade de chegada", "0.5");
    commit("Duração da rampa", "0.5");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar rampa no cursor" }));
    const pieces = editor.store.getState().document.tracks[0].clips.filter((clip) => clip.assetId === "vid");
    expect(pieces.length).toBeGreaterThan(2);
    expect(pieces.at(-1)?.speed).toBe(0.5);
  });

  it("keeps the duration when asked and offers no speed on texts", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    openTab("Velocidade");
    fireEvent.click(screen.getByLabelText("Manter a duração"));
    commitBox("Velocidade", "0.5");
    expect(clipOf(editor, "a")).toMatchObject({ speed: 0.5, durationMs: 4000 });
    act(() => editor.store.getState().select(["o"]));
    expect(screen.queryByLabelText("Velocidade")).not.toBeInTheDocument();
  });
});

describe("color correction on video clips", () => {
  it("grades a video with sliders, applies a look and resets", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    act(() => editor.store.getState().select(["a"]));
    openTab("Cor");
    const section = within(screen.getByRole("group", { name: "Correção de cor" }));
    fireEvent.change(section.getByLabelText("Exposição"), { target: { value: "1" } });
    expect(findClip(editor.store.getState().document, "a")!.clip.color).toEqual({ exposure: 1 });
    fireEvent.click(section.getByRole("button", { name: "Preto e branco" }));
    expect(findClip(editor.store.getState().document, "a")!.clip.color).toEqual({ saturation: -100, contrast: 15 });
    fireEvent.click(section.getByRole("button", { name: "Redefinir cor" }));
    expect(findClip(editor.store.getState().document, "a")!.clip.color).toBeUndefined();
    act(() => editor.store.getState().select(["o"]));
    expect(screen.queryByRole("group", { name: "Correção de cor" })).not.toBeInTheDocument();
  });
});
