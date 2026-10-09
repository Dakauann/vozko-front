"use client";

import type { MediaEvent, MediaPort } from "./media-protocol";

export function workerPort(worker: Worker): MediaPort {
  return {
    send: (request) => worker.postMessage(request),
    listen: (onEvent, onBroken) => {
      worker.addEventListener("message", (event: MessageEvent<MediaEvent>) => onEvent(event.data));
      worker.addEventListener("error", onBroken);
      worker.addEventListener("messageerror", onBroken);
    },
    close: () => worker.terminate(),
  };
}

export function mediaWorkerSupported(): boolean {
  return typeof Worker !== "undefined" && typeof VideoDecoder !== "undefined" && typeof VideoFrame !== "undefined";
}

export function openMediaWorker(): MediaPort | null {
  if (!mediaWorkerSupported()) return null;
  try {
    return workerPort(new Worker(new URL("./media.worker.ts", import.meta.url), { type: "module" }));
  } catch {
    return null;
  }
}
