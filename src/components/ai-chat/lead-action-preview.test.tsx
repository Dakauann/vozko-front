import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getPreview = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/lead-actions", () => ({ previewLeadActionAction: vi.fn(), getLeadActionPreviewAction: getPreview }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));

import ptMessages from "@/i18n/messages/pt.json";

import { hasProposalPreview, ProposalPreview } from "./proposal-preview";

const t = ptMessages;

function renderPreview(data: unknown, open = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (isOpen: boolean) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ProposalPreview preview={{ kind: "lead_action", data }} open={isOpen} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  const rendered = render(view(open));
  return { ...rendered, decide: () => rendered.rerender(view(false)) };
}

const classify = {
  stage: "prepare",
  action: "classify",
  mode: "all_matching",
  previewId: "pv-1",
  matched: 5000,
  selected: 5000,
  eligible: 4700,
  partial: false,
  skipped: { unchanged: 280, gone: 20 },
};

const quote = {
  count: 1200,
  parts: 1,
  splitRequired: false,
  maxPerCampaign: 150000,
  unitPriceMicros: 62500,
  costMicros: 75000000,
  balanceMicros: 50000000,
  currency: "USD",
  affordable: false,
  fits: 800,
  refusal: "unaffordable",
};

function finished(eligible: number) {
  return {
    data: {
      id: "pv-1",
      action: "classify",
      status: "done",
      result: { matched: 5000, expectedCount: 5000, fingerprint: "f", selected: 5000, eligible, skipped: { unchanged: 5000 - eligible } },
    },
    error: null,
  };
}

function valueOf(label: string): string {
  const term = screen.getByText(label).closest("dt");
  return (term?.nextElementSibling as HTMLElement | null)?.textContent ?? "";
}

beforeEach(() => {
  getPreview.mockReset();
});

describe("lead action preview", () => {
  it("is registered for the lead_action kind", () => {
    expect(hasProposalPreview({ kind: "lead_action", data: {} })).toBe(true);
  });

  it("shows how many leads change and why the others are skipped", () => {
    renderPreview(classify);
    expect(valueOf(t.leadsPage.bulk.dialog.counts.selected)).toBe("5.000");
    expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.edit)).toBe("4.700");
    expect(valueOf(t.leadsPage.bulk.skipped.unchanged)).toBe("280");
    expect(valueOf(t.leadsPage.bulk.skipped.gone)).toBe("20");
    expect(screen.queryByText(t.aiChatPage.previews.leadAction.counting)).toBeNull();
    expect(getPreview).not.toHaveBeenCalled();
  });

  it("names the rows of an export file", () => {
    renderPreview({ ...classify, action: "export", eligible: 5000, skipped: {} });
    expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.export)).toBe("5.000");
  });

  it("follows a partial count to its final numbers while the card is open", async () => {
    getPreview.mockResolvedValueOnce({ data: { ...finished(0).data, status: "running" }, error: null }).mockResolvedValueOnce(finished(4321));
    renderPreview({ ...classify, partial: true, eligible: 1800 });
    expect(screen.getByText(t.aiChatPage.previews.leadAction.counting)).toBeTruthy();
    expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.edit)).toBe("1.800");
    await waitFor(() => expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.edit)).toBe("4.321"), { timeout: 8000 });
    expect(screen.queryByText(t.aiChatPage.previews.leadAction.counting)).toBeNull();
    expect(getPreview).toHaveBeenCalledWith("pv-1", expect.anything());
  }, 10000);

  it("says a failed count gets this approval refused and offers no retry that could never succeed", async () => {
    getPreview.mockResolvedValue({ data: { ...finished(0).data, status: "failed", failureCode: "stalled" }, error: null });
    renderPreview({ ...classify, partial: true, eligible: 1800 });
    const alert = await screen.findByRole("alert", undefined, { timeout: 8000 });
    expect(alert.textContent).toContain(t.aiChatPage.previews.leadAction.failed);
    expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.edit)).toBe("1.800");
    expect(screen.queryByRole("button", { name: t.leadsPage.bulk.dialog.retry })).toBeNull();
  }, 10000);

  it("treats an expired count as partial numbers the approval checks again, with no alert and no retry", async () => {
    getPreview.mockResolvedValue({ data: null, error: { status: 404, code: "lead_action_preview_not_found" } });
    renderPreview({ ...classify, partial: true, eligible: 1800 });
    await screen.findByText(t.aiChatPage.previews.leadAction.expired, undefined, { timeout: 12000 });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: t.leadsPage.bulk.dialog.retry })).toBeNull();
    expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.edit)).toBe("1.800");
  }, 15000);

  it("offers to try again when the count could not be read, keeping the partial numbers visible", async () => {
    getPreview.mockRejectedValue(new Error("network down"));
    renderPreview({ ...classify, partial: true, eligible: 1800 });
    await screen.findByRole("alert", undefined, { timeout: 8000 });
    expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.edit)).toBe("1.800");
    expect(screen.getByText(t.aiChatPage.previews.leadAction.partial)).toBeTruthy();
    getPreview.mockReset();
    getPreview.mockResolvedValue(finished(4000));
    fireEvent.click(screen.getByRole("button", { name: t.leadsPage.bulk.dialog.retry }));
    await waitFor(() => expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.edit)).toBe("4.000"), { timeout: 8000 });
  }, 20000);

  it("keeps the final count on a card decided after the count finished", async () => {
    getPreview.mockResolvedValue(finished(4321));
    const { decide } = renderPreview({ ...classify, partial: true, eligible: 1800 });
    await waitFor(() => expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.edit)).toBe("4.321"), { timeout: 8000 });
    decide();
    expect(valueOf(t.leadsPage.bulk.dialog.counts.eligible.edit)).toBe("4.321");
    expect(screen.queryByText(t.aiChatPage.previews.leadAction.partial)).toBeNull();
  }, 10000);

  it("never polls for a card that was already decided, and marks its count as partial", () => {
    renderPreview({ ...classify, partial: true, eligible: 1800 }, false);
    expect(screen.getByText(t.aiChatPage.previews.leadAction.partial)).toBeTruthy();
    expect(getPreview).not.toHaveBeenCalled();
  });

  it("shows the selection, the estimate and what the balance covers for a prepared official send", () => {
    renderPreview({ stage: "prepare", action: "send_template", mode: "all_matching", matched: 1200, selected: 1200, eligible: 1200, partial: false, skipped: {}, quote });
    expect(valueOf(t.leadSends.review.selected)).toBe("1.200");
    expect(screen.getByText(t.leadSends.review.cost)).toBeTruthy();
    expect(screen.getByText(/US\$\s*75,00/)).toBeTruthy();
    expect(screen.getByText(/O saldo cobre 800 dos 1\.200/)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("shows the pace of a prepared unofficial send instead of a cost", () => {
    renderPreview({
      stage: "prepare",
      action: "send_unofficial",
      matched: 900,
      selected: 900,
      eligible: 900,
      partial: false,
      skipped: {},
      quote: { ...quote, count: 900, unitPriceMicros: 0, costMicros: 0, affordable: true, fits: 900, refusal: undefined, dailyCap: 300, estimatedDays: 3 },
    });
    expect(screen.getByText(t.leadSends.review.pace)).toBeTruthy();
    expect(screen.queryByText(t.leadSends.review.cost)).toBeNull();
  });

  it("shows who receives the started send, the skip reasons and the window note", () => {
    renderPreview({
      stage: "start",
      action: "send_template",
      matched: 1500,
      selected: 1500,
      eligible: 1200,
      partial: false,
      skipped: { blocked: 100, opted_out: 200 },
      counted: { window_open: 52 },
      quote: { ...quote, refusal: undefined, affordable: true, fits: 1200 },
      parts: [{ campaignId: "c-1", name: "Reativação", status: "stopped", entries: 1500, eligible: 1200 }],
    });
    expect(valueOf(t.leadSends.review.selected)).toBe("1.500");
    expect(valueOf(t.leadSends.review.receive)).toBe("1.200");
    expect(valueOf(t.leadSends.review.skipped.blocked)).toBe("100");
    expect(valueOf(t.leadSends.review.skipped.opted_out)).toBe("200");
    expect(screen.getByText(/52 estão com a janela aberta/)).toBeTruthy();
    expect(screen.getByText(t.leadSends.review.cost)).toBeTruthy();
  });

  it("leaves the cost to the card when only the first leads receive, so two totals never disagree", () => {
    renderPreview({
      stage: "start",
      action: "send_template",
      matched: 1500,
      selected: 1500,
      eligible: 800,
      partial: false,
      skipped: {},
      quote,
    });
    expect(valueOf(t.leadSends.review.receive)).toBe("800");
    expect(screen.queryByText(t.leadSends.review.cost)).toBeNull();
  });

  it("lists the stopped sends a discard deletes", () => {
    renderPreview({
      stage: "cancel",
      action: "send_template",
      matched: 1500,
      selected: 1500,
      eligible: 1200,
      partial: false,
      skipped: {},
      parts: [
        { campaignId: "c-1", name: "Reativação (1/2)", status: "stopped", entries: 1000, eligible: 800 },
        { campaignId: "c-2", name: "Reativação (2/2)", status: "stopped", entries: 500, eligible: 400 },
      ],
    });
    expect(screen.getByText(t.aiChatPage.previews.leadAction.cancel)).toBeTruthy();
    expect(screen.getByText("Reativação (1/2)")).toBeTruthy();
    expect(screen.getByText("1.000 leads")).toBeTruthy();
    expect(screen.getByText("500 leads")).toBeTruthy();
  });

  it("renders nothing for data it cannot read", () => {
    const { container } = renderPreview({ stage: "prepare", action: "classify", selected: "muitos" });
    expect(container.textContent).toBe("");
  });
});
