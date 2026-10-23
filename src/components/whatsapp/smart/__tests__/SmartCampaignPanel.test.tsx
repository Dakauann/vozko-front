import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { SmartCampaignView, SmartPolicy } from "@/lib/whatsapp-campaigns/smart";

const actions = vi.hoisted(() => ({
  getSmartCampaignAction: vi.fn(),
  saveSmartCampaignAction: vi.fn(),
  removeSmartCampaignAction: vi.fn(),
}));

vi.mock("@/app/actions/whatsapp-campaign-smart", () => actions);
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { SmartCampaignPanel } from "../SmartCampaignPanel";

const smart = ptMessages.whatsappCampaignsPage.smart;
const hours = { timezone: "America/Sao_Paulo", days: { mon: [{ start: "08:00", end: "20:00" }] } };

const standard: SmartPolicy = {
  preset: "standard", firstWaveSize: 200, minWaveSize: 50, maxWaveSize: 5000, growth: 2, shrink: 0.5,
  observeWaitMinutes: 120, maxObserveWaitMinutes: 300, maxWavesPerDay: 0, maxSlowWavesAtFloor: 3, minSample: 50,
  failureRateSlow: 0.08, failureRateStop: 0.15, engagementRateSlow: 0.03, onTemplateYellow: "pause", onPhoneYellow: "slow_down", onPhoneRed: "pause",
  sendHours: hours,
};

function view(overrides: Partial<SmartCampaignView>): SmartCampaignView {
  return {
    policy: standard,
    editable: false,
    defaults: { sendHours: hours, presets: { conservative: standard, standard, aggressive: standard } },
    progress: { phase: "sending", wave: 1 },
    waves: [],
    ...overrides,
  };
}

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <SmartCampaignPanel campaignId="camp-1" contacts={5000} refreshToken={1} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  Object.values(actions).forEach((fn) => fn.mockReset());
});

describe("SmartCampaignPanel", () => {
  it("explains a hold with the reason Meta gave", async () => {
    actions.getSmartCampaignAction.mockResolvedValue({
      view: view({
        progress: {
          phase: "held",
          wave: 3,
          since: "2026-10-16T15:56:00Z",
          reason: { action: "pause", findings: [{ rule: "template_yellow", action: "pause", at: "2026-10-16T15:56:00Z" }] },
        },
      }),
      error: null,
    });

    renderPanel();

    expect(await screen.findByText(smart.rules.template_yellow)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Segurada automaticamente às");
  });

  it("lists each wave with its numbers and decision, newest first", async () => {
    actions.getSmartCampaignAction.mockResolvedValue({
      view: view({
        progress: { phase: "observing", wave: 2, until: "2026-10-16T17:00:00Z" },
        waves: [
          { number: 1, size: 200, state: "decided", releasedAt: "2026-10-16T13:00:00Z", outcome: { processed: 200, delivered: 190, read: 95, failures: { "131026": 4 } }, decision: { action: "continue", nextSize: 400 } },
          { number: 2, size: 400, state: "drained", releasedAt: "2026-10-16T15:00:00Z", outcome: { processed: 400, delivered: 380, read: 120 }, decision: { action: "continue" } },
        ],
      }),
      error: null,
    });

    renderPanel();

    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Onda 2");
    expect(items[1]).toHaveTextContent("Onda 1");
    expect(items[1]).toHaveTextContent(smart.decision.continue);
    expect(screen.getByRole("status")).toHaveTextContent("Onda 2 em observação até");
  });

  it("says the campaign sends everything at once when the policy is off", async () => {
    actions.getSmartCampaignAction.mockResolvedValue({ view: view({ policy: null, editable: true }), error: null });

    renderPanel();

    expect(await screen.findByText(smart.off)).toBeInTheDocument();
  });

  it("saves an edited policy while the campaign is not running", async () => {
    actions.getSmartCampaignAction.mockResolvedValue({ view: view({ editable: true }), error: null });
    actions.saveSmartCampaignAction.mockResolvedValue({ view: view({ editable: true }), error: null });

    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: smart.edit }));
    fireEvent.click(screen.getByRole("button", { name: smart.save }));

    await waitFor(() => expect(actions.saveSmartCampaignAction).toHaveBeenCalledWith("camp-1", standard));
  });

  it("never offers editing while the campaign runs", async () => {
    actions.getSmartCampaignAction.mockResolvedValue({ view: view({ editable: false }), error: null });

    renderPanel();

    expect(await screen.findByText(smart.locked)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: smart.edit })).not.toBeInTheDocument();
  });
});
