import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminActions = vi.hoisted(() => ({
  uploadNotificationImageAction: vi.fn(),
  createNotificationBroadcastAction: vi.fn(),
  listNotificationBroadcastsAction: vi.fn(),
  previewNotificationBroadcastAction: vi.fn(),
  listBroadcastRecipientsAction: vi.fn(),
}));

vi.mock("@/app/actions/admin-notifications", () => adminActions);

import ptMessages from "@/i18n/messages/pt.json";
import type { Broadcast } from "@/lib/notifications/broadcast";

import { BroadcastRecipientsSheet } from "./broadcast-recipients-sheet";

const copy = ptMessages.adminNotifications.recipients;

const broadcast: Broadcast = {
  id: "b1",
  target: { all: true },
  audience: { kind: "everyone" },
  category: "billing",
  severity: "warning",
  title: "Reajuste de tarifas",
  recipients: 40,
  read: 10,
  createdAt: "2026-10-16T12:00:00Z",
};

const ana = { userId: "u1", name: "Ana Souza", email: "ana@example.com", workspaceId: "w1", workspaceName: "Loja Centro", readAt: "2026-10-16T12:05:00Z" };
const bia = { userId: "u2", name: "Bia Lima", email: "bia@example.com", workspaceId: "w2", workspaceName: "Loja Sul" };

function renderSheet(onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo" now={new Date("2026-10-16T12:10:00Z")}>
        <BroadcastRecipientsSheet broadcast={broadcast} onClose={onClose} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return screen.getByRole("dialog", { name: copy.title });
}

describe("BroadcastRecipientsSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminActions.listBroadcastRecipientsAction.mockResolvedValue({ data: { items: [ana, bia], next: "" } });
  });

  it("names the broadcast and how many read it", () => {
    const sheet = renderSheet();

    expect(within(sheet).getByText("Reajuste de tarifas")).toBeInTheDocument();
    expect(within(sheet).getByText("10 de 40 pessoas leram")).toBeInTheDocument();
    expect(within(sheet).getByText("25%")).toBeInTheDocument();
  });

  it("lists each person with email, workspace and when they read it", async () => {
    const sheet = renderSheet();

    const anaRow = (await within(sheet).findByText("Ana Souza")).closest("li") as HTMLElement;
    expect(within(anaRow).getByText("ana@example.com")).toBeInTheDocument();
    expect(within(anaRow).getByText("Loja Centro")).toBeInTheDocument();
    expect(within(anaRow).getByText("Lida há 5 minutos")).toBeInTheDocument();

    const biaRow = within(sheet).getByText("Bia Lima").closest("li") as HTMLElement;
    expect(within(biaRow).getByText("Loja Sul")).toBeInTheDocument();
    expect(within(biaRow).getByText(copy.unreadMark)).toBeInTheDocument();
  });

  it("filters by who read and who did not", async () => {
    const sheet = renderSheet();
    await within(sheet).findByText("Ana Souza");

    fireEvent.click(within(sheet).getByRole("button", { name: copy.unread }));

    expect(within(sheet).getByRole("button", { name: copy.unread })).toHaveAttribute("aria-pressed", "true");
    await vi.waitFor(() =>
      expect(adminActions.listBroadcastRecipientsAction).toHaveBeenCalledWith("b1", { status: "unread", cursor: undefined, limit: 30 }, expect.any(AbortSignal)),
    );
  });

  it("loads the next page by cursor", async () => {
    adminActions.listBroadcastRecipientsAction.mockResolvedValueOnce({ data: { items: [ana], next: "c2" } }).mockResolvedValueOnce({ data: { items: [bia], next: "" } });
    const sheet = renderSheet();
    await within(sheet).findByText("Ana Souza");

    fireEvent.click(within(sheet).getByRole("button", { name: ptMessages.adminNotifications.actions.loadMore }));

    expect(await within(sheet).findByText("Bia Lima")).toBeInTheDocument();
    expect(adminActions.listBroadcastRecipientsAction).toHaveBeenLastCalledWith("b1", { status: "all", cursor: "c2", limit: 30 }, expect.any(AbortSignal));
  });

  it("explains an empty filter", async () => {
    adminActions.listBroadcastRecipientsAction.mockResolvedValue({ data: { items: [], next: "" } });
    const sheet = renderSheet();
    await within(sheet).findByText(copy.emptyAllTitle);

    fireEvent.click(within(sheet).getByRole("button", { name: copy.read }));

    expect(await within(sheet).findByText(copy.emptyReadTitle)).toBeInTheDocument();
  });

  it("shows the coded failure with a retry", async () => {
    adminActions.listBroadcastRecipientsAction.mockResolvedValue({ error: "bad", status: 400, code: "notification_status_invalid" });
    const sheet = renderSheet();

    expect(await within(sheet).findByText(ptMessages.notifications.errors.notification_status_invalid)).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: ptMessages.metricsOps.common.retry })).toBeInTheDocument();
  });
});
