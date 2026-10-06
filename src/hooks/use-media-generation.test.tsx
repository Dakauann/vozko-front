import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaGenerationJob } from "@/lib/media-generation/types";

const requestMediaGeneration = vi.fn();
const getMediaGeneration = vi.fn();
vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: (...args: unknown[]) => requestMediaGeneration(...args),
  getMediaGenerationAction: (...args: unknown[]) => getMediaGeneration(...args),
}));

import { useMediaGeneration } from "./use-media-generation";

function job(overrides: Partial<MediaGenerationJob> = {}): MediaGenerationJob {
  return {
    id: "job-1",
    kind: "image",
    status: "queued",
    prompt: "a red bike",
    aspect: "square",
    referenceMediaIds: [],
    createdAt: "2026-10-02T10:00:00Z",
    updatedAt: "2026-10-02T10:00:00Z",
    ...overrides,
  };
}

const finished = job({ status: "done", mediaId: "m1", mediaUrl: "https://cdn/m1.png" });

let visibility: DocumentVisibilityState = "visible";

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function startGeneration() {
  const hook = renderHook(() => useMediaGeneration());
  await act(async () => {
    await hook.result.current.start({ kind: "image", model: "openai/gpt-image-2", prompt: "a red bike", aspect: "square" });
  });
  return hook;
}

describe("useMediaGeneration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    requestMediaGeneration.mockReset();
    getMediaGeneration.mockReset();
    requestMediaGeneration.mockResolvedValue({ data: job() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls with a growing delay until the job is done", async () => {
    getMediaGeneration
      .mockResolvedValueOnce({ data: job({ status: "running" }) })
      .mockResolvedValueOnce({ data: job({ status: "running" }) })
      .mockResolvedValueOnce({ data: finished });
    const { result } = await startGeneration();

    expect(requestMediaGeneration).toHaveBeenCalledWith({ kind: "image", model: "openai/gpt-image-2", prompt: "a red bike", aspect: "square" });
    expect(result.current.status).toBe("generating");

    await advance(1_499);
    expect(getMediaGeneration).toHaveBeenCalledTimes(0);
    await advance(1);
    expect(getMediaGeneration).toHaveBeenCalledTimes(1);
    expect(getMediaGeneration).toHaveBeenCalledWith("job-1");

    await advance(2_249);
    expect(getMediaGeneration).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(getMediaGeneration).toHaveBeenCalledTimes(2);

    await advance(3_375);
    expect(getMediaGeneration).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("done");
    expect(result.current.result).toEqual({ mediaId: "m1", mediaUrl: "https://cdn/m1.png" });

    await advance(30_000);
    expect(getMediaGeneration).toHaveBeenCalledTimes(3);
  });

  it("calls onDone with the generated image", async () => {
    getMediaGeneration.mockResolvedValueOnce({ data: finished });
    const onDone = vi.fn();
    const { result } = renderHook(() => useMediaGeneration({ onDone }));
    await act(async () => {
      await result.current.start({ kind: "image", model: "openai/gpt-image-2", prompt: "a red bike", aspect: "portrait" });
    });
    await advance(1_500);

    expect(onDone).toHaveBeenCalledWith({ mediaId: "m1", mediaUrl: "https://cdn/m1.png" });
  });

  it("settles without polling when the started job is already done", async () => {
    requestMediaGeneration.mockResolvedValue({ data: finished });
    const { result } = await startGeneration();

    expect(result.current.status).toBe("done");
    await advance(10_000);
    expect(getMediaGeneration).not.toHaveBeenCalled();
  });

  it("stops on a failed job and reports its code", async () => {
    getMediaGeneration.mockResolvedValueOnce({ data: job({ status: "failed", failureCode: "generation_failed" }) });
    const { result } = await startGeneration();
    await advance(1_500);

    expect(result.current.status).toBe("failed");
    expect(result.current.error?.code).toBe("generation_failed");
    await advance(30_000);
    expect(getMediaGeneration).toHaveBeenCalledTimes(1);
  });

  it("fails a done job that has no media", async () => {
    getMediaGeneration.mockResolvedValueOnce({ data: job({ status: "done" }) });
    const { result } = await startGeneration();
    await advance(1_500);

    expect(result.current.status).toBe("failed");
    expect(result.current.error?.code).toBe("missing_media");
  });

  it("reports the server code when the request is refused", async () => {
    requestMediaGeneration.mockResolvedValue({ error: "Saldo insuficiente", code: "insufficient_balance", status: 402 });
    const { result } = await startGeneration();

    expect(result.current.status).toBe("failed");
    expect(result.current.error).toEqual({ code: "insufficient_balance", message: "Saldo insuficiente" });
    expect(getMediaGeneration).not.toHaveBeenCalled();
  });

  it("keeps polling through transient errors and recovers", async () => {
    getMediaGeneration
      .mockResolvedValueOnce({ error: "Network error" })
      .mockResolvedValueOnce({ error: "Network error" })
      .mockResolvedValueOnce({ data: job({ status: "running" }) })
      .mockResolvedValueOnce({ error: "Network error" })
      .mockResolvedValueOnce({ error: "Network error" })
      .mockResolvedValueOnce({ data: finished });
    const { result } = await startGeneration();
    await advance(60_000);

    expect(getMediaGeneration).toHaveBeenCalledTimes(6);
    expect(result.current.status).toBe("done");
  });

  it("fails after three consecutive check errors", async () => {
    getMediaGeneration.mockResolvedValue({ error: "Network error" });
    const { result } = await startGeneration();
    await advance(60_000);

    expect(getMediaGeneration).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("failed");
    expect(result.current.error).toEqual({ code: "poll_failed", message: "Network error" });
  });

  it("gives up when the job no longer exists", async () => {
    getMediaGeneration.mockResolvedValue({ error: "not found", code: "not_found", status: 404 });
    const { result } = await startGeneration();
    await advance(60_000);

    expect(getMediaGeneration).toHaveBeenCalledTimes(1);
    expect(result.current.error?.code).toBe("poll_failed");
  });

  it("times out on the client just past the server limit", async () => {
    getMediaGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    const { result } = await startGeneration();

    await advance(10 * 60_000);
    expect(result.current.status).toBe("generating");
    await advance(60_000 + 5_000);
    expect(result.current.status).toBe("failed");
    expect(result.current.error?.code).toBe("timed_out");

    const calls = getMediaGeneration.mock.calls.length;
    await advance(60_000);
    expect(getMediaGeneration).toHaveBeenCalledTimes(calls);
  });

  it("pauses while the tab is hidden and checks at once when it is visible again", async () => {
    getMediaGeneration.mockResolvedValueOnce({ data: job({ status: "running" }) }).mockResolvedValueOnce({ data: finished });
    const { result } = await startGeneration();

    setVisibility("hidden");
    await advance(60_000);
    expect(getMediaGeneration).not.toHaveBeenCalled();

    await act(async () => {
      setVisibility("visible");
    });
    expect(getMediaGeneration).toHaveBeenCalledTimes(1);

    await advance(2_250);
    expect(getMediaGeneration).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("done");
  });

  it("never runs two checks at the same time", async () => {
    let answer: (value: unknown) => void = () => {};
    getMediaGeneration.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    getMediaGeneration.mockResolvedValue({ data: finished });
    await startGeneration();
    await advance(1_500);
    expect(getMediaGeneration).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility("hidden");
      setVisibility("visible");
    });
    await advance(10_000);
    expect(getMediaGeneration).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer({ data: job({ status: "running" }) });
    });
    await advance(2_250);
    expect(getMediaGeneration).toHaveBeenCalledTimes(2);
  });

  it("asks for the reference images with the prompt", async () => {
    getMediaGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    const { result } = renderHook(() => useMediaGeneration());
    await act(async () => {
      await result.current.start({ kind: "image", model: "openai/gpt-image-2", prompt: "a red bike", aspect: "story", referenceMediaIds: ["ref-1", "ref-2"] });
    });

    expect(requestMediaGeneration).toHaveBeenCalledWith({
      kind: "image",
      model: "openai/gpt-image-2",
      prompt: "a red bike",
      aspect: "story",
      referenceMediaIds: ["ref-1", "ref-2"],
    });
  });

  it("shows a settling job as finishing and only delivers it once it is done", async () => {
    getMediaGeneration
      .mockResolvedValueOnce({ data: job({ status: "settling", mediaId: "m1", mediaUrl: "https://cdn/m1.png" }) })
      .mockResolvedValueOnce({ data: finished });
    const onDone = vi.fn();
    const { result } = renderHook(() => useMediaGeneration({ onDone }));
    await act(async () => {
      await result.current.start({ kind: "image", model: "openai/gpt-image-2", prompt: "a red bike", aspect: "square" });
    });
    expect(result.current.settling).toBe(false);

    await advance(1_500);
    expect(result.current.status).toBe("generating");
    expect(result.current.settling).toBe(true);
    expect(result.current.result).toBeUndefined();
    expect(onDone).not.toHaveBeenCalled();

    await advance(2_250);
    expect(result.current.status).toBe("done");
    expect(result.current.settling).toBe(false);
    expect(onDone).toHaveBeenCalledWith({ mediaId: "m1", mediaUrl: "https://cdn/m1.png" });
  });

  it("reports whether the job is still queued or already running", async () => {
    getMediaGeneration.mockResolvedValueOnce({ data: job({ status: "running" }) }).mockResolvedValueOnce({ data: finished });
    const { result } = renderHook(() => useMediaGeneration());
    expect(result.current.jobStatus).toBeNull();
    await act(async () => {
      await result.current.start({ kind: "image", model: "openai/gpt-image-2", prompt: "a red bike", aspect: "square" });
    });
    expect(result.current.jobStatus).toBe("queued");
    await advance(1_500);
    expect(result.current.jobStatus).toBe("running");
    await advance(2_250);
    expect(result.current.status).toBe("done");
    expect(result.current.jobStatus).toBeNull();
  });

  it("asks for music with its model and prompt", async () => {
    getMediaGeneration.mockResolvedValue({ data: job({ kind: "music", status: "running" }) });
    const { result } = renderHook(() => useMediaGeneration());
    await act(async () => {
      await result.current.start({ kind: "music", model: "google/lyria-3-clip-preview", prompt: "samba leve" });
    });

    expect(requestMediaGeneration).toHaveBeenCalledWith({ kind: "music", model: "google/lyria-3-clip-preview", prompt: "samba leve" });
  });

  it("stops polling when unmounted", async () => {
    getMediaGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    const { unmount } = await startGeneration();
    unmount();
    await advance(60_000);

    expect(getMediaGeneration).not.toHaveBeenCalled();
  });

  it("stops polling and returns to idle on reset", async () => {
    getMediaGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    const { result } = await startGeneration();
    await advance(1_500);

    act(() => result.current.reset());
    await advance(60_000);

    expect(getMediaGeneration).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeUndefined();
  });

  it("ignores a request that resolves after reset", async () => {
    let answer: (value: unknown) => void = () => {};
    requestMediaGeneration.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useMediaGeneration());
    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = result.current.start({ kind: "image", model: "openai/gpt-image-2", prompt: "a red bike", aspect: "story" });
    });
    act(() => result.current.reset());
    await act(async () => {
      answer({ data: job() });
      await started;
    });
    await advance(60_000);

    expect(result.current.status).toBe("idle");
    expect(getMediaGeneration).not.toHaveBeenCalled();
  });
});
