import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

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

function renderPanel() {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <AdPreviewPanel content={content} />
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
});
