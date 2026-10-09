import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIRST_POLL_MS, MAX_CONSECUTIVE_POLL_ERRORS, nextPollDelay, pollUntil, type PollAnswer } from "./polling";

type Job = { status: string };

function answers(...sequence: PollAnswer<Job, string>[]) {
  const read = vi.fn<() => Promise<PollAnswer<Job, string>>>();
  for (const answer of sequence) read.mockResolvedValueOnce(answer);
  return read;
}

const running: PollAnswer<Job, string> = { data: { status: "running" }, error: null };
const done: PollAnswer<Job, string> = { data: { status: "done" }, error: null };
const broken: PollAnswer<Job, string> = { data: null, error: "boom" };
const isDone = (job: Job) => job.status === "done";

describe("pollUntil", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits the backoff before every read and answers the first value that is over", async () => {
    const read = answers(running, done);
    const outcome = pollUntil(read, isDone, { maxPolls: 10 });
    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS - 1);
    expect(read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(nextPollDelay(FIRST_POLL_MS));
    await expect(outcome).resolves.toEqual({ status: "over", value: { status: "done" } });
  });

  it("gives up after consecutive errors, and a good answer resets the count", async () => {
    const read = answers(broken, broken, running, ...Array.from({ length: MAX_CONSECUTIVE_POLL_ERRORS }, () => broken));
    const outcome = pollUntil(read, isDone, { maxPolls: 20 });
    await vi.runAllTimersAsync();
    await expect(outcome).resolves.toEqual({ status: "failing", error: "boom" });
    expect(read).toHaveBeenCalledTimes(3 + MAX_CONSECUTIVE_POLL_ERRORS);
  });

  it("stops at the poll cap", async () => {
    const read = vi.fn(async () => running);
    const outcome = pollUntil(read, isDone, { maxPolls: 3 });
    await vi.runAllTimersAsync();
    await expect(outcome).resolves.toEqual({ status: "exhausted" });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("stops without reading once the signal aborts", async () => {
    const read = vi.fn(async () => running);
    const controller = new AbortController();
    const outcome = pollUntil(read, isDone, { maxPolls: 10, signal: controller.signal });
    controller.abort();
    await vi.runAllTimersAsync();
    await expect(outcome).resolves.toEqual({ status: "aborted" });
    expect(read).not.toHaveBeenCalled();
  });

  it("drops the answer of a read that finished after the abort", async () => {
    const controller = new AbortController();
    const read = vi.fn(async () => {
      controller.abort();
      return done;
    });
    const outcome = pollUntil(read, isDone, { maxPolls: 10, signal: controller.signal });
    await vi.runAllTimersAsync();
    await expect(outcome).resolves.toEqual({ status: "aborted" });
  });

  it("reads at once when woken, without waiting out the backoff", async () => {
    const listeners = new Set<() => void>();
    const wake = (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    };
    const read = answers(running, done);
    const outcome = pollUntil(read, isDone, { maxPolls: 10, wake });
    await vi.advanceTimersByTimeAsync(10);
    expect(read).not.toHaveBeenCalled();
    listeners.forEach((listener) => listener());
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);
    listeners.forEach((listener) => listener());
    await expect(outcome).resolves.toEqual({ status: "over", value: { status: "done" } });
    expect(read).toHaveBeenCalledTimes(2);
    expect(listeners.size).toBe(0);
  });

  it("keeps a wake that arrives during a read for the next wait", async () => {
    const listeners = new Set<() => void>();
    const wake = (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    };
    const read = vi.fn<() => Promise<PollAnswer<Job, string>>>();
    read.mockImplementationOnce(async () => {
      listeners.forEach((listener) => listener());
      return running;
    });
    read.mockResolvedValueOnce(done);
    const outcome = pollUntil(read, isDone, { maxPolls: 10, wake });
    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    await expect(outcome).resolves.toEqual({ status: "over", value: { status: "done" } });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("stops listening for wakes once aborted", async () => {
    const listeners = new Set<() => void>();
    const wake = (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    };
    const controller = new AbortController();
    const read = vi.fn(async () => running);
    const outcome = pollUntil(read, isDone, { maxPolls: 10, signal: controller.signal, wake });
    controller.abort();
    await expect(outcome).resolves.toEqual({ status: "aborted" });
    expect(listeners.size).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });

  it("follows several jobs at once, each on its own", async () => {
    const first = answers(running, done);
    const second = answers(done);
    const both = Promise.all([pollUntil(first, isDone, { maxPolls: 5 }), pollUntil(second, isDone, { maxPolls: 5 })]);
    await vi.runAllTimersAsync();
    await expect(both).resolves.toEqual([
      { status: "over", value: { status: "done" } },
      { status: "over", value: { status: "done" } },
    ]);
  });
});
