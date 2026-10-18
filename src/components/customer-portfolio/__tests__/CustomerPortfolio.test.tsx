import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { PortfolioHolding, PortfolioRow } from "@/lib/customer-portfolio/portfolio";

const granted = vi.hoisted(() => ({ value: new Set<string>() }));
const actions = vi.hoisted(() => ({
  listPortfolioAction: vi.fn(),
  conversationHoldingAction: vi.fn(),
  leadHoldingAction: vi.fn(),
  placeConversationAction: vi.fn(),
  placeLeadAction: vi.fn(),
  movePortfolioEntryAction: vi.fn(),
  removePortfolioEntryAction: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: (resource: string, action: string) => granted.value.has(`${resource}:${action}`) }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-ana" } }) }));
vi.mock("@/app/actions/customer-portfolio", () => actions);
vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/dashboard/leads/portfolio",
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/explainers/ExplainerHint", () => ({ ExplainerHint: ({ id }: { id: string }) => <span data-explainer={id} /> }));
vi.mock("@/components/members/MemberCommandSelect", () => ({
  MemberCommandSelect: ({ text, leadingOptions = [], onChange }: { text: { label: string }; leadingOptions?: { value: string; label: string }[]; onChange: (value: string) => void }) => (
    <span data-member-select={text.label}>
      {leadingOptions.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </span>
  ),
}));

import { ConversationPortfolio } from "../ConversationPortfolio";
import { CustomerPortfolioPage } from "../CustomerPortfolioPage";
import { LeadPortfolioRow } from "../LeadPortfolioRow";

const copy = pt.customerPortfolio;
const operator = ["customer_portfolios:read", "customer_portfolios:use", "conversations:read", "leads:read"];
const manager = [...operator, "customer_portfolios:manage", "members:read"];

const igSubject = { kind: "contact", contactType: "instagram", contactId: "ig-1" } as const;

function entry(holderId: string, holderName: string) {
  return { id: "e-1", holderId, holderName, subject: igSubject, addedAt: "2026-10-18T12:00:00Z", updatedAt: "2026-10-18T12:00:00Z" };
}

function holding(held: ReturnType<typeof entry> | null): { data: PortfolioHolding; error: null } {
  return { data: { subject: igSubject, entry: held }, error: null };
}

function row(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    id: "e-1",
    holderId: "u-ana",
    holderName: "Ana",
    holderReceives: true,
    addedBy: "u-ana",
    addedByName: "Ana",
    subject: { kind: "lead", leadId: "l-1" },
    display: { name: "Maria Souza", number: "5511987654321" },
    addedAt: "2026-10-18T12:00:00Z",
    updatedAt: "2026-10-18T12:00:00Z",
    ...overrides,
  };
}

function page(items: PortfolioRow[]) {
  return { data: { items, page: 1, pageSize: 20, totalPages: 1, totalItems: items.length }, error: null };
}

function renderUi(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  granted.value = new Set(operator);
  for (const action of Object.values(actions)) action.mockReset();
  push.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
});

describe("ConversationPortfolio", () => {
  it("puts the customer of the conversation in the operator's carteira in one click", async () => {
    actions.conversationHoldingAction.mockResolvedValue(holding(null));
    actions.placeConversationAction.mockResolvedValue(holding(entry("u-ana", "Ana")));
    renderUi(<ConversationPortfolio entryType="instagram" entryId="conv-1" active />);

    fireEvent.click(await screen.findByRole("button", { name: copy.conversation.add }));

    await waitFor(() => expect(actions.placeConversationAction).toHaveBeenCalledWith("instagram", "conv-1", undefined));
    expect(toast.success).toHaveBeenCalledWith(copy.toast.placed);
  });

  it("shows the operator's own customer with a way out", async () => {
    actions.conversationHoldingAction.mockResolvedValue(holding(entry("u-ana", "Ana")));
    actions.removePortfolioEntryAction.mockResolvedValue({ data: true, error: null });
    renderUi(<ConversationPortfolio entryType="instagram" entryId="conv-1" active />);

    expect(await screen.findByText(copy.conversation.mine)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.conversation.remove }));
    await waitFor(() => expect(actions.removePortfolioEntryAction).toHaveBeenCalledWith("e-1"));
  });

  it("names a colleague's carteira and offers nothing to take it", async () => {
    actions.conversationHoldingAction.mockResolvedValue(holding(entry("u-bob", "Bob")));
    renderUi(<ConversationPortfolio entryType="instagram" entryId="conv-1" active />);

    expect(await screen.findByText("Carteira de Bob")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("stays out of the way for someone who cannot see carteiras", () => {
    granted.value = new Set(["conversations:read"]);
    const { container } = renderUi(<ConversationPortfolio entryType="instagram" entryId="conv-1" active />);

    expect(container).toBeEmptyDOMElement();
    expect(actions.conversationHoldingAction).not.toHaveBeenCalled();
  });

  it("explains a customer already taken by a colleague and lets a manager bring it over", async () => {
    granted.value = new Set(manager);
    actions.conversationHoldingAction.mockResolvedValue(holding(null));
    actions.placeConversationAction.mockResolvedValue({
      data: null,
      error: { code: "customer_portfolio_held_by_other", expected: { entryId: "e-9", holderId: "u-bob", holderName: "Bob" } },
    });
    actions.movePortfolioEntryAction.mockResolvedValue(holding(entry("u-ana", "Ana")));
    renderUi(<ConversationPortfolio entryType="instagram" entryId="conv-1" active />);

    fireEvent.click(await screen.findByRole("button", { name: copy.conversation.add }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [message, options] = toast.error.mock.calls[0];
    expect(message).toBe("Já está na carteira de Bob");
    expect(options.action.label).toBe(copy.toast.moveToMe);
    options.action.onClick();
    await waitFor(() => expect(actions.movePortfolioEntryAction).toHaveBeenCalledWith("e-9", "u-ana"));
  });

  it("offers an operator no move when a colleague holds the customer", async () => {
    actions.conversationHoldingAction.mockResolvedValue(holding(null));
    actions.placeConversationAction.mockResolvedValue({
      data: null,
      error: { code: "customer_portfolio_held_by_other", expected: { entryId: "e-9", holderId: "u-bob", holderName: "Bob" } },
    });
    renderUi(<ConversationPortfolio entryType="instagram" entryId="conv-1" active />);

    fireEvent.click(await screen.findByRole("button", { name: copy.conversation.add }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error.mock.calls[0][1].action).toBeUndefined();
  });
});

describe("LeadPortfolioRow", () => {
  it("tells whose carteira the lead is in and lets the operator add a free lead", async () => {
    actions.leadHoldingAction.mockResolvedValue({ data: { subject: { kind: "lead", leadId: "l-1" }, entry: null }, error: null });
    actions.placeLeadAction.mockResolvedValue({ data: { subject: { kind: "lead", leadId: "l-1" }, entry: entry("u-ana", "Ana") }, error: null });
    renderUi(<LeadPortfolioRow leadId="l-1" />);

    expect(await screen.findByText(copy.lead.none)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.lead.add }));
    await waitFor(() => expect(actions.placeLeadAction).toHaveBeenCalledWith("l-1", undefined));
  });
});

describe("CustomerPortfolioPage", () => {
  it("lists the operator's own carteira, with how each customer reaches them", async () => {
    actions.listPortfolioAction.mockResolvedValue(
      page([row(), row({ id: "e-2", subject: igSubject, display: { name: "Joana", handle: "joana.ig", channel: "instagram" } })]),
    );
    renderUi(<CustomerPortfolioPage />);

    expect(await screen.findByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("Joana")).toBeInTheDocument();
    expect(screen.getByText("@joana.ig")).toBeInTheDocument();
    expect(screen.getByText(copy.reach.lead)).toBeInTheDocument();
    expect(screen.getByText("Só pelo Instagram")).toBeInTheDocument();
    expect(actions.listPortfolioAction.mock.calls[0][0].scope).toEqual({ kind: "mine" });
    expect(screen.queryByText(copy.table.holder)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.scope.label)).not.toBeInTheDocument();
  });

  it("opens the lead from its row", async () => {
    actions.listPortfolioAction.mockResolvedValue(page([row()]));
    renderUi(<CustomerPortfolioPage />);

    fireEvent.click(await screen.findByText("Maria Souza"));
    expect(push).toHaveBeenCalledWith("/dashboard/leads/l-1");
  });

  it("gives managers the team scope, with the holder column and a mark on a holder who no longer receives", async () => {
    granted.value = new Set(manager);
    actions.listPortfolioAction.mockResolvedValue(page([row({ holderId: "u-bob", holderName: "Bob", holderReceives: false })]));
    renderUi(<CustomerPortfolioPage />);
    await screen.findByText("Maria Souza");

    fireEvent.click(screen.getByRole("button", { name: copy.scope.all }));

    await waitFor(() => expect(actions.listPortfolioAction).toHaveBeenLastCalledWith(expect.objectContaining({ scope: { kind: "all" }, page: 1 }), expect.anything()));
    expect(await screen.findByText(copy.table.holder)).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText(copy.dormant.label)).toBeInTheDocument();
  });

  it("explains an empty carteira with how to fill it", async () => {
    actions.listPortfolioAction.mockResolvedValue(page([]));
    renderUi(<CustomerPortfolioPage />);

    expect(await screen.findByText(copy.page.emptyMineTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.page.emptyMineDescription)).toBeInTheDocument();
  });

  it("lets the holder take a customer out after confirming", async () => {
    actions.listPortfolioAction.mockResolvedValue(page([row()]));
    actions.removePortfolioEntryAction.mockResolvedValue({ data: true, error: null });
    renderUi(<CustomerPortfolioPage />);

    fireEvent.pointerDown(await screen.findByRole("button", { name: "Ações de Maria Souza" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(await screen.findByRole("menuitem", { name: copy.actions.remove }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: copy.confirm.removeConfirm }));

    await waitFor(() => expect(actions.removePortfolioEntryAction).toHaveBeenCalledWith("e-1"));
  });
});
