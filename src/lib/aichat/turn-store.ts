import type { QueuedMessage } from "./queue";
import { applyTurnEvent, type TurnEvent } from "./turn-events";
import type { UIMessage } from "./ui-message";

interface TurnState {
  messages: UIMessage[];
  queued: QueuedMessage[];
  streaming: boolean;
  error: string | null;
  projectId: string | null;
}

export const IDLE_TURN: TurnState = Object.freeze({ messages: [], queued: [], streaming: false, error: null, projectId: null }) as TurnState;

const NO_LIVE_THREADS: readonly string[] = Object.freeze([]);

interface TurnStore {
  subscribe: (listener: () => void) => () => void;
  snapshot: (threadId: string | null) => TurnState;
  isStreaming: (threadId: string) => boolean;
  live: () => readonly string[];
  whenIdle: (threadId: string) => Promise<void>;
  load: (threadId: string, messages: UIMessage[]) => boolean;
  update: (threadId: string, change: (messages: UIMessage[]) => UIMessage[]) => void;
  queue: (threadId: string, change: (queued: QueuedMessage[]) => QueuedMessage[]) => void;
  bindProject: (threadId: string, projectId: string | null) => void;
  apply: (threadId: string, event: TurnEvent) => void;
  begin: (threadId: string) => AbortSignal | null;
  end: (threadId: string) => void;
  fail: (threadId: string, error: string) => void;
  abort: (threadId: string) => boolean;
  abortAll: () => void;
}

export function createTurnStore(): TurnStore {
  const states = new Map<string, TurnState>();
  const controllers = new Map<string, AbortController>();
  const listeners = new Set<() => void>();
  let liveIds: readonly string[] = NO_LIVE_THREADS;

  const relist = () => {
    liveIds = controllers.size === 0 ? NO_LIVE_THREADS : Object.freeze([...controllers.keys()]);
  };

  const snapshot = (threadId: string | null): TurnState => (threadId ? states.get(threadId) ?? IDLE_TURN : IDLE_TURN);

  const write = (threadId: string, change: (state: TurnState) => TurnState) => {
    states.set(threadId, change(snapshot(threadId)));
    listeners.forEach((listener) => listener());
  };

  const isStreaming = (threadId: string) => controllers.has(threadId);

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    subscribe,
    snapshot,
    isStreaming,
    live: () => liveIds,
    whenIdle: (threadId) =>
      new Promise<void>((resolve) => {
        if (!isStreaming(threadId)) {
          resolve();
          return;
        }
        const leave = subscribe(() => {
          if (isStreaming(threadId)) return;
          leave();
          resolve();
        });
      }),
    load: (threadId, messages) => {
      if (isStreaming(threadId)) return false;
      write(threadId, (state) => ({ ...state, messages }));
      return true;
    },
    update: (threadId, change) => write(threadId, (state) => ({ ...state, messages: change(state.messages) })),
    queue: (threadId, change) => write(threadId, (state) => ({ ...state, queued: change(state.queued) })),
    bindProject: (threadId, projectId) => {
      if (snapshot(threadId).projectId === projectId) return;
      write(threadId, (state) => ({ ...state, projectId }));
    },
    apply: (threadId, event) => write(threadId, (state) => ({ ...state, messages: applyTurnEvent(state.messages, event) })),
    begin: (threadId) => {
      if (isStreaming(threadId)) return null;
      const controller = new AbortController();
      controllers.set(threadId, controller);
      relist();
      write(threadId, (state) => ({ ...state, streaming: true, error: null }));
      return controller.signal;
    },
    end: (threadId) => {
      controllers.delete(threadId);
      relist();
      write(threadId, (state) => ({ ...state, streaming: false, messages: applyTurnEvent(state.messages, { kind: "finalize" }) }));
    },
    fail: (threadId, error) => write(threadId, (state) => ({ ...state, error })),
    abort: (threadId) => {
      const controller = controllers.get(threadId);
      if (!controller) return false;
      controller.abort();
      return true;
    },
    abortAll: () => {
      [...controllers.values()].forEach((controller) => controller.abort());
    },
  };
}

export const chatTurns = createTurnStore();
