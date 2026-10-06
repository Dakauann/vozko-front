import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageGenerationJob } from "@/lib/image-generation/types";

const requestImageGeneration = vi.fn();
const getImageGeneration = vi.fn();
vi.mock("@/app/actions/image-generation", () => ({
  requestImageGenerationAction: (...args: unknown[]) => requestImageGeneration(...args),
  getImageGenerationAction: (...args: unknown[]) => getImageGeneration(...args),
}));

import { useImageGeneration } from "./use-image-generation";

function job(overrides: Partial<ImageGenerationJob> = {}): ImageGenerationJob {
  return {
    id: "job-1",
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
  const hook = renderHook(() => useImageGeneration());
  await act(async () => {
    await hook.result.current.start({ model: "openai/gpt-image-2", prompt: "a red bike", aspect: "square" });
  });
  return hook;
}

describe("useImageGeneration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = "visible";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    requestImageGeneration.mockReset();
    getImageGeneration.mockReset();
    requestImageGeneration.mockResolvedValue({ data: job() });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls with a growing delay until the job is done", async () => {
    getImageGeneration
      .mockResolvedValueOnce({ data: job({ status: "running" }) })
      .mockResolvedValueOnce({ data: job({ status: "running" }) })
      .mockResolvedValueOnce({ data: finished });
    const { result } = await startGeneration();

    expect(requestImageGeneration).toHaveBeenCalledWith({ model: "openai/gpt-image-2", prompt: "a red bike", aspect: "square" });
    expect(result.current.status).toBe("generating");

    await advance(1_499);
    expect(getImageGeneration).toHaveBeenCalledTimes(0);
    await advance(1);
    expect(getImageGeneration).toHaveBeenCalledTimes(1);
    expect(getImageGeneration).toHaveBeenCalledWith("job-1");

    await advance(2_249);
    expect(getImageGeneration).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(getImageGeneration).toHaveBeenCalledTimes(2);

    await advance(3_375);
    expect(getImageGeneration).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("done");
    expect(result.current.result).toEqual({ mediaId: "m1", mediaUrl: "https://cdn/m1.png" });

    await advance(30_000);
    expect(getImageGeneration).toHaveBeenCalledTimes(3);
  });

  it("calls onDone with the generated image", async () => {
    getImageGeneration.mockResolvedValueOnce({ data: finished });
    const onDone = vi.fn();
    const { result } = renderHook(() => useImageGeneration({ onDone }));
    await act(async () => {
      await result.current.start({ model: "openai/gpt-image-2", prompt: "a red bike", aspect: "portrait" });
    });
    await advance(1_500);

    expect(onDone).toHaveBeenCalledWith({ mediaId: "m1", mediaUrl: "https://cdn/m1.png" });
  });

  it("settles without polling when the started job is already done", async () => {
    requestImageGeneration.mockResolvedValue({ data: finished });
    const { result } = await startGeneration();

    expect(result.current.status).toBe("done");
    await advance(10_000);
    expect(getImageGeneration).not.toHaveBeenCalled();
  });

  it("stops on a failed job and reports its code", async () => {
    getImageGeneration.mockResolvedValueOnce({ data: job({ status: "failed", failureCode: "generation_failed" }) });
    const { result } = await startGeneration();
    await advance(1_500);

    expect(result.current.status).toBe("failed");
    expect(result.current.error?.code).toBe("generation_failed");
    await advance(30_000);
    expect(getImageGeneration).toHaveBeenCalledTimes(1);
  });

  it("fails a done job that has no media", async () => {
    getImageGeneration.mockResolvedValueOnce({ data: job({ status: "done" }) });
    const { result } = await startGeneration();
    await advance(1_500);

    expect(result.current.status).toBe("failed");
    expect(result.current.error?.code).toBe("missing_media");
  });

  it("reports the server code when the request is refused", async () => {
    requestImageGeneration.mockResolvedValue({ error: "Saldo insuficiente", code: "insufficient_balance", status: 402 });
    const { result } = await startGeneration();

    expect(result.current.status).toBe("failed");
    expect(result.current.error).toEqual({ code: "insufficient_balance", message: "Saldo insuficiente" });
    expect(getImageGeneration).not.toHaveBeenCalled();
  });

  it("keeps polling through transient errors and recovers", async () => {
    getImageGeneration
      .mockResolvedValueOnce({ error: "Network error" })
      .mockResolvedValueOnce({ error: "Network error" })
      .mockResolvedValueOnce({ data: job({ status: "running" }) })
      .mockResolvedValueOnce({ error: "Network error" })
      .mockResolvedValueOnce({ error: "Network error" })
      .mockResolvedValueOnce({ data: finished });
    const { result } = await startGeneration();
    await advance(60_000);

    expect(getImageGeneration).toHaveBeenCalledTimes(6);
    expect(result.current.status).toBe("done");
  });

  it("fails after three consecutive check errors", async () => {
    getImageGeneration.mockResolvedValue({ error: "Network error" });
    const { result } = await startGeneration();
    await advance(60_000);

    expect(getImageGeneration).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe("failed");
    expect(result.current.error).toEqual({ code: "poll_failed", message: "Network error" });
  });

  it("gives up when the job no longer exists", async () => {
    getImageGeneration.mockResolvedValue({ error: "not found", code: "not_found", status: 404 });
    const { result } = await startGeneration();
    await advance(60_000);

    expect(getImageGeneration).toHaveBeenCalledTimes(1);
    expect(result.current.error?.code).toBe("poll_failed");
  });

  it("times out on the client just past the server limit", async () => {
    getImageGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    const { result } = await startGeneration();

    await advance(10 * 60_000);
    expect(result.current.status).toBe("generating");
    await advance(60_000 + 5_000);
    expect(result.current.status).toBe("failed");
    expect(result.current.error?.code).toBe("timed_out");

    const calls = getImageGeneration.mock.calls.length;
    await advance(60_000);
    expect(getImageGeneration).toHaveBeenCalledTimes(calls);
  });

  it("pauses while the tab is hidden and checks at once when it is visible again", async () => {
    getImageGeneration.mockResolvedValueOnce({ data: job({ status: "running" }) }).mockResolvedValueOnce({ data: finished });
    const { result } = await startGeneration();

    setVisibility("hidden");
    await advance(60_000);
    expect(getImageGeneration).not.toHaveBeenCalled();

    await act(async () => {
      setVisibility("visible");
    });
    expect(getImageGeneration).toHaveBeenCalledTimes(1);

    await advance(2_250);
    expect(getImageGeneration).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("done");
  });

  it("never runs two checks at the same time", async () => {
    let answer: (value: unknown) => void = () => {};
    getImageGeneration.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    getImageGeneration.mockResolvedValue({ data: finished });
    await startGeneration();
    await advance(1_500);
    expect(getImageGeneration).toHaveBeenCalledTimes(1);

    await act(async () => {
      setVisibility("hidden");
      setVisibility("visible");
    });
    await advance(10_000);
    expect(getImageGeneration).toHaveBeenCalledTimes(1);

    await act(async () => {
      answer({ data: job({ status: "running" }) });
    });
    await advance(2_250);
    expect(getImageGeneration).toHaveBeenCalledTimes(2);
  });

  it("asks for the reference images with the prompt", async () => {
    getImageGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    const { result } = renderHook(() => useImageGeneration());
    await act(async () => {
      await result.current.start({ model: "openai/gpt-image-2", prompt: "a red bike", aspect: "story", referenceMediaIds: ["ref-1", "ref-2"] });
    });

    expect(requestImageGeneration).toHaveBeenCalledWith({
      model: "openai/gpt-image-2",
      prompt: "a red bike",
      aspect: "story",
      referenceMediaIds: ["ref-1", "ref-2"],
    });
  });

  it("stops polling when unmounted", async () => {
    getImageGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    const { unmount } = await startGeneration();
    unmount();
    await advance(60_000);

    expect(getImageGeneration).not.toHaveBeenCalled();
  });

  it("stops polling and returns to idle on reset", async () => {
    getImageGeneration.mockResolvedValue({ data: job({ status: "running" }) });
    const { result } = await startGeneration();
    await advance(1_500);

    act(() => result.current.reset());
    await advance(60_000);

    expect(getImageGeneration).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeUndefined();
  });

  it("ignores a request that resolves after reset", async () => {
    let answer: (value: unknown) => void = () => {};
    requestImageGeneration.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useImageGeneration());
    let started: Promise<void> = Promise.resolve();
    act(() => {
      started = result.current.start({ model: "openai/gpt-image-2", prompt: "a red bike", aspect: "story" });
    });
    act(() => result.current.reset());
    await act(async () => {
      answer({ data: job() });
      await started;
    });
    await advance(60_000);

    expect(result.current.status).toBe("idle");
    expect(getImageGeneration).not.toHaveBeenCalled();
  });
});
