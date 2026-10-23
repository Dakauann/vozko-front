import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ members: vi.fn(), targets: vi.fn() }));
vi.mock("next-intl", () => ({ useLocale: () => "pt" }));
vi.mock("@/app/actions/workspace", () => ({ listAssignableMembersAction: actions.members }));
vi.mock("@/app/actions/conversations", () => ({ listDelegationTargetsAction: actions.targets }));

import AssignMemberPicker from "../AssignMemberPicker";

function setup(canAssignMembers = true) {
  const onAssign = vi.fn();
  const onDelegate = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <AssignMemberPicker workspaceId="ws1" assignedUserId="workflow:w1" canAssignMembers={canAssignMembers} onAssign={onAssign} onDelegate={onDelegate} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Atribuir para" }));
  return { onAssign, onDelegate };
}

function switchTo(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false });
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.targets.mockResolvedValue([
    { kind: "workflow", id: "w1", name: "Planilha de mensagens" },
    { kind: "agent", id: "a1", name: "Assistente virtual" },
  ]);
  actions.members.mockResolvedValue({ members: [{ userId: "u1", username: "Maria", departments: [{ id: "d1", name: "Atendimento" }] }], page: 1, totalPages: 1 });
});

describe("conversation assignment tabs", () => {
  it("separates workflows, agents and operators and preserves their assignment actions", async () => {
    const { onAssign, onDelegate } = setup();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Automações" })).toHaveAttribute("aria-selected", "true");
    await screen.findByRole("option", { name: /Planilha de mensagens/ });
    expect(screen.queryByRole("option", { name: "Assistente virtual" })).not.toBeInTheDocument();
    expect(actions.members).not.toHaveBeenCalled();
    switchTo("Agentes");
    expect(await screen.findByRole("option", { name: "Assistente virtual" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Planilha de mensagens/ })).not.toBeInTheDocument();
    switchTo("Operadores");
    expect(await screen.findByRole("option", { name: "Maria" })).toBeInTheDocument();
    expect(screen.getByText("Atendimento")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Assistente virtual" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Maria" }));
    expect(onAssign).toHaveBeenCalledWith("u1");
    expect(onDelegate).not.toHaveBeenCalled();
  });

  it("delegates the selected agent without assigning it as a human operator", async () => {
    const { onAssign, onDelegate } = setup();
    switchTo("Agentes");
    fireEvent.click(await screen.findByRole("option", { name: "Assistente virtual" }));
    expect(onDelegate).toHaveBeenCalledWith({ kind: "agent", id: "a1", name: "Assistente virtual" });
    expect(onAssign).not.toHaveBeenCalled();
  });

  it("searches the active category and preserves assignment permissions", async () => {
    setup(false);
    expect(screen.getByRole("tab", { name: "Operadores" })).toBeDisabled();
    switchTo("Agentes");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Assistente" } });
    await waitFor(() => expect(actions.targets).toHaveBeenCalledWith("Assistente"));
    expect(actions.members).not.toHaveBeenCalled();
  });

  it("shows a loading failure without offering cached operators", async () => {
    actions.members.mockResolvedValue({ members: [], page: 1, totalPages: 1, error: "unavailable" });
    setup();
    switchTo("Operadores");
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    expect(screen.queryByText("Nenhum resultado encontrado")).not.toBeInTheDocument();
  });
});
