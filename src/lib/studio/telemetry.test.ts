import { describe, expect, it } from "vitest";

import { REPORT_EVERY_MS, rendererBackend, SessionMeter, SLOW_FRAME_MS, STALL_MS } from "./telemetry";

function probed(meter: SessionMeter) {
  meter.describe({ gpuRenderer: "ANGLE", webgpu: false, decode: true, encodeVideo: true, encodeAudio: true, pixelRatio: 2, cores: 8, memoryGb: 8 });
  meter.probed();
}

describe("studio session meter", () => {
  it("waits for the device probe and the renderer before the first report", () => {
    const meter = new SessionMeter("video");
    expect(meter.due(0, true)).toBeNull();
    probed(meter);
    expect(meter.due(0, true)).toBeNull();
    meter.describe({ backend: "webgl" });
    const first = meter.due(0, true);
    expect(first?.report).toMatchObject({ kind: "video", capabilities: { backend: "webgl", gpuRenderer: "ANGLE", decode: true }, usage: { frames: 0 } });
  });

  it("counts slow frames and playback stalls, not pauses", () => {
    const meter = new SessionMeter("video");
    meter.rendered(SLOW_FRAME_MS + 1, 0, false);
    meter.rendered(2, 1000, true);
    meter.rendered(2, 1016, true);
    meter.rendered(2, 1016 + STALL_MS + 1, true);
    meter.rendered(2, 9000, false);
    meter.rendered(2, 20_000, true);
    probed(meter);
    meter.describe({ backend: "webgl" });
    expect(meter.due(0, true)?.report.usage).toMatchObject({ frames: 6, slowFrames: 1, stalls: 1 });
  });

  it("reports again only after something changed and the interval passed, and retries what was not confirmed", () => {
    const meter = new SessionMeter("image");
    probed(meter);
    meter.describe({ backend: "webgpu" });
    const first = meter.due(0, true)!;
    meter.confirm(first.revision);
    expect(meter.due(REPORT_EVERY_MS * 2)).toBeNull();
    meter.exportFailed("no_encoder");
    meter.exportFailed("no_encoder");
    meter.exported();
    expect(meter.due(REPORT_EVERY_MS - 1)).toBeNull();
    const second = meter.due(REPORT_EVERY_MS)!;
    expect(second.report.usage).toMatchObject({ browserExports: 1, exportFailures: { no_encoder: 2 } });
    expect(second.report.usage).not.toHaveProperty("serverExports");
    expect(meter.due(REPORT_EVERY_MS * 2)?.revision).toBe(second.revision);
    expect(meter.due(REPORT_EVERY_MS * 2, true)?.revision).toBe(second.revision);
  });

  it("counts the moments the fast paths gave up", () => {
    const meter = new SessionMeter("video");
    meter.contextLost();
    meter.decodeFallback();
    meter.decodeFallback();
    meter.workerFailed();
    probed(meter);
    meter.describe({ backend: "unavailable" });
    expect(meter.due(0, true)?.report.usage).toMatchObject({ contextLosses: 1, decodeFallbacks: 2, workerFailures: 1 });
  });

  it("names the renderer backend the way the server expects", () => {
    expect(rendererBackend("webgl")).toBe("webgl");
    expect(rendererBackend("webgl2")).toBe("webgl");
    expect(rendererBackend("webgpu")).toBe("webgpu");
    expect(rendererBackend("canvas")).toBe("unavailable");
  });
});
