import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

const thumbnails = vi.fn();
vi.mock("../panels/effect-thumbnails", () => ({ PLAIN_PREVIEW: "plain", useEffectThumbnails: () => thumbnails() }));

import { emptyVideoDocument } from "@/lib/studio/document";
import { groupedKinds, VFX_KINDS } from "@/lib/studio/vfx";
import ptMessages from "@/i18n/messages/pt.json";

import { EffectsPanel } from "../panels/effects-panel";
import { renderInEditor } from "./harness";

function marked(attribute: string): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>(`[${attribute}]`)).map((element) => element.getAttribute(attribute) ?? "");
}

const SHOWN = groupedKinds(VFX_KINDS).flatMap((entry) => entry.kinds);

function tiles(): HTMLElement[] {
  return within(screen.getByRole("group", { name: ptMessages.studio.video.vfx.title })).getAllByRole("button");
}

function rendered(): Map<string, string> {
  return new Map([["plain", "data:image/png;base64,plain"], ...VFX_KINDS.map((kind) => [kind, `data:image/png;base64,${kind}`] as [string, string])]);
}

describe("before and after previews in the Efeitos panel", () => {
  it("shows the plain sample beside each rendered effect and still adds it on click", { timeout: 15_000 }, () => {
    thumbnails.mockReturnValue(rendered());
    const { editor } = renderInEditor(emptyVideoDocument("story"), <EffectsPanel />);
    expect(marked("data-studio-effect-preview")).toEqual(SHOWN);
    expect(marked("data-studio-effect-before")).toEqual(SHOWN);
    expect(within(screen.getByRole("group", { name: ptMessages.studio.video.vfx.title })).getAllByRole("heading").map((heading) => heading.textContent)).toEqual(Object.values(ptMessages.studio.video.vfx.groups));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar clipe de efeito: Vinheta" }));
    expect(editor.store.getState().document.tracks.flatMap((track) => track.clips).some((clip) => clip.vfx?.[0]?.kind === "vignette")).toBe(true);
  });

  it("opens a larger before and after with the effect name when a tile takes keyboard focus", { timeout: 15_000 }, async () => {
    thumbnails.mockReturnValue(rendered());
    renderInEditor(emptyVideoDocument("story"), <EffectsPanel />);
    const tile = screen.getByRole("button", { name: "Adicionar clipe de efeito: Granulado" });
    await act(async () => {
      tile.focus();
      fireEvent.focus(tile);
    });
    const preview = await screen.findAllByText("Depois");
    expect(preview.length).toBeGreaterThan(0);
    expect(screen.getAllByText("Antes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Textura de filme que muda a cada quadro.").length).toBeGreaterThan(0);
  });

  it("moves between tiles with the arrow keys", { timeout: 15_000 }, () => {
    thumbnails.mockReturnValue(rendered());
    renderInEditor(emptyVideoDocument("story"), <EffectsPanel />);
    const shown = tiles();
    shown[0].focus();
    fireEvent.keyDown(shown[0], { key: "ArrowRight" });
    expect(document.activeElement).toBe(shown[1]);
    fireEvent.keyDown(shown[1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(shown[3]);
    fireEvent.keyDown(shown[3], { key: "End" });
    expect(document.activeElement).toBe(shown[VFX_KINDS.length - 1]);
    fireEvent.keyDown(shown[VFX_KINDS.length - 1], { key: "Home" });
    expect(document.activeElement).toBe(shown[0]);
  });

  it("keeps the drawn icons while previews are rendering or the GPU is off", { timeout: 15_000 }, () => {
    thumbnails.mockReturnValue(null);
    renderInEditor(emptyVideoDocument("story"), <EffectsPanel />);
    expect(marked("data-studio-effect-preview")).toEqual([]);
    expect(tiles()).toHaveLength(VFX_KINDS.length);
    expect(screen.getByRole("button", { name: "Adicionar clipe de efeito: Granulado" }).querySelector("svg")).not.toBeNull();
  });

  it("marks the sound effects as needing a sound track and keeps echo for clips", { timeout: 15_000 }, () => {
    thumbnails.mockReturnValue(null);
    const silent = emptyVideoDocument("story");
    silent.tracks = silent.tracks.filter((track) => track.kind !== "audio");
    const { editor } = renderInEditor(silent, <EffectsPanel />);
    const spectrum = screen.getByRole("button", { name: `Adicionar clipe de efeito: ${ptMessages.studio.video.vfx.kinds.audioSpectrum}` });
    const echo = screen.getByRole("button", { name: `Adicionar clipe de efeito: ${ptMessages.studio.video.vfx.kinds.echo}` });
    expect(spectrum.getAttribute("aria-disabled")).toBe("true");
    expect(echo.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(spectrum);
    fireEvent.click(echo);
    expect(editor.store.getState().document.tracks.flatMap((track) => track.clips).some((clip) => clip.type === "effect")).toBe(false);
  });

  it("adds a visualizer listening to the project's sound track", { timeout: 15_000 }, () => {
    thumbnails.mockReturnValue(null);
    const doc = emptyVideoDocument("story");
    doc.tracks = [...doc.tracks.filter((track) => track.kind !== "audio"), { id: "music", kind: "audio", clips: [] }];
    const { editor } = renderInEditor(doc, <EffectsPanel />);
    fireEvent.click(screen.getByRole("button", { name: `Adicionar clipe de efeito: ${ptMessages.studio.video.vfx.kinds.audioWaveform}` }));
    const added = editor.store.getState().document.tracks.flatMap((track) => track.clips).find((clip) => clip.type === "effect");
    expect(added?.vfx?.[0]).toMatchObject({ kind: "audioWaveform", trackId: "music" });
  });
});
