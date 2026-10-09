export const FIRST_POLL_MS = 1_500;
export const MAX_POLL_MS = 5_000;
export const POLL_BACKOFF = 1.5;
export const MAX_CONSECUTIVE_POLL_ERRORS = 3;

export function nextPollDelay(previousMs: number | null): number {
  if (previousMs === null) return FIRST_POLL_MS;
  return Math.min(Math.round(previousMs * POLL_BACKOFF), MAX_POLL_MS);
}

export type PollAnswer<T, E> = { data: T; error: null } | { data: null; error: E };

type PollFailure<E> = { data: null; error: E };

export function isPollFailure<T, E>(answer: PollAnswer<T, E>): answer is PollFailure<E> {
  return answer.error !== null;
}

export type PollOutcome<T, E> =
  | { status: "over"; value: T }
  | { status: "failing"; error: E }
  | { status: "exhausted" }
  | { status: "aborted" };

export type PollWake = (listener: () => void) => () => void;

export interface PollOptions {
  maxPolls: number;
  signal?: AbortSignal;
  maxErrors?: number;
  wake?: PollWake;
}

interface PollAlarm {
  rung: boolean;
  ring: (() => void) | null;
}

function pause(ms: number, signal: AbortSignal | undefined, alarm: PollAlarm): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  if (alarm.rung) {
    alarm.rung = false;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const finish = (value: boolean) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      alarm.ring = null;
      alarm.rung = false;
      resolve(value);
    };
    const stop = () => finish(false);
    const timer = setTimeout(() => finish(true), ms);
    alarm.ring = () => finish(true);
    signal?.addEventListener("abort", stop, { once: true });
  });
}

export async function pollUntil<T, E>(
  read: () => Promise<PollAnswer<T, E>>,
  isOver: (value: T) => boolean,
  { maxPolls, signal, maxErrors = MAX_CONSECUTIVE_POLL_ERRORS, wake }: PollOptions,
): Promise<PollOutcome<T, E>> {
  const alarm: PollAlarm = { rung: false, ring: null };
  const leave = wake?.(() => {
    if (alarm.ring) alarm.ring();
    else alarm.rung = true;
  });
  try {
    let delay: number | null = null;
    let errors = 0;
    for (let polls = 0; polls < maxPolls; polls += 1) {
      delay = nextPollDelay(delay);
      if (!(await pause(delay, signal, alarm))) return { status: "aborted" };
      const answer = await read();
      if (signal?.aborted) return { status: "aborted" };
      if (isPollFailure(answer)) {
        errors += 1;
        if (errors >= maxErrors) return { status: "failing", error: answer.error };
        continue;
      }
      errors = 0;
      if (isOver(answer.data)) return { status: "over", value: answer.data };
    }
    return { status: "exhausted" };
  } finally {
    leave?.();
  }
}
