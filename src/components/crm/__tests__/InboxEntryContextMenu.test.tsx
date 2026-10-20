import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { InboxEntry } from "@/lib/conversations/types";

const granted = vi.hoisted(() => ({ value: new Set<string>() }));
const portfolio = vi.hoisted(() => ({
  conversationHoldingAction: vi.fn(),
  placeConversationAction: vi.fn(),
  removePortfolioEntryAction: vi.fn(),
  movePortfolioEntryAction: vi.fn(),
  placeLeadAction: vi.fn(),
  leadHoldingAction: vi.fn(),
  listPortfolioAction: vi.fn(),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: (resource: string, action: string) => granted.value.has(`${resource}:${action}`) }),
}));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "u-ana" } }) }));
vi.mock("@/app/actions/customer-portfolio", () => portfolio);
vi.mock("sonner", () => ({ toast }));

import { InboxEntryContextMenu, InboxEntryMenuButton, type InboxEntryMenuActions } from "../InboxEntryContextMenu";

const copy = pt.inboxMenu;

function entry(overrides: Partial<InboxEntry> = {}): InboxEntry {
  return {
    entry_id: "conv-1",
    entry_type: "whatsapp",
    lead_id: "l-1",
    lead_name: "Maria",
    lead_number: "5511987654321",
    stage: { stage_id: "s-lead", name: "Lead", color: "#111" },
    available_stages: [
      { stage_id: "s-lead", name: "Lead", color: "#111" },
      { stage_id: "s-won", name: "Ganho", color: "#222" },
    ],
    labels: [{ label_id: "lb-vip", name: "VIP", color: "#333" }],
    ...overrides,
  } as InboxEntry;
}

function renderMenu(actions: Partial<InboxEntryMenuActions> = {}, shown: InboxEntry = entry()) {
  const all: InboxEntryMenuActions = { onOpen: vi.fn(), ...actions };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (children: ReactNode) => (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  render(
    ui(
      <InboxEntryContextMenu entry={shown} actions={all}>
        <div data-testid="card">
          Maria
          <InboxEntryMenuButton />
        </div>
      </InboxEntryContextMenu>,
    ),
  );
  return all;
}

async function openMenu() {
  fireEvent.contextMenu(screen.getByTestId("card"));
  return screen.findByRole("menu");
}

async function openSub(name: string) {
  const trigger = await screen.findByRole("menuitem", { name });
  fireEvent.keyDown(trigger, { key: "ArrowRight" });
}

beforeEach(() => {
  granted.value = new Set();
  for (const action of Object.values(portfolio)) action.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
});

describe("InboxEntryContextMenu", () => {
  it("offers only opening the conversation to someone with no extra permission", async () => {
    const actions = renderMenu();
    await openMenu();

    expect(screen.getByRole("menuitem", { name: copy.open })).toBeInTheDocument();
    for (const absent of [copy.assign, copy.stage, copy.labels, copy.openLead, pt.customerPortfolio.conversation.add]) {
      expect(screen.queryByRole("menuitem", { name: absent })).not.toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("menuitem", { name: copy.open }));
    expect(actions.onOpen).toHaveBeenCalled();
  });

  it("starts selecting with this row from Selecionar, only where the list can select", async () => {
    const onSelectRow = vi.fn();
    renderMenu({ onSelectRow });
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: copy.select }));
    expect(onSelectRow).toHaveBeenCalled();
  });

  it("leaves Selecionar out where the list cannot select", async () => {
    renderMenu();
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: copy.select })).not.toBeInTheDocument();
  });

  it("opens from the visible button too, so the menu is discoverable without right click", async () => {
    renderMenu();
    fireEvent.click(screen.getByRole("button", { name: copy.more }));
    expect(await screen.findByRole("menuitem", { name: copy.open })).toBeInTheDocument();
  });

  it("lists only the stages the server says this conversation can move to", async () => {
    const onMoveStage = vi.fn();
    renderMenu({ onMoveStage });
    await openMenu();
    await openSub(copy.stage);

    const won = await screen.findByRole("menuitemradio", { name: "Ganho" });
    expect(screen.getByRole("menuitemradio", { name: "Lead" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
    fireEvent.click(won);
    expect(onMoveStage).toHaveBeenCalledWith("s-won");
  });

  it("hides the stage move when the server offers no stage", async () => {
    renderMenu({ onMoveStage: vi.fn() }, entry({ available_stages: [] }));
    await openMenu();
    expect(screen.queryByRole("menuitem", { name: copy.stage })).not.toBeInTheDocument();
  });

  it("toggles labels with the state the conversation has", async () => {
    const onToggleLabel = vi.fn();
    renderMenu({
      onToggleLabel,
      labels: [
        { id: "lb-vip", userId: "", name: "VIP", color: "#333", position: 0, createdAt: "", updatedAt: "" },
        { id: "lb-new", userId: "", name: "Novo", color: "#444", position: 1, createdAt: "", updatedAt: "" },
      ],
    });
    await openMenu();
    await openSub(copy.labels);

    fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "VIP" }));
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Novo" }));
    expect(onToggleLabel).toHaveBeenNthCalledWith(1, "lb-vip", true);
    expect(onToggleLabel).toHaveBeenNthCalledWith(2, "lb-new", false);
  });

  it("assigns to a member and marks who is online", async () => {
    const onAssignTo = vi.fn();
    renderMenu({
      onAssignTo,
      members: [{ userId: "u-bob", username: "Bob" }] as InboxEntryMenuActions["members"],
      onlineUserIds: new Set(["u-bob"]),
    });
    await openMenu();
    await openSub(copy.assign);

    const bob = await screen.findByRole("menuitemradio", { name: /Bob/ });
    expect(screen.getByLabelText(copy.online)).toBeInTheDocument();
    fireEvent.click(bob);
    expect(onAssignTo).toHaveBeenCalledWith("u-bob");
  });

  it("puts the customer in the operator's carteira from the menu", async () => {
    granted.value = new Set(["customer_portfolios:read", "customer_portfolios:use"]);
    portfolio.conversationHoldingAction.mockResolvedValue({ data: { subject: { kind: "lead", leadId: "l-1" }, entry: null }, error: null });
    portfolio.placeConversationAction.mockResolvedValue({
      data: { subject: { kind: "lead", leadId: "l-1" }, entry: { id: "e-1", holderId: "u-ana", subject: { kind: "lead", leadId: "l-1" }, addedAt: "", updatedAt: "" } },
      error: null,
    });
    renderMenu();
    await openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: pt.customerPortfolio.conversation.add }));
    await waitFor(() => expect(portfolio.placeConversationAction).toHaveBeenCalledWith("whatsapp", "conv-1", undefined));
  });

  it("leaves carteira and contact copy out of a group", async () => {
    granted.value = new Set(["customer_portfolios:read", "customer_portfolios:use"]);
    renderMenu({}, entry({ is_group: true }));
    await openMenu();

    expect(screen.queryByRole("menuitem", { name: copy.copyContact })).not.toBeInTheDocument();
    expect(portfolio.conversationHoldingAction).not.toHaveBeenCalled();
  });

  describe("personal marks", () => {
    const personalCopy = pt.crmInbox.menu;

    function personal(overrides: Partial<NonNullable<InboxEntryMenuActions["personal"]>> = {}): NonNullable<InboxEntryMenuActions["personal"]> {
      return {
        pinned: false,
        canMarkUnread: true,
        onTogglePin: vi.fn(),
        onMarkUnread: vi.fn(),
        ...overrides,
      };
    }

    it("pins and marks unread", async () => {
      const marks = personal();
      renderMenu({ personal: marks });
      await openMenu();

      fireEvent.click(screen.getByRole("menuitem", { name: personalCopy.pin }));
      expect(marks.onTogglePin).toHaveBeenCalled();
      await openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: personalCopy.markUnread }));
      expect(marks.onMarkUnread).toHaveBeenCalled();
    });

    it("unpins a pinned conversation", async () => {
      const marks = personal({ pinned: true });
      renderMenu({ personal: marks });
      await openMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: personalCopy.unpin }));
      expect(marks.onTogglePin).toHaveBeenCalled();
    });

    it("does not offer marking unread a row already marked unread", async () => {
      renderMenu({ personal: personal({ canMarkUnread: false }) });
      await openMenu();
      expect(screen.queryByRole("menuitem", { name: personalCopy.markUnread })).not.toBeInTheDocument();
    });
  });

  it("copies the contact in the readable format", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    renderMenu();
    await openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: copy.copyContact }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("+55 (11) 98765-4321"));
    expect(toast.success).toHaveBeenCalledWith(copy.copied);
  });
});
