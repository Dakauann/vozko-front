import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import SendTemplateNowDialog from "../SendTemplateNowDialog";

const listTemplates = vi.fn();
vi.mock("@/app/actions/whatsapp-templates", () => ({
  listWhatsAppTemplatesAction: (...args: unknown[]) => listTemplates(...args),
}));
vi.mock("@/app/actions/whatsapp-outreach", () => ({
  quoteTemplateSendAction: () =>
    Promise.resolve({ quote: { category: "UTILITY", priceMicros: 50_000, balanceMicros: 1_000_000, affordable: true } }),
}));
vi.mock("@/app/actions/pricing", () => ({
  getExchangeRateAction: () => Promise.resolve({ item: { priceMicros: 5_000_000 } }),
}));

const copy = ptMessages.crmComposer.templateNow;

function template(id: string, components: WhatsAppTemplate["components"]): WhatsAppTemplate {
  return {
    id,
    externalId: `ext-${id}`,
    name: id,
    language: "pt_BR",
    category: "UTILITY",
    status: "APPROVED",
    components,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  };
}

const followUp = template("follow_up", [{ type: "BODY", text: "Oi {{1}}, podemos continuar?" }]);
const withHeaderVariable = template("promo", [
  { type: "HEADER", format: "TEXT", text: "Oferta {{1}}" },
  { type: "BODY", text: "Oi {{1}}" },
] as WhatsAppTemplate["components"]);

function renderDialog(onSend = vi.fn(), initialTemplateId = "follow_up", bodyParams = ["Ana"]) {
  const onOpenChange = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <SendTemplateNowDialog
        open
        onOpenChange={onOpenChange}
        businessPhoneId="bp-1"
        initial={{ templateId: initialTemplateId, bodyParams }}
        onSend={onSend}
      />
    </NextIntlClientProvider>,
  );
  return { onSend, onOpenChange };
}

beforeEach(() => {
  listTemplates.mockReset();
  listTemplates.mockResolvedValue({ templates: [followUp, withHeaderVariable] });
});

describe("SendTemplateNowDialog", () => {
  it("sends the chosen template with its body values right away and closes", async () => {
    const { onSend, onOpenChange } = renderDialog();
    const confirm = screen.getByRole("button", { name: copy.confirm });
    await waitFor(() => expect(confirm).not.toBeDisabled());

    fireEvent.click(confirm);

    expect(onSend).toHaveBeenCalledWith("follow_up", ["Ana"], []);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("waits until every body value is filled", async () => {
    renderDialog(vi.fn(), "follow_up", [""]);
    await screen.findByText(ptMessages.scheduledMessages.templateDialog.previewLabel);
    expect(screen.getByRole("button", { name: copy.confirm })).toBeDisabled();
  });

  it("asks the header value first, labelled as the header, and sends it apart from the body", async () => {
    const onSend = vi.fn();
    renderDialog(onSend, "promo", ["Ana"]);
    const header = await screen.findByLabelText("{{1}} no cabeçalho");
    expect(screen.getByLabelText("{{1}}")).toHaveValue("Ana");
    expect(header.compareDocumentPosition(screen.getByLabelText("{{1}}")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.confirm })).toBeDisabled();

    fireEvent.change(header, { target: { value: "de Natal" } });
    const confirm = screen.getByRole("button", { name: copy.confirm });
    await waitFor(() => expect(confirm).not.toBeDisabled());
    fireEvent.click(confirm);

    expect(onSend).toHaveBeenCalledWith("promo", ["Ana"], ["de Natal"]);
  });
});
