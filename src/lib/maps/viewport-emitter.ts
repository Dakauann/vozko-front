import { snapViewport } from "./tiles";
import type { SnappedViewport, Viewport } from "./types";

export const VIEWPORT_DEBOUNCE_MS = 300;

export interface ViewportEmitter {
  push(viewport: Viewport): void;
  cancel(): void;
}

export function createViewportEmitter(
  emit: (viewport: SnappedViewport) => void,
  delayMs = VIEWPORT_DEBOUNCE_MS,
): ViewportEmitter {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastKey: string | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    push(viewport) {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        const snapped = snapViewport(viewport);
        if (!snapped || snapped.key === lastKey) return;
        lastKey = snapped.key;
        emit(snapped);
      }, delayMs);
    },
    cancel,
  };
}
