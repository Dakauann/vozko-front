import { describe, expect, it, vi } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

import { CHAT_STREAM_ERRORS, dispatchStreamEvent, isChatStreamError, providerBusyError, readChatStreamError } from "./chat-stream";

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

  it("hands a retry over with exactly what the dropped attempt showed", () => {
    const onRetry = vi.fn();
    dispatchStreamEvent({ type: "assistant_retry", payload: { attempt: 1, of: 3, text: "Vou mon", reasoning: "rascunho" } }, { onRetry });
    dispatchStreamEvent({ type: "assistant_retry", payload: { attempt: 2, of: 3 } }, { onRetry });
    expect(onRetry).toHaveBeenNthCalledWith(1, { text: "Vou mon", reasoning: "rascunho" });
    expect(onRetry).toHaveBeenNthCalledWith(2, { text: "", reasoning: "" });
  });

  it("hands the turn's go for a claimed change to the claim waiting for it, and drops a malformed one", () => {
    const onScreenGo = vi.fn();
    const signal = { id: "cmd-1", claimant: "5f1c1a9e-8f7a-4c1e-9d55-3c2b8f0e6a11" };
    dispatchStreamEvent({ type: "screen_go", payload: signal as never }, { onScreenGo });
    dispatchStreamEvent({ type: "screen_go", payload: { id: "cmd-1" } as never }, { onScreenGo });
    expect(onScreenGo).toHaveBeenCalledTimes(1);
    expect(onScreenGo).toHaveBeenCalledWith(signal);
  });

  it("drops a command the editor would not understand", () => {
    const onScreenCommand = vi.fn();
    dispatchStreamEvent({ type: "screen_command", payload: { id: "cmd-1", name: "click", projectId: "p-1" } as never }, { onScreenCommand });
    expect(onScreenCommand).not.toHaveBeenCalled();
  });
});

describe("stream errors", () => {
  it("reports a failed answer without a reason with a code the screen translates", () => {
    const onError = vi.fn();
    dispatchStreamEvent({ type: "error", payload: {} }, { onError });
    expect(onError).toHaveBeenCalledWith("reply_failed");
  });

  it("knows the code for a provider connection that kept dropping", () => {
    const onError = vi.fn();
    dispatchStreamEvent({ type: "error", payload: { error: "A conexão com o provedor de IA caiu.", code: "provider_unreachable" } }, { onError });
    expect(onError).toHaveBeenCalledWith("provider_unreachable");
    expect(isChatStreamError("provider_unreachable")).toBe(true);
  });

  it("carries how long to wait when the provider is at its limit, rounded up to whole minutes", () => {
    const cases: Array<[number | undefined, number]> = [
      [120, 2],
      [61, 2],
      [30, 1],
      [undefined, 0],
      [0, 0],
    ];
    for (const [retryAfterSeconds, minutes] of cases) {
      const onError = vi.fn();
      dispatchStreamEvent({ type: "error", payload: { error: "O provedor de IA está no limite.", code: "provider_busy", retryAfterSeconds } }, { onError });
      expect(readChatStreamError(onError.mock.calls[0][0])).toEqual({ code: "provider_busy", minutes });
    }
    expect(isChatStreamError("provider_busy")).toBe(true);
  });

  it("reads its own codes with no wait and leaves server text alone", () => {
    expect(readChatStreamError("provider_unreachable")).toEqual({ code: "provider_unreachable", minutes: 0 });
    expect(readChatStreamError(providerBusyError(180))).toEqual({ code: "provider_busy", minutes: 3 });
    expect(readChatStreamError("a Elo ainda está respondendo nesta conversa")).toBeNull();
    expect(readChatStreamError("provider_busy@soon")).toEqual({ code: "provider_busy", minutes: 0 });
  });

  it("knows the model refusal codes, including an unreadable model catalog", () => {
    for (const code of ["model_without_tools", "model_catalog_unavailable", "reasoning_level_unsupported"]) {
      const onError = vi.fn();
      dispatchStreamEvent({ type: "error", payload: { error: "recusado", code } }, { onError });
      expect(onError).toHaveBeenCalledWith(code);
      expect(isChatStreamError(code)).toBe(true);
    }
  });

  it("translates every code in every language", () => {
    for (const messages of [pt, en, es, de]) {
      for (const code of CHAT_STREAM_ERRORS) {
        expect(messages.aiChatPage.streamErrors[code]).toBeTruthy();
      }
    }
  });

  it("tells its own codes apart from messages the server wrote", () => {
    expect(CHAT_STREAM_ERRORS.every(isChatStreamError)).toBe(true);
    expect(isChatStreamError("a Elo ainda está respondendo nesta conversa")).toBe(false);
  });
});
