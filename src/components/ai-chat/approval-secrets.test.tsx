import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { Approval } from "@/lib/aichat/types";

import type { UIMessage } from "@/lib/aichat/ui-message";

import { MessageBubble, useBubbleLabels } from "./message-list";

const message: UIMessage = {
  id: "m1",
  role: "assistant",
  content: "",
  createdAt: "",
  pending: {
    id: "act-1",
    toolName: "create_phone_line",
    fields: [{ key: "name", value: "Principal" }],
    secrets: [{ key: "password", label: "Senha da linha" }],
    status: "pending",
  },
};

function Bubble({ onApprove }: { onApprove: (id: string, approval?: Approval) => void }) {
  const labels = useBubbleLabels();
  return <MessageBubble elo message={message} live={false} onApprove={onApprove} onReject={vi.fn()} labels={labels} />;
}

function renderBubble(onApprove = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <Bubble onApprove={onApprove} />
    </NextIntlClientProvider>,
  );
  return onApprove;
}

describe("approval card with a protected field", () => {
  it("asks for the secret in a password field and never shows it in the summary", () => {
    renderBubble();
    const input = screen.getByLabelText("Senha") as HTMLInputElement;
    expect(input.type).toBe("password");
    expect(screen.getByText(/a Elo nunca vê nem guarda/)).toBeTruthy();
  });

  it("approves only once the secret is typed and hands it over with the approval", () => {
    const onApprove = renderBubble();
    const approve = screen.getByRole("button", { name: "Aprovar" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "s3nh4" } });
    expect(approve.disabled).toBe(false);
    fireEvent.click(approve);
    expect(onApprove).toHaveBeenCalledWith("act-1", { secrets: { password: "s3nh4" } });
  });
});
