import { createStore, type StoreApi } from "zustand/vanilla";

import { createLookShots, type LookShots } from "./look-shots";

const PRESENCE_IDLE_MS = 4000;

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
  ticks: readonly PresenceRect[];
  progress: PresenceProgress | null;
}

export interface AgentPresence {
  store: StoreApi<AgentPresenceState>;
  shots: LookShots;
  point: (at: PresencePoint | null, label: string, outline?: PresenceRect | null, ticks?: readonly PresenceRect[]) => void;
  progress: (progress: PresenceProgress | null) => void;
  busy: (on: boolean) => void;
  rest: () => void;
  dispose: () => void;
}

export function createAgentPresence(idleMs: number = PRESENCE_IDLE_MS): AgentPresence {
  const store = createStore<AgentPresenceState>()(() => ({ visible: false, busy: false, x: 0, y: 0, label: "", outline: null, ticks: [], progress: null }));
  const shots = createLookShots();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancelRest = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    store,
    shots,
    point: (at, label, outline = null, ticks = []) => {
      cancelRest();
      store.setState((current) => ({ visible: true, label, outline, ticks, ...(at ? { x: at.x, y: at.y } : { x: current.x, y: current.y }) }));
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
        store.setState({ visible: false, label: "", outline: null, ticks: [], progress: null });
      }, idleMs);
    },
    dispose: () => {
      cancelRest();
      shots.clear();
    },
  };
}
