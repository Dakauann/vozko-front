import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { LeadDetailSummary } from "@/lib/leads/detail-summary";
import { draftFromRecord, type LeadSheetDraft } from "@/lib/leads/sheet";
import type { LeadRecord } from "@/lib/leads/types";

import { PhonesSection } from "../sheet/PhonesSection";

const summary: LeadDetailSummary = {
  memoriesCount: 0,
  sharedNumbers: [
    { number: "551141990000", holders: [{ leadId: "lead-2", name: "João Souza" }, { leadId: "lead-3", name: "Bruna Souza" }], more: false },
    { number: "5511900010142", holders: [{ leadId: "lead-4", name: "Pedro Lima" }], more: false },
  ],
};

const stored: LeadRecord = {
  id: "lead-1",
  workspaceId: "ws-1",
  number: "5511900010142",
  blocked: false,
  relativesCount: 0,
  referredCount: 0,
  version: 3,
  phones: [{ id: "p-1", number: "551141990000", label: "landline" }],
};

function renderPhones(draft: LeadSheetDraft, shared?: LeadDetailSummary, record?: LeadRecord) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <PhonesSection
        draft={draft}
        errors={{}}
        identityRefusal={null}
        onUpdate={() => {}}
        onMoveNumberToContacts={() => {}}
        summary={shared}
        stored={record}
      />
    </NextIntlClientProvider>,
  );
}

const hints = () => screen.queryAllByText(/Este telefone também está em/).map((hint) => hint.textContent);

describe("PhonesSection shared numbers", () => {
  it("names the other leads that hold the stored WhatsApp number and each stored contact phone", () => {
    renderPhones(draftFromRecord(stored), summary, stored);
    expect(hints()).toEqual(["Este telefone também está em Pedro Lima.", "Este telefone também está em João Souza e Bruna Souza."]);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names nobody once a number is edited away from the stored one", () => {
    const draft = draftFromRecord(stored);
    renderPhones({ ...draft, number: "11 90001-0143", phones: [{ ...draft.phones[0], number: "(11) 4199-0001" }] }, summary, stored);
    expect(hints()).toEqual([]);
  });

  it("names nobody for a phone added in this edit", () => {
    const draft = draftFromRecord(stored);
    renderPhones({ ...draft, number: "", phones: [{ key: "new", number: "+55 (11) 4199-0000", label: "landline" }] }, summary, stored);
    expect(hints()).toEqual([]);
  });

  it("names nobody without a summary, as for a new lead", () => {
    renderPhones(draftFromRecord(stored));
    expect(hints()).toEqual([]);
  });
});
