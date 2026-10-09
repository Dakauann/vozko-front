import { getVersion, setWorkerUrl } from "maplibre-gl";

export const MAPLIBRE_WORKER_PATH = "/maplibre/maplibre-gl-worker.mjs";

export const MAP_LOAD_TIMEOUT_MS = 20_000;

export function maplibreWorkerUrl(version: string): string {
  return `${MAPLIBRE_WORKER_PATH}?v=${encodeURIComponent(version)}`;
}

let configured = false;

export function ensureMapLibreWorker(): void {
  if (configured) return;
  setWorkerUrl(maplibreWorkerUrl(getVersion()));
  configured = true;
}

export interface MapStartErrorEvent {
  error?: unknown;
  sourceId?: unknown;
  tile?: unknown;
}

function isResourceFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, url } = error as { status?: unknown; url?: unknown };
  return typeof status === "number" && typeof url === "string";
}

export function isFatalMapStartError(event: MapStartErrorEvent): boolean {
  if (event.sourceId !== undefined || event.tile !== undefined) return false;
  return !isResourceFailure(event.error);
}
