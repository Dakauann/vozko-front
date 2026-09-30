import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { forgetLocalInstalls, LOCAL_CHECK_MS } from "@/lib/voice/browser-speech";

class LocalCapableRecognition {
  static instances: LocalCapableRecognition[] = [];
  static status: string | null = "available";
  static available = vi.fn(() =>
    LocalCapableRecognition.status === null ? new Promise<string>(() => {}) : Promise.resolve(LocalCapableRecognition.status),
  );
  static install = vi.fn(() => new Promise<boolean>(() => {}));
  lang = "";
  continuous = false;
  interimResults = false;
  processLocally = false;
  onstart: (() => void) | null = null;
  onresult = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    LocalCapableRecognition.instances.push(this);
  }
  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
  abort() {
    this.onend?.();
  }
}

function setup(onFailure = vi.fn()) {
  const view = renderHook(() => useSpeechRecognition({ lang: "pt-BR", continuous: false, onFinal: vi.fn(), onFailure }));
  return { ...view, onFailure };
}

afterEach(() => {
  LocalCapableRecognition.instances = [];
  LocalCapableRecognition.available.mockClear();
  LocalCapableRecognition.install.mockClear();
  forgetLocalInstalls();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useSpeechRecognition", () => {
  it("recognizes on the device when the language pack is there, so no audio leaves the computer", async () => {
    LocalCapableRecognition.status = "available";
    vi.stubGlobal("SpeechRecognition", LocalCapableRecognition);
    const { result } = setup();
    await act(async () => result.current.start());
    expect(LocalCapableRecognition.available).toHaveBeenCalledWith({ langs: ["pt-BR"], processLocally: true });
    expect(LocalCapableRecognition.instances[0].processLocally).toBe(true);
    expect(result.current.listening).toBe(true);
  });

  it("listens right away while the language pack downloads in the background, once", async () => {
    LocalCapableRecognition.status = "downloadable";
    vi.stubGlobal("SpeechRecognition", LocalCapableRecognition);
    const { result } = setup();
    await act(async () => result.current.start());
    expect(result.current.listening).toBe(true);
    expect(LocalCapableRecognition.instances[0].processLocally).toBe(false);
    await act(async () => result.current.abort());
    await act(async () => result.current.start());
    expect(LocalCapableRecognition.install).toHaveBeenCalledTimes(1);

    LocalCapableRecognition.status = "available";
    await act(async () => result.current.abort());
    await act(async () => result.current.start());
    expect(LocalCapableRecognition.instances.at(-1)?.processLocally).toBe(true);
  });

  it("does not wait on a browser that never answers the local check", async () => {
    vi.useFakeTimers();
    LocalCapableRecognition.status = null;
    vi.stubGlobal("SpeechRecognition", LocalCapableRecognition);
    const { result } = setup();
    act(() => result.current.start());
    expect(result.current.listening).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOCAL_CHECK_MS);
    });
    expect(result.current.listening).toBe(true);
    expect(LocalCapableRecognition.instances[0].processLocally).toBe(false);
  });

  it("explains a network failure while the offline pack is still downloading", async () => {
    LocalCapableRecognition.status = "downloading";
    vi.stubGlobal("SpeechRecognition", LocalCapableRecognition);
    const { result, onFailure } = setup();
    await act(async () => result.current.start());
    act(() => LocalCapableRecognition.instances[0].onerror?.({ error: "network" }));
    expect(onFailure).toHaveBeenCalledWith("installing");
  });

  it("stops claiming a download once the browser refuses to install the pack", async () => {
    LocalCapableRecognition.status = "downloadable";
    LocalCapableRecognition.install.mockImplementationOnce(() => Promise.resolve(false));
    vi.stubGlobal("SpeechRecognition", LocalCapableRecognition);
    const { result, onFailure } = setup();
    await act(async () => result.current.start());
    await act(async () => result.current.abort());
    await act(async () => result.current.start());
    act(() => LocalCapableRecognition.instances.at(-1)?.onerror?.({ error: "network" }));
    expect(onFailure).toHaveBeenLastCalledWith("network");
    await expect(result.current.waitForLocal()).resolves.toBe("failed");
  });

  it("does not start a stale attempt after being cancelled", async () => {
    LocalCapableRecognition.status = "available";
    vi.stubGlobal("SpeechRecognition", LocalCapableRecognition);
    const { result } = setup();
    await act(async () => {
      result.current.start();
      result.current.abort();
    });
    expect(LocalCapableRecognition.instances).toHaveLength(0);
    expect(result.current.listening).toBe(false);
  });
});
