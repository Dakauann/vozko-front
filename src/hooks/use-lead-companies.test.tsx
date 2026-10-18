import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listLeadCompaniesAction = vi.fn();
const getLeadCompanyAction = vi.fn();
vi.mock("@/app/actions/lead-companies", () => ({
  listLeadCompaniesAction: (...args: unknown[]) => listLeadCompaniesAction(...args),
  getLeadCompanyAction: (...args: unknown[]) => getLeadCompanyAction(...args),
}));
const grants = new Set<string>();
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: (resource: string, action: string) => grants.has(`${resource}:${action}`) }),
}));

import { useLeadCompaniesPage, useLeadCompany } from "./use-lead-companies";

const acme = { id: "c-1", name: "Acme", acceptsLeads: true, membersCount: 2, createdAt: "2026-10-17T12:00:00Z", updatedAt: "2026-10-17T12:00:00Z" };

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("lead company queries", () => {
  beforeEach(() => {
    grants.clear();
    listLeadCompaniesAction.mockReset();
    getLeadCompanyAction.mockReset();
    listLeadCompaniesAction.mockResolvedValue({ data: { items: [acme], page: 1, pageSize: 20, totalPages: 1, totalItems: 1 }, error: null });
    getLeadCompanyAction.mockResolvedValue({ data: acme, error: null });
  });

  it("never asks for companies the person cannot read", async () => {
    const { result } = renderHook(() => useLeadCompaniesPage({ page: 1, pageSize: 20 }), { wrapper: wrapper() });
    const company = renderHook(() => useLeadCompany("c-1"), { wrapper: wrapper() });
    expect(result.current.fetchStatus).toBe("idle");
    expect(company.result.current.fetchStatus).toBe("idle");
    expect(listLeadCompaniesAction).not.toHaveBeenCalled();
    expect(getLeadCompanyAction).not.toHaveBeenCalled();
  });

  it("reads the page the person asked for", async () => {
    grants.add("lead_companies:read");
    const { result } = renderHook(() => useLeadCompaniesPage({ page: 2, pageSize: 20, search: "ac" }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data?.items).toEqual([acme]));
    expect(listLeadCompaniesAction.mock.calls[0][0]).toEqual({ page: 2, pageSize: 20, search: "ac" });
  });

  it("reads one company only when the lead has one", async () => {
    grants.add("lead_companies:read");
    const none = renderHook(() => useLeadCompany(""), { wrapper: wrapper() });
    expect(none.result.current.fetchStatus).toBe("idle");
    const { result } = renderHook(() => useLeadCompany("c-1"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toEqual(acme));
  });

  it("turns a refusal into a query error with its code", async () => {
    grants.add("lead_companies:read");
    getLeadCompanyAction.mockResolvedValue({ data: null, error: { message: "gone", code: "lead_company_not_found", status: 404 } });
    const { result } = renderHook(() => useLeadCompany("c-9"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { code?: string }).code).toBe("lead_company_not_found");
  });
});
