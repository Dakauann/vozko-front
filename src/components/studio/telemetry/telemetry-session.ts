import type { StudioKind } from "@/lib/studio/document";
import type { ExportFailure } from "@/lib/studio/export";
import { SessionMeter, type CapabilityReport, type DeviceCapabilities, type RenderBackendName } from "@/lib/studio/telemetry";

export interface StudioTelemetry {
  backend(name: RenderBackendName): void;
  rendered(renderMs: number, continuous: boolean): void;
  contextLost(): void;
  decodeFallback(): void;
  workerFailed(): void;
  exported(): void;
  exportFailed(reason: ExportFailure): void;
}

export interface TelemetryDeps {
  kind: StudioKind;
  sessionId: string;
  renderingWanted: boolean;
  probe: () => Promise<Partial<DeviceCapabilities>>;
  send: (sessionId: string, report: CapabilityReport, keepalive: boolean) => Promise<boolean>;
  now: () => number;
}

export class TelemetrySession implements StudioTelemetry {
  private readonly meter: SessionMeter;
  private sending = false;
  private reported = false;
  private stopped = false;

  constructor(private readonly deps: TelemetryDeps) {
    this.meter = new SessionMeter(deps.kind);
    if (!deps.renderingWanted) this.meter.describe({ backend: "disabled" });
  }

  async start(): Promise<void> {
    this.stopped = false;
    const capabilities = await this.deps.probe().catch(() => ({}));
    if (this.stopped) return;
    this.meter.describe(capabilities);
    this.meter.probed();
    this.flush(!this.reported);
  }

  backend(name: RenderBackendName): void {
    this.meter.describe({ backend: name });
    this.flush(!this.reported);
  }

  rendered(renderMs: number, continuous: boolean): void {
    this.meter.rendered(renderMs, this.deps.now(), continuous);
  }

  contextLost(): void {
    this.meter.contextLost();
  }

  decodeFallback(): void {
    this.meter.decodeFallback();
  }

  workerFailed(): void {
    this.meter.workerFailed();
  }

  exported(): void {
    this.meter.exported();
    this.flush(true);
  }

  exportFailed(reason: ExportFailure): void {
    this.meter.exportFailed(reason);
    this.flush(true);
  }

  tick(): void {
    this.flush(false);
  }

  hide(): void {
    this.flush(true, true);
  }

  stop(): void {
    this.flush(true, true);
    this.stopped = true;
  }

  private flush(force: boolean, keepalive = false): void {
    if (this.stopped || (this.sending && !keepalive)) return;
    const due = this.meter.due(this.deps.now(), force);
    if (!due) return;
    this.sending = true;
    void this.deps
      .send(this.deps.sessionId, due.report, keepalive)
      .then((ok) => {
        if (!ok) return;
        this.meter.confirm(due.revision);
        this.reported = true;
      })
      .catch(() => undefined)
      .finally(() => {
        this.sending = false;
      });
  }
}
