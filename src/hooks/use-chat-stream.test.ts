import { describe, expect, it, vi } from "vitest";

import { dispatchStreamEvent } from "./use-chat-stream";

describe("dispatchStreamEvent", () => {
  it("keeps the readable fields of a proposal", () => {
    const onProposal = vi.fn();
    dispatchStreamEvent(
      {
        type: "tool_proposal",
        payload: {
          id: "a1",
          toolName: "create_template",
          summary: "create_template {}",
          fields: [{ key: "name", value: "refiliacao" }],
          preview: { kind: "whatsapp_template", data: { name: "refiliacao" } },
        },
      },
      { onProposal },
    );
    expect(onProposal).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a1", toolName: "create_template", fields: [{ key: "name", value: "refiliacao" }], preview: { kind: "whatsapp_template", data: { name: "refiliacao" } } }),
    );
  });

  it("passes action cards through", () => {
    const onCard = vi.fn();
    const card = { kind: "top_up_balance", balanceMicros: 5, subscriptionActive: true };
    dispatchStreamEvent({ type: "action_card", payload: card as never }, { onCard });
    expect(onCard).toHaveBeenCalledWith(card);
  });
});
