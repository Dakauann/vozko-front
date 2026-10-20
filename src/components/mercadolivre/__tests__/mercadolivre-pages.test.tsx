import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";
import type { MercadoLivreAccount, MercadoLivreConnectResult } from "@/lib/mercadolivre/types";
import { MERCADOLIVRE_CONNECT_ERRORS } from "@/lib/mercadolivre/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  can: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  search: { value: "" },
  connect: vi.fn(),
  onResult: { current: null as ((result: MercadoLivreConnectResult) => void) | null },
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

vi.mock("@/app/actions/mercadolivre", () => ({
  listMercadoLivreAccountsAction: mocks.list,
  disconnectMercadoLivreAccountAction: vi.fn(),
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: mocks.can }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search.value),
}));
vi.mock("@/hooks/use-mercadolivre-connect", () => ({
  useMercadoLivreConnect: (onResult: (result: MercadoLivreConnectResult) => void) => {
    mocks.onResult.current = onResult;
    return { connect: mocks.connect, isConnecting: false };
  },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge, actions }: { badge: string; actions?: ReactNode }) => (
    <header>
      <h1>{badge}</h1>
      {actions}
    </header>
  ),
}));

import { MercadoLivreAccountsList } from "@/components/mercadolivre/mercadolivre-accounts-list";
import { MercadoLivreConnectView } from "@/components/mercadolivre/mercadolivre-connect-view";

const pt = brandedMessages(rawPt);
const copy = pt.mercadolivre;
const META = { page: 1, pageSize: 15, totalPages: 1, totalItems: 3 };

function account(overrides: Partial<MercadoLivreAccount>): MercadoLivreAccount {
  return {
    id: "acc-1",
    workspaceId: "ws-1",
    mlUserId: "111",
    siteId: "MLB",
    nickname: "LOJA_A",
    status: "CONNECTED",
    needsReconnect: false,
    grantedScopes: [],
    canReadQuestions: true,
    canAnswerQuestions: true,
    canReadMessages: true,
    canSendMessages: true,
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
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mocks.list.mockReset();
  mocks.can.mockReset();
  mocks.replace.mockReset();
  mocks.connect.mockReset();
  mocks.toast.mockReset();
  mocks.toast.error.mockReset();
  mocks.search.value = "";
  mocks.can.mockReturnValue(true);
});

describe("MercadoLivreAccountsList", () => {
  const accounts = [
    account({ id: "acc-1", nickname: "LOJA_A" }),
    account({ id: "acc-2", nickname: "LOJA_B", status: "NEEDS_RECONNECT", needsReconnect: true }),
    account({ id: "acc-3", nickname: "LOJA_C", status: "DISCONNECTED", purgeAfter: "2026-11-18T15:00:00Z" }),
  ];

  it("lists accounts with status chips, the purge date and the reconnect notice", async () => {
    mocks.list.mockResolvedValue({ accounts, meta: META });
    wrap(<MercadoLivreAccountsList />);
    expect(await screen.findByText("LOJA_A")).toBeInTheDocument();
    expect(screen.getByText(copy.status.connected)).toBeInTheDocument();
    expect(screen.getByText(copy.status.needs_reconnect)).toBeInTheDocument();
    expect(screen.getByText(copy.status.disconnected)).toBeInTheDocument();
    expect(screen.getByText("Dados apagados em 18 de novembro de 2026")).toBeInTheDocument();
    expect(screen.getByText("1 conta precisa ser reconectada para voltar a receber mensagens.")).toBeInTheDocument();
  });

  it("reconnects from the row", async () => {
    mocks.list.mockResolvedValue({ accounts, meta: META });
    wrap(<MercadoLivreAccountsList />);
    const reconnects = await screen.findAllByRole("button", { name: copy.list.reconnect });
    expect(reconnects).toHaveLength(2);
    fireEvent.click(reconnects[0]);
    expect(mocks.connect).toHaveBeenCalledWith("/dashboard/mercadolivre-accounts");
  });

  it("shows the connect action only with the create permission", async () => {
    mocks.list.mockResolvedValue({ accounts: [], meta: { ...META, totalItems: 0 } });
    mocks.can.mockImplementation((_resource: string, action: string) => action !== "create");
    wrap(<MercadoLivreAccountsList />);
    expect(await screen.findByText(copy.list.emptyTitle)).toBeInTheDocument();
    expect(screen.queryByText(copy.list.connect)).not.toBeInTheDocument();
  });

  it("shows the connect action to whoever may create", async () => {
    mocks.list.mockResolvedValue({ accounts: [], meta: { ...META, totalItems: 0 } });
    wrap(<MercadoLivreAccountsList />);
    expect(await screen.findByText(copy.list.emptyTitle)).toBeInTheDocument();
    expect(screen.getAllByText(copy.list.connect).length).toBeGreaterThan(0);
  });

  it("reports the redirect fallback result and cleans the address", async () => {
    mocks.list.mockResolvedValue({ accounts: [], meta: META });
    mocks.search.value = "mercadolivre=error&reason=already_linked";
    wrap(<MercadoLivreAccountsList />);
    await act(async () => {});
    expect(mocks.toast.error).toHaveBeenCalledWith(copy.connect.errorTitle, { description: copy.connectError.already_linked });
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard/mercadolivre-accounts");
  });
});

describe("MercadoLivreConnectView", () => {
  it("lists the checklist the plan requires, with the brand name", () => {
    wrap(<MercadoLivreConnectView />);
    expect(screen.getByText(copy.connect.adminTitle)).toBeInTheDocument();
    for (const fact of Object.values(copy.connect.facts)) {
      expect(screen.getByText(fact.term)).toBeInTheDocument();
      expect(screen.getByText(fact.detail)).toBeInTheDocument();
    }
    expect(screen.getByText(/^A Acme pede as permissões/)).toBeInTheDocument();
  });

  it("starts the popup connect returning to the connect page", () => {
    wrap(<MercadoLivreConnectView />);
    fireEvent.click(screen.getByRole("button", { name: copy.connect.cta }));
    expect(mocks.connect).toHaveBeenCalledWith("/dashboard/mercadolivre-accounts/connect");
  });

  it.each(MERCADOLIVRE_CONNECT_ERRORS)("explains the %s connect error", (reason) => {
    wrap(<MercadoLivreConnectView />);
    act(() => mocks.onResult.current?.({ status: "error", reason }));
    expect(screen.getByText(copy.connectError[reason])).toBeInTheDocument();
  });

  it("confirms a connected account with links onward", () => {
    wrap(<MercadoLivreConnectView />);
    act(() => mocks.onResult.current?.({ status: "connected", nickname: "LOJA_A", accountId: "acc-1" }));
    expect(screen.getByText(copy.connect.successTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.connect.viewAccount }));
    expect(mocks.push).toHaveBeenCalledWith("/dashboard/mercadolivre-accounts/acc-1");
  });

  it("sends away whoever may not connect", () => {
    mocks.can.mockReturnValue(false);
    const { container } = wrap(<MercadoLivreConnectView />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.replace).toHaveBeenCalledWith("/dashboard/mercadolivre-accounts");
  });
});
