import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";

vi.mock("@/components/elevated-design/ai-model-selector", () => ({
  AIModelSelector: ({ variant }: { variant?: string }) => <button type="button" data-testid="model" data-variant={variant}>model</button>,
}));
vi.mock("@/hooks/use-speech-recognition", () => ({
  useSpeechRecognition: () => ({ supported: true, listening: false, interim: "", start: vi.fn(), stop: vi.fn(), abort: vi.fn() }),
}));
vi.mock("@/lib/call-session/call-session-control", () => ({ useCallActive: () => false }));

import { Composer } from "./composer";
import type { ChatAttachments } from "./use-chat-attachments";
import type { VoiceMode } from "./voice/use-voice-mode";

const HEIGHT_KEY = "assistant-composer:height";
const t = en.aiChatPage;

let contentHeight = 44;

function emptyFiles(): ChatAttachments {
  return { items: [], ready: [], uploading: false, error: null, add: vi.fn(), attach: vi.fn(), remove: vi.fn(), clear: vi.fn() };
}

function voiceMode(): VoiceMode {
  return { supported: true, phase: "off", interim: "", failure: null, enable: vi.fn(), disable: vi.fn(), skip: vi.fn() };
}

type Props = ComponentProps<typeof Composer>;

function props(overrides: Partial<Props> = {}): Props {
  return {
    docked: true,
    input: "",
    setInput: vi.fn(),
    onSend: vi.fn(() => true),
    onStop: vi.fn(),
    streaming: false,
    model: "m",
    models: ["m"],
    pricing: [],
    onModelChange: vi.fn(),
    error: null,
    showScrollDown: false,
    onScrollDown: vi.fn(),
    files: emptyFiles(),
    ...overrides,
  };
}

function mount(overrides: Partial<Props> = {}) {
  const all = props(overrides);
  const view = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Composer {...all} />
    </NextIntlClientProvider>,
  );
  const rerender = (next: Partial<Props>) =>
    view.rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <Composer {...all} {...next} />
      </NextIntlClientProvider>,
    );
  return { ...all, rerender, field: screen.getByRole("textbox") as HTMLTextAreaElement, handle: screen.getByRole("separator", { name: t.resizeComposer }) };
}

beforeEach(() => {
  contentHeight = 44;
  localStorage.clear();
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 900 });
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", { configurable: true, get: () => contentHeight });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("composer size", () => {
  it("opens three lines tall", { timeout: 15_000 }, () => {
    const { field, handle } = mount();
    expect(field.style.height).toBe("92px");
    expect(handle.getAttribute("aria-valuenow")).toBe("92");
    expect(handle.getAttribute("aria-valuemin")).toBe("68");
    expect(handle.getAttribute("aria-valuemax")).toBe("450");
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("grows with the text up to the cap, then scrolls inside", () => {
    const { field, rerender } = mount();
    contentHeight = 150;
    rerender({ input: "a\nb\nc\nd\ne" });
    expect(field.style.height).toBe("150px");
    contentHeight = 2000;
    rerender({ input: "a long draft".repeat(200) });
    expect(field.style.height).toBe("260px");
    expect(field.className).toContain("overflow-y-auto");
    contentHeight = 44;
    rerender({ input: "" });
    expect(field.style.height).toBe("92px");
  });

  it("resizes by dragging its top edge and remembers the height", () => {
    const { field, handle } = mount();
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 600 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 500 });
    expect(field.style.height).toBe("192px");
    expect(localStorage.getItem(HEIGHT_KEY)).toBeNull();
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(localStorage.getItem(HEIGHT_KEY)).toBe("192");
    expect(handle.getAttribute("aria-valuenow")).toBe("192");
  });

  it("stops at its limits while dragging", () => {
    const { field, handle } = mount();
    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 600 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 0 });
    expect(field.style.height).toBe("450px");
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 900 });
    expect(field.style.height).toBe("68px");
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(localStorage.getItem(HEIGHT_KEY)).toBe("68");
  });

  it("resizes one line at a time with the arrow keys", () => {
    const { field, handle } = mount();
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(field.style.height).toBe("116px");
    expect(localStorage.getItem(HEIGHT_KEY)).toBe("116");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(field.style.height).toBe("68px");
    expect(handle).toHaveFocus();
  });

  it("opens at the height the person chose before", () => {
    localStorage.setItem(HEIGHT_KEY, "200");
    const { field } = mount();
    expect(field.style.height).toBe("200px");
  });

  it("ignores a remembered height that is not a number", () => {
    localStorage.setItem(HEIGHT_KEY, "tall");
    const { field } = mount();
    expect(field.style.height).toBe("92px");
  });

  it("still works when the browser refuses storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { field, handle } = mount();
    expect(field.style.height).toBe("92px");
    expect(() => {
      fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientY: 600 });
      fireEvent.pointerMove(handle, { pointerId: 1, clientY: 552 });
      fireEvent.pointerUp(handle, { pointerId: 1 });
      fireEvent.keyDown(handle, { key: "ArrowUp" });
    }).not.toThrow();
    expect(field.style.height).toBe("164px");
  });

  it("refits when the window gets shorter", () => {
    const { field } = mount();
    contentHeight = 2000;
    act(() => {
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 400 });
      window.dispatchEvent(new Event("resize"));
    });
    expect(field.style.height).toBe("200px");
  });
});

describe("composer toolbar", () => {
  it("puts the tools on the left and send on the right of one centered row", () => {
    const { field } = mount({ input: "hello", voice: voiceMode() });
    const bar = screen.getByRole("group", { name: t.composerTools });
    expect(bar.className).toContain("items-center");
    const names = within(bar)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names).toEqual([t.attachments.add, t.voice.dictate, t.voice.mode, "model", t.send]);
    for (const name of [t.attachments.add, t.voice.dictate, t.voice.mode, t.send]) {
      const button = within(bar).getByRole("button", { name });
      expect(button.className).toContain("h-8");
      expect(button.className).toContain("w-8");
    }
    expect(screen.getByTestId("model").dataset.variant).toBe("toolbar");
    expect(bar.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("swaps send for stop in the same place while Elo works", () => {
    mount({ streaming: true });
    const bar = screen.getByRole("group", { name: t.composerTools });
    const buttons = within(bar).getAllByRole("button");
    expect(buttons.at(-1)?.getAttribute("aria-label")).toBe(t.stop);
    expect(buttons.at(-1)?.className).toContain("h-8");
  });
});

describe("composer behavior", () => {
  it("sends on Enter and adds a line on Shift+Enter", () => {
    const { field, onSend } = mount({ input: "hello" });
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("keeps the textbox named by its placeholder", () => {
    mount({ placeholder: "Ask Elo" });
    expect(screen.getByRole("textbox", { name: "Ask Elo" })).toBeTruthy();
  });

  it("lists attachments with their remove buttons and opens the file picker", () => {
    const files = { ...emptyFiles(), items: [{ key: "k1", name: "report.pdf", uploading: false, attachment: { mediaId: "1", name: "report.pdf", kind: "document" as const } }] };
    mount({ files, input: "see this" });
    fireEvent.click(screen.getByRole("button", { name: t.attachments.remove.replace("{name}", "report.pdf") }));
    expect(files.remove).toHaveBeenCalledWith("k1");
    const picker = document.querySelector<HTMLInputElement>('input[type="file"]');
    const click = vi.spyOn(picker as HTMLInputElement, "click");
    fireEvent.click(screen.getByRole("button", { name: t.attachments.add }));
    expect(click).toHaveBeenCalled();
  });

  it("turns voice mode on from the toolbar", () => {
    const voice = voiceMode();
    mount({ voice });
    fireEvent.click(screen.getByRole("button", { name: t.voice.mode }));
    expect(voice.enable).toHaveBeenCalled();
  });

  it("stops Elo from the toolbar", () => {
    const { onStop } = mount({ streaming: true });
    fireEvent.click(screen.getByRole("button", { name: t.stop }));
    expect(onStop).toHaveBeenCalled();
  });
});

describe("composer copy", () => {
  it("names the new controls in every locale", () => {
    for (const messages of [pt, en, es, de]) {
      expect(messages.aiChatPage.resizeComposer).toBeTruthy();
      expect(messages.aiChatPage.composerTools).toBeTruthy();
    }
  });
});
