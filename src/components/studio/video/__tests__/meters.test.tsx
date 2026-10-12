import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import type { MeterFrame } from "../audio-meters";
import { Timeline } from "../timeline/timeline";
import { renderInEditor } from "./harness";

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    { id: "v1", kind: "visual", clips: [{ ...newMediaClip("image", "img", 0, 3000), id: "a" }] },
    { id: "au", kind: "audio", name: "Trilha", clips: [{ ...newMediaClip("audio", "song", 0, 3000), id: "m" }] },
  ];
  d.durationMs = 3000;
  return d;
}

const loud: MeterFrame = { master: { left: 0.5, right: 0.25, power: 0.1 }, tracks: { au: { left: 1, right: 0.5 } } };

function cover(meter: Element, side: number): string {
  return (meter.querySelectorAll("[data-meter-cover]")[side] as HTMLElement).style.transform;
}

describe("level meters", () => {
  it("moves the master and track meters from the live audio and latches the clip light", { timeout: 15_000 }, async () => {
    const { editor } = renderInEditor(doc(), <Timeline />);
    vi.spyOn(editor.audio, "meters").mockReturnValue(loud);
    const master = screen.getByRole("group", { name: "Nível geral" });
    const track = screen.getByRole("group", { name: "Nível de Trilha" });
    expect(cover(master, 0)).toBe("scaleX(1)");
    act(() => editor.view.setState({ playing: true }));
    await waitFor(() => expect(cover(master, 0)).not.toBe("scaleX(1)"));
    expect(cover(track, 0)).toBe("scaleY(0)");
    expect(screen.getByText(/-10\.7 LUFS/)).toBeInTheDocument();
    const light = screen.getByRole("button", { name: "Pico em Trilha. Clique para apagar" });
    expect(light).toBeVisible();
    act(() => editor.view.setState({ playing: false }));
    vi.spyOn(editor.audio, "meters").mockReturnValue(null);
    fireEvent.click(light);
    expect(light).not.toBeVisible();
  });
});
