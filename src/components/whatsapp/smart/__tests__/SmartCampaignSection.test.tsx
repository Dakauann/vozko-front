import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { SmartPolicy } from "@/lib/whatsapp-campaigns/smart";

const getSmartDefaultsAction = vi.hoisted(() => vi.fn());
const projectSmartWavesAction = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/whatsapp-campaign-smart", () => ({ getSmartDefaultsAction, projectSmartWavesAction }));

import { SmartCampaignSection, useSmartPolicyDraft } from "../SmartCampaignSection";

const smart = ptMessages.whatsappCampaignsPage.smart;
const explained = ptMessages.explainers.campaigns.smartSend;
const hours = { timezone: "America/Sao_Paulo", days: { mon: [{ start: "08:00", end: "20:00" }] } };
const standard: SmartPolicy = {
  preset: "standard", firstWaveSize: 200, minWaveSize: 50, maxWaveSize: 5000, growth: 2, shrink: 0.5,
  observeWaitMinutes: 120, maxObserveWaitMinutes: 300, maxWavesPerDay: 0, maxSlowWavesAtFloor: 3, minSample: 50,
  failureRateSlow: 0.08, failureRateStop: 0.15, engagementRateSlow: 0.03, onTemplateYellow: "pause", onPhoneYellow: "slow_down", onPhoneRed: "pause",
  sendHours: hours,
};

beforeEach(() => {
  getSmartDefaultsAction.mockReset();
  getSmartDefaultsAction.mockResolvedValue({ defaults: { sendHours: hours, presets: { conservative: standard, standard, aggressive: standard } }, error: null });
  projectSmartWavesAction.mockReset();
  projectSmartWavesAction.mockResolvedValue({
    projection: { waves: [{ number: 1, size: 200, at: "2026-10-19T11:00:00Z" }, { number: 2, size: 400, at: "2026-10-19T13:00:00Z" }], truncated: false },
    error: null,
  });
});

function Harness() {
  const draft = useSmartPolicyDraft("create");
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <SmartCampaignSection draft={draft} contacts={50000} />
      <output data-testid="fields">{JSON.stringify(draft.fields)}</output>
      <output data-testid="blocks">{String(draft.blocks)}</output>
    </NextIntlClientProvider>
  );
}

describe("SmartCampaignSection", () => {
  it("sends nothing extra until wave sending is switched on", async () => {
    render(<Harness />);
    await waitFor(() => expect(getSmartDefaultsAction).toHaveBeenCalled());
    expect(screen.getByTestId("fields")).toHaveTextContent("{}");
  });

  it("switching on prefills the standard pace with the workspace hours and forecasts each wave", async () => {
    render(<Harness />);
    const toggle = await screen.findByRole("switch", { name: smart.enable });
    await waitFor(() => expect(toggle).not.toBeDisabled());

    fireEvent.click(toggle);

    expect(JSON.parse(screen.getByTestId("fields").textContent ?? "{}").smartPolicy).toEqual(standard);
    const forecast = await screen.findByRole("list", { name: smart.projection.title });
    expect(forecast).toHaveTextContent("Onda 1");
    expect(forecast).toHaveTextContent("200 contatos");
    expect(forecast).toHaveTextContent("Onda 2");
    expect(projectSmartWavesAction).toHaveBeenCalledWith(standard, 50000, undefined);
    expect(screen.getByTestId("blocks")).toHaveTextContent("false");
  });

  it("keeps the number colour rules behind the advanced settings, already filled by the pace", async () => {
    render(<Harness />);
    const toggle = await screen.findByRole("switch", { name: smart.enable });
    await waitFor(() => expect(toggle).not.toBeDisabled());
    fireEvent.click(toggle);

    expect(screen.queryByText(smart.fields.onPhoneRed)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(smart.advanced) }));

    expect(screen.getByText(smart.fields.onPhoneYellow)).toBeInTheDocument();
    expect(screen.getByText(smart.fields.onPhoneRed)).toBeInTheDocument();
    expect(screen.getByText(smart.protectionHint)).toBeInTheDocument();
    const summary = smart.presetProtection.replace("{yellow}", smart.protectiveShort.slow_down).replace("{red}", smart.protectiveShort.pause);
    expect(screen.getAllByText(new RegExp(summary)).length).toBeGreaterThan(0);
    const fields = JSON.parse(screen.getByTestId("fields").textContent ?? "{}").smartPolicy;
    expect([fields.onPhoneYellow, fields.onPhoneRed]).toEqual(["slow_down", "pause"]);
  });

  it("explains what Disparo Inteligente does before anyone switches it on", async () => {
    render(<Harness />);

    fireEvent.click(await screen.findByRole("button", { name: `Saiba mais sobre ${explained.name}` }));

    const card = screen.getByRole("dialog", { name: explained.name });
    expect(card).toHaveTextContent(explained.steps["1"].title);
    expect(card).toHaveTextContent(explained.steps["2"].title);
    expect(card).toHaveTextContent(explained.steps["3"].title);
    expect(screen.getByTestId("fields")).toHaveTextContent("{}");
  });

  it("blocks the submit while the policy has no send hours", async () => {
    const { result } = renderHook(() => useSmartPolicyDraft("create"));
    await waitFor(() => expect(result.current.defaults).not.toBeNull());

    act(() => result.current.setPolicy({ ...standard, sendHours: null }));

    expect(result.current.blocks).toBe(true);
  });

  it("does nothing in edit mode, where the campaign page owns the policy", async () => {
    const { result } = renderHook(() => useSmartPolicyDraft("edit"));
    act(() => result.current.setPolicy(standard));
    expect(getSmartDefaultsAction).not.toHaveBeenCalled();
    expect(result.current.fields).toEqual({});
  });
});
