import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";

import WhatsAppPreview from "../WhatsAppPreview";

const preview = ptMessages.whatsappTemplates.phonePreview;

function renderPreview(components: Parameters<typeof WhatsAppPreview>[0]["components"], messages = ptMessages, locale = "pt") {
  render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <WhatsAppPreview components={components} templateName="promo_outubro" language="pt_BR" />
    </NextIntlClientProvider>,
  );
}

describe("WhatsAppPreview", () => {
  it("speaks the viewer's language when the template is still empty", () => {
    renderPreview([]);
    expect(screen.getByText(preview.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(preview.emptyDescription)).toBeInTheDocument();
    expect(screen.getByText(preview.status)).toBeInTheDocument();
    expect(screen.getByText(preview.templateTag.replace("{name}", "promo_outubro").replace("{language}", "PT_BR"))).toBeInTheDocument();
    expect(screen.queryByText("No components yet")).not.toBeInTheDocument();
    expect(screen.queryByText("Typically replies instantly")).not.toBeInTheDocument();
  });

  it("labels empty buttons and the call permission in the viewer's language", () => {
    renderPreview([
      { id: "b", type: "BODY", data: { text: "Olá" } },
      { id: "c", type: "CALL_PERMISSION_REQUEST", data: {} },
    ]);
    expect(screen.getByText(preview.allowCall)).toBeInTheDocument();
    expect(screen.getByText(preview.notNow)).toBeInTheDocument();
  });

  it("falls back to the localized button label when a button has no text", () => {
    renderPreview([{ id: "b", type: "BUTTONS", data: { buttons: [{ id: "1", type: "URL" }] } }], enMessages, "en");
    expect(screen.getByText(enMessages.whatsappTemplates.phonePreview.buttons.url)).toBeInTheDocument();
    expect(screen.getByText(enMessages.whatsappTemplates.phonePreview.noBody)).toBeInTheDocument();
  });
});
