import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { Approval, PendingAction } from "@/lib/aichat/types";
import type { UIMessage } from "@/lib/aichat/ui-message";

import { MessageBubble, useBubbleLabels } from "./message-list";

const campaignProposal: PendingAction = {
  id: "act-9",
  toolName: "create_campaign",
  fields: [
    { key: "name", value: "Black Friday" },
    { key: "risks", value: "O modelo não mostra ao lead como parar de receber mensagens." },
  ],
  choices: [{ key: "exit_risk_acknowledgement", kind: "exit_risk_acknowledgement" }],
  status: "pending",
};

function Bubble({ onApprove }: { onApprove: (id: string, approval?: Approval) => void }) {
  const labels = useBubbleLabels();
  const message: UIMessage = { id: "m1", role: "assistant", content: "", createdAt: "", pending: campaignProposal };
  return <MessageBubble elo message={message} live={false} onApprove={onApprove} onReject={vi.fn()} labels={labels} />;
}

function renderCard() {
  const onApprove = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <Bubble onApprove={onApprove} />
    </NextIntlClientProvider>,
  );
  return onApprove;
}

describe("approval card of a send whose template shows no exit", () => {
  it("lists the risks and approves only after the operator ticks the acknowledgement", () => {
    const onApprove = renderCard();
    expect(screen.getByText(pt.templateExit.risk.policy)).toBeInTheDocument();
    expect(screen.getByText(pt.templateExit.risk.lgpd)).toBeInTheDocument();
    const approve = screen.getByRole("button", { name: "Aprovar" });
    expect(approve).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: pt.templateExit.risk.confirm }));
    expect(approve).not.toBeDisabled();
    fireEvent.click(approve);
    expect(onApprove).toHaveBeenCalledWith("act-9", { choices: { exit_risk_acknowledgement: "acknowledged" } });
  });

  it("takes the tick back when the operator unticks it", () => {
    renderCard();
    const box = screen.getByRole("checkbox", { name: pt.templateExit.risk.confirm });
    fireEvent.click(box);
    fireEvent.click(box);
    expect(screen.getByRole("button", { name: "Aprovar" })).toBeDisabled();
  });
});
