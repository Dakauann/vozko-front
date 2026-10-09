import { describe, expect, it, vi } from "vitest";

const maplibre = vi.hoisted(() => ({ setWorkerUrl: vi.fn(), getVersion: vi.fn(() => "6.13.0") }));
vi.mock("maplibre-gl", () => maplibre);

import { MAPLIBRE_WORKER_PATH, ensureMapLibreWorker, isFatalMapStartError, maplibreWorkerUrl } from "./maplibre-worker";

describe("the MapLibre worker", () => {
  it("is served from our own origin, versioned so a new release never meets an old cached worker", () => {
    expect(MAPLIBRE_WORKER_PATH).toBe("/maplibre/maplibre-gl-worker.mjs");
    expect(maplibreWorkerUrl("6.13.0")).toBe("/maplibre/maplibre-gl-worker.mjs?v=6.13.0");
    expect(maplibreWorkerUrl("7.0.0-beta 1")).toBe("/maplibre/maplibre-gl-worker.mjs?v=7.0.0-beta%201");
  });

  it("points MapLibre at that copy once, with the installed version", () => {
    ensureMapLibreWorker();
    ensureMapLibreWorker();
    expect(maplibre.setWorkerUrl).toHaveBeenCalledTimes(1);
    expect(maplibre.setWorkerUrl).toHaveBeenCalledWith("/maplibre/maplibre-gl-worker.mjs?v=6.13.0");
  });
});

describe("isFatalMapStartError", () => {
  it("treats an error the map raises on its own before loading as fatal", () => {
    expect(isFatalMapStartError({ error: new Error("Worker failed to load. Check that the worker URL is correct") })).toBe(true);
    expect(isFatalMapStartError({})).toBe(true);
  });

  it("lets a missing style resource pass, because the map still loads without it", () => {
    expect(isFatalMapStartError({ error: Object.assign(new Error("Not Found"), { status: 404, url: "https://tiles.example/sprite.json" }) })).toBe(false);
  });

  it("lets a source or tile error pass", () => {
    expect(isFatalMapStartError({ error: new Error("boom"), sourceId: "points" })).toBe(false);
    expect(isFatalMapStartError({ error: new Error("boom"), tile: {} })).toBe(false);
  });
});
