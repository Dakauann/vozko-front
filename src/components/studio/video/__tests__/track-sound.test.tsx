import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import { useEditorState } from "../editor-context";
import { TrackSound } from "../timeline/track-sound";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "voice", kind: "audio", name: "Voz", clips: [{ ...newMediaClip("audio", "talk", 0, 2000), id: "v" }] },
    { id: "music", kind: "audio", name: "Música", clips: [{ ...newMediaClip("audio", "song", 0, 2000), id: "m" }] },
  ];
  d.durationMs = 2000;
  return d;
}

function Music() {
  const track = useEditorState((s) => s.document.tracks.find((t) => t.id === "music")!);
  return <TrackSound track={track} name="Música" />;
}

function commit(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("track sound by hand", () => {
  it("sets the track level, ducks it under the voice track and tunes the duck", () => {
    const { editor } = renderInEditor(doc(), <Music />);
    const music = () => editor.store.getState().document.tracks.find((t) => t.id === "music")!;
    fireEvent.click(screen.getByRole("button", { name: "Som da faixa Música" }));
    commit("Volume da faixa", "-4");
    expect(music().gainDb).toBe(-4);
    fireEvent.click(within(screen.getByRole("group", { name: "Abaixar quando houver fala em" })).getByLabelText("Voz"));
    expect(music().ducking).toMatchObject({ triggerTrackIds: ["voice"], reduceDb: 12 });
    commit("Quanto abaixa", "18");
    expect(music().ducking?.reduceDb).toBe(18);
    act(() => undefined);
    fireEvent.click(within(screen.getByRole("group", { name: "Abaixar quando houver fala em" })).getByLabelText("Voz"));
    expect(music().ducking).toBeUndefined();
  });
});
