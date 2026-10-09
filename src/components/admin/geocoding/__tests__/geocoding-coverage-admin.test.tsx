import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { GeocodingPlatformPage, GeocodingPlatformWorkspace } from "@/lib/workspace/workspace-config/geocoding-platform";

import { GeocodingCoverageAdmin } from "../geocoding-coverage-admin";

const listAction = vi.fn();

vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/dashboard/admin/geocoding",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock("@/app/actions/geocoding-platform", () => ({
  adminListGeocodingCoverageAction: (...args: unknown[]) => listAction(...args),
}));

const t = ptMessages.adminGeocoding;

function workspace(overrides: Partial<GeocodingPlatformWorkspace> = {}): GeocodingPlatformWorkspace {
  return {
    workspaceId: "ws-1",
    workspaceName: "Escola Norte",
    coverage: {
      total: 10,
      withAddress: 8,
      withoutAddress: 2,
      onMap: 5,
      approximate: 2,
      pending: 1,
      notFound: 0,
      addressShare: 0.8,
      mapShare: 0.5,
    },
    ...overrides,
  };
}

function pageOf(items: GeocodingPlatformWorkspace[], overrides: Partial<GeocodingPlatformPage> = {}): GeocodingPlatformPage {
  return { items, page: 1, pageSize: 20, totalItems: items.length, totalPages: 1, ...overrides };
}

function renderAdmin() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <GeocodingCoverageAdmin />
    </NextIntlClientProvider>,
  );
}

describe("GeocodingCoverageAdmin", () => {
  beforeEach(() => {
    listAction.mockReset();
  });

  it("lists each workspace with its address coverage only", async () => {
    const empty = workspace({
      workspaceId: "ws-2",
      workspaceName: "Clínica",
      coverage: { total: 0, withAddress: 0, withoutAddress: 0, onMap: 0, approximate: 0, pending: 0, notFound: 0, addressShare: 0, mapShare: 0 },
    });
    listAction.mockResolvedValue({ page: pageOf([workspace(), empty]), error: null });
    renderAdmin();

    const row = (await screen.findByText("Escola Norte")).closest("tr") as HTMLElement;
    expect(within(row).getByText("80%")).toBeTruthy();
    expect(within(row).getByText("50%")).toBeTruthy();
    expect(within(row).getByText("8 de 10 leads")).toBeTruthy();
    expect(within(row).getByText("2 aproximados.")).toBeTruthy();
    expect(screen.getAllByText("n/d").length).toBeGreaterThan(0);
    expect(screen.queryByText("OpenCage")).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();
    expect(screen.queryByText(/provedor/i)).toBeNull();
    expect(screen.queryByText(/ciclo/i)).toBeNull();
    expect(listAction).toHaveBeenCalledWith({ page: 1, pageSize: 20, search: "" }, expect.any(AbortSignal));
  });

  it("opens a workspace's address breakdown", async () => {
    listAction.mockResolvedValue({ page: pageOf([workspace()]), error: null });
    renderAdmin();

    fireEvent.click(await screen.findByRole("button", { name: t.actions.showDetails }));

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
    [{ status: 500, code: "geocoding_coverage_unreadable", message: "boom" }, t.errors.default],
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
