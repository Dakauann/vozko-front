import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listWorkflowsAction = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/workflows", () => ({ listWorkflowsAction }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));

import { useWorkflowOptions } from "../use-action-param-options";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useWorkflowOptions", () => {
  beforeEach(() => listWorkflowsAction.mockReset());

  it("offers only the flows the server says a button can start", async () => {
    listWorkflowsAction.mockResolvedValue({ workflows: [{ id: "wf-1", name: "Agenda" }], meta: {} });

    const { result } = renderHook(() => useWorkflowOptions(true), { wrapper });

    await waitFor(() => expect(result.current.options).toEqual([{ value: "wf-1", label: "Agenda" }]));
    expect(listWorkflowsAction).toHaveBeenCalledWith(expect.objectContaining({ startsFromMessage: true }));
  });

  it("reports a failed read instead of an empty list", async () => {
    listWorkflowsAction.mockResolvedValue({ workflows: [], meta: {}, error: "boom" });

    const { result } = renderHook(() => useWorkflowOptions(true), { wrapper });

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.options).toEqual([]);
  });
});
