import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { LeadCardOptOut } from "@/lib/leads/types";

import { LeadOptOutRecord } from "../LeadOptOutRecord";

const t = ptMessages.leadExit.contact;

function show(record: LeadCardOptOut | undefined, options: { legacyLine?: string | null; onRegrant?: () => void } = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <LeadOptOutRecord record={record} legacyLine={options.legacyLine ?? null} onRegrant={options.onRegrant} />
    </NextIntlClientProvider>,
  );
}

describe("LeadOptOutRecord", () => {
  it("says when, how and with what proof the lead left, and that the one confirmation went out", () => {
    show({ at: "2026-10-16T19:59:00Z", source: "button_reply", actorType: "lead", evidenceType: "button_reply", excerpt: "SAIR", confirmationSentAt: "2026-10-16T19:59:01Z" });
    expect(screen.getByText(ptMessages.crmContactPanel.lead.optedOut)).toBeInTheDocument();
    expect(screen.getByText(t.leftAt.replace("{date}", "16/10/2026, 16:59"))).toBeInTheDocument();
    expect(screen.getByText(t.how.button_reply)).toBeInTheDocument();
    expect(screen.getByText(t.evidence.replace("{excerpt}", "SAIR"))).toBeInTheDocument();
    expect(screen.getByText(t.confirmationSent.replace("{date}", "16/10/2026, 16:59"))).toBeInTheDocument();
  });

  it("names the kind of proof when there is no excerpt", () => {
    show({ at: "2026-10-16T19:59:00Z", source: "manual", actorType: "user", evidenceType: "note" });
    expect(screen.getByText(t.how.manual)).toBeInTheDocument();
    expect(screen.getByText(t.evidenceType.note)).toBeInTheDocument();
  });

  it("keeps the older date and source line for an opt-out from before the record", () => {
    show(undefined, { legacyLine: "a pedido do lead, em 08/10/2026" });
    expect(screen.getByText("a pedido do lead, em 08/10/2026")).toBeInTheDocument();
    expect(screen.queryByText(t.how.manual)).toBeNull();
  });

  it("offers a new consent only when the viewer may record one", () => {
    const onRegrant = vi.fn();
    show({ at: "2026-10-16T19:59:00Z", source: "keyword", actorType: "lead", evidenceType: "message", excerpt: "parar" }, { onRegrant });
    fireEvent.click(screen.getByRole("button", { name: t.regrant }));
    expect(onRegrant).toHaveBeenCalled();

    const { container } = show({ at: "2026-10-16T19:59:00Z", source: "keyword", actorType: "lead" });
    expect(container.querySelector("button")).toBeNull();
  });
});
