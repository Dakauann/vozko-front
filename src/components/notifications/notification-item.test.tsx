import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a data-locale-link href={href} {...rest}>
      {children}
    </a>
  ),
}));

import ptMessages from "@/i18n/messages/pt.json";
import type { NotificationItem } from "@/lib/notifications/types";

import { NotificationItemView } from "./notification-item";

const NOW = new Date("2026-10-16T12:05:00Z");

const base: NotificationItem = {
  id: "n1",
  category: "billing",
  severity: "info",
  title: "Fatura disponível",
  body: "A fatura de outubro já pode ser paga.",
  createdAt: "2026-10-16T12:00:00Z",
};

function show(item: NotificationItem, props: Partial<Parameters<typeof NotificationItemView>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <NotificationItemView item={item} now={NOW} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("NotificationItemView", () => {
  it("shows the title, body, category and how long ago it arrived", () => {
    show(base);

    expect(screen.getByText("Fatura disponível")).toBeInTheDocument();
    expect(screen.getByText("A fatura de outubro já pode ser paga.")).toBeInTheDocument();
    expect(screen.getByText(ptMessages.notifications.categories.billing)).toBeInTheDocument();
    expect(screen.getByText("há 5 minutos")).toBeInTheDocument();
  });

  it("marks an unread item and leaves a read one quiet", () => {
    const { rerender } = show(base);
    expect(screen.getByText(ptMessages.notifications.item.unread)).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <NotificationItemView item={{ ...base, readAt: "2026-10-16T12:01:00Z" }} now={NOW} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByText(ptMessages.notifications.item.unread)).not.toBeInTheDocument();
  });

  it("shows a solid severity chip only when the severity is not plain information", () => {
    const { rerender } = show(base);
    expect(screen.queryByText(ptMessages.notifications.severity.info)).not.toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <NotificationItemView item={{ ...base, severity: "critical" }} now={NOW} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(ptMessages.notifications.severity.critical)).toHaveClass("bg-destructive");
  });

  it("routes a relative action through the locale aware link and reports the click", () => {
    const onOpen = vi.fn();
    const onNavigate = vi.fn();
    show({ ...base, actionUrl: "/dashboard/invoices", actionLabel: "Ver faturas" }, { onOpen, onNavigate });

    const link = screen.getByRole("link", { name: "Ver faturas" });
    expect(link).toHaveAttribute("href", "/dashboard/invoices");
    expect(link).toHaveAttribute("data-locale-link");

    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "n1" }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("opens an https action in a new tab without the opener", () => {
    show({ ...base, actionUrl: "https://status.example.com" });

    const link = screen.getByRole("link", { name: new RegExp(ptMessages.notifications.item.open) });
    expect(link).toHaveAttribute("href", "https://status.example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).not.toHaveAttribute("data-locale-link");
  });

  it("renders no link for an action the backend would refuse", () => {
    show({ ...base, actionUrl: "javascript:alert(1)" });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("marks read when the row is clicked and toggles without opening", () => {
    const onOpen = vi.fn();
    const onToggleRead = vi.fn();
    show(base, { onOpen, onToggleRead });

    fireEvent.click(screen.getByRole("button", { name: ptMessages.notifications.item.markRead }));
    expect(onToggleRead).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Fatura disponível"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("offers mark unread on a read item", () => {
    show({ ...base, readAt: "2026-10-16T12:01:00Z" }, { onToggleRead: vi.fn() });

    expect(screen.getByRole("button", { name: ptMessages.notifications.item.markUnread })).toBeInTheDocument();
  });

  it("draws the image when there is one", () => {
    const { container } = show({ ...base, imageUrl: "https://cdn.example.com/n.png" });

    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn.example.com/n.png");
  });

  it("stays inert as a preview", () => {
    show({ ...base, actionUrl: "/dashboard", actionLabel: "Abrir painel" }, { preview: true });

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Abrir painel")).toBeInTheDocument();
  });
});
