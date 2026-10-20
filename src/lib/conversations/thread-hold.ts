interface HoldableThread {
  messages: readonly unknown[];
}

export interface ThreadHold<T extends HoldableThread> {
  key: string | null;
  shown: T | null;
  waiting: boolean;
  waitingFor: string | null;
}

export function noThreadHold<T extends HoldableThread>(): ThreadHold<T> {
  return { key: null, shown: null, waiting: false, waitingFor: null };
}

function isWaitingForFirstPage<T extends HoldableThread>(
  previous: ThreadHold<T>,
  key: string | null,
  thread: T | null,
  loading: boolean,
): boolean {
  return (
    loading &&
    thread !== null &&
    thread.messages.length === 0 &&
    key !== previous.key &&
    previous.shown !== null &&
    previous.shown.messages.length > 0
  );
}

export function holdThread<T extends HoldableThread>(
  previous: ThreadHold<T>,
  key: string | null,
  thread: T | null,
  loading: boolean,
): ThreadHold<T> {
  if (isWaitingForFirstPage(previous, key, thread, loading)) {
    if (previous.waiting && previous.waitingFor === key) return previous;
    return { ...previous, waiting: true, waitingFor: key };
  }
  if (previous.key === key && previous.shown === thread && !previous.waiting) return previous;
  return { key, shown: thread, waiting: false, waitingFor: null };
}
