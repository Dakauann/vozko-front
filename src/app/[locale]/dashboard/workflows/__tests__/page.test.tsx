import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { Workflow } from "@/lib/workflows/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/workflows",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, permissionsLoading: false, can: () => false }),
}));
vi.mock("@/contexts/department-context", () => ({ useDepartment: () => ({ currentDepartment: null }) }));
vi.mock("@/components/dashboard/ScopeBreadcrumb", () => ({ ScopeBreadcrumb: () => null }));
vi.mock("@/hooks/use-settled-permission", () => ({ useSettledPermission: () => false }));

const actions = vi.hoisted(() => ({
  listWorkflowsAction: vi.fn(),
  deleteWorkflowAction: vi.fn(),
  activateWorkflowAction: vi.fn(),
  pauseWorkflowAction: vi.fn(),
  publishWorkflowAction: vi.fn(),
  importWorkflowAction: vi.fn(),
  assignWorkflowDepartmentAction: vi.fn(),
}));
vi.mock("@/app/actions/workflows", () => actions);

import WorkflowsPage from "../page";

const copy = ptMessages.workflowsPage;

function workflow(id: string, name: string): Workflow {
  return { id, name, status: "active", type: "messages", graph: { nodes: [], edges: [] } } as unknown as Workflow;
}

describe("workflows list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.listWorkflowsAction.mockImplementation(async (params: { entryKind?: string }) => ({
      workflows: params.entryKind === "webhook" ? [workflow("w2", "Recebe webhook")] : [workflow("w1", "Sem webhook"), workflow("w2", "Recebe webhook")],
      meta: { page: 1, pageSize: 15, totalPages: params.entryKind ? 4 : 9, totalItems: params.entryKind ? 50 : 130 },
    }));
  });

  it("asks the server for the chosen entry kind from the first page, so the filter covers every page", async () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <WorkflowsPage />
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText("Sem webhook")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: copy.entryPoints.title }));
    fireEvent.click(await screen.findByRole("option", { name: copy.entryPoints.kinds.webhook }));

    await waitFor(() => expect(actions.listWorkflowsAction).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, entryKind: "webhook" })));
    await waitFor(() => expect(screen.queryByText("Sem webhook")).toBeNull());
    expect(screen.getByText("Recebe webhook")).toBeInTheDocument();
  });
});
