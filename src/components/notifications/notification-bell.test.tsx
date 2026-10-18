import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  listNotificationsAction: vi.fn(),
  getNotificationSummaryAction: vi.fn(),
  markNotificationsReadAction: vi.fn(),
  markNotificationsUnreadAction: vi.fn(),
  markAllNotificationsReadAction: vi.fn(),
  getNotificationPreferencesAction: vi.fn(),
  saveNotificationPreferencesAction: vi.fn(),
}));

vi.mock("@/app/actions/notifications", () => actions);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { toast } from "sonner";

import ptMessages from "@/i18n/messages/pt.json";
import { emitNotificationCreated } from "@/lib/notifications/bus";
import type { NotificationItem } from "@/lib/notifications/types";

import { NotificationBell } from "./notification-bell";

const copy = ptMessages.notifications;

function notification(id: string, category: NotificationItem["category"], readAt?: string): NotificationItem {
  return { id, category, severity: "info", title: `Título ${id}`, body: "", createdAt: "2026-10-16T12:00:00Z", ...(readAt ? { readAt } : {}) };
}

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo" now={new Date("2026-10-16T12:10:00Z")}>
        <NotificationBell />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function openPanel() {
  fireEvent.click(await screen.findByRole("button", { name: /Notificações/ }));
  return screen.findByRole("dialog");
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.getNotificationSummaryAction.mockResolvedValue({ data: { unread: 3, byCategory: { billing: 2, team: 1 }, capped: false } });
    actions.listNotificationsAction.mockResolvedValue({ data: { items: [notification("a", "billing"), notification("b", "team", "2026-10-16T12:01:00Z")], next: "" } });
    actions.markNotificationsReadAction.mockResolvedValue({ data: { updated: 1 } });
    actions.markAllNotificationsReadAction.mockResolvedValue({ data: { updated: 2 } });
  });

  it("shows the unread count on the bell", async () => {
    renderBell();

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notificações, 3 notificações não lidas" })).toBeInTheDocument();
  });

  it("folds a large count into 99+", async () => {
    actions.getNotificationSummaryAction.mockResolvedValue({ data: { unread: 1000, byCategory: {}, capped: true } });
    renderBell();

    expect(await screen.findByText("99+")).toBeInTheDocument();
  });

  it("refreshes the summary when opened and lists the notifications", async () => {
    renderBell();
    await screen.findByText("3");

    const panel = await openPanel();

    expect(await within(panel).findByText("Título a")).toBeInTheDocument();
    expect(actions.getNotificationSummaryAction).toHaveBeenCalledTimes(2);
    expect(actions.listNotificationsAction).toHaveBeenCalledWith({ category: undefined, unread: false, cursor: undefined, limit: 20 }, expect.any(AbortSignal));
  });

  it("filters by category with the unread count on each pill", async () => {
    renderBell();
    await screen.findByText("3");
    const panel = await openPanel();

    const billing = await within(panel).findByRole("button", { name: `${copy.categories.billing}, 2 não lidas` });
    fireEvent.click(billing);

    await waitFor(() =>
      expect(actions.listNotificationsAction).toHaveBeenLastCalledWith({ category: "billing", unread: false, cursor: undefined, limit: 20 }, expect.any(AbortSignal)),
    );
  });

  it("asks only for unread ones when the switch is on", async () => {
    renderBell();
    await screen.findByText("3");
    const panel = await openPanel();

    fireEvent.click(within(panel).getByRole("switch", { name: copy.panel.unreadOnly }));

    await waitFor(() =>
      expect(actions.listNotificationsAction).toHaveBeenLastCalledWith({ category: undefined, unread: true, cursor: undefined, limit: 20 }, expect.any(AbortSignal)),
    );
  });

  it("marks an unread item read when it is clicked", async () => {
    renderBell();
    await screen.findByText("3");
    const panel = await openPanel();

    fireEvent.click(await within(panel).findByText("Título a"));

    await waitFor(() => expect(actions.markNotificationsReadAction).toHaveBeenCalledWith(["a"]));
    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("marks all read within the active category", async () => {
    renderBell();
    await screen.findByText("3");
    const panel = await openPanel();

    fireEvent.click(await within(panel).findByRole("button", { name: `${copy.categories.billing}, 2 não lidas` }));
    fireEvent.click(within(panel).getByRole("button", { name: `Marcar ${copy.categories.billing} como lidas` }));

    await waitFor(() => expect(actions.markAllNotificationsReadAction).toHaveBeenCalledWith("billing"));
  });

  it("explains an empty inbox", async () => {
    actions.listNotificationsAction.mockResolvedValue({ data: { items: [], next: "" } });
    renderBell();
    await screen.findByText("3");
    const panel = await openPanel();

    expect(await within(panel).findByText(copy.panel.emptyTitle)).toBeInTheDocument();
  });

  it("shows the failure with a retry", async () => {
    actions.listNotificationsAction.mockResolvedValue({ error: "boom", status: 400 });
    renderBell();
    await screen.findByText("3");
    const panel = await openPanel();

    expect(await within(panel).findByText(copy.panel.loadFailed)).toBeInTheDocument();
  });

  it("prepends a pushed notification while open", async () => {
    renderBell();
    await screen.findByText("3");
    const panel = await openPanel();
    await within(panel).findByText("Título a");

    act(() => emitNotificationCreated({ workspaceId: "ws-1", item: notification("z", "system") }));

    expect(await within(panel).findByText("Título z")).toBeInTheDocument();
    expect(await screen.findByText("4")).toBeInTheDocument();
  });

  async function openPreferences() {
    renderBell();
    await screen.findByText("3");
    const panel = await openPanel();
    fireEvent.click(within(panel).getByRole("button", { name: copy.panel.preferences }));
    return panel;
  }

  it("switches email per category in the preferences, saying critical always emails", async () => {
    actions.getNotificationPreferencesAction.mockResolvedValue({ data: { categories: ["billing", "team"], emailMuted: ["team"], emailDigest: false } });
    actions.saveNotificationPreferencesAction.mockResolvedValue({ data: { categories: ["billing", "team"], emailMuted: ["team", "billing"], emailDigest: false } });
    const panel = await openPreferences();

    expect(await within(panel).findByText(copy.preferences.critical)).toBeInTheDocument();
    const billing = await within(panel).findByRole("switch", { name: `Receber ${copy.categories.billing} por e-mail` });
    const team = within(panel).getByRole("switch", { name: `Receber ${copy.categories.team} por e-mail` });
    expect(billing).toHaveAttribute("aria-checked", "true");
    expect(team).toHaveAttribute("aria-checked", "false");

    fireEvent.click(billing);

    await waitFor(() => expect(actions.saveNotificationPreferencesAction).toHaveBeenCalledWith({ emailMuted: ["team", "billing"], emailDigest: false }));
  });

  it("moves non critical emails into the daily summary, keeping the muted categories", async () => {
    actions.getNotificationPreferencesAction.mockResolvedValue({ data: { categories: ["billing", "team"], emailMuted: ["team"], emailDigest: false } });
    actions.saveNotificationPreferencesAction.mockResolvedValue({ data: { categories: ["billing", "team"], emailMuted: ["team"], emailDigest: true } });
    const panel = await openPreferences();

    const immediate = await within(panel).findByRole("button", { name: copy.preferences.deliveryImmediate });
    const digest = within(panel).getByRole("button", { name: copy.preferences.deliveryDigest });
    expect(immediate).toHaveAttribute("aria-pressed", "true");
    expect(within(panel).getByText(copy.preferences.deliveryImmediateHint)).toBeInTheDocument();

    fireEvent.click(digest);

    await waitFor(() => expect(digest).toHaveAttribute("aria-pressed", "true"));
    expect(within(panel).getByText(copy.preferences.deliveryDigestHint)).toBeInTheDocument();
    await waitFor(() => expect(actions.saveNotificationPreferencesAction).toHaveBeenCalledWith({ emailMuted: ["team"], emailDigest: true }));
    expect(within(panel).getByRole("button", { name: `Saiba mais sobre ${ptMessages.explainers.settings.notificationDigest.name}` })).toBeInTheDocument();
  });

  it("puts the delivery choice back and says so when saving fails", async () => {
    actions.getNotificationPreferencesAction.mockResolvedValue({ data: { categories: ["billing"], emailMuted: [], emailDigest: true } });
    actions.saveNotificationPreferencesAction.mockResolvedValue({ error: "down", status: 500 });
    const panel = await openPreferences();

    fireEvent.click(await within(panel).findByRole("button", { name: copy.preferences.deliveryImmediate }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(copy.preferences.saveFailed));
    expect(within(panel).getByRole("button", { name: copy.preferences.deliveryDigest })).toHaveAttribute("aria-pressed", "true");
  });
});
