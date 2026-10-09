import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchLeadSection = vi.fn();
vi.mock("@/app/actions/leads", () => ({
  fetchLeadSection: (...args: unknown[]) => fetchLeadSection(...args),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }),
}));

import { LeadSectionError } from "@/lib/leads/sections";
import { LEAD_FILTER_FIELD, emptyLeadFilter, toggleInSet } from "@/lib/leads/filters";
import { useLeadSection } from "./use-lead-section";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useLeadSection", () => {
  beforeEach(() => {
    fetchLeadSection.mockReset();
    fetchLeadSection.mockImplementation(async (section: string) => ({ section }));
  });

  it("does not ask the server while the section is off screen", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useLeadSection("summary", { filter: emptyLeadFilter }, { enabled }),
      { wrapper: wrapper(), initialProps: { enabled: false } },
    );
    expect(result.current.isPending).toBe(true);
    expect(fetchLeadSection).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.data).toEqual({ section: "summary" }));
    expect(fetchLeadSection).toHaveBeenCalledTimes(1);
    expect(fetchLeadSection.mock.calls[0][0]).toBe("summary");
  });

  it("loads summary and facets separately, so one failing leaves the other", async () => {
    fetchLeadSection.mockImplementation(async (section: string) => {
      if (section === "facets") throw new LeadSectionError("forbidden", 403);
      return { section };
    });
    const { result } = renderHook(
      () => ({
        summary: useLeadSection("summary", { filter: emptyLeadFilter }, { enabled: true }),
        facets: useLeadSection("facets", { filter: emptyLeadFilter }, { enabled: true }),
      }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.facets.isError).toBe(true));
    await waitFor(() => expect(result.current.summary.data).toEqual({ section: "summary" }));
    expect(fetchLeadSection.mock.calls.filter((call) => call[0] === "facets")).toHaveLength(1);
  });

  it("asks again when the filter or the search changes", async () => {
    const byCity = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
    const { result, rerender } = renderHook(
      ({ filter, q }) => useLeadSection("places", { filter, q }, { enabled: true }),
      { wrapper: wrapper(), initialProps: { filter: emptyLeadFilter, q: "" } },
    );
    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ filter: byCity, q: "" });
    await waitFor(() => expect(fetchLeadSection).toHaveBeenCalledTimes(2));
    rerender({ filter: byCity, q: "ana" });
    await waitFor(() => expect(fetchLeadSection).toHaveBeenCalledTimes(3));

    expect(fetchLeadSection.mock.calls[1][1]).toEqual({ filter: byCity, q: "" });
    expect(fetchLeadSection.mock.calls[2][1]).toEqual({ filter: byCity, q: "ana" });
  });

  it("keeps the last numbers on screen, marked as placeholders, while the next filter loads", async () => {
    let release: (value: unknown) => void = () => undefined;
    const byCity = toggleInSet(emptyLeadFilter, LEAD_FILTER_FIELD.city, "sp:barueri");
    const { result, rerender } = renderHook(
      ({ filter }) => useLeadSection("summary", { filter }, { enabled: true }),
      { wrapper: wrapper(), initialProps: { filter: emptyLeadFilter } },
    );
    await waitFor(() => expect(result.current.data).toEqual({ section: "summary" }));

    fetchLeadSection.mockImplementationOnce(() => new Promise((resolve) => (release = resolve)));
    rerender({ filter: byCity });
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
    expect(result.current.data).toEqual({ section: "summary" });

    release({ section: "summary", city: true });
    await waitFor(() => expect(result.current.data).toEqual({ section: "summary", city: true }));
    expect(result.current.isPlaceholderData).toBe(false);
  });
});
