import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import enMessages from "@/i18n/messages/en.json";
import ptMessages from "@/i18n/messages/pt.json";
import type { OpportunityEvent } from "@/lib/crm/opportunities";

const actions = vi.hoisted(() => ({ listOpportunityEventsAction: vi.fn() }));

vi.mock("@/app/actions/opportunities", () => actions);

import OpportunityHistory from "../OpportunityHistory";

const actorLabels = { ai: "AI agent", workflow: "Workflow", system: "System", unknownMember: "Removed member" };
const stageNames = new Map([["st-new", "New"], ["st-won", "Won"]]);
const members = new Map([["u-1", "Ana"]]);

function event(overrides: Partial<OpportunityEvent>): OpportunityEvent {
  return { id: "ev-1", opportunityId: "deal-1", type: "created", actorId: "u-1", valueCents: 0, currency: "BRL", createdAt: "2026-09-25T14:00:00Z", ...overrides };
}

function renderHistory(locale: "en" | "pt") {
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "en" ? enMessages : ptMessages} timeZone="UTC">
      <OpportunityHistory opportunityId="deal-1" updatedAt="2026-09-25T14:00:00Z" members={members} stageNames={stageNames} actorLabels={actorLabels} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OpportunityHistory", () => {
  it("tells the deal's history in the viewer's language, newest first", async () => {
    actions.listOpportunityEventsAction.mockResolvedValue({
      events: [
        event({ id: "ev-1", type: "created" }),
        event({ id: "ev-2", type: "stage_moved", fromStageId: "st-new", toStageId: "st-gone", createdAt: "2026-09-26T09:30:00Z" }),
        event({ id: "ev-3", type: "won", valueCents: 150050, createdAt: "2026-09-27T10:00:00Z" }),
      ],
      error: null,
    });

    renderHistory("en");

    expect(await screen.findByText("Ana created the opportunity")).toBeInTheDocument();
    expect(screen.getByText(`Ana moved it from New to ${enMessages.opportunityHistory.removedStage}`)).toBeInTheDocument();
    expect(screen.getByText(/^Ana marked it as won \(R\$\s?1,500\.50\)$/)).toBeInTheDocument();
    expect(screen.getByText(enMessages.opportunityHistory.title)).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent(/marked it as won/);
    expect(items[0].querySelector("time")?.textContent).toMatch(/Sep/);
  });

  it("names a system change with the system label", async () => {
    actions.listOpportunityEventsAction.mockResolvedValue({ events: [event({ type: "reopened", actorId: "" })], error: null });

    renderHistory("pt");

    expect(await screen.findByText("System reabriu a oportunidade")).toBeInTheDocument();
  });

  it("says it could not read the history instead of showing an empty one", async () => {
    actions.listOpportunityEventsAction.mockResolvedValue({ events: [], error: "boom" });

    renderHistory("en");

    expect(await screen.findByText(enMessages.opportunityHistory.loadFailed)).toBeInTheDocument();
    expect(screen.queryByText(enMessages.opportunityHistory.empty)).toBeNull();
  });

  it("says when the deal has no history yet", async () => {
    actions.listOpportunityEventsAction.mockResolvedValue({ events: [], error: null });

    renderHistory("en");

    expect(await screen.findByText(enMessages.opportunityHistory.empty)).toBeInTheDocument();
  });
});
