import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), panel: vi.fn() }));

vi.mock("@/app/actions/email-inboxes", () => ({ getEmailInboxAction: mocks.get }));
vi.mock("@/components/email-marketing/inbox-settings-panel", () => ({
  EmailInboxSettingsPanel: (props: { inbox: { id: string } }) => {
    mocks.panel(props);
    return <div data-testid="inbox-panel">{props.inbox.id}</div>;
  },
}));

import rawPt from "@/i18n/messages/pt.json";
import type { EmailSender } from "@/lib/email-marketing/types";
import { brandedMessages } from "@/test/branded-messages";

import { InboxSettingsSheet } from "../inbox-settings-sheet";

const pt = brandedMessages(rawPt);

const SENDER: EmailSender = {
  id: "snd-1",
  domain_id: "dom-1",
  address: "vendas@loja.com.br",
  local_part: "vendas",
  display_name: "Vendas",
  reply_forward_to: "",
  is_default: true,
  domain_lifecycle: "active",
};

function renderSheet() {
  render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <InboxSettingsSheet sender={SENDER} onClose={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("InboxSettingsSheet", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.panel.mockReset();
  });

  it("loads the inbox of the sender into the settings panel", async () => {
    mocks.get.mockResolvedValue({ inbox: { id: "snd-1" } });
    renderSheet();
    expect(mocks.get).toHaveBeenCalledWith("snd-1");
    expect(await screen.findByTestId("inbox-panel")).toHaveTextContent("snd-1");
    expect(screen.getByText(pt.emailMarketing.inboxSettings.sheetTitle)).toBeInTheDocument();
  });

  it("explains a refused load by its code", async () => {
    mocks.get.mockResolvedValue({ error: "email inbox not found", code: "inbox_not_found" });
    renderSheet();
    expect(await screen.findByText(pt.emailMarketing.errors.inbox_not_found)).toBeInTheDocument();
    expect(screen.queryByTestId("inbox-panel")).not.toBeInTheDocument();
  });
});
