import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { GeocodingPlatformPage, GeocodingPlatformWorkspace } from "@/lib/workspace/workspace-config/geocoding-platform";

import { GeocodingUsageAdmin } from "../geocoding-usage-admin";

const listAction = vi.fn();

vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/admin/geocoding",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock("@/app/actions/geocoding-platform", () => ({
  adminListGeocodingUsageAction: (...args: unknown[]) => listAction(...args),
}));

const t = ptMessages.adminGeocoding;

const cycles = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(2026, 9 - i, 1, 3)).toISOString());

function workspace(overrides: Partial<GeocodingPlatformWorkspace> = {}): GeocodingPlatformWorkspace {
  return {
    workspaceId: "ws-1",
    workspaceName: "Escola Norte",
    provider: "opencage",
    enabled: true,
    monthlyCeiling: 5000,
    ceilingSet: false,
    providerChangedAt: "2026-10-02T12:00:00Z",
    usedThisCycle: 40,
    usedToday: 3,
    months: cycles.map((cycleStart, i) => ({ cycleStart, requests: i === 0 ? 40 : i === 1 ? 7 : 0 })),
    coverage: {
      total: 10,
      withAddress: 8,
      withoutAddress: 2,
      onMap: 5,
      approximate: 2,
      pending: 1,
      notFound: 0,
      quotaExceeded: 0,
      refused: 0,
      addressShare: 0.8,
      mapShare: 0.5,
    },
    ...overrides,
  };
}

function pageOf(items: GeocodingPlatformWorkspace[], overrides: Partial<GeocodingPlatformPage> = {}): GeocodingPlatformPage {
  return {
    cycleStart: "2026-10-01T03:00:00Z",
    nextCycleStart: "2026-11-01T03:00:00Z",
    today: "2026-10-08T03:00:00Z",
    cycles,
    items,
    page: 1,
    pageSize: 20,
    totalItems: items.length,
    totalPages: 1,
    ...overrides,
  };
}

function renderAdmin() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <GeocodingUsageAdmin />
    </NextIntlClientProvider>,
  );
}

describe("GeocodingUsageAdmin", () => {
  beforeEach(() => {
    listAction.mockReset();
  });

  it("lists each workspace with its provider, usage this cycle and coverage", async () => {
    listAction.mockResolvedValue({ page: pageOf([workspace(), workspace({ workspaceId: "ws-2", workspaceName: "Clínica", provider: "", enabled: false, monthlyCeiling: 0, usedThisCycle: 0, usedToday: 0, providerChangedAt: undefined })]), error: null });
    renderAdmin();

    const row = (await screen.findByText("Escola Norte")).closest("tr") as HTMLElement;
    expect(within(row).getByText("OpenCage")).toBeTruthy();
    expect(within(row).getByText(/40 de 5\.000/)).toBeTruthy();
    expect(within(row).getByText(/Hoje: 3/)).toBeTruthy();
    expect(within(row).getByText(new RegExp(t.usage.defaultCeiling))).toBeTruthy();
    expect(within(row).getByText("80%")).toBeTruthy();
    expect(within(row).getByText("50%")).toBeTruthy();
    expect(within(row).getByRole("meter", { name: t.usage.meter })).toBeTruthy();

    const quiet = screen.getByText("Clínica").closest("tr") as HTMLElement;
    expect(within(quiet).getByText(t.provider.none)).toBeTruthy();
    expect(within(quiet).getByText(t.usage.off)).toBeTruthy();
    expect(listAction).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: "" }, expect.any(AbortSignal));
  });

  it("opens a workspace's monthly history and address breakdown", async () => {
    listAction.mockResolvedValue({ page: pageOf([workspace()]), error: null });
    renderAdmin();

    fireEvent.click(await screen.findByRole("button", { name: t.actions.showDetails }));

    expect(screen.getByText(t.details.history)).toBeTruthy();
    expect(screen.getByText("47 nos últimos 12 ciclos")).toBeTruthy();
    expect(screen.getByText(t.details.coverage)).toBeTruthy();
    expect(screen.getByText("1 aguardando localização.")).toBeTruthy();
    expect(screen.getByText("2 sem endereço.")).toBeTruthy();
    expect(screen.getByRole("button", { name: t.actions.hideDetails })).toBeTruthy();
  });

  it("searches by name from the first page", async () => {
    listAction.mockResolvedValue({ page: pageOf([workspace()]), error: null });
    renderAdmin();
    await screen.findByText("Escola Norte");

    fireEvent.change(screen.getByLabelText(t.search.placeholder), { target: { value: "  clínica " } });

    await waitFor(() => expect(listAction).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: "clínica" }, expect.any(AbortSignal)));
  });

  it("moves between server pages", async () => {
    listAction.mockResolvedValue({ page: pageOf([workspace()], { totalItems: 41, totalPages: 3 }), error: null });
    renderAdmin();
    await screen.findByText("Escola Norte");

    fireEvent.click(screen.getByRole("button", { name: "2" }));

    await waitFor(() => expect(listAction).toHaveBeenLastCalledWith({ page: 2, pageSize: 20, search: "" }, expect.any(AbortSignal)));
  });

  it.each([
    [{ status: 403, message: "Forbidden: insufficient permissions" }, t.errors.forbidden],
    [{ status: 503, message: "busy" }, t.errors.busy],
    [{ status: 503, code: "geocoding_unavailable", message: "off" }, t.errors.unavailable],
    [{ status: 504, message: "slow" }, t.errors.slow],
    [{ status: 500, code: "geocoding_usage_unreadable", message: "boom" }, t.errors.default],
  ])("shows a refusal instead of an empty list: %o", async (error, message) => {
    listAction.mockResolvedValue({ page: null, error });
    renderAdmin();

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText(t.errors.title)).toBeTruthy();
    expect(screen.queryByText(t.empty.title)).toBeNull();
  });

  it("retries a failed read", async () => {
    listAction.mockResolvedValueOnce({ page: null, error: { status: 503, message: "busy" } });
    listAction.mockResolvedValueOnce({ page: pageOf([workspace()]), error: null });
    renderAdmin();

    await screen.findByText(t.errors.busy);
    const refresh = screen.getAllByRole("button", { name: t.actions.refresh });
    fireEvent.click(refresh[refresh.length - 1]);

    expect(await screen.findByText("Escola Norte")).toBeTruthy();
  });
});
