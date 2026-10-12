import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";
import pt from "@/i18n/messages/pt.json";
import type { QueuedMessage } from "@/lib/aichat/queue";

import { QueuedMessages } from "./queued-messages";

const items: QueuedMessage[] = [
  { clientId: "c1", content: "use o azul", createdAt: "2026-10-10T12:00:00Z" },
  { clientId: "c2", content: "e o logo", createdAt: "2026-10-10T12:00:01Z", attachments: [{ mediaId: "m1", name: "logo.pdf", kind: "document" }] },
];

function show(locale: "pt" | "en", props: Partial<Parameters<typeof QueuedMessages>[0]> = {}) {
  const onRemove = vi.fn();
  const onSendNow = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "pt" ? pt : en}>
      <QueuedMessages items={items} streaming awaitingApproval={false} onRemove={onRemove} onSendNow={onSendNow} {...props} />
    </NextIntlClientProvider>,
  );
  return { onRemove, onSendNow };
}

afterEach(cleanup);

describe("QueuedMessages", () => {
  it("shows each waiting message as queued, in order, with a way to take it back", () => {
    const { onRemove } = show("pt");
    expect(screen.getByRole("region", { name: "Mensagens na fila" })).toBeTruthy();
    expect(screen.getAllByText("Na fila")).toHaveLength(2);
    expect(screen.getByText("use o azul")).toBeTruthy();
    expect(screen.getByText("logo.pdf")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Retirar da fila" })[1]);
    expect(onRemove).toHaveBeenCalledWith("c2");
    expect(screen.getByText("A Elo lê no próximo passo, sem parar o que está fazendo.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar agora" })).toBeNull();
  });

  it("offers to send the queue once Elo stopped", () => {
    const { onSendNow } = show("en", { streaming: false });
    expect(screen.getByText("Elo stopped. It goes with your next message.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send now" }));
    expect(onSendNow).toHaveBeenCalled();
  });

  it("says the queue waits for the approval card", () => {
    show("en", { streaming: false, awaitingApproval: true });
    expect(screen.getByText("Waiting for your answer on the approval card.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send now" })).toBeTruthy();
  });

  it("renders nothing without queued messages", () => {
    show("en", { items: [] });
    expect(screen.queryByRole("region")).toBeNull();
  });
});
