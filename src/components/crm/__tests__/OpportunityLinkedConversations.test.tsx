import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import en from "@/i18n/messages/en.json";
import pt from "@/i18n/messages/pt.json";
import type { OpportunityConversationLink } from "@/lib/crm/opportunities";
import OpportunityLinkedConversations from "../OpportunityLinkedConversations";

function renderLinks(links: OpportunityConversationLink[], onUnlink = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <OpportunityLinkedConversations links={links} onUnlink={onUnlink} />
    </NextIntlClientProvider>,
  );
  return onUnlink;
}

const LINK: OpportunityConversationLink = {
  opportunityId: "o1",
  entryId: "85d15c05-03c7-441d-b418-b190408d6cca",
  entryType: "unofficial_whatsapp",
  leadName: "DakauannT",
  leadNumber: "558494409624",
};

describe("OpportunityLinkedConversations", () => {
  it("names the contact and the channel, never the raw ids", () => {
    renderLinks([LINK]);
    expect(screen.getByText("DakauannT")).toBeTruthy();
    expect(screen.getByText(`${pt.audience.channels.unofficial_whatsapp} · 558494409624`)).toBeTruthy();
    expect(screen.queryByText(LINK.entryId)).toBeNull();
    expect(screen.queryByText("unofficial_whatsapp")).toBeNull();
  });

  it("falls back to the number, then to an unnamed contact", () => {
    renderLinks([
      { ...LINK, entryId: "a", leadName: "" },
      { ...LINK, entryId: "b", leadName: undefined, leadNumber: undefined },
    ]);
    expect(screen.getByText("558494409624")).toBeTruthy();
    expect(screen.getByText("Contato sem nome")).toBeTruthy();
  });

  it("unlinks the conversation that was clicked", () => {
    const onUnlink = renderLinks([LINK]);
    fireEvent.click(screen.getByRole("button", { name: "Desvincular conversa com DakauannT" }));
    expect(onUnlink).toHaveBeenCalledWith(LINK.entryId, "unofficial_whatsapp");
  });

  it("says when nothing is linked", () => {
    renderLinks([]);
    expect(screen.getByText("Nenhuma conversa vinculada a esta oportunidade.")).toBeTruthy();
  });

  it("speaks the viewer's language", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <OpportunityLinkedConversations links={[{ ...LINK, leadName: undefined, leadNumber: undefined }]} onUnlink={vi.fn()} />
      </NextIntlClientProvider>,
    );
    const t = en.opportunityLinkedConversations;
    expect(screen.getByText(t.title)).toBeTruthy();
    expect(screen.getByText(t.unnamed)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.openWith.replace("{name}", t.unnamed) }).getAttribute("title")).toBe(t.open);
    expect(screen.getByRole("button", { name: t.unlinkWith.replace("{name}", t.unnamed) }).getAttribute("title")).toBe(t.unlink);
  });
});
