import { describe, expect, it, vi } from "vitest";

import { createTileLimiter, latToMercatorY, mercatorYToLat, mergeTileLayers, MAX_TILE_ZOOM, snapViewport, tileId, visibleTiles } from "./tiles";

const saoPaulo = { south: -23.7, west: -46.8, north: -23.4, east: -46.4 };

describe("snapViewport", () => {
  it("snaps a São Paulo viewport to the zoom 10 tiles that cover it", () => {
    const snapped = snapViewport({ bbox: saoPaulo, zoom: 10 });
    expect(snapped?.tiles).toEqual({ zoom: 10, minX: 378, maxX: 380, minY: 580, maxY: 581 });
    expect(snapped?.zoom).toBe(10);
    expect(snapped?.bbox.west).toBeCloseTo(-47.109375, 12);
    expect(snapped?.bbox.east).toBeCloseTo(-46.0546875, 12);
    expect(snapped?.bbox.north).toBeCloseTo(-23.241346102386135, 12);
    expect(snapped?.bbox.south).toBeCloseTo(-23.885837699861998, 12);
    expect(snapped?.key).toBe("10/378:380/580:581");
  });

  it("uses the integer zoom below a fractional one", () => {
    const snapped = snapViewport({ bbox: saoPaulo, zoom: 12.8 });
    expect(snapped?.tiles).toEqual({ zoom: 12, minX: 1515, maxX: 1520, minY: 2321, maxY: 2325 });
    expect(snapped?.zoom).toBe(12);
  });

  it("gives the same key to small pans inside the same tiles, so the cache is reused", () => {
    const a = snapViewport({ bbox: saoPaulo, zoom: 10 });
    const b = snapViewport({ bbox: { south: -23.8, west: -47.0, north: -23.3, east: -46.1 }, zoom: 10.4 });
    expect(b?.key).toBe(a?.key);
  });

  it("always covers the viewport it was given", () => {
    const snapped = snapViewport({ bbox: saoPaulo, zoom: 14 });
    expect(snapped!.bbox.west).toBeLessThanOrEqual(saoPaulo.west);
    expect(snapped!.bbox.east).toBeGreaterThanOrEqual(saoPaulo.east);
    expect(snapped!.bbox.north).toBeGreaterThanOrEqual(saoPaulo.north);
    expect(snapped!.bbox.south).toBeLessThanOrEqual(saoPaulo.south);
  });

  it("covers the whole world with one tile at zoom 0", () => {
    const snapped = snapViewport({ bbox: { south: -60, west: -170, north: 60, east: 170 }, zoom: 0 });
    expect(snapped?.tiles).toEqual({ zoom: 0, minX: 0, maxX: 0, minY: 0, maxY: 0 });
    expect(snapped?.bbox.west).toBe(-180);
    expect(snapped?.bbox.east).toBe(180);
    expect(snapped?.bbox.north).toBeCloseTo(85.0511287798, 8);
    expect(snapped?.bbox.south).toBeCloseTo(-85.0511287798, 8);
  });

  it("clamps a viewport past the poles and the antimeridian", () => {
    const snapped = snapViewport({ bbox: { south: -89, west: -200, north: 89, east: 200 }, zoom: 2 });
    expect(snapped?.tiles).toEqual({ zoom: 2, minX: 0, maxX: 3, minY: 0, maxY: 3 });
  });

  it("clamps a negative zoom to 0 and a deep zoom to the deepest level", () => {
    expect(snapViewport({ bbox: saoPaulo, zoom: -2 })?.zoom).toBe(0);
    expect(snapViewport({ bbox: { south: -23.5501, west: -46.6301, north: -23.55, east: -46.63 }, zoom: 40 })?.zoom).toBe(MAX_TILE_ZOOM);
  });

  it.each([
    ["NaN in the box", { bbox: { ...saoPaulo, west: Number.NaN }, zoom: 10 }],
    ["an infinite zoom", { bbox: saoPaulo, zoom: Number.POSITIVE_INFINITY }],
    ["south above north", { bbox: { ...saoPaulo, south: -23.3 }, zoom: 10 }],
    ["west above east", { bbox: { ...saoPaulo, west: -46.3 }, zoom: 10 }],
  ])("refuses %s", (_, viewport) => {
    expect(snapViewport(viewport)).toBeNull();
  });
});

describe("mercator helpers", () => {
  it.each([0, -23.55, 45, -80])("round-trips latitude %s", (lat) => {
    expect(mercatorYToLat(latToMercatorY(lat))).toBeCloseTo(lat, 10);
  });
});

const point = (id: string, lat: number, lng: number, count = 1, placement: "on_map" | "approximate" = "on_map") => ({
  id,
  lat,
  lng,
  precision: "exact" as const,
  placement,
  tone: "neutral" as const,
  count,
  leadIds: [],
});

describe("visibleTiles", () => {
  it("lists every tile of the snapped window once, nearest the centre first", () => {
    const snapped = snapViewport({ bbox: saoPaulo, zoom: 10 });
    const tiles = visibleTiles(snapped!);
    expect(tiles).toHaveLength(6);
    expect(new Set(tiles.map(tileId)).size).toBe(6);
    expect(tiles.map(tileId)).toEqual(expect.arrayContaining(["10/378/580", "10/380/581"]));
    expect(tiles[0]).toEqual({ z: 10, x: 379, y: 580 });
  });

  it("gives one tile at zoom 0", () => {
    const snapped = snapViewport({ bbox: { south: -60, west: -170, north: 60, east: 170 }, zoom: 0 });
    expect(visibleTiles(snapped!)).toEqual([{ z: 0, x: 0, y: 0 }]);
  });

  it("keeps the tiles both sides of a pan share, so only the new column is asked for", () => {
    const before = visibleTiles(snapViewport({ bbox: saoPaulo, zoom: 10 })!).map(tileId);
    const after = visibleTiles(snapViewport({ bbox: { ...saoPaulo, west: -46.4, east: -46.0 }, zoom: 10 })!).map(tileId);
    expect(after.filter((id) => !before.includes(id))).toEqual(["10/381/580", "10/381/581"]);
  });
});

describe("tileId", () => {
  it("writes z/x/y", () => {
    expect(tileId({ z: 12, x: 1517, y: 2323 })).toBe("12/1517/2323");
  });
});

describe("mergeTileLayers", () => {
  it("has nothing to draw before any tile answers", () => {
    expect(mergeTileLayers([])).toBeNull();
  });

  it("joins the points of every tile, keeping a position once", () => {
    const merged = mergeTileLayers([
      { kind: "points", points: [point("a", -23.5, -46.6, 2)] },
      { kind: "points", points: [point("b", -23.4, -46.5), point("a", -23.5, -46.6, 2)] },
      { kind: "points", points: [] },
    ]);
    expect(merged).toEqual({ kind: "points", points: [point("a", -23.5, -46.6, 2), point("b", -23.4, -46.5)] });
  });

  it("adds up the parts of a cell split by a tile edge, with a centre weighted by people", () => {
    const merged = mergeTileLayers([
      { kind: "cells", cellSizeDegrees: 0.5, cells: [{ ix: -94, iy: -47, placement: "on_map", count: 3, lat: -23.4, lng: -46.9 }] },
      { kind: "cells", cellSizeDegrees: 0.5, cells: [
        { ix: -94, iy: -47, placement: "on_map", count: 1, lat: -23.2, lng: -46.7 },
        { ix: -94, iy: -47, placement: "approximate", count: 5, lat: -23.3, lng: -46.8 },
      ] },
    ]);
    expect(merged?.kind).toBe("cells");
    if (merged?.kind !== "cells") throw new Error("cells");
    expect(merged.cellSizeDegrees).toBe(0.5);
    expect(merged.cells).toHaveLength(2);
    const precise = merged.cells.find((cell) => cell.placement === "on_map")!;
    expect(precise.count).toBe(4);
    expect(precise.lat).toBeCloseTo(-23.35, 10);
    expect(precise.lng).toBeCloseTo(-46.85, 10);
    expect(merged.cells.find((cell) => cell.placement === "approximate")?.count).toBe(5);
  });

  it("folds point tiles into the cell grid once any tile answers cells, never mixing the two classes", () => {
    const merged = mergeTileLayers([
      { kind: "points", points: [point("a", -23.4, -46.9, 2), point("b", -23.3, -46.8, 1, "approximate")] },
      { kind: "cells", cellSizeDegrees: 0.5, cells: [{ ix: -94, iy: -47, placement: "on_map", count: 2, lat: -23.2, lng: -46.7 }] },
    ]);
    if (merged?.kind !== "cells") throw new Error("cells");
    expect(merged.cells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ix: -94, iy: -47, placement: "on_map", count: 4 }),
        expect.objectContaining({ ix: -94, iy: -47, placement: "approximate", count: 1, lat: -23.3, lng: -46.8 }),
      ]),
    );
    expect(merged.cells).toHaveLength(2);
    const precise = merged.cells.find((cell) => cell.placement === "on_map")!;
    expect(precise.lat).toBeCloseTo(-23.3, 10);
  });
});

describe("createTileLimiter", () => {
  const deferred = () => {
    let resolve: (value: string) => void = () => undefined;
    const promise = new Promise<string>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  };

  it("runs at most the limit at once and starts the next as one finishes", async () => {
    const limiter = createTileLimiter(2);
    const tasks = [deferred(), deferred(), deferred()];
    const started: number[] = [];
    const runs = tasks.map((task, index) =>
      limiter.run(undefined, () => {
        started.push(index);
        return task.promise;
      }),
    );
    expect(started).toEqual([0, 1]);
    tasks[0].resolve("first");
    await expect(runs[0]).resolves.toBe("first");
    expect(started).toEqual([0, 1, 2]);
    tasks[1].resolve("second");
    tasks[2].resolve("third");
    await expect(Promise.all(runs)).resolves.toEqual(["first", "second", "third"]);
  });

  it("drops a waiting tile whose request was cancelled, without ever starting it", async () => {
    const limiter = createTileLimiter(1);
    const first = deferred();
    const started: string[] = [];
    void limiter.run(undefined, () => {
      started.push("first");
      return first.promise;
    });
    const controller = new AbortController();
    const dropped = limiter.run(controller.signal, () => {
      started.push("dropped");
      return Promise.resolve("never");
    });
    const next = limiter.run(undefined, () => {
      started.push("next");
      return Promise.resolve("next");
    });
    controller.abort();
    await expect(dropped).rejects.toThrow();
    first.resolve("done");
    await expect(next).resolves.toBe("next");
    expect(started).toEqual(["first", "next"]);
  });

  it("refuses a tile already cancelled", async () => {
    const limiter = createTileLimiter(1);
    const controller = new AbortController();
    controller.abort();
    const task = vi.fn(() => Promise.resolve("never"));
    await expect(limiter.run(controller.signal, task)).rejects.toThrow();
    expect(task).not.toHaveBeenCalled();
  });

  it("frees the slot when a tile fails", async () => {
    const limiter = createTileLimiter(1);
    await expect(limiter.run(undefined, () => Promise.reject(new Error("tile failed")))).rejects.toThrow("tile failed");
    await expect(limiter.run(undefined, () => Promise.resolve("after"))).resolves.toBe("after");
  });
});
