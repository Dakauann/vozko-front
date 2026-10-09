import { describe, expect, it, vi } from "vitest";

import { REPORT_EVERY_MS, type CapabilityReport } from "@/lib/studio/telemetry";

import { TelemetrySession, type TelemetryDeps } from "./telemetry-session";

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function setup(overrides: Partial<TelemetryDeps> = {}) {
  let now = 0;
  const sent: { report: CapabilityReport; keepalive: boolean }[] = [];
  const deps: TelemetryDeps = {
    kind: "video",
    sessionId: "6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
    renderingWanted: true,
    probe: async () => ({ gpuRenderer: "ANGLE", decode: true }),
    send: vi.fn(async (_session: string, report: CapabilityReport, keepalive: boolean) => {
      sent.push({ report, keepalive });
      return true;
    }),
    now: () => now,
    ...overrides,
  };
  return { session: new TelemetrySession(deps), deps, sent, advance: (ms: number) => void (now += ms) };
}

describe("studio telemetry session", () => {
  it("sends the first report once the probe and the renderer are both known", async () => {
    const { session, sent } = setup();
    session.backend("webgl");
    expect(sent).toHaveLength(0);
    await session.start();
    await settle();
    expect(sent).toHaveLength(1);
    expect(sent[0].report.capabilities).toMatchObject({ backend: "webgl", gpuRenderer: "ANGLE", decode: true });
  });

  it("reports an export right away and keeps the rest to the interval", async () => {
    const { session, sent, advance } = setup();
    await session.start();
    session.backend("webgl");
    await settle();
    session.rendered(4, true);
    session.tick();
    await settle();
    expect(sent).toHaveLength(1);
    session.exportFailed("no_encoder");
    await settle();
    expect(sent).toHaveLength(2);
    expect(sent[1].report.usage).toMatchObject({ frames: 1, exportFailures: { no_encoder: 1 } });
    session.rendered(4, true);
    advance(REPORT_EVERY_MS);
    session.tick();
    await settle();
    expect(sent).toHaveLength(3);
  });

  it("tries a failed report again on a later tick", async () => {
    const failing = vi.fn(async () => false);
    const { session, advance } = setup({ send: failing });
    await session.start();
    session.backend("webgl");
    await settle();
    advance(REPORT_EVERY_MS);
    session.tick();
    await settle();
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("reports a disabled renderer without waiting, survives a failing probe, and leaves with the last counters", async () => {
    const { session, sent } = setup({ renderingWanted: false, probe: async () => Promise.reject(new Error("no gpu")) });
    await session.start();
    await settle();
    expect(sent[0].report.capabilities.backend).toBe("disabled");
    session.workerFailed();
    session.stop();
    await settle();
    expect(sent.at(-1)).toMatchObject({ keepalive: true, report: { usage: { workerFailures: 1 } } });
  });

  it("starts again after a stop, as React does when it mounts twice", async () => {
    const { session, sent } = setup();
    void session.start();
    session.stop();
    await session.start();
    session.backend("webgl");
    await settle();
    expect(sent).toHaveLength(1);
  });
});
