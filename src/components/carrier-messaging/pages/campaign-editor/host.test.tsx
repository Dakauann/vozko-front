import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const phones = vi.hoisted(() => ({ useConnectedPhones: vi.fn() }));
const composer = vi.hoisted(() => ({ useTemplateComposer: vi.fn() }));

vi.mock("@/components/leads/sends/LeadTemplateSendDialog", () => phones);
vi.mock("@/hooks/use-template-composer", () => composer);
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));
vi.mock("@/components/whatsapp/template-conversation-preview", () => ({ TemplateConversationPreview: () => <div data-testid="template-preview" /> }));

import rawPt from "@/i18n/messages/pt.json";
import type { CampaignWhatsAppFallback } from "@/lib/carrier-messaging/campaigns";
import { brandedMessages } from "@/test/branded-messages";

import { whatsappFallbackSlot } from "./WhatsAppFallbackPicker";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.campaignHost;

function withIntl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      {node}
    </NextIntlClientProvider>
  );
}

function SlotHarness({ initial, onValue }: { initial?: CampaignWhatsAppFallback; onValue: (value: CampaignWhatsAppFallback | undefined) => void }) {
  const [value, setValue] = useState(initial);
  return withIntl(
    whatsappFallbackSlot(value, (next) => {
      onValue(next);
      setValue(next);
    }),
  );
}

describe("whatsappFallbackSlot", () => {
  beforeEach(() => {
    phones.useConnectedPhones.mockReturnValue({ data: [{ id: "ph-1", displayPhoneNumber: "+55 11 4000 0000" }], isPending: false, isError: false });
    composer.useTemplateComposer.mockReturnValue({
      templates: [{ id: "tpl-1", name: "promo", components: [{ type: "BODY", text: "Oi {{1}}" }] }],
      templateOptions: [{ value: "tpl-1", label: "promo" }],
      templatesLoading: false,
      readyTemplates: [{ id: "tpl-1" }],
    });
  });

  it("stays off until enabled and clears the fallback when switched off", () => {
    const onValue = vi.fn();
    render(<SlotHarness initial={{ business_phone_id: "ph-1", template_id: "tpl-1", body_bindings: [{ source: "lead.first_name" }], header_bindings: [] }} onValue={onValue} />);
    expect(screen.getByTestId("template-preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    expect(onValue).toHaveBeenLastCalledWith(undefined);
    expect(screen.queryByTestId("template-preview")).not.toBeInTheDocument();
  });

  it("shows nothing to pick while switched off", () => {
    render(<SlotHarness onValue={vi.fn()} />);
    expect(screen.getByText(copy.whatsapp.toggle)).toBeInTheDocument();
    expect(screen.queryByText(copy.whatsapp.template)).not.toBeInTheDocument();
  });
});
