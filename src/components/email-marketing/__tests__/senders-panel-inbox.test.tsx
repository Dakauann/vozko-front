import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ allowed: vi.fn(), sheet: vi.fn() }));

vi.mock("@/hooks/use-settled-permission", () => ({
  useSettledPermission: (resource: string, action: string) => mocks.allowed(resource, action),
}));
vi.mock("@/app/actions/email-marketing", () => ({ deleteEmailSenderAction: vi.fn(), updateEmailSenderAction: vi.fn() }));
vi.mock("@/components/email-marketing/inbox-settings-sheet", () => ({
  InboxSettingsSheet: (props: { sender: { id: string } }) => {
    mocks.sheet(props);
    return <div data-testid="inbox-sheet">{props.sender.id}</div>;
  },
}));

import rawPt from "@/i18n/messages/pt.json";
import type { EmailSender, EmailSetup } from "@/lib/email-marketing/types";
import { brandedMessages } from "@/test/branded-messages";

import { SendersPanelBody } from "../senders-panel";

const pt = brandedMessages(rawPt);
const copy = pt.emailMarketing.senders;

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

const SETUP = { domains: [], senders: [SENDER], setup: { state: "ready" } } as unknown as EmailSetup;

function renderBody(canConfigure: boolean) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <SendersPanelBody setup={SETUP} canConfigure={canConfigure} onChanged={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

function inboxButton() {
  return screen.queryByRole("button", { name: copy.configureInbox.replace("{address}", SENDER.address) });
}

describe("SendersPanelBody inbox settings", () => {
  beforeEach(() => {
    mocks.allowed.mockReset();
    mocks.sheet.mockReset();
  });

  it("opens the inbox settings of a sender for people who can read email inboxes", () => {
    mocks.allowed.mockImplementation((resource: string, action: string) => resource === "email_inboxes" && action === "read");
    renderBody(false);
    expect(screen.queryByRole("button", { name: copy.delete.replace("{address}", SENDER.address) })).not.toBeInTheDocument();
    fireEvent.click(inboxButton()!);
    expect(screen.getByTestId("inbox-sheet")).toHaveTextContent("snd-1");
  });

  it("offers no inbox settings without the email inbox read permission", () => {
    mocks.allowed.mockReturnValue(false);
    renderBody(true);
    expect(inboxButton()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.delete.replace("{address}", SENDER.address) })).toBeInTheDocument();
  });
});
