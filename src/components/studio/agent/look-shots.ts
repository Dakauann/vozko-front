import { createStore, type StoreApi } from "zustand/vanilla";

import type { ScreenTarget } from "@/lib/aichat/screen";

export const LOOK_SHOT_LIMIT = 3;

export interface LookShot {
  id: number;
  image: string;
  target: ScreenTarget;
}

export interface LookShotsState {
  shots: readonly LookShot[];
}

export interface LookShots {
  store: StoreApi<LookShotsState>;
  add: (image: string, target: ScreenTarget) => void;
  clear: () => void;
}

export function createLookShots(limit: number = LOOK_SHOT_LIMIT): LookShots {
  const store = createStore<LookShotsState>()(() => ({ shots: [] }));
  let next = 1;
  return {
    store,
    add: (image, target) => store.setState(({ shots }) => ({ shots: [{ id: next++, image, target }, ...shots].slice(0, limit) })),
    clear: () => store.setState({ shots: [] }),
  };
}
