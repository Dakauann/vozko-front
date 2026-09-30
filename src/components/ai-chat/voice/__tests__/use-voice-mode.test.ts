import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setCallActive } from "@/lib/call-session/call-session-control";
import { forgetLocalInstalls, LOCAL_POLL_MS, LOCAL_WAIT_LIMIT_MS } from "@/lib/voice/browser-speech";

import type { UIMessage } from "../../message-list";
import { useVoiceMode } from "../use-voice-mode";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static warmingUp = false;
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
    if (!FakeRecognition.warmingUp) this.onstart?.();
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

  hearPartial(text: string) {
    this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal: false, length: 1, 0: { transcript: text } } } });
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
  const stop = vi.fn();
  const view = renderHook((props: Props) => useVoiceMode({ ...props, lang: "pt-BR", send, stop }), {
    initialProps: { messages: [] as UIMessage[], streaming: false, error: null } as Props,
  });
  return { ...view, send, stop };
}

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.warmingUp = false;
  synthesis.queue = [];
  vi.stubGlobal("SpeechRecognition", FakeRecognition);
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
  vi.stubGlobal("speechSynthesis", synthesis);
});

afterEach(() => {
  act(() => setCallActive(false));
  forgetLocalInstalls();
  vi.useRealTimers();
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
    expect(liveRecognition()).toHaveLength(1);

    const asked = user("u1", "quantas conversas abertas?");
    rerender({ messages: [asked, reply("a1", "Hoje há 12. E", true)], streaming: true, error: null });
    expect(synthesis.said()).toEqual(["Hoje há 12."]);
    expect(result.current.phase).toBe("speaking");

    rerender({ messages: [asked, reply("a1", "Hoje há 12. E duas aguardam resposta", true)], streaming: false, error: null });
    expect(synthesis.said()).toEqual(["Hoje há 12.", "E duas aguardam resposta"]);

    act(() => synthesis.finishAll());
    expect(result.current.phase).toBe("listening");
    expect(liveRecognition()).toHaveLength(1);
  });

  it("says the microphone is starting, not thinking, until the browser starts listening", () => {
    FakeRecognition.warmingUp = true;
    const { result } = setup();
    act(() => result.current.enable());
    expect(result.current.phase).toBe("starting");
    act(() => FakeRecognition.instances[0].onstart?.());
    expect(result.current.phase).toBe("listening");
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

  it("waits for the offline speech pack and starts listening by itself", async () => {
    vi.useFakeTimers();
    let status = "downloading";
    class PackRecognition extends FakeRecognition {
      static available = vi.fn(() => Promise.resolve(status));
      static install = vi.fn(() => Promise.resolve(true));
      processLocally = false;
    }
    vi.stubGlobal("SpeechRecognition", PackRecognition);
    const { result } = setup();
    await act(async () => result.current.enable());
    act(() => liveRecognition()[0].fail("network"));
    expect(result.current.phase).toBe("downloading");
    expect(result.current.failure).toBeNull();

    status = "available";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOCAL_POLL_MS);
    });
    expect(result.current.phase).toBe("listening");
    expect((liveRecognition()[0] as PackRecognition).processLocally).toBe(true);
  });

  it("gives up after the wait limit and says the browser never finished", async () => {
    vi.useFakeTimers();
    class StuckRecognition extends FakeRecognition {
      static available = vi.fn(() => Promise.resolve("downloading"));
    }
    vi.stubGlobal("SpeechRecognition", StuckRecognition);
    const { result } = setup();
    await act(async () => result.current.enable());
    act(() => liveRecognition()[0].fail("network"));
    expect(result.current.phase).toBe("downloading");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOCAL_WAIT_LIMIT_MS + LOCAL_POLL_MS);
    });
    expect(result.current.phase).toBe("off");
    expect(result.current.failure).toBe("pack_stalled");
  });

  it("does not mistake its own voice for an interruption", () => {
    const { result, rerender, send, stop } = setup();
    act(() => result.current.enable());
    act(() => liveRecognition()[0].hear("quantas conversas abertas?"));
    const asked = user("u1", "quantas conversas abertas?");
    rerender({ messages: [asked, reply("a1", "Hoje você tem doze conversas abertas. ", true)], streaming: true, error: null });

    act(() => liveRecognition()[0].hearPartial("você tem doze conversas"));
    act(() => liveRecognition()[0].hear("você tem doze conversas abertas"));

    expect(synthesis.said()).toEqual(["Hoje você tem doze conversas abertas."]);
    expect(stop).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stops talking the moment the member speaks over it, then answers the new question", () => {
    const { result, rerender, send, stop } = setup();
    act(() => result.current.enable());
    act(() => liveRecognition()[0].hear("quantas conversas abertas?"));
    const asked = user("u1", "quantas conversas abertas?");
    rerender({ messages: [asked, reply("a1", "Hoje você tem doze conversas abertas. ", true)], streaming: true, error: null });

    act(() => liveRecognition()[0].hearPartial("espera, quero só as de hoje"));
    expect(synthesis.said()).toEqual([]);
    expect(stop).toHaveBeenCalled();

    act(() => liveRecognition()[0].hear("espera, quero só as de hoje"));
    expect(send).toHaveBeenCalledTimes(1);

    rerender({ messages: [asked, reply("a1", "Hoje você tem doze conversas abertas. Duas aguardam.", false)], streaming: false, error: null });
    expect(send).toHaveBeenLastCalledWith("espera, quero só as de hoje");
    expect(synthesis.said()).toEqual([]);
  });

  it("drops an answer that has not started yet when the member changes their mind", () => {
    const { result, rerender, send, stop } = setup();
    act(() => result.current.enable());
    act(() => liveRecognition()[0].hear("relatório do mês"));
    act(() => liveRecognition()[0].hear("cancela"));
    expect(send).toHaveBeenCalledTimes(1);

    const asked = user("u1", "relatório do mês");
    rerender({ messages: [asked, reply("a1", "Montando o relatório. ", true)], streaming: true, error: null });
    expect(stop).toHaveBeenCalled();
    expect(synthesis.said()).toEqual([]);

    rerender({ messages: [asked, reply("a1", "Montando o relatório. ", false)], streaming: false, error: null });
    expect(send).toHaveBeenLastCalledWith("cancela");
  });

  it("releases the microphone when turned off", () => {
    const { result } = setup();
    act(() => result.current.enable());
    act(() => result.current.disable());
    expect(result.current.phase).toBe("off");
    expect(liveRecognition()).toHaveLength(0);
  });
});
