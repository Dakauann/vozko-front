import type { TrackEvent, TrackRequest } from "./media-protocol";
import { trackInWorker } from "./track-feed";

const PROGRESS_STEP = 0.01;

const running = new Map<string, AbortController>();

export async function startTrack(request: TrackRequest, post: (event: TrackEvent) => void): Promise<void> {
  const controller = new AbortController();
  running.set(request.id, controller);
  let shown = -1;
  const progress = (done: number) => {
    if (done < 1 && done - shown < PROGRESS_STEP) return;
    shown = done;
    post({ kind: "track-progress", id: request.id, done });
  };
  const outcome = await trackInWorker(request.blob, request.request, progress, controller.signal).catch(() => ({ kind: "failed" as const }));
  running.delete(request.id);
  post({ kind: "track-done", id: request.id, outcome });
}

export function cancelTrack(id: string): void {
  running.get(id)?.abort();
}
