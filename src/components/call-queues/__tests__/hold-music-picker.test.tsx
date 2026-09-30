import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { HoldMusicRef } from "@/lib/call-routing/types";
import type { Media } from "@/lib/medias/types";

vi.mock("@/app/actions/call-routing", () => ({
  fetchHoldPresetAudioAction: vi.fn(() => Promise.resolve({ error: "offline" })),
  listHoldPresetsAction: vi.fn(),
}));
vi.mock("@/app/actions/medias", () => ({ listMediasAction: vi.fn(), uploadMediaAction: vi.fn() }));

import { HoldMusicPicker } from "@/components/call-queues/hold-music-picker";
import type { HoldMusicLibrary } from "@/components/call-queues/use-hold-music-library";

const upload: Media = { id: "m1", description: "jingle.mp3", url: "https://files/jingle.mp3", previewUrl: "", createdAt: "", type: "audio" };

function library(overrides: Partial<HoldMusicLibrary> = {}): HoldMusicLibrary {
  return {
    presets: [
      { id: "piano_calmo", name: "Piano calmo", mood: "calm" },
      { id: "bossa_nova", name: "Bossa nova", mood: "brazilian" },
    ],
    audios: [upload],
    loading: false,
    upload: vi.fn(),
    ...overrides,
  };
}

function renderPicker(value: HoldMusicRef, lib: HoldMusicLibrary, onChange = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <HoldMusicPicker value={value} onChange={onChange} library={lib} />
    </NextIntlClientProvider>,
  );
  return onChange;
}

describe("HoldMusicPicker", () => {
  it("picks a ready-made song, named in the member's language", () => {
    const onChange = renderPicker({}, library());
    expect(screen.getByRole("radio", { name: /Piano calmo/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Brasileira")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Bossa nova/ }));
    expect(onChange).toHaveBeenCalledWith({ presetId: "bossa_nova" });
  });

  it("opens on the uploads when an uploaded song is chosen", () => {
    renderPicker({ mediaId: "m1" }, library());
    expect(screen.getByRole("radio", { name: /jingle.mp3/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("uploads an audio and chooses it", async () => {
    const lib = library({ upload: vi.fn(() => Promise.resolve({ media: { ...upload, id: "m2" } })) });
    const onChange = renderPicker({}, lib);
    fireEvent.click(screen.getByRole("tab", { name: "Enviadas" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["x"], "hold.mp3", { type: "audio/mpeg" })] } });
    });
    expect(lib.upload).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({ mediaId: "m2" });
  });

  it("says why an upload failed and keeps the current choice", async () => {
    const lib = library({ upload: vi.fn(() => Promise.resolve({ error: "arquivo grande demais" })) });
    const onChange = renderPicker({}, lib);
    fireEvent.click(screen.getByRole("tab", { name: "Enviadas" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["x"], "hold.mp3", { type: "audio/mpeg" })] } });
    });
    expect(screen.getByText("arquivo grande demais")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});
