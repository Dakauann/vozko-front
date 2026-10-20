import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";
import type { MercadoLivreAccount } from "@/lib/mercadolivre/types";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  health: vi.fn(),
  disconnect: vi.fn(),
  panelProps: vi.fn(),
  departmentProps: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/app/actions/mercadolivre", () => ({
  updateMercadoLivreAccountAction: mocks.update,
  checkMercadoLivreAccountHealthAction: mocks.health,
  disconnectMercadoLivreAccountAction: mocks.disconnect,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/components/channels/channel-automation-panel", () => ({
  ChannelAutomationPanel: (props: Record<string, unknown>) => {
    mocks.panelProps(props);
    return <div data-testid="automation-panel" />;
  },
}));
vi.mock("@/components/dashboard/DepartmentAssignmentCard", () => ({
  DepartmentAssignmentCard: (props: Record<string, unknown>) => {
    mocks.departmentProps(props);
    return <div data-testid="department-card" />;
  },
}));

import { MercadoLivreAccountHeader } from "@/components/mercadolivre/mercadolivre-account-header";
import { MercadoLivreAccountNotices } from "@/components/mercadolivre/mercadolivre-account-notices";
import { MercadoLivreAutomationTab } from "@/components/mercadolivre/mercadolivre-automation-tab";
import { MercadoLivreDisconnectDialog } from "@/components/mercadolivre/mercadolivre-disconnect-dialog";

const ptMessages = brandedMessages(rawPt);
const copy = ptMessages.mercadolivre;

function account(overrides: Partial<MercadoLivreAccount> = {}): MercadoLivreAccount {
  return {
    id: "acc-1",
    workspaceId: "ws-1",
    mlUserId: "123456",
    siteId: "MLB",
    nickname: "LOJA_TESTE",
    status: "CONNECTED",
    needsReconnect: false,
    grantedScopes: ["offline_access", "read", "write"],
    canReadQuestions: true,
    canAnswerQuestions: true,
    canReadMessages: true,
    canSendMessages: false,
    enableAgentResponses: false,
    enableWorkflow: false,
    automationDisclosure: "",
    createdAt: "2026-10-19T10:00:00Z",
    updatedAt: "2026-10-19T10:00:00Z",
    ...overrides,
  };
}

function wrap(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  for (const fn of [mocks.update, mocks.health, mocks.disconnect, mocks.panelProps, mocks.departmentProps, mocks.toast, mocks.toast.error]) fn.mockReset();
});

describe("MercadoLivreAccountNotices", () => {
  it("asks for a reconnect with a button when allowed", () => {
    const onReconnect = vi.fn();
    wrap(<MercadoLivreAccountNotices account={account({ status: "NEEDS_RECONNECT", needsReconnect: true })} canReconnect onReconnect={onReconnect} reconnecting={false} />);
    expect(screen.getByText(copy.notice.reconnectTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.notice.reconnectAction }));
    expect(onReconnect).toHaveBeenCalled();
  });

  it("disables the reconnect without the permission and says why", () => {
    wrap(<MercadoLivreAccountNotices account={account({ status: "NEEDS_RECONNECT", needsReconnect: true })} canReconnect={false} onReconnect={vi.fn()} reconnecting={false} />);
    expect(screen.getByRole("button", { name: copy.notice.reconnectAction })).toBeDisabled();
    expect(screen.getByText(copy.notice.noConnectPermission)).toBeInTheDocument();
  });

  it("announces the purge date of a disconnected account", () => {
    wrap(<MercadoLivreAccountNotices account={account({ status: "DISCONNECTED", purgeAfter: "2026-11-18T15:00:00Z" })} canReconnect onReconnect={vi.fn()} reconnecting={false} />);
    expect(screen.getByText(copy.notice.purgeTitle)).toBeInTheDocument();
    expect(screen.getByText(/18 de novembro de 2026/)).toBeInTheDocument();
  });

  it("offers a reconnect on a disconnected account to cancel the purge", () => {
    const onReconnect = vi.fn();
    wrap(<MercadoLivreAccountNotices account={account({ status: "DISCONNECTED", purgeAfter: "2026-11-18T15:00:00Z" })} canReconnect onReconnect={onReconnect} reconnecting={false} />);
    fireEvent.click(screen.getByRole("button", { name: copy.notice.reconnectAction }));
    expect(onReconnect).toHaveBeenCalled();
  });

  it("offers a single reconnect on a revoked account awaiting purge", () => {
    wrap(
      <MercadoLivreAccountNotices
        account={account({ status: "REVOKED", needsReconnect: true, purgeAfter: "2026-11-18T15:00:00Z" })}
        canReconnect
        onReconnect={vi.fn()}
        reconnecting={false}
      />,
    );
    expect(screen.getAllByRole("button", { name: copy.notice.reconnectAction })).toHaveLength(1);
    expect(screen.getByText(copy.notice.purgeTitle)).toBeInTheDocument();
  });

  it("renders nothing for a healthy account", () => {
    const { container } = wrap(<MercadoLivreAccountNotices account={account()} canReconnect onReconnect={vi.fn()} reconnecting={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("MercadoLivreAccountHeader", () => {
  it("shows the nickname, status, seller, capabilities and when it was last checked", () => {
    wrap(<MercadoLivreAccountHeader account={account({ lastHealthCheckAt: "2026-10-19T13:00:00Z" })} canCheckHealth onUpdated={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "LOJA_TESTE" })).toBeInTheDocument();
    expect(screen.getByText(copy.status.connected)).toBeInTheDocument();
    expect(screen.getByText("Vendedor 123456")).toBeInTheDocument();
    for (const label of Object.values(copy.capability).filter((value) => value !== copy.capability.missingHint)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(copy.capability.canSendMessages).closest("[title]")).toHaveAttribute("title", copy.capability.missingHint);
    expect(screen.getByText(/Verificada em/)).toBeInTheDocument();
  });

  it("says when the account was never checked", () => {
    wrap(<MercadoLivreAccountHeader account={account()} canCheckHealth={false} onUpdated={vi.fn()} />);
    expect(screen.getByText(copy.account.neverChecked)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.account.checkHealth })).not.toBeInTheDocument();
  });

  it("runs the health check and hands back the fresh account", async () => {
    const fresh = account({ lastHealthCheckAt: "2026-10-19T14:00:00Z" });
    mocks.health.mockResolvedValue({ account: fresh });
    const onUpdated = vi.fn();
    wrap(<MercadoLivreAccountHeader account={account()} canCheckHealth onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole("button", { name: copy.account.checkHealth }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(fresh));
    expect(mocks.health).toHaveBeenCalledWith("acc-1");
  });

  it("explains a health check Mercado Livre did not answer", async () => {
    mocks.health.mockResolvedValue({ error: "down", code: "mercadolivre_unreachable", status: 502 });
    wrap(<MercadoLivreAccountHeader account={account()} canCheckHealth onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: copy.account.checkHealth }));
    expect(await screen.findByText(copy.errors.mercadolivre_unreachable)).toBeInTheDocument();
  });
});

describe("MercadoLivreAutomationTab", () => {
  it("offers only the agent, workflow and funnel panel, with no analysis, memory or staging toggles", () => {
    wrap(<MercadoLivreAutomationTab account={account()} canUpdate onUpdated={vi.fn()} />);
    const props = mocks.panelProps.mock.calls[0][0];
    expect(props.translationNamespace).toBe("mercadolivre.automation");
    expect(props.showHandling).toBeUndefined();
    expect(props.dealEntryType).toBeUndefined();
    expect(screen.getByTestId("department-card")).toBeInTheDocument();
  });

  it("saves panel changes through the account update, clearing with null", async () => {
    mocks.update.mockResolvedValue({ account: account({ agentId: null }) });
    wrap(<MercadoLivreAutomationTab account={account({ agentId: "agent-1" })} canUpdate onUpdated={vi.fn()} />);
    const { onSave } = mocks.panelProps.mock.calls[0][0] as { onSave: (id: string, payload: object) => Promise<unknown> };
    await onSave("acc-1", { agentId: null, enableAgentResponses: false });
    expect(mocks.update).toHaveBeenCalledWith("acc-1", { agentId: null, enableAgentResponses: false });
  });

  it("warns that Mercado Livre moderates automatic messages", () => {
    wrap(<MercadoLivreAutomationTab account={account()} canUpdate onUpdated={vi.fn()} />);
    expect(screen.getByText(copy.automation.moderationTitle)).toBeInTheDocument();
  });

  it("checks the disclosure against the Mercado Livre text rule while typing", () => {
    wrap(<MercadoLivreAutomationTab account={account()} canUpdate onUpdated={vi.fn()} />);
    const box = screen.getByPlaceholderText(copy.automation.disclosurePlaceholder);
    const save = screen.getByRole("button", { name: copy.automation.disclosureSave });
    fireEvent.change(box, { target: { value: "Atendimento “automático”" } });
    expect(screen.getByText("Este canal não aceita estes caracteres: “ ”. Troque ou remova para enviar.")).toBeInTheDocument();
    expect(save).toBeDisabled();
    fireEvent.change(box, { target: { value: "a".repeat(351) } });
    expect(screen.getByText("Texto longo demais: 351 de 350 caracteres permitidos neste canal.")).toBeInTheDocument();
    expect(save).toBeDisabled();
    fireEvent.change(box, { target: { value: "Você fala com um assistente." } });
    expect(screen.getByText("28/350")).toBeInTheDocument();
    expect(save).toBeEnabled();
  });

  it("maps a disclosure refusal from the backend to its copy", async () => {
    mocks.update.mockResolvedValue({ error: "bad", code: "text_charset", status: 400 });
    wrap(<MercadoLivreAutomationTab account={account()} canUpdate onUpdated={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(copy.automation.disclosurePlaceholder), { target: { value: "Olá" } });
    fireEvent.click(screen.getByRole("button", { name: copy.automation.disclosureSave }));
    expect(await screen.findByText(copy.errors.text_charset)).toBeInTheDocument();
    expect(mocks.update).toHaveBeenCalledWith("acc-1", { automationDisclosure: "Olá" });
  });

  it("leaves the department card out without the update permission", () => {
    wrap(<MercadoLivreAutomationTab account={account()} canUpdate={false} onUpdated={vi.fn()} />);
    expect(screen.queryByTestId("department-card")).not.toBeInTheDocument();
  });
});

describe("MercadoLivreDisconnectDialog", () => {
  it("states the 30 day purge before disconnecting", () => {
    wrap(<MercadoLivreDisconnectDialog account={account()} open onOpenChange={vi.fn()} onDisconnected={vi.fn()} />);
    expect(screen.getByText(/apagados em 30 dias/)).toBeInTheDocument();
    expect(screen.getByText(/para a Acme na hora/)).toBeInTheDocument();
  });

  it("disconnects and reports the purge date", async () => {
    mocks.disconnect.mockResolvedValue({ disconnected: { status: "disconnected", purgeAfter: "2026-11-18T15:00:00Z" } });
    const onDisconnected = vi.fn();
    wrap(<MercadoLivreDisconnectDialog account={account()} open onOpenChange={vi.fn()} onDisconnected={onDisconnected} />);
    fireEvent.click(screen.getByRole("button", { name: copy.disconnect.action }));
    await waitFor(() => expect(onDisconnected).toHaveBeenCalled());
    expect(mocks.toast).toHaveBeenCalledWith(copy.disconnect.title, {
      description: expect.stringContaining("18 de novembro de 2026"),
    });
  });

  it("warns when Mercado Livre did not confirm the revocation", async () => {
    mocks.disconnect.mockResolvedValue({
      disconnected: { status: "disconnected", purgeAfter: "2026-11-18T15:00:00Z", warning: "revoke_failed" },
    });
    wrap(<MercadoLivreDisconnectDialog account={account()} open onOpenChange={vi.fn()} onDisconnected={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: copy.disconnect.action }));
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(copy.disconnect.title, { description: copy.disconnect.revokeFailed }));
  });
});
