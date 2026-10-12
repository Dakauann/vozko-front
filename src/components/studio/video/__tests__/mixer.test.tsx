import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 3000), id: "a" }] },
    { id: "voice", kind: "audio", name: "Voz", clips: [{ ...newMediaClip("audio", "talk", 0, 3000), id: "v" }] },
    { id: "music", kind: "audio", name: "Trilha", gainDb: -6, clips: [{ ...newMediaClip("audio", "song", 0, 3000), id: "m" }] },
  ];
  d.durationMs = 3000;
  return d;
}

describe("compact mixer", () => {
  it("shows one strip per audio track plus the master and edits the same track state", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    const music = () => editor.store.getState().document.tracks.find((t) => t.id === "music")!;
    expect(screen.queryByRole("region", { name: "Mixer" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mixer" }));
    const mixer = screen.getByRole("region", { name: "Mixer" });
    expect(within(mixer).getAllByRole("group").map((strip) => strip.getAttribute("aria-label"))).toEqual(expect.arrayContaining(["Canal Voz", "Canal Trilha", "Nível geral"]));
    const strip = within(within(mixer).getByRole("group", { name: "Canal Trilha" }));
    const fader = strip.getByLabelText("Volume de Trilha");
    expect(fader).toHaveAttribute("aria-valuetext", "-6.0 dB");
    fireEvent.change(fader, { target: { value: "-12" } });
    expect(music().gainDb).toBe(-12);
    fireEvent.doubleClick(fader);
    expect(music().gainDb).toBeUndefined();
    fireEvent.change(strip.getByLabelText("Pan de Trilha"), { target: { value: "50" } });
    expect(music().pan).toBe(0.5);
    fireEvent.click(strip.getByRole("button", { name: "Silenciar Trilha" }));
    expect(music().muted).toBe(true);
    fireEvent.click(strip.getByRole("button", { name: "Ouvir só Trilha" }));
    expect(editor.view.getState().soloTrackIds).toEqual(["music"]);
    expect(screen.getAllByRole("button", { name: "Parar de ouvir só Trilha" })).toHaveLength(2);
    expect(editor.store.getState().document).not.toHaveProperty("soloTrackIds");
  });
});
