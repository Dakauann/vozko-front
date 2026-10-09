import { describe, expect, it, vi } from "vitest";

import { dispatchStreamEvent } from "./chat-stream";

describe("dispatchStreamEvent", () => {
  it("passes the protected fields of a proposal through to the approval card", () => {
    const onProposal = vi.fn();
    dispatchStreamEvent(
      {
        type: "tool_proposal",
        payload: {
          id: "a2",
          toolName: "create_phone_line",
          fields: [{ key: "name", value: "Principal" }],
          secrets: [{ key: "password", label: "Senha da linha" }],
        },
      },
      { onProposal },
    );
    expect(onProposal).toHaveBeenCalledWith(expect.objectContaining({ secrets: [{ key: "password", label: "Senha da linha" }] }));
  });

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
describe("screen commands", () => {
  it("hands a well formed editor command to the screen handler", () => {
    const onScreenCommand = vi.fn();
    const payload = { id: "cmd-1", name: "edit", projectId: "p-1", args: { operations: [] } };
    dispatchStreamEvent({ type: "screen_command", payload: payload as never }, { onScreenCommand });
    expect(onScreenCommand).toHaveBeenCalledWith(payload);
  });

  it("drops a command the editor would not understand", () => {
    const onScreenCommand = vi.fn();
    dispatchStreamEvent({ type: "screen_command", payload: { id: "cmd-1", name: "click", projectId: "p-1" } as never }, { onScreenCommand });
    expect(onScreenCommand).not.toHaveBeenCalled();
  });
});
