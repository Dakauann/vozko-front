import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setCallActive } from "@/lib/call-session/call-session-control";

import type { UIMessage } from "../../message-list";
import { useVoiceMode } from "../use-voice-mode";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  running = false;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() {
    this.running = true;
    this.onstart?.();
  }

  stop() {
    this.end();
  }

  abort() {
    this.end();
  }

  end() {
    if (!this.running) return;
    this.running = false;
    this.onend?.();
  }

  hear(text: string) {
    this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: true, length: 1, 0: { transcript: text } } } });
    this.end();
  }

  fail(error: string) {
    this.onerror?.({ error });
    this.end();
  }
}

class FakeUtterance {
  text: string;
  lang = "";
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

const synthesis = {
  queue: [] as FakeUtterance[],
  speak(u: FakeUtterance) {
    this.queue.push(u);
  },
  cancel() {
    this.queue = [];
  },
  getVoices: () => [],
  finishAll() {
    const done = this.queue;
    this.queue = [];
    done.forEach((u) => u.onend?.());
  },
  said() {
    return this.queue.map((u) => u.text).filter(Boolean);
  },
};

function liveRecognition() {
  return FakeRecognition.instances.filter((r) => r.running);
}

function user(id: string, content: string): UIMessage {
  return { id, role: "user", content, createdAt: "" };
}

function reply(id: string, text: string, streaming: boolean): UIMessage {
  return { id, role: "assistant", content: "", createdAt: "", segments: [{ kind: "text", text, streaming }] };
}

type Props = { messages: UIMessage[]; streaming: boolean; error: string | null };

function setup(send = vi.fn(() => true)) {
  const view = renderHook((props: Props) => useVoiceMode({ ...props, lang: "pt-BR", send }), {
    initialProps: { messages: [] as UIMessage[], streaming: false, error: null } as Props,
  });
  return { ...view, send };
}

beforeEach(() => {
  FakeRecognition.instances = [];
  synthesis.queue = [];
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("speechSynthesis", synthesis);
});

afterEach(() => {
  act(() => setCallActive(false));
  vi.unstubAllGlobals();
});

describe("useVoiceMode", () => {
  it("listens, sends what was said, speaks the answer as it streams, then listens again", () => {
    const { result, rerender, send } = setup();
    expect(result.current.phase).toBe("off");

    act(() => result.current.enable());
    expect(result.current.phase).toBe("listening");

    act(() => liveRecognition()[0].hear("quantas conversas abertas?"));
    expect(send).toHaveBeenCalledWith("quantas conversas abertas?");
    expect(result.current.phase).toBe("thinking");
    expect(liveRecognition()).toHaveLength(0);

    const asked = user("u1", "quantas conversas abertas?");
    rerender({ messages: [asked, reply("a1", "Hoje há 12. E", true)], streaming: true, error: null });
    expect(synthesis.said()).toEqual(["Hoje há 12."]);
    expect(result.current.phase).toBe("speaking");

    rerender({ messages: [asked, reply("a1", "Hoje há 12. E duas aguardam resposta", true)], streaming: false, error: null });
    expect(synthesis.said()).toEqual(["Hoje há 12.", "E duas aguardam resposta"]);
    expect(liveRecognition()).toHaveLength(0);

    act(() => synthesis.finishAll());
    expect(result.current.phase).toBe("listening");
    expect(liveRecognition()).toHaveLength(1);
  });

  it("keeps listening when the chat refuses the message", () => {
    const { result } = setup(vi.fn(() => false));
    act(() => result.current.enable());
    act(() => liveRecognition()[0].hear("oi"));
    expect(result.current.phase).toBe("listening");
  });

  it("goes quiet during a phone call and resumes after it", () => {
    const { result, rerender } = setup();
    act(() => result.current.enable());
    act(() => liveRecognition()[0].hear("resuma"));
    rerender({ messages: [user("u1", "resuma"), reply("a1", "Primeiro ponto. ", true)], streaming: true, error: null });
    expect(synthesis.said()).toEqual(["Primeiro ponto."]);

    act(() => setCallActive(true));
    expect(result.current.phase).toBe("paused");
    expect(synthesis.said()).toEqual([]);
    expect(liveRecognition()).toHaveLength(0);

    rerender({ messages: [user("u1", "resuma"), reply("a1", "Primeiro ponto. Segundo.", false)], streaming: false, error: null });
    expect(liveRecognition()).toHaveLength(0);

    act(() => setCallActive(false));
    expect(result.current.phase).not.toBe("paused");
  });

  it("stops and explains when the microphone is blocked", () => {
    const { result } = setup();
    act(() => result.current.enable());
    act(() => liveRecognition()[0].fail("not-allowed"));
    expect(result.current.phase).toBe("off");
    expect(result.current.failure).toBe("blocked");
    expect(liveRecognition()).toHaveLength(0);
  });

  it("keeps waiting for speech through silence", () => {
    const { result } = setup();
    act(() => result.current.enable());
    act(() => liveRecognition()[0].fail("no-speech"));
    expect(result.current.phase).toBe("listening");
    expect(liveRecognition()).toHaveLength(1);
  });

  it("skips the rest of a reply and listens again", () => {
    const { result, rerender } = setup();
    act(() => result.current.enable());
    act(() => liveRecognition()[0].hear("detalhe tudo"));
    rerender({ messages: [user("u1", "x"), reply("a1", "Um. ", true)], streaming: true, error: null });
    act(() => result.current.skip());
    rerender({ messages: [user("u1", "x"), reply("a1", "Um. Dois. Três.", false)], streaming: false, error: null });
    expect(synthesis.said()).toEqual([]);
    expect(result.current.phase).toBe("listening");
  });

  it("releases the microphone when turned off", () => {
    const { result } = setup();
    act(() => result.current.enable());
    act(() => result.current.disable());
    expect(result.current.phase).toBe("off");
    expect(liveRecognition()).toHaveLength(0);
  });
});
