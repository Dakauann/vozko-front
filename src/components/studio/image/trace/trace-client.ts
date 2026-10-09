import { traceRaster, type RasterImage, type TraceOptions, type TraceResult } from "@/lib/studio/trace/trace";

export const TRACE_TIMEOUT_MS = 30_000;

function startWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./trace.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
}

export function traceInBackground(raster: RasterImage, options: TraceOptions): Promise<TraceResult> {
  const worker = startWorker();
  if (!worker) return Promise.resolve(traceRaster(raster, options));
  const copy: RasterImage = { ...raster, data: new Uint8ClampedArray(raster.data) };
  return new Promise((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const onMainThread = () => {
      finish();
      try {
        resolve(traceRaster(raster, options));
      } catch (error) {
        reject(error);
      }
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error("trace timed out"));
    }, TRACE_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<{ ok: true; result: TraceResult } | { ok: false }>) => {
      finish();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error("trace failed"));
    };
    worker.onerror = onMainThread;
    worker.onmessageerror = onMainThread;
    worker.postMessage({ raster: copy, options }, [copy.data.buffer]);
  });
}
