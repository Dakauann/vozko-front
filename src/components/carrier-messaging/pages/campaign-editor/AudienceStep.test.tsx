import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: () => true }) }));
vi.mock("@/components/leads/LeadsToolbar", () => ({ LeadsToolbar: () => <div data-testid="leads-toolbar" /> }));
vi.mock("@/components/leads/LeadSavedViews", () => ({ default: () => null }));
vi.mock("@/components/leads/sends/SelectionSummaryLine", () => ({ SelectionSummaryLine: () => null }));
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));

const actions = vi.hoisted(() => ({
  countAudienceAction: vi.fn(),
  listAudienceFieldsAction: vi.fn(),
}));
vi.mock("@/app/actions/campaign-audience", () => actions);

const carrier = vi.hoisted(() => ({ estimateCarrierCampaignAction: vi.fn() }));
vi.mock("@/app/actions/carrier-messaging", () => carrier);

import rawPt from "@/i18n/messages/pt.json";
import type { AudienceCount } from "@/lib/campaign-audience/types";
import type { LeadSelection } from "@/lib/leads/actions";
import { estimateFixture } from "@/lib/carrier-messaging/test-fixtures";
import { brandedMessages } from "@/test/branded-messages";

import { AudienceStep } from "./AudienceStep";

const pt = brandedMessages(rawPt);
const step = pt.campaignAudience.step;
const copy = pt.carrierMessaging.pages.campaignEditor.audience;
const SETTLE = { timeout: 3000 };

function carrierCount(overrides: Partial<AudienceCount> = {}): AudienceCount {
  return {
    channel: "carrier",
    source: "leads",
    matched: 1300,
    withContact: 1250,
    sendable: 1200,
    out: { no_phone: 50, opted_out: 30, frequency_cap: 20 },
    outTotal: 100,
    requiredVariables: 0,
    variables: [],
    blockers: [],
    selection: { selected: 1300, confirmCount: 1300, fingerprint: "fp-c" },
    list: null,
    metadataMissing: [],
    ...overrides,
  };
}

function renderStep(audience: LeadSelection | null, onChange = vi.fn(), campaignId: string | null = null) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <AudienceStep audience={audience} kind="marketing" campaignId={campaignId} onChange={onChange} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return onChange;
}

function lastCount() {
  const calls = actions.countAudienceAction.mock.calls;
  return calls[calls.length - 1];
}

beforeEach(() => {
  actions.countAudienceAction.mockReset().mockResolvedValue({ data: carrierCount(), error: null });
  actions.listAudienceFieldsAction.mockReset().mockResolvedValue({ data: [], error: null });
  carrier.estimateCarrierCampaignAction.mockReset().mockResolvedValue({ data: estimateFixture({ count: carrierCount({ out: { suppressed: 7 }, outTotal: 7 }) }), error: null });
});

describe("carrier AudienceStep", () => {
  it("picks leads with the leads toolbar and offers no list", () => {
    renderStep(null);
    expect(screen.getByTestId("leads-toolbar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: step.sources.list })).not.toBeInTheDocument();
    expect(screen.getByText(copy.frozenHint)).toBeInTheDocument();
  });

  it("shows the carrier count with the carrier reasons and writes the counted whole base", async () => {
    const onChange = renderStep(null);
    fireEvent.click(screen.getByRole("button", { name: step.pick.everyone }));

    await waitFor(() => expect(lastCount()).toEqual(["carrier", { source: "leads", selection: { mode: "everyone" } }, { kind: "marketing" }, expect.any(AbortSignal)]), SETTLE);
    expect(await screen.findByText(pt.carrierMessaging.skipReasons.no_phone)).toBeInTheDocument();
    expect(screen.getByText(pt.carrierMessaging.skipReasons.frequency_cap)).toBeInTheDocument();
    expect(screen.getByText("1.250")).toBeInTheDocument();
    expect(screen.getByText(step.count.withPhone)).toBeInTheDocument();
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ mode: "everyone", expectedCount: 1300, fingerprint: "fp-c" }), SETTLE);
  });

  it("keeps a pick by ids from the leads page and counts it", async () => {
    actions.countAudienceAction.mockResolvedValue({ data: carrierCount({ matched: 2, withContact: 2, sendable: 2, out: {}, outTotal: 0, selection: { selected: 2, confirmCount: 2 } }), error: null });
    const onChange = renderStep({ mode: "ids", ids: ["a", "b"] });
    expect(screen.getByText("Selecionados (2)")).toBeInTheDocument();
    await waitFor(() => expect(lastCount()?.[1]).toEqual({ source: "leads", selection: { mode: "ids", ids: ["a", "b"] } }), SETTLE);
    expect(await screen.findByText(step.count.noneOut)).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("takes the count of a saved campaign from its estimate and never asks the count route", async () => {
    renderStep({ mode: "everyone", expectedCount: 1300 }, vi.fn(), "camp-1");
    expect(await screen.findByText(pt.carrierMessaging.skipReasons.suppressed, undefined, SETTLE)).toBeInTheDocument();
    expect(carrier.estimateCarrierCampaignAction).toHaveBeenCalledWith("camp-1", expect.anything());
    expect(actions.countAudienceAction).not.toHaveBeenCalled();
  });

  it("counts a changed selection of a saved campaign on the count route until it is saved", async () => {
    renderStep({ mode: "everyone", expectedCount: 1300 }, vi.fn(), "camp-1");
    await screen.findByText(pt.carrierMessaging.skipReasons.suppressed, undefined, SETTLE);
    fireEvent.click(screen.getByRole("button", { name: step.pick.filter }));
    fireEvent.click(screen.getByRole("button", { name: step.pick.everyone }));
    await waitFor(() => expect(actions.countAudienceAction).toHaveBeenCalled(), SETTLE);
  });

  it("shows a first n audience as it is until the person starts over with filters", async () => {
    const audience: LeadSelection = { mode: "first_n", limit: 500, filter: { groups: [] } };
    const onChange = renderStep(audience);
    expect(screen.getByText("Os primeiros 500 do filtro")).toBeInTheDocument();
    expect(screen.queryByTestId("leads-toolbar")).not.toBeInTheDocument();
    expect(actions.countAudienceAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: copy.startOver }));
    expect(screen.getByTestId("leads-toolbar")).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
