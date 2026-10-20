import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Outbox, OutboxItem } from "@/lib/conversations/outbox";
import { useSendAndFinish } from "./use-send-and-finish";

function pending(requestId: string, state: OutboxItem["state"] = "pending"): OutboxItem {
  return {
    requestId,
    entryId: "e1",
    entryType: "whatsapp",
    payload: { kind: "text", text: "obrigado", signed: false },
    state,
    queuedAt: "2026-10-18T12:00:00Z",
  };
}

function setup() {
  const onFinish = vi.fn();
  const onAbandon = vi.fn();
  const view = renderHook(({ outbox }: { outbox: Outbox }) => useSendAndFinish({ outbox, onFinish, onAbandon }), {
    initialProps: { outbox: [] as Outbox },
  });
  return { ...view, onFinish, onAbandon };
}

describe("useSendAndFinish", () => {
  it("finishes the conversation only after the server accepted the message", () => {
    const { result, rerender, onFinish, onAbandon } = setup();

    act(() => {
      rerender({ outbox: [pending("r1")] });
      result.current("e1", "whatsapp");
    });
    expect(onFinish).not.toHaveBeenCalled();

    rerender({ outbox: [] });
    expect(onFinish).toHaveBeenCalledWith("e1", "whatsapp");
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onAbandon).not.toHaveBeenCalled();
  });

  it("leaves the conversation open when the send fails", () => {
    const { result, rerender, onFinish, onAbandon } = setup();

    act(() => {
      rerender({ outbox: [pending("r1")] });
      result.current("e1", "whatsapp");
    });
    rerender({ outbox: [pending("r1", "failed")] });
    rerender({ outbox: [] });

    expect(onFinish).not.toHaveBeenCalled();
    expect(onAbandon).toHaveBeenCalledTimes(1);
  });

  it("does not finish when nothing was queued", () => {
    const { result, onFinish, onAbandon } = setup();
    act(() => result.current("e1", "whatsapp"));
    expect(onFinish).not.toHaveBeenCalled();
    expect(onAbandon).toHaveBeenCalledTimes(1);
  });
});
