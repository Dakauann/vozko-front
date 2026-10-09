import { applyTurnEvent, type TurnEvent } from "./turn-events";
import type { UIMessage } from "./ui-message";

export interface TurnState {
  messages: UIMessage[];
  streaming: boolean;
  error: string | null;
}

export const IDLE_TURN: TurnState = Object.freeze({ messages: [], streaming: false, error: null }) as TurnState;

export interface TurnStore {
  subscribe: (listener: () => void) => () => void;
  snapshot: (threadId: string | null) => TurnState;
  isStreaming: (threadId: string) => boolean;
  load: (threadId: string, messages: UIMessage[]) => boolean;
  update: (threadId: string, change: (messages: UIMessage[]) => UIMessage[]) => void;
  apply: (threadId: string, event: TurnEvent) => void;
  begin: (threadId: string) => AbortSignal | null;
  end: (threadId: string) => void;
  fail: (threadId: string, error: string) => void;
  abort: (threadId: string) => boolean;
}

export function createTurnStore(): TurnStore {
  const states = new Map<string, TurnState>();
  const controllers = new Map<string, AbortController>();
  const listeners = new Set<() => void>();

  const snapshot = (threadId: string | null): TurnState => (threadId ? states.get(threadId) ?? IDLE_TURN : IDLE_TURN);

  const write = (threadId: string, change: (state: TurnState) => TurnState) => {
    states.set(threadId, change(snapshot(threadId)));
    listeners.forEach((listener) => listener());
  };

  const isStreaming = (threadId: string) => controllers.has(threadId);

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot,
    isStreaming,
    load: (threadId, messages) => {
      if (isStreaming(threadId)) return false;
      write(threadId, (state) => ({ ...state, messages }));
      return true;
    },
    update: (threadId, change) => write(threadId, (state) => ({ ...state, messages: change(state.messages) })),
    apply: (threadId, event) => write(threadId, (state) => ({ ...state, messages: applyTurnEvent(state.messages, event) })),
    begin: (threadId) => {
      if (isStreaming(threadId)) return null;
      const controller = new AbortController();
      controllers.set(threadId, controller);
      write(threadId, (state) => ({ ...state, streaming: true, error: null }));
      return controller.signal;
    },
    end: (threadId) => {
      controllers.delete(threadId);
      write(threadId, (state) => ({ ...state, streaming: false, messages: applyTurnEvent(state.messages, { kind: "finalize" }) }));
    },
    fail: (threadId, error) => write(threadId, (state) => ({ ...state, error })),
    abort: (threadId) => {
      const controller = controllers.get(threadId);
      if (!controller) return false;
      controller.abort();
      return true;
    },
  };
}

export const chatTurns = createTurnStore();
