import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminActions = vi.hoisted(() => ({
  uploadNotificationImageAction: vi.fn(),
  createNotificationBroadcastAction: vi.fn(),
  listNotificationBroadcastsAction: vi.fn(),
  previewNotificationBroadcastAction: vi.fn(),
  listBroadcastRecipientsAction: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { role: "admin" } as { role: string } | null, isLoading: false }));

vi.mock("@/app/actions/admin-notifications", () => adminActions);
vi.mock("@/app/actions/workspace", () => ({ adminListAllWorkspacesAction: vi.fn(), adminListWorkspaceMembersAction: vi.fn() }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => auth }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/components/dashboard/DashboardPageHeader", () => ({
  DashboardPageHeader: ({ badge, description }: { badge: string; description: string }) => (
    <header>
      <h1>{badge}</h1>
      <p>{description}</p>
    </header>
  ),
}));
vi.mock("@/components/ui/access-denied", () => ({ AccessDenied: () => <p>access denied</p> }));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ptMessages from "@/i18n/messages/pt.json";

import AdminNotificationsPage from "./page";

const copy = ptMessages.adminNotifications;

const broadcasts = [
  {
    id: "b1",
    target: { all: true },
    audience: { kind: "managers" },
    category: "billing",
    severity: "critical",
    title: "Reajuste de tarifas",
    email: true,
    status: "completed",
    workspaceCount: 12,
    recipients: 1300,
    read: 520,
    createdAt: "2026-10-15T12:00:00Z",
  },
  {
    id: "b2",
    target: { all: false, workspaceIds: ["w1", "w2"] },
    audience: { kind: "everyone" },
    category: "announcements",
    severity: "info",
    title: "Painel novo",
    email: false,
    status: "queued",
    createdAt: "2026-10-16T12:00:00Z",
  },
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <AdminNotificationsPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("AdminNotificationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.user = { role: "admin" };
    adminActions.listNotificationBroadcastsAction.mockResolvedValue({ data: { items: broadcasts, next: "" } });
    adminActions.listBroadcastRecipientsAction.mockResolvedValue({
      data: { items: [{ userId: "u1", name: "Ana Souza", email: "ana@example.com", workspaceId: "w1", workspaceName: "Loja Centro" }], next: "" },
    });
  });

  it("is closed to anyone who is not a platform admin", () => {
    auth.user = { role: "user" };
    renderPage();

    expect(screen.getByText("access denied")).toBeInTheDocument();
    expect(adminActions.listNotificationBroadcastsAction).not.toHaveBeenCalled();
  });

  it("lists the broadcasts with target, audience, email and status", async () => {
    renderPage();

    const first = (await screen.findByText("Reajuste de tarifas")).closest("tr") as HTMLElement;
    expect(within(first).getByText(copy.target.all)).toBeInTheDocument();
    expect(within(first).getByText(copy.audience.managers)).toBeInTheDocument();
    expect(within(first).getByText(copy.email.on)).toBeInTheDocument();
    expect(within(first).getByText(copy.status.completed)).toBeInTheDocument();
    expect(within(first).getByText("12 workspaces alcançados")).toBeInTheDocument();

    const second = screen.getByText("Painel novo").closest("tr") as HTMLElement;
    expect(within(second).getByText("2 workspaces")).toBeInTheDocument();
    expect(within(second).getByText(copy.status.queued)).toBeInTheDocument();
  });

  it("explains an empty history", async () => {
    adminActions.listNotificationBroadcastsAction.mockResolvedValue({ data: { items: [], next: "" } });
    renderPage();

    expect(await screen.findByText(copy.empty.title)).toBeInTheDocument();
  });

  it("opens the composer from the header action", async () => {
    renderPage();
    await screen.findByText("Reajuste de tarifas");

    fireEvent.click(screen.getByRole("button", { name: copy.actions.compose }));

    expect(await screen.findByRole("dialog", { name: copy.compose.title })).toBeInTheDocument();
  });

  it("shows how many received each broadcast and how many read it", async () => {
    renderPage();

    const first = (await screen.findByText("Reajuste de tarifas")).closest("tr") as HTMLElement;
    expect(within(first).getByText("1.300")).toBeInTheDocument();
    expect(within(first).getByText("520")).toBeInTheDocument();
    expect(within(first).getByText("40%")).toBeInTheDocument();

    const second = screen.getByText("Painel novo").closest("tr") as HTMLElement;
    expect(within(second).getAllByText("n/d")).toHaveLength(2);
  });

  it("opens who read a broadcast when its row is clicked", async () => {
    renderPage();

    fireEvent.click((await screen.findByText("Reajuste de tarifas")).closest("tr") as HTMLElement);

    const sheet = await screen.findByRole("dialog", { name: copy.recipients.title });
    expect(await within(sheet).findByText("Ana Souza")).toBeInTheDocument();
    expect(adminActions.listBroadcastRecipientsAction).toHaveBeenCalledWith("b1", { status: "all", cursor: undefined, limit: 30 }, expect.any(AbortSignal));
  });
});

