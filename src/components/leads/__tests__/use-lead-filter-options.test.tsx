import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listWhatsAppCampaignsAction = vi.fn();
const listStagesAction = vi.fn();
const listLabelsAction = vi.fn();
const fetchLeadSection = vi.fn();
const listCustomFieldsAction = vi.fn();
const listAssignableMembersAction = vi.fn();
const permissions = { current: new Set<string>(["leads:read", "members:read"]) };

vi.mock("@/app/actions/whatsapp-campaigns", () => ({
  listWhatsAppCampaignsAction: (...args: unknown[]) => listWhatsAppCampaignsAction(...args),
}));
vi.mock("@/app/actions/stages", () => ({ listStagesAction: (...args: unknown[]) => listStagesAction(...args) }));
vi.mock("@/app/actions/labels", () => ({ listLabelsAction: (...args: unknown[]) => listLabelsAction(...args) }));
vi.mock("@/app/actions/leads", () => ({ fetchLeadSection: (...args: unknown[]) => fetchLeadSection(...args) }));
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: (...args: unknown[]) => listCustomFieldsAction(...args),
}));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: (...args: unknown[]) => listAssignableMembersAction(...args),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    currentWorkspace: { id: "ws1" },
    can: (resource: string, action: string) => permissions.current.has(`${resource}:${action}`),
  }),
}));

import { useLeadFilterOptions } from "../use-lead-filter-options";
import { LEAD_FILTER_FIELD, readSet } from "@/lib/leads/filters";
import type { LeadSectionParams } from "@/lib/leads/sections";

const WHOLE_WORKSPACE = {
  cities: [
    { cityKey: "sp:barueri", city: "Barueri", state: "SP", count: 900 },
    { cityKey: "sp:carapicuiba", city: "Carapicuíba", state: "SP", count: 40 },
  ],
  districts: [{ pair: "sp:barueri/centro", cityKey: "sp:barueri", districtKey: "centro", district: "Centro", city: "Barueri", state: "SP", count: 120 }],
};

const ONLY_CARAPICUIBA = {
  cities: [WHOLE_WORKSPACE.cities[1]],
  districts: [
    { pair: "sp:carapicuiba/centro", cityKey: "sp:carapicuiba", districtKey: "centro", district: "Centro", city: "Carapicuíba", state: "SP", count: 30 },
  ],
};

function wrapper(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useLeadFilterOptions", () => {
  beforeEach(() => {
    permissions.current = new Set(["leads:read", "members:read"]);
    listWhatsAppCampaignsAction.mockReset().mockResolvedValue({ campaigns: [{ id: "c1", name: "Matrículas" }] });
    listStagesAction.mockReset().mockResolvedValue({ stages: [{ id: "s1", name: "Novo", color: "#111" }] });
    listLabelsAction.mockReset().mockResolvedValue({ labels: [{ id: "l1", name: "VIP", color: "#222" }] });
    listCustomFieldsAction.mockReset().mockResolvedValue({
      fields: [
        { id: "f1", key: "interesse", label: "Interesse", type: "select", role: "classification", readable: true, position: 0, options: ["Positivo"] },
        { id: "f2", key: "saude", label: "Saúde", type: "text", sensitive: true, readable: false, position: 1 },
      ],
    });
    listAssignableMembersAction.mockReset().mockResolvedValue({ members: [{ userId: "u-1", username: "Clara M." }] });
    fetchLeadSection.mockReset().mockImplementation(async (_section: string, params: LeadSectionParams) =>
      readSet(params.filter, LEAD_FILTER_FIELD.city).length > 0 ? ONLY_CARAPICUIBA : WHOLE_WORKSPACE,
    );
  });

  it("loads campaigns, stages and labels once for every consumer", async () => {
    const shared = wrapper();
    const first = renderHook(() => useLeadFilterOptions(), { wrapper: shared });
    const second = renderHook(() => useLeadFilterOptions(), { wrapper: shared });

    await waitFor(() => expect(first.result.current.pending).not.toContain("campaigns"));
    await waitFor(() => expect(second.result.current.pending).not.toContain("campaigns"));

    expect(first.result.current.campaigns).toEqual([{ value: "c1", label: "Matrículas" }]);
    expect(first.result.current.stages).toEqual([{ value: "s1", label: "Novo", color: "#111" }]);
    expect(first.result.current.labels).toEqual([{ value: "l1", label: "VIP", color: "#222" }]);
    expect(listWhatsAppCampaignsAction).toHaveBeenCalledTimes(1);
    expect(listStagesAction).toHaveBeenCalledTimes(1);
    expect(listLabelsAction).toHaveBeenCalledTimes(1);
    expect(fetchLeadSection).toHaveBeenCalledTimes(1);
  });

  it("takes cities and bairros from the places section of the whole workspace", async () => {
    const { result } = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.cities).toHaveLength(2));
    expect(result.current.districts.map((d) => d.pair)).toEqual(["sp:barueri/centro"]);
    expect(fetchLeadSection).toHaveBeenCalledWith("places", expect.objectContaining({ filter: { groups: [] } }), expect.anything());
  });

  it("narrows the bairros to the chosen cities", async () => {
    const { result, rerender } = renderHook(({ cityKeys }) => useLeadFilterOptions({ cityKeys }), {
      wrapper: wrapper(),
      initialProps: { cityKeys: [] as string[] },
    });
    await waitFor(() => expect(result.current.districts).toHaveLength(1));

    rerender({ cityKeys: ["sp:carapicuiba"] });
    await waitFor(() => expect(result.current.districts.map((d) => d.pair)).toEqual(["sp:carapicuiba/centro"]));
    expect(result.current.cities).toHaveLength(2);
  });

  it("offers the classification and readable fields only", async () => {
    const { result } = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.classification?.key).toBe("interesse"));
    expect(result.current.customFields.map((spec) => spec.label)).toEqual(["Interesse"]);
  });

  it("names members only for a viewer who may read them", async () => {
    const reader = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    await waitFor(() => expect(reader.result.current.members.get("u-1")).toBe("Clara M."));

    permissions.current = new Set(["leads:read"]);
    listAssignableMembersAction.mockClear();
    const outsider = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    await waitFor(() => expect(outsider.result.current.pending).not.toContain("campaigns"));
    expect(outsider.result.current.members.size).toBe(0);
    expect(listAssignableMembersAction).not.toHaveBeenCalled();
  });

  it("tells the toolbar whether street level filters are allowed", async () => {
    const plain = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    expect(plain.result.current.readsAddresses).toBe(false);

    permissions.current = new Set(["leads:read", "leads:read_addresses"]);
    const full = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    expect(full.result.current.readsAddresses).toBe(true);
  });

  it("reports a failed places section instead of an empty list", async () => {
    fetchLeadSection.mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.failed).toContain("cities"), { timeout: 4000 });
    expect(result.current.failed).toContain("districts");
  });

  it("reports a failed option list and keeps the others", async () => {
    listStagesAction.mockResolvedValue({ stages: [], error: "forbidden" });
    const { result } = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.pending).not.toContain("stages"));
    expect(result.current.failed).toContain("stages");
    expect(result.current.failed).not.toContain("labels");
    expect(result.current.labels).toHaveLength(1);
  });

  it("marks every option set as pending until it arrives", async () => {
    fetchLeadSection.mockImplementation(() => new Promise(() => {}));
    listAssignableMembersAction.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useLeadFilterOptions({ cityKeys: ["sp:carapicuiba"] }), { wrapper: wrapper() });

    expect(result.current.pending).toEqual(expect.arrayContaining(["cities", "districts", "owners"]));
    await waitFor(() => expect(result.current.pending).not.toContain("campaigns"));
    expect(result.current.pending).toEqual(expect.arrayContaining(["cities", "districts", "owners"]));
  });

  it("reports lead fields that did not load instead of dropping their filters", async () => {
    listCustomFieldsAction.mockResolvedValue({ fields: [], error: "down" });
    const { result } = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.fieldsFailed).toBe(true));
    expect(result.current.classification).toBeUndefined();

    listCustomFieldsAction.mockResolvedValue({
      fields: [{ id: "f1", key: "interesse", label: "Interesse", type: "select", role: "classification", readable: true, position: 0, options: ["Positivo"] }],
    });
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.fieldsFailed).toBe(false));
    expect(result.current.classification?.key).toBe("interesse");
  });

  it("retries the option sets that failed", async () => {
    fetchLeadSection.mockRejectedValue(new Error("down"));
    listAssignableMembersAction.mockResolvedValue({ members: [], error: "down" });
    const { result } = renderHook(() => useLeadFilterOptions(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.failed).toEqual(expect.arrayContaining(["cities", "owners"])), { timeout: 4000 });

    fetchLeadSection.mockResolvedValue(WHOLE_WORKSPACE);
    listAssignableMembersAction.mockResolvedValue({ members: [{ userId: "u-1", username: "Clara M." }] });
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.failed).toEqual([]));
    expect(result.current.cities).toHaveLength(2);
    expect(result.current.members.get("u-1")).toBe("Clara M.");
  });
});
