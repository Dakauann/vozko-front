import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
const workspaceActions = vi.hoisted(() => ({
  adminListAllWorkspacesAction: vi.fn(),
  adminListWorkspaceMembersAction: vi.fn(),
}));

vi.mock("@/app/actions/admin-notifications", () => adminActions);
vi.mock("@/app/actions/workspace", () => workspaceActions);
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ptMessages from "@/i18n/messages/pt.json";

import { BroadcastComposeDialog } from "./broadcast-compose-dialog";

const copy = ptMessages.adminNotifications.compose;
const errors = ptMessages.notifications.errors;

const created = {
  id: "b1",
  target: { all: true },
  audience: { kind: "everyone" },
  category: "announcements",
  severity: "info",
  title: "Manutenção",
  createdAt: "2026-10-16T12:00:00Z",
};

function renderDialog() {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <BroadcastComposeDialog onClose={onClose} onCreated={onCreated} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onClose, onCreated };
}

function typeTitle(value: string) {
  fireEvent.change(screen.getByLabelText(copy.titleField), { target: { value } });
}

describe("BroadcastComposeDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workspaceActions.adminListAllWorkspacesAction.mockResolvedValue({ workspaces: [], meta: { page: 1, pageSize: 20, totalPages: 1, totalItems: 0 } });
    adminActions.createNotificationBroadcastAction.mockResolvedValue({ data: created });
    adminActions.previewNotificationBroadcastAction.mockResolvedValue({ data: { workspaces: 12, recipients: 1300, people: 1234, emails: 980 } });
  });

  it("keeps the people audience locked until exactly one workspace is picked", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: copy.audienceUsers })).toBeDisabled();
    expect(screen.getByText(copy.audienceUsersLocked)).toBeInTheDocument();
  });

  it("previews the notification with the same item the bell shows", () => {
    renderDialog();

    typeTitle("Manutenção programada");

    const preview = screen.getByRole("region", { name: copy.preview });
    expect(within(preview).getByText("Manutenção programada")).toBeInTheDocument();
    expect(within(preview).getByText(ptMessages.notifications.categories.announcements)).toBeInTheDocument();
  });

  it("names what is missing instead of sending", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: copy.send }));

    expect(screen.getByText(errors.notification_target_invalid)).toBeInTheDocument();
    expect(screen.getByText(errors.notification_title_required)).toBeInTheDocument();
    expect(adminActions.createNotificationBroadcastAction).not.toHaveBeenCalled();
  });

  it("sends to every workspace and hands back the broadcast", async () => {
    const { onCreated } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: copy.targetAll }));
    typeTitle("  Manutenção  ");
    fireEvent.click(screen.getByRole("switch", { name: copy.email }));
    fireEvent.click(screen.getByRole("button", { name: copy.send }));

    await waitFor(() =>
      expect(adminActions.createNotificationBroadcastAction).toHaveBeenCalledWith({
        target: { all: true, workspaceIds: [] },
        audience: { kind: "everyone" },
        category: "announcements",
        severity: "info",
        title: "Manutenção",
        body: "",
        email: true,
      }),
    );
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("shows the coded refusal from the server", async () => {
    adminActions.createNotificationBroadcastAction.mockResolvedValue({ error: "bad", status: 400, code: "notification_image_foreign" });
    const { onCreated } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: copy.targetAll }));
    typeTitle("Manutenção");
    fireEvent.click(screen.getByRole("button", { name: copy.send }));

    expect(await screen.findByText(errors.notification_image_foreign)).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("refuses a large image before uploading and uploads a good one into the preview", async () => {
    adminActions.uploadNotificationImageAction.mockResolvedValue({ data: { url: "https://cdn.example.com/n.png" } });
    renderDialog();
    const input = screen.getByLabelText(copy.imageAdd, { selector: "input" });

    const huge = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(huge, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [huge] } });
    expect(screen.getByText(errors.notification_image_too_large)).toBeInTheDocument();
    expect(adminActions.uploadNotificationImageAction).not.toHaveBeenCalled();

    const good = new File(["x"], "n.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [good] } });

    await waitFor(() => expect(adminActions.uploadNotificationImageAction).toHaveBeenCalledWith(good));
    const preview = screen.getByRole("region", { name: copy.preview });
    await waitFor(() => expect(preview.querySelector("img")).toHaveAttribute("src", "https://cdn.example.com/n.png"));
  });

  it("waits for a complete form before asking who it reaches", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: copy.targetAll }));

    const reach = screen.getByRole("region", { name: copy.reach });
    expect(within(reach).getByText(copy.reachIncomplete)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(adminActions.previewNotificationBroadcastAction).not.toHaveBeenCalled();
  });

  it("shows who it will reach once the form is complete, asking once for the settled choices", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: copy.targetAll }));
    typeTitle("  Manutenção  ");
    fireEvent.click(screen.getByRole("switch", { name: copy.email }));

    const reach = screen.getByRole("region", { name: copy.reach });
    expect(within(reach).getByText(copy.reachLoading)).toBeInTheDocument();
    expect(await within(reach).findByText("Vai chegar para 1.234 pessoas em 12 workspaces")).toBeInTheDocument();
    expect(within(reach).getByText("980 por e-mail")).toBeInTheDocument();
    expect(adminActions.previewNotificationBroadcastAction).toHaveBeenCalledTimes(1);
    expect(adminActions.previewNotificationBroadcastAction).toHaveBeenCalledWith(
      {
        target: { all: true, workspaceIds: [] },
        audience: { kind: "everyone" },
        category: "announcements",
        severity: "info",
        title: "Manutenção",
        body: "",
        email: true,
      },
      expect.any(AbortSignal),
    );
  });

  it("leaves the email count out when the email is off", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: copy.targetAll }));
    typeTitle("Manutenção");

    const reach = screen.getByRole("region", { name: copy.reach });
    expect(await within(reach).findByText("Vai chegar para 1.234 pessoas em 12 workspaces")).toBeInTheDocument();
    expect(within(reach).queryByText("980 por e-mail")).not.toBeInTheDocument();
  });

  it("says when nobody would receive it", async () => {
    adminActions.previewNotificationBroadcastAction.mockResolvedValue({ data: { workspaces: 1, recipients: 0, people: 0, emails: 0 } });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: copy.targetAll }));
    typeTitle("Manutenção");

    expect(await screen.findByText(copy.reachNobody)).toBeInTheDocument();
  });

  it("explains a reach that could not be worked out and asks again on retry", async () => {
    adminActions.previewNotificationBroadcastAction.mockResolvedValue({ error: "bad", status: 400, code: "notification_target_invalid" });
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: copy.targetAll }));
    typeTitle("Manutenção");

    const reach = screen.getByRole("region", { name: copy.reach });
    expect(await within(reach).findByText(errors.notification_target_invalid)).toBeInTheDocument();
    adminActions.previewNotificationBroadcastAction.mockResolvedValue({ data: { workspaces: 12, recipients: 1300, people: 1234, emails: 980 } });
    fireEvent.click(within(reach).getByRole("button", { name: ptMessages.metricsOps.common.retry }));

    expect(await within(reach).findByText("Vai chegar para 1.234 pessoas em 12 workspaces")).toBeInTheDocument();
  });
});

