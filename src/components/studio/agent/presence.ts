import { createStore, type StoreApi } from "zustand/vanilla";

export const PRESENCE_IDLE_MS = 4000;

export interface PresencePoint {
  x: number;
  y: number;
}

export interface PresenceRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PresenceProgress {
  step: number;
  total: number;
}

export interface AgentPresenceState {
  visible: boolean;
  busy: boolean;
  x: number;
  y: number;
  label: string;
  outline: PresenceRect | null;
  progress: PresenceProgress | null;
}

export interface AgentPresence {
  store: StoreApi<AgentPresenceState>;
  point: (at: PresencePoint | null, label: string, outline?: PresenceRect | null) => void;
  progress: (progress: PresenceProgress | null) => void;
  busy: (on: boolean) => void;
  rest: () => void;
  isBusy: () => boolean;
  dispose: () => void;
}

export function centerOf(rect: PresenceRect): PresencePoint {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function createAgentPresence(idleMs: number = PRESENCE_IDLE_MS): AgentPresence {
  const store = createStore<AgentPresenceState>()(() => ({ visible: false, busy: false, x: 0, y: 0, label: "", outline: null, progress: null }));
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancelRest = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    store,
    point: (at, label, outline = null) => {
      cancelRest();
      store.setState((current) => ({ visible: true, label, outline, ...(at ? { x: at.x, y: at.y } : { x: current.x, y: current.y }) }));
    },
    progress: (progress) => store.setState({ progress }),
    busy: (on) => {
      if (on) cancelRest();
      store.setState({ busy: on });
    },
    rest: () => {
      cancelRest();
      timer = setTimeout(() => {
        timer = null;
        store.setState({ visible: false, label: "", outline: null, progress: null });
      }, idleMs);
    },
    isBusy: () => store.getState().busy,
    dispose: cancelRest,
  };
}
