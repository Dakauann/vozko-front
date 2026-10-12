import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { gainToDb } from "@/lib/studio/audio-gain";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";
import { clipLoudness, loudnessProfile } from "@/lib/studio/loudness";
import { findClip } from "@/lib/studio/timeline";

import { useEditorState } from "../editor-context";
import { Inspector } from "../inspector/inspector";
import { TrackSound } from "../timeline/track-sound";
import { renderInEditor } from "./harness";

const RATE = 8000;
const tone = Float32Array.from({ length: RATE * 4 }, (_, i) => 0.25 * Math.sin((2 * Math.PI * 1000 * i) / RATE));
const profile = loudnessProfile([tone], RATE);

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "voice", kind: "audio", name: "Voz", clips: [{ ...newMediaClip("audio", "talk", 0, 4000), id: "v" }] },
    { id: "music", kind: "audio", name: "Música", clips: [{ ...newMediaClip("audio", "song", 0, 4000), id: "m" }] },
  ];
  d.durationMs = 4000;
  return d;
}

function measured(editor: ReturnType<typeof renderInEditor>["editor"]) {
  vi.spyOn(editor.audio, "loudness").mockResolvedValue(profile);
  vi.spyOn(editor.audio, "loudnessOf").mockReturnValue(profile);
}

function Music() {
  const track = useEditorState((s) => s.document.tracks.find((t) => t.id === "music")!);
  return <TrackSound track={track} name="Música" />;
}

describe("sound of a clip by hand", () => {
  it("pans the clip, keys the pan and normalizes it to a loudness target", { timeout: 15_000 }, async () => {
    const { editor } = renderInEditor(doc(), <Inspector />);
    const song = () => findClip(editor.store.getState().document, "m")!.clip;
    measured(editor);
    act(() => editor.store.getState().select(["m"]));
    const pan = screen.getByLabelText("Pan");
    fireEvent.change(pan, { target: { value: "-40" } });
    expect(song().pan).toBe(-0.4);
    expect(pan).toHaveAttribute("aria-valuetext", "E 40");
    fireEvent.click(screen.getByRole("button", { name: "Quadro-chave de pan" }));
    expect(song().keyframes?.pan).toEqual([{ atMs: 0, value: -0.4, easing: "linear" }]);
    fireEvent.click(screen.getByRole("button", { name: "Normalizar para Redes -14 (-14 LUFS)" }));
    await waitFor(() => expect(screen.getByText(/Estava em .* LUFS\. Ganho aplicado: .* dB\./)).toBeInTheDocument());
    expect(clipLoudness(profile, song())! + gainToDb(song().volume)).toBeCloseTo(-14, 1);
  });
});

describe("sound of a track by hand", () => {
  it("pans the track and normalizes the whole track", { timeout: 15_000 }, async () => {
    const { editor } = renderInEditor(doc(), <Music />);
    const music = () => editor.store.getState().document.tracks.find((t) => t.id === "music")!;
    measured(editor);
    fireEvent.click(screen.getByRole("button", { name: "Som da faixa Música" }));
    fireEvent.change(screen.getByLabelText("Pan da faixa"), { target: { value: "30" } });
    expect(music().pan).toBe(0.3);
    fireEvent.click(screen.getByRole("button", { name: "Normalizar para TV -23 (-23 LUFS)" }));
    await waitFor(() => expect(music().gainDb).toBeDefined());
    expect(screen.getByText(/Estava em .* LUFS/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Som da faixa Música" })).toHaveAttribute("aria-pressed", "true");
  });
});
