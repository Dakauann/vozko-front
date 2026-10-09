import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";

import { anItem, MEMBERS, OUTCOME_CONFIG, renderWithProviders, WORKER, workspaceFor } from "./call-list-test-kit";

const actions = vi.hoisted(() => ({ listCallListItemsAction: vi.fn() }));

vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => workspaceFor(new Set(WORKER)) }));
vi.mock("@/app/actions/call-lists", () => actions);
vi.mock("@/app/actions/workspace", () => ({ listAssignableMembersAction: () => Promise.resolve(MEMBERS) }));
vi.mock("@/app/actions/workspace-config", () => ({ getWorkspaceConfigAction: () => Promise.resolve(OUTCOME_CONFIG) }));

import { CallListQueue } from "../CallListQueue";

const copy = pt.callLists;
const asOf = "2026-10-08T12:00:00Z";

describe("CallListQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the pending tab in the server's order with the bairro of each lead, and asks for the next page with the whole cursor", async () => {
    actions.listCallListItemsAction.mockImplementation(async (_listId: string, query: { cursor?: unknown }) =>
      query.cursor
        ? { data: { items: [anItem({ id: "item-3", leadName: "Carlos Nunes", state: "pending", reservedBy: undefined, leadCity: "Barueri" })] }, error: null }
        : {
            data: {
              items: [
                anItem({ id: "item-1", leadName: "Luciana Ramos", state: "pending", reservedBy: undefined, callbackAt: "2026-10-08T11:00:00Z", leadDistrict: "Aldeia", leadCity: "Barueri" }),
                anItem({ id: "item-2", leadName: "João Souza", state: "pending", reservedBy: undefined, leadDistrict: "Jardim Silveira" }),
              ],
              next: { after: 2, asOf },
            },
            error: null,
          },
    );
    renderWithProviders(<CallListQueue listId="list-1" userId="u-me" />);

    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([expect.stringContaining("Luciana Ramos"), expect.stringContaining("João Souza")]);
    expect(screen.getByText("Aldeia")).toBeInTheDocument();
    expect(screen.getByText("Jardim Silveira")).toBeInTheDocument();
    expect(actions.listCallListItemsAction).toHaveBeenCalledWith("list-1", { state: "pending", cursor: undefined, limit: 50 }, expect.any(AbortSignal));

    fireEvent.click(screen.getByRole("button", { name: copy.queue.loadMore }));
    expect(await screen.findByText("Carlos Nunes")).toBeInTheDocument();
    expect(actions.listCallListItemsAction).toHaveBeenLastCalledWith("list-1", { state: "pending", cursor: { after: 2, asOf }, limit: 50 }, expect.any(AbortSignal));
    expect(screen.getByText("Barueri")).toBeInTheDocument();
  });

  it("names a closed item's outcome with the workspace's catalogue and a callback with its own label", async () => {
    actions.listCallListItemsAction.mockResolvedValue({
      data: {
        items: [
          anItem({ id: "item-1", leadName: "Luciana Ramos", state: "closed", reservedBy: undefined, disposition: "interessada" }),
          anItem({ id: "item-2", leadName: "João Souza", state: "closed", reservedBy: undefined, disposition: "_callback" }),
        ],
      },
      error: null,
    });
    renderWithProviders(<CallListQueue listId="list-1" userId="u-me" />);
    await screen.findAllByRole("listitem");
    fireEvent.click(screen.getByRole("button", { name: copy.queue.tabs.closed }));
    await waitFor(() => expect(screen.getByText("Interessada")).toBeInTheDocument());
    expect(screen.getByText(copy.queue.callbackDisposition)).toBeInTheDocument();
  });
});
