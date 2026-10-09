import { traceRaster, type RasterImage, type TraceOptions } from "@/lib/studio/trace/trace";

self.onmessage = (event: MessageEvent<{ raster: RasterImage; options: TraceOptions }>) => {
  try {
    self.postMessage({ ok: true, result: traceRaster(event.data.raster, event.data.options) });
  } catch {
    self.postMessage({ ok: false });
  }
};
