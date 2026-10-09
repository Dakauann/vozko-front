import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/dashboard/leads",
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const access = vi.hoisted(() => ({ granted: new Set<string>(), loading: false }));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "ws1" },
    permissionsLoading: access.loading,
    can: (resource: string, action: string) => !access.loading && access.granted.has(`${resource}:${action}`),
  }),
}));

const listLeadsQueryAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/leads", () => ({ listLeadsQueryAction }));

vi.mock("@/components/dashboard/ScopeBreadcrumb", () => ({ ScopeBreadcrumb: () => null }));
vi.mock("@/components/leads/map/LeadsMapView", () => ({ LeadsMapView: () => <div data-testid="leads-map" /> }));
vi.mock("@/components/leads/LeadStatsStrip", () => ({ LeadStatsStrip: () => <div data-testid="stats" /> }));
vi.mock("@/components/leads/LeadsToolbar", () => ({ LeadsToolbar: () => <div data-testid="toolbar" /> }));
vi.mock("../_components/LeadSavedViews", () => ({ default: () => null }));
vi.mock("../_components/ImportLeadsDialog", () => ({ default: () => null }));
vi.mock("@/components/leads/imports/LeadImportsStatus", () => ({ LeadImportsStatus: () => null }));
vi.mock("@/components/leads/sheet/LeadSheet", () => ({ LeadSheet: () => null }));
vi.mock("@/components/crm/CustomFieldManager", () => ({ default: () => null }));
vi.mock("@/components/leads/use-lead-columns", () => ({
  useLeadColumns: () => [{ header: "Nome", key: "name" }],
  isLeadOptionalColumn: () => false,
  rowsNeedMemberDirectory: () => false,
}));
vi.mock("@/components/leads/use-leads-live-refetch", () => ({
  LEADS_LIVE_AGGREGATES_INTERVAL_MS: 30_000,
  createQuietReloadGate: () => ({ quiet: () => false, markLive: () => undefined }),
  useLeadsLiveRefetch: () => undefined,
}));
vi.mock("@/hooks/use-lead-map", () => ({ useLeadAreas: () => ({ data: [] }) }));
vi.mock("@/hooks/use-lead-section", () => ({ useLeadSection: () => ({ data: undefined }) }));
vi.mock("@/components/leads/bulk/use-lead-bulk", () => ({
  useLeadBulk: () => ({
    dialog: null,
    mapPicks: {},
    onMapPicksChange: () => undefined,
    mapBar: () => null,
    tableSelection: () => undefined,
    selection: { size: 0 },
  }),
}));
vi.mock("@/components/leads/use-leads-assistant-context", () => ({ usePublishLeadsAssistantContext: () => undefined }));
vi.mock("@/hooks/use-lead-presentation", () => ({
  useLeadPresentation: () => ({ fields: { definitions: [], reload: () => undefined }, classification: undefined, ownerName: () => "" }),
}));
vi.mock("@/hooks/use-call-readiness", () => ({ useMayPlaceCalls: () => false }));

import LeadsPage from "../page";

const READS_ADDRESSES = "leads:read_addresses";

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Harness() {
    return (
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
          <LeadsPage />
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  }
  const view = render(<Harness />);
  return { rerender: () => view.rerender(<Harness />) };
}

describe("LeadsPage default view", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockReset();
    access.granted = new Set(["leads:create", "leads:configure"]);
    access.loading = false;
    listLeadsQueryAction.mockReset().mockResolvedValue({ items: [], meta: { totalItems: 0, totalPages: 1 }, error: null, errorCode: null });
  });

  it("opens the map for a viewer who reads addresses, without fetching the list", async () => {
    access.granted.add(READS_ADDRESSES);
    renderPage();
    expect(await screen.findByTestId("leads-map")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mapa" })).toHaveAttribute("aria-pressed", "true");
    expect(listLeadsQueryAction).not.toHaveBeenCalled();
  });

  it("opens the table for a viewer who does not read addresses, with no view toggle", async () => {
    renderPage();
    await waitFor(() => expect(listLeadsQueryAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("leads-map")).toBeNull();
    expect(screen.queryByRole("group", { name: "Ver como" })).toBeNull();
  });

  it("lets view=table in the address win for a viewer who reads addresses", async () => {
    access.granted.add(READS_ADDRESSES);
    navigation.search = "view=table";
    renderPage();
    await waitFor(() => expect(listLeadsQueryAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("leads-map")).toBeNull();
    expect(screen.getByRole("button", { name: "Tabela" })).toHaveAttribute("aria-pressed", "true");
  });

  it("refuses view=map to a viewer who does not read addresses", async () => {
    navigation.search = "view=map";
    renderPage();
    await waitFor(() => expect(listLeadsQueryAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("leads-map")).toBeNull();
  });

  it("loads neither view while the permissions are still loading, then opens the map", async () => {
    access.loading = true;
    const { rerender } = renderPage();
    expect(screen.queryByTestId("leads-map")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
    access.loading = false;
    access.granted.add(READS_ADDRESSES);
    rerender();
    expect(await screen.findByTestId("leads-map")).toBeInTheDocument();
    expect(listLeadsQueryAction).not.toHaveBeenCalled();
  });

  it("writes view=table when a map reader switches to the table, and drops it going back", () => {
    access.granted.add(READS_ADDRESSES);
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Tabela" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/dashboard/leads?view=table", { scroll: false });
    navigation.search = "view=table";
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "Mapa" })[1]);
    expect(navigation.replace).toHaveBeenLastCalledWith("/dashboard/leads", { scroll: false });
  });

  it("keeps the primary action in the header and the rest in the compact menu", () => {
    renderPage();
    expect(screen.getByRole("button", { name: "Novo lead" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mais ações" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importar" })).toBeNull();
  });
});
