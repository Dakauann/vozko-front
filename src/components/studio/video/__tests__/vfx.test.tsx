import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { newEffectClip, newVfx, VFX_SPECS } from "@/lib/studio/vfx";

import { useEditorState } from "../editor-context";
import { EffectStrengthFields, VfxFields } from "../inspector/vfx-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { EffectsPanel } from "../panels/effects-panel";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

const IDS = ["c"];

function doc(clip: Clip = { ...newMediaClip("video", "vid", 0, 2000), id: "c" }): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [clip] }];
  d.durationMs = 2000;
  return d;
}

function effectDoc(): VideoDocument {
  return doc({ ...newEffectClip([newVfx("grain", "g", 4), newVfx("vignette", "n", 0)], 0, 2000), id: "c" });
}

function Vfx() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return (
    <>
      {clip.type === "effect" ? <EffectStrengthFields clips={[clip]} disabled={false} editor={editor} /> : null}
      <VfxFields clip={clip} disabled={false} editor={editor} />
    </>
  );
}

function slide(label: string, value: number) {
  fireEvent.change(screen.getByLabelText(label), { target: { value: String(value) } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("visual effects by hand", () => {
  it("adds an effect, tunes it, keys it at the playhead, shuffles its seed, hides it and removes it", { timeout: 15_000 }, () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const { editor } = renderInEditor(doc(), <Vfx />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    expect(screen.getByText("Sem efeitos. Granulado, luz e movimento entram aqui.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Adicionar efeito: Granulado" }));
    expect(clip().vfx).toEqual([expect.objectContaining({ kind: "grain", seed: 250_000 })]);

    slide("Intensidade", 0.6);
    expect(clip().vfx![0].params?.amount).toBeCloseTo(0.6);
    slide("Trocas por segundo", 12);
    expect(clip().vfx![0].params?.rate).toBe(12);
    expect(screen.queryByRole("button", { name: "Chave de Trocas por segundo no cursor" })).toBeNull();

    act(() => editor.view.setState({ playheadMs: 500 }));
    fireEvent.click(screen.getByRole("button", { name: "Chave de Intensidade no cursor" }));
    expect(clip().vfx![0].keyframes?.amount).toEqual([{ atMs: 500, value: 0.6, easing: "linear" }]);
    act(() => editor.view.setState({ playheadMs: 1500 }));
    slide("Intensidade", 0.2);
    expect(clip().vfx![0].keyframes?.amount?.map((k) => [k.atMs, k.value])).toEqual([
      [500, 0.6],
      [1500, 0.2],
    ]);

    vi.spyOn(Math, "random").mockReturnValue(0.5);
    fireEvent.click(screen.getByRole("button", { name: "Sortear outra variação" }));
    expect(clip().vfx![0].seed).toBe(500_000);

    fireEvent.click(screen.getByRole("button", { name: "Ocultar efeito" }));
    expect(clip().vfx![0].hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar efeito" }));
    expect(clip().vfx![0].hidden).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Remover efeito" }));
    expect(clip().vfx).toBeUndefined();
  });

  it("reads every slider range from the effect spec and recolors an effect", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Vfx />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    fireEvent.click(screen.getByRole("button", { name: "Adicionar efeito: Partículas" }));
    const count = screen.getByLabelText("Quantidade") as HTMLInputElement;
    expect([Number(count.min), Number(count.max)]).toEqual([...VFX_SPECS.particles.params.count!.range]);
    expect(screen.queryByRole("button", { name: "Chave de Quantidade no cursor" })).toBeNull();
    expect(screen.getByRole("button", { name: "Chave de Tamanho no cursor" })).toBeTruthy();

    const color = screen.getAllByLabelText("Cor")[1];
    fireEvent.change(color, { target: { value: "#ffcc00" } });
    fireEvent.blur(color);
    expect(clip().vfx![0].colors?.color).toBe("#ffcc00");
  });

  it("offers a seed shuffle only where the effect draws from it, and reorders effects", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Vfx />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    fireEvent.click(screen.getByRole("button", { name: "Adicionar efeito: Granulado" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar efeito: Vinheta" }));
    expect(screen.queryByRole("button", { name: "Sortear outra variação" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Subir efeito" }));
    expect(clip().vfx!.map((vfx) => vfx.kind)).toEqual(["vignette", "grain"]);
    fireEvent.click(screen.getByRole("button", { name: "Efeito 2: Granulado" }));
    expect(screen.getByRole("button", { name: "Sortear outra variação" })).toBeTruthy();
  });

  it("doses an effect clip with its strength and keeps it when its last effect goes", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(effectDoc(), <Vfx />);
    const clip = () => findClip(editor.store.getState().document, "c")!.clip;
    slide("Força", 40);
    expect(clip().transform.opacity).toBeCloseTo(0.4);
    fireEvent.click(screen.getByRole("button", { name: "Remover efeito" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover efeito" }));
    expect(clip().type).toBe("effect");
    expect(clip().vfx).toEqual([]);
    expect(screen.getByText("Este clipe de efeito está vazio. Escolha um efeito acima.")).toBeTruthy();
  });

  it("adds an effect clip at the playhead from the effects panel and selects it", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <EffectsPanel />);
    act(() => editor.view.setState({ playheadMs: 400 }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar clipe de efeito: Vazamento de luz" }));
    const state = editor.store.getState();
    const added = findClip(state.document, state.selection[0])!.clip;
    expect(added).toMatchObject({ type: "effect", startMs: 400 });
    expect(added.vfx).toEqual([expect.objectContaining({ kind: "lightLeak" })]);
  });

  it("names an effect clip on the timeline after its effects", { timeout: 15_000 }, () => {
    renderInEditor(effectDoc(), <Timeline />);
    expect(document.querySelector('[data-clip-id="c"]')).toHaveAttribute("aria-label", "Granulado + Vinheta, começa em 0:00.00, dura 0:02.00");
  });
});
