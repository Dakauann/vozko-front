import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { hasProposalPreview, ProposalPreview } from "./proposal-preview";

function renderPreview(kind: string, data: unknown) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ProposalPreview preview={{ kind, data }} />
    </NextIntlClientProvider>,
  );
}

describe("ProposalPreview", () => {
  it("renders the template bubble with the real values", () => {
    renderPreview("whatsapp_template", {
      name: "pedido_saiu",
      language: "pt_BR",
      components: [{ type: "BODY", text: "Olá {{1}}, pedido {{2}} saiu.", example: { body_text: [["Maria", "123"]] } }],
    });
    expect(screen.getByText("Olá Maria, pedido 123 saiu.")).toBeTruthy();
  });

  it("renders the exact message text and when it will go", () => {
    renderPreview("message", { text: "Bom dia, Maria!", channel: "instagram", scheduledAt: "2026-09-26T09:00:00-03:00" });
    expect(screen.getByText("Bom dia, Maria!")).toBeTruthy();
    expect(screen.getByText(/Agendada para/)).toBeTruthy();
    expect(screen.getByText("Instagram")).toBeTruthy();
  });

  it("only claims kinds it can draw", () => {
    expect(hasProposalPreview({ kind: "message", data: {} })).toBe(true);
    expect(hasProposalPreview({ kind: "deal", data: {} })).toBe(false);
    expect(hasProposalPreview(undefined)).toBe(false);
  });
});
