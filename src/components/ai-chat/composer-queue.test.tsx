import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";
import pt from "@/i18n/messages/pt.json";

vi.mock("@/components/elevated-design/ai-model-selector", () => ({
  AIModelSelector: ({ disabled }: { disabled?: boolean }) => <div data-testid="model" data-disabled={String(!!disabled)} />,
}));
vi.mock("@/hooks/use-speech-recognition", () => ({
  useSpeechRecognition: () => ({ supported: false, listening: false, interim: "", start: vi.fn(), stop: vi.fn(), abort: vi.fn() }),
}));
vi.mock("@/lib/call-session/call-session-control", () => ({ useCallActive: () => false }));

import { Composer } from "./composer";
import type { ChatAttachments } from "./use-chat-attachments";

const files: ChatAttachments = { items: [], ready: [], uploading: false, error: null, add: vi.fn(), attach: vi.fn(), remove: vi.fn(), clear: vi.fn() };

function show(locale: "pt" | "en", streaming: boolean, input = "use o azul") {
  const onSend = vi.fn(() => true);
  const onStop = vi.fn();
  render(
    <NextIntlClientProvider locale={locale} messages={locale === "pt" ? pt : en}>
      <Composer
        docked
        input={input}
        setInput={vi.fn()}
        onSend={onSend}
        onStop={onStop}
        streaming={streaming}
        model="m"
        models={["m"]}
        pricing={[]}
        onModelChange={vi.fn()}
        error={null}
        showScrollDown={false}
        onScrollDown={vi.fn()}
        files={files}
      />
    </NextIntlClientProvider>,
  );
  return { onSend, onStop };
}

afterEach(cleanup);

describe("the composer while Elo works", () => {
  it("stays open: Enter queues the message and stop still stops", () => {
    const { onSend, onStop } = show("pt", true);
    const field = screen.getByRole("textbox");
    expect((field as HTMLTextAreaElement).disabled).toBe(false);
    expect(field.getAttribute("placeholder")).toBe("Escreva e a Elo lê no próximo passo");
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Colocar na fila" }));
    expect(onSend).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Parar" }));
    expect(onStop).toHaveBeenCalled();
    expect(screen.getByTestId("model").getAttribute("data-disabled")).toBe("true");
  });

  it("shows only stop while Elo works and nothing is typed", () => {
    show("en", true, "");
    expect(screen.queryByRole("button", { name: "Add to queue" })).toBeNull();
    expect(screen.getByRole("button", { name: en.aiChatPage.stop })).toBeTruthy();
  });

  it("sends normally when Elo is idle", () => {
    const { onSend } = show("en", false);
    fireEvent.click(screen.getByRole("button", { name: en.aiChatPage.send }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: en.aiChatPage.stop })).toBeNull();
  });
});
