import type { StudioKind } from "./document";
import type { ExportFailure } from "./export";

export const RENDER_BACKENDS = ["webgl", "webgpu", "unavailable", "disabled"] as const;
export type RenderBackendName = (typeof RENDER_BACKENDS)[number];

export const SLOW_FRAME_MS = 16;
export const STALL_MS = 100;
export const REPORT_EVERY_MS = 60_000;

export interface DeviceCapabilities {
  backend: RenderBackendName;
  gpuVendor: string;
  gpuRenderer: string;
  webgpu: boolean;
  decode: boolean;
  encodeVideo: boolean;
  encodeAudio: boolean;
  pixelRatio: number;
  cores: number;
  memoryGb: number;
}

export interface SessionUsage {
  frames: number;
  slowFrames: number;
  stalls: number;
  contextLosses: number;
  decodeFallbacks: number;
  workerFailures: number;
  browserExports: number;
  exportFailures: Partial<Record<ExportFailure, number>>;
}

export interface CapabilityReport {
  kind: StudioKind;
  capabilities: DeviceCapabilities;
  usage: SessionUsage;
}

export interface DueReport {
  report: CapabilityReport;
  revision: number;
}

export function rendererBackend(name: string): RenderBackendName {
  if (name.startsWith("webgl")) return "webgl";
  return name === "webgpu" ? "webgpu" : "unavailable";
}

export class SessionMeter {
  private capabilities: Omit<DeviceCapabilities, "backend"> & { backend: RenderBackendName | null } = {
    backend: null,
    gpuVendor: "",
    gpuRenderer: "",
    webgpu: false,
    decode: false,
    encodeVideo: false,
    encodeAudio: false,
    pixelRatio: 0,
    cores: 0,
    memoryGb: 0,
  };
  private usage: SessionUsage = { frames: 0, slowFrames: 0, stalls: 0, contextLosses: 0, decodeFallbacks: 0, workerFailures: 0, browserExports: 0, exportFailures: {} };
  private isProbed = false;
  private revision = 0;
  private confirmed = -1;
  private attemptedAt = Number.NEGATIVE_INFINITY;
  private lastFrameAt: number | null = null;

  constructor(private readonly kind: StudioKind) {}

  describe(capabilities: Partial<DeviceCapabilities>): void {
    this.capabilities = { ...this.capabilities, ...capabilities };
    this.revision += 1;
  }

  probed(): void {
    this.isProbed = true;
    this.revision += 1;
  }

  rendered(renderMs: number, at: number, continuous: boolean): void {
    this.usage.frames += 1;
    if (renderMs > SLOW_FRAME_MS) this.usage.slowFrames += 1;
    if (continuous && this.lastFrameAt !== null && at - this.lastFrameAt > STALL_MS) this.usage.stalls += 1;
    this.lastFrameAt = continuous ? at : null;
    this.revision += 1;
  }

  contextLost(): void {
    this.count("contextLosses");
  }

  decodeFallback(): void {
    this.count("decodeFallbacks");
  }

  workerFailed(): void {
    this.count("workerFailures");
  }

  exported(): void {
    this.count("browserExports");
  }

  exportFailed(reason: ExportFailure): void {
    this.usage.exportFailures = { ...this.usage.exportFailures, [reason]: (this.usage.exportFailures[reason] ?? 0) + 1 };
    this.revision += 1;
  }

  due(now: number, force = false): DueReport | null {
    const backend = this.capabilities.backend;
    if (!this.isProbed || backend === null || this.revision === this.confirmed) return null;
    if (!force && now - this.attemptedAt < REPORT_EVERY_MS) return null;
    this.attemptedAt = now;
    return { revision: this.revision, report: { kind: this.kind, capabilities: { ...this.capabilities, backend }, usage: { ...this.usage, exportFailures: { ...this.usage.exportFailures } } } };
  }

  confirm(revision: number): void {
    this.confirmed = Math.max(this.confirmed, revision);
  }

  private count(counter: Exclude<keyof SessionUsage, "exportFailures">): void {
    this.usage[counter] += 1;
    this.revision += 1;
  }
}
