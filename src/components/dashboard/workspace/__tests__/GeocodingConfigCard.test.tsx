import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import type { GeocodingSettings } from "@/lib/workspace/workspace-config/geocoding";

import ptMessages from "@/i18n/messages/pt.json";

const actions = vi.hoisted(() => ({
  getGeocodingSettingsAction: vi.fn(),
  updateGeocodingSettingsAction: vi.fn(),
}));

vi.mock("@/app/actions/geocoding-settings", () => actions);

const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("sonner", () => ({ toast: toasts }));

import { GeocodingConfigCard } from "../GeocodingConfigCard";

const t = ptMessages.workspaceSettings.geocoding;
const provider = ptMessages.leadMap.providers.opencage;

function settings(overrides: Partial<GeocodingSettings> = {}): GeocodingSettings {
  return {
    provider: "",
    enabled: false,
    monthlyCeiling: 0,
    dailyShare: 0,
    usedThisCycle: 0,
    usedToday: 0,
    exhausted: "",
    availableProviders: ["opencage"],
    attribution: "IBGE, CNEFE 2022",
    canChangeProvider: true,
    canChangeCeiling: false,
    providerPause: null,
    ...overrides,
  };
}

const enabled = settings({
  provider: "opencage",
  enabled: true,
  providerChangedBy: "u-1",
  providerChangedByName: "Ana Souza",
  providerChangedAt: "2026-10-08T12:00:00Z",
  monthlyCeiling: 5000,
  dailyShare: 323,
  usedThisCycle: 1250,
  usedToday: 12,
  cycleStart: "2026-10-01T03:00:00Z",
  nextCycleStart: "2026-11-01T03:00:00Z",
});

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <GeocodingConfigCard workspaceId="ws-1" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function openCard(status: string) {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`${t.title}.*${status}`) }));
}

function pauseNotice(title: string) {
  const heading = screen.getByText(title);
  expect(heading).toHaveClass("notice-ink", "font-semibold");
  const notice = heading.closest<HTMLElement>("[role=status]");
  expect(notice).not.toBeNull();
  return notice as HTMLElement;
}

function providerSwitch() {
  return screen.getByRole("switch", { name: t.provider.label.replace("{provider}", provider) });
}

beforeEach(() => {
  actions.getGeocodingSettingsAction.mockReset();
  actions.updateGeocodingSettingsAction.mockReset();
  toasts.success.mockReset();
  toasts.error.mockReset();
});

describe("GeocodingConfigCard", () => {
  it("shows a workspace on reference data alone, with the source credited", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: settings(), error: null });
    renderCard();
    await openCard(t.status.reference);
    expect(screen.getByText("IBGE, CNEFE 2022")).toBeInTheDocument();
    expect(providerSwitch()).not.toBeChecked();
    expect(screen.getByText(t.provider.never)).toBeInTheDocument();
    expect(screen.getByText(t.usage.off)).toBeInTheDocument();
  });

  it("asks before sending addresses to the provider, then turns it on", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: settings(), error: null });
    actions.updateGeocodingSettingsAction.mockResolvedValue({ settings: enabled, error: null });
    renderCard();
    await openCard(t.status.reference);
    fireEvent.click(providerSwitch());
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(t.confirm.enable.title)).toBeInTheDocument();
    expect(actions.updateGeocodingSettingsAction).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: t.confirm.enable.confirm }));
    await waitFor(() => expect(actions.updateGeocodingSettingsAction).toHaveBeenCalledWith("ws-1", { provider: "opencage" }));
    await waitFor(() => expect(providerSwitch()).toBeChecked());
    expect(toasts.success).toHaveBeenCalledWith(t.saved);
  });

  it("turns the provider off without a confirmation", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: enabled, error: null });
    actions.updateGeocodingSettingsAction.mockResolvedValue({ settings: settings({ providerChangedAt: "2026-10-09T12:00:00Z" }), error: null });
    renderCard();
    await openCard(t.status.provider);
    fireEvent.click(providerSwitch());
    await waitFor(() => expect(actions.updateGeocodingSettingsAction).toHaveBeenCalledWith("ws-1", { provider: "" }));
  });

  it("shows the cycle's usage against the ceiling and today's share", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: enabled, error: null });
    renderCard();
    await openCard(t.status.provider);
    expect(screen.getByText("1.250 de 5.000")).toBeInTheDocument();
    expect(screen.getByText("Hoje: 12 de 323")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: t.usage.title })).toHaveAttribute("aria-valuenow", "25");
    expect(screen.queryByText(t.usage.reached)).not.toBeInTheDocument();
    expect(screen.queryByText(t.usage.todayReached)).not.toBeInTheDocument();
    expect(screen.getByText(/Ligado por/)).toHaveTextContent("Ligado por Ana Souza em 08/10/2026");
  });

  it("warns when the server says the month's ceiling is reached", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: { ...enabled, usedThisCycle: 5000, exhausted: "monthly" }, error: null });
    renderCard();
    await openCard(t.status.ceilingReached);
    expect(screen.getByText(t.usage.reached).closest(".notice-warning")).not.toBeNull();
    expect(screen.queryByText(t.usage.todayReached)).not.toBeInTheDocument();
  });

  it("follows the server's verdict, not the counts", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: { ...enabled, usedThisCycle: 5000, exhausted: "" }, error: null });
    renderCard();
    await openCard(t.status.provider);
    expect(screen.queryByText(t.usage.reached)).not.toBeInTheDocument();
  });

  it("warns when the server says today's share is used", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: { ...enabled, exhausted: "daily" }, error: null });
    renderCard();
    await openCard(t.status.provider);
    expect(screen.getByText(t.usage.todayReached).closest(".notice-warning")).not.toBeNull();
    expect(screen.queryByText(t.usage.reached)).not.toBeInTheDocument();
  });

  it("says why a provider that was turned on no longer works, and still lets it be turned off", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: { ...enabled, availableProviders: [] }, error: null });
    actions.updateGeocodingSettingsAction.mockResolvedValue({ settings: settings({ availableProviders: [] }), error: null });
    renderCard();
    await openCard(t.status.providerMissing);
    expect(providerSwitch()).toBeChecked();
    expect(providerSwitch()).toBeEnabled();
    expect(providerSwitch()).toHaveAccessibleDescription(expect.stringContaining(t.provider.notConfigured));
    fireEvent.click(providerSwitch());
    await waitFor(() => expect(actions.updateGeocodingSettingsAction).toHaveBeenCalledWith("ws-1", { provider: "" }));
  });

  it("explains a zero ceiling", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: { ...enabled, monthlyCeiling: 0, dailyShare: 0, usedThisCycle: 0 }, error: null });
    renderCard();
    await openCard(t.status.noCeiling);
    expect(screen.getByText(t.usage.none)).toBeInTheDocument();
  });

  it("locks the switch with its reason for someone who may not choose the provider", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: settings({ canChangeProvider: false }), error: null });
    renderCard();
    await openCard(t.status.reference);
    expect(providerSwitch()).toBeDisabled();
    expect(providerSwitch()).toHaveAccessibleDescription(expect.stringContaining(t.provider.readOnly));
  });

  it("locks the switch when this server has no provider to offer", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: settings({ availableProviders: [] }), error: null });
    renderCard();
    await openCard(t.status.reference);
    expect(screen.getByRole("switch", { name: t.provider.labelNone })).toBeDisabled();
    expect(screen.getByText(t.provider.notConfigured)).toBeInTheDocument();
  });

  it("explains a refused change", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: enabled, error: null });
    actions.updateGeocodingSettingsAction.mockResolvedValue({ settings: null, error: { status: 403, code: "geocoding_forbidden" } });
    renderCard();
    await openCard(t.status.provider);
    fireEvent.click(providerSwitch());
    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith(t.saveFailed, { description: t.errors.geocoding_forbidden }));
    expect(providerSwitch()).toBeChecked();
  });

  it("shows the ceiling as text to someone who may not change it", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: enabled, error: null });
    renderCard();
    await openCard(t.status.provider);
    expect(screen.queryByRole("spinbutton", { name: t.ceiling.label })).not.toBeInTheDocument();
    expect(screen.getByText(t.ceiling.readOnly)).toBeInTheDocument();
  });

  it("lets a platform admin change the ceiling", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: { ...enabled, canChangeCeiling: true }, error: null });
    actions.updateGeocodingSettingsAction.mockResolvedValue({ settings: { ...enabled, canChangeCeiling: true, monthlyCeiling: 8000 }, error: null });
    renderCard();
    await openCard(t.status.provider);
    const input = screen.getByRole("spinbutton", { name: t.ceiling.label });
    expect(input).toHaveValue(5000);
    expect(input).toHaveAttribute("min", "0");
    expect(input).toHaveAttribute("step", "1");
    fireEvent.change(input, { target: { value: "8000" } });
    fireEvent.click(screen.getByRole("button", { name: t.ceiling.save }));
    await waitFor(() => expect(actions.updateGeocodingSettingsAction).toHaveBeenCalledWith("ws-1", { monthlyCeiling: 8000 }));
  });

  it("refuses a ceiling that is not a whole number before asking the server", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: { ...enabled, canChangeCeiling: true }, error: null });
    renderCard();
    await openCard(t.status.provider);
    const input = screen.getByRole("spinbutton", { name: t.ceiling.label });
    fireEvent.change(input, { target: { value: "1.5" } });
    expect(screen.getByRole("button", { name: t.ceiling.save })).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(expect.stringContaining(t.ceiling.invalid));
    expect(actions.updateGeocodingSettingsAction).not.toHaveBeenCalled();
  });

  it("says the provider is paused for everyone, since when, why, and that positions use the free reference meanwhile", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({
      settings: { ...enabled, providerPause: { state: "paused", reason: "account_quota_spent", since: "2026-10-08T15:00:00Z", until: "2026-10-08T16:00:00Z" } },
      error: null,
    });
    renderCard();
    await openCard(t.status.providerPaused);
    const notice = pauseNotice(t.pause.title);
    expect(notice).toHaveClass("notice", "notice-warning");
    expect(notice.querySelector("svg")?.closest(".notice-ink")).not.toBeNull();
    expect(notice).toHaveTextContent(t.pause.reasons.account_quota_spent);
    expect(notice).toHaveTextContent("08/10/2026, 12:00");
    expect(notice).toHaveTextContent("08/10/2026, 13:00");
    expect(notice).toHaveTextContent(t.pause.reference);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
    expect(providerSwitch()).toBeChecked();
  });

  it("points at the integration, not the addresses, when several texts were refused in a row", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({
      settings: { ...enabled, providerPause: { state: "paused", reason: "queries_refused", since: "2026-10-08T15:00:00Z", until: "2026-10-08T16:00:00Z" } },
      error: null,
    });
    renderCard();
    await openCard(t.status.providerPaused);
    expect(pauseNotice(t.pause.title)).toHaveTextContent(t.pause.reasons.queries_refused);
  });

  it("names a pause reason it does not know without guessing it", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({
      settings: { ...enabled, providerPause: { state: "paused", reason: "other", since: "2026-10-08T15:00:00Z", until: "2026-10-08T16:00:00Z" } },
      error: null,
    });
    renderCard();
    await openCard(t.status.providerPaused);
    expect(pauseNotice(t.pause.title)).toHaveTextContent(t.pause.reasons.other);
  });

  it("says no paid lookup is made while the pause state cannot be read", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: { ...enabled, providerPause: { state: "unknown" } }, error: null });
    renderCard();
    await openCard(t.status.providerPauseUnknown);
    const notice = pauseNotice(t.pause.unknownTitle);
    expect(notice).toHaveTextContent(t.pause.unknown);
    expect(notice).toHaveTextContent(t.pause.reference);
  });

  it("shows the pause to someone who may not change anything, with nothing to act on", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({
      settings: { ...enabled, canChangeProvider: false, providerPause: { state: "paused", reason: "key_rejected", since: "2026-10-08T15:00:00Z", until: "2026-10-08T16:00:00Z" } },
      error: null,
    });
    renderCard();
    await openCard(t.status.providerPaused);
    const notice = pauseNotice(t.pause.title);
    expect(within(notice).queryByRole("button")).not.toBeInTheDocument();
    expect(within(notice).queryByRole("switch")).not.toBeInTheDocument();
    expect(providerSwitch()).toBeDisabled();
  });

  it("shows no pause notice while the provider works", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: enabled, error: null });
    renderCard();
    await openCard(t.status.provider);
    expect(screen.queryByText(t.pause.title)).not.toBeInTheDocument();
    expect(screen.queryByText(t.pause.reference)).not.toBeInTheDocument();
  });

  it("shows the load failure instead of an empty card", async () => {
    actions.getGeocodingSettingsAction.mockResolvedValue({ settings: null, error: { status: 403, code: "geocoding_forbidden" } });
    renderCard();
    await openCard(t.status.unavailable);
    expect(screen.getByRole("alert")).toHaveTextContent(t.loadFailed);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
});
