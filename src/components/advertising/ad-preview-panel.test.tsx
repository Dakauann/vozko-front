import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import type { AdPreviewContent } from "./ad-preview-card";
import { AdPreviewPanel } from "./ad-preview-panel";

const content = {
  pageName: "Clínica Viva",
  format: "IMAGE",
  primaryText: "Todos os canais numa caixa só",
  media: { kind: "image" as const, url: "https://cdn/a.png" },
  medias: [],
  cards: [],
  destination: "WHATSAPP",
  iceBreakers: [],
};

function renderPanel(shown: AdPreviewContent = content) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <AdPreviewPanel content={shown} />
    </NextIntlClientProvider>,
  );
}

describe("AdPreviewPanel", () => {
  it("opens any placement in a larger view and moves between placements", () => {
    renderPanel();
    const placements = ptMessages.adsWizard.placements;
    fireEvent.click(screen.getByRole("button", { name: ptMessages.adsWizard.preview.zoom.replace("{placement}", placements.facebook_feed) }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(placements.facebook_feed)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: ptMessages.adsWizard.preview.nextPlacement }));
    expect(within(dialog).getByText(placements.instagram_feed)).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(within(dialog).getByText(placements.facebook_feed)).toBeTruthy();
  });

  it("plays a video creative muted in the larger view, with a sound toggle like Meta", () => {
    renderPanel({ ...content, format: "VIDEO", media: { kind: "video" as const, url: "https://cdn/spot.mp4" } });
    expect(screen.queryByRole("button", { name: ptMessages.mediaPlayer.unmute })).toBeNull();
    const placements = ptMessages.adsWizard.placements;
    fireEvent.click(screen.getByRole("button", { name: ptMessages.adsWizard.preview.zoom.replace("{placement}", placements.facebook_feed) }));
    const dialog = screen.getByRole("dialog");
    const video = dialog.querySelector("video") as HTMLVideoElement;
    expect(video.muted).toBe(true);
    expect(video.autoplay).toBe(true);
    expect(video.loop).toBe(true);
    video.play = () => Promise.resolve();
    fireEvent.click(within(dialog).getByRole("button", { name: ptMessages.mediaPlayer.unmute }));
    expect(video.muted).toBe(false);
    expect(within(dialog).getByRole("button", { name: ptMessages.mediaPlayer.mute })).toHaveAttribute("aria-pressed", "true");
  });
});
