import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pending = new Promise<never>(() => undefined);
vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: vi.fn(() => pending),
  getMediaGenerationAction: vi.fn(),
  listMediaModelsAction: vi.fn(() => pending),
}));

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, type VideoDocument } from "@/lib/studio/document";

import { AiPanel } from "../panels/ai-panel";
import { EMPTY_AI_DRAFT } from "../view-store";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [] },
    { id: "a1", kind: "audio", clips: [] },
    { id: "a2", kind: "audio", clips: [] },
    { id: "a3", kind: "audio", locked: true, clips: [] },
  ];
  return d;
}

function setup() {
  const rendered = renderInEditor(doc(), <AiPanel />);
  act(() => rendered.editor.view.setState({ playheadMs: 1500, aiDrafts: { music: { ...EMPTY_AI_DRAFT, prompt: "trilha animada", model: "m-1" } } }));
  return rendered;
}

function setDuration(value: string) {
  const field = screen.getByRole("textbox", { name: "Duração" });
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe("AI generation placement", () => {
  it("offers automatic placement plus the unlocked tracks that take the result", () => {
    setup();
    const track = screen.getByRole("combobox", { name: "Faixa" });
    expect(within(track).getAllByRole("option").map((option) => option.textContent)).toEqual(["Automática", "Áudio 1", "Áudio 2"]);
  });

  it("generates onto the chosen track with the chosen length", () => {
    const { editor } = setup();
    fireEvent.change(screen.getByRole("combobox", { name: "Faixa" }), { target: { value: "a2" } });
    setDuration("12,5");
    fireEvent.click(screen.getByRole("button", { name: "Gerar música" }));
    expect(editor.view.getState().jobs[0].target).toEqual({ atMs: 1500, trackId: "a2", durationMs: 12_500 });
  });

  it("goes back to automatic when the length is cleared", () => {
    const { editor } = setup();
    setDuration("8");
    setDuration("");
    expect(editor.view.getState().aiDrafts.music?.durationMs).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Gerar música" }));
    expect(editor.view.getState().jobs[0].target).toEqual({ atMs: 1500 });
  });
});
