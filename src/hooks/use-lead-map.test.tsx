import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchLeadMapTile = vi.fn();
vi.mock("@/app/actions/lead-map", () => ({
  fetchLeadMapTile: (...args: unknown[]) => fetchLeadMapTile(...args),
  fetchLeadMapDistricts: vi.fn(),
  fetchLeadMapLeftOut: vi.fn(),
  fetchLeadMapPoint: vi.fn(),
  fetchLeadMapSummary: vi.fn(),
  fetchLeadMapViewport: vi.fn(),
  listLeadAreas: vi.fn(),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" } }),
}));

import { SectionError } from "@/lib/analytics/section-query";
import { emptyLeadFilter } from "@/lib/leads/filters";
import type { LeadMapLayerRequest, LeadMapTileRequest } from "@/lib/leads/map-view";
import { tileId, tileKey } from "@/lib/maps/tiles";
import type { MapLayerResponse, SnappedViewport, TileRange } from "@/lib/maps/types";

import { useLeadMapTiles } from "./use-lead-map";

const PARAMS = { filter: emptyLeadFilter, q: "" };

function window(zoom: number, minX: number, maxX: number, minY: number, maxY: number): SnappedViewport {
  const tiles: TileRange = { zoom, minX, maxX, minY, maxY };
  return { zoom, tiles, key: tileKey(tiles), bbox: { south: -24, west: -47, north: -23, east: -46 } };
}

function request(viewport: SnappedViewport, colorBy?: string): LeadMapLayerRequest {
  return colorBy ? { viewport, colorBy } : { viewport };
}

function answerOf(tile: LeadMapTileRequest["tile"]): MapLayerResponse {
  return {
    kind: "points",
    points: [{ id: tileId(tile), lat: -23.5, lng: -46.6, precision: "exact", placement: "on_map", tone: "neutral", count: 1, leadIds: [] }],
  };
}

interface Pending {
  tile: string;
  signal: AbortSignal;
  answer: () => void;
  fail: (error: unknown) => void;
}

let pending: Pending[] = [];

function holdEveryTile() {
  fetchLeadMapTile.mockImplementation(
    (_params: unknown, tileRequest: LeadMapTileRequest, signal: AbortSignal) =>
      new Promise<MapLayerResponse>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        pending.push({ tile: tileId(tileRequest.tile), signal, answer: () => resolve(answerOf(tileRequest.tile)), fail: reject });
      }),
  );
}

function answerEveryTile() {
  fetchLeadMapTile.mockImplementation(async (_params: unknown, tileRequest: LeadMapTileRequest) => answerOf(tileRequest.tile));
}

function asked(): string[] {
  return fetchLeadMapTile.mock.calls.map((call) => tileId((call[1] as LeadMapTileRequest).tile));
}

function drawnIds(layer: MapLayerResponse | undefined): string[] {
  return layer?.kind === "points" ? layer.points.map((point) => point.id).sort() : [];
}

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function renderTiles(initial: LeadMapLayerRequest | null, enabled = true) {
  return renderHook(({ at, on }) => useLeadMapTiles(PARAMS, at, { enabled: on }), {
    wrapper: wrapper(),
    initialProps: { at: initial, on: enabled },
  });
}

async function answerAll() {
  await act(async () => {
    for (const tile of pending.splice(0)) tile.answer();
  });
}

describe("useLeadMapTiles", () => {
  beforeEach(() => {
    pending = [];
    fetchLeadMapTile.mockReset();
  });

  afterEach(() => {
    for (const tile of pending.splice(0)) tile.fail(new Error("test over"));
  });

  it("asks nothing while the map is off screen or has no viewport", () => {
    answerEveryTile();
    renderTiles(request(window(12, 1517, 1519, 2322, 2323)), false);
    renderTiles(null);
    expect(fetchLeadMapTile).not.toHaveBeenCalled();
  });

  it("asks for every visible tile once and merges the answers into one layer", async () => {
    answerEveryTile();
    const { result } = renderTiles(request(window(12, 1517, 1519, 2322, 2323)));
    await waitFor(() => expect(drawnIds(result.current.data)).toHaveLength(6));
    expect(asked().sort()).toEqual(["12/1517/2322", "12/1517/2323", "12/1518/2322", "12/1518/2323", "12/1519/2322", "12/1519/2323"]);
    expect(result.current.isError).toBe(false);
  });

  it("sends the colour with every tile", async () => {
    answerEveryTile();
    renderTiles(request(window(15, 12136, 12136, 18589, 18589), "interesse"));
    await waitFor(() => expect(fetchLeadMapTile).toHaveBeenCalledTimes(1));
    expect(fetchLeadMapTile).toHaveBeenCalledWith(PARAMS, { tile: { z: 15, x: 12136, y: 18589 }, colorBy: "interesse" }, expect.any(AbortSignal));
  });

  it("asks only for the new column when a pan crosses one tile edge", async () => {
    answerEveryTile();
    const { result, rerender } = renderTiles(request(window(12, 1517, 1519, 2322, 2323)));
    await waitFor(() => expect(drawnIds(result.current.data)).toHaveLength(6));
    const beforePan = fetchLeadMapTile.mock.calls.length;

    rerender({ at: request(window(12, 1518, 1520, 2322, 2323)), on: true });
    await waitFor(() => expect(drawnIds(result.current.data)).toContain("12/1520/2323"));

    expect(beforePan).toBe(6);
    expect(fetchLeadMapTile.mock.calls.length - beforePan).toBe(2);
    expect(asked().slice(beforePan).sort()).toEqual(["12/1520/2322", "12/1520/2323"]);
    expect(drawnIds(result.current.data)).toEqual(["12/1518/2322", "12/1518/2323", "12/1519/2322", "12/1519/2323", "12/1520/2322", "12/1520/2323"]);
  });

  it("keeps at most six tile requests in flight and starts the next as one answers", async () => {
    holdEveryTile();
    renderTiles(request(window(12, 1516, 1519, 2321, 2323)));
    await waitFor(() => expect(pending).toHaveLength(6));
    await new Promise((settle) => setTimeout(settle, 20));
    expect(fetchLeadMapTile).toHaveBeenCalledTimes(6);

    await act(async () => pending.shift()?.answer());
    await waitFor(() => expect(fetchLeadMapTile).toHaveBeenCalledTimes(7));
  });

  it("cancels the tiles that left the view, and never starts the ones still waiting", async () => {
    holdEveryTile();
    const { rerender } = renderTiles(request(window(12, 1516, 1519, 2321, 2323)));
    await waitFor(() => expect(pending).toHaveLength(6));
    const leaving = [...pending];

    rerender({ at: request(window(12, 1600, 1600, 2400, 2400)), on: true });
    await waitFor(() => expect(leaving.every((tile) => tile.signal.aborted)).toBe(true));
    await waitFor(() => expect(asked()).toContain("12/1600/2400"));
    expect(fetchLeadMapTile).toHaveBeenCalledTimes(7);
  });

  it("keeps the previous zoom drawn until every tile of the new zoom answers", async () => {
    holdEveryTile();
    const { result, rerender } = renderTiles(request(window(12, 1517, 1518, 2322, 2322)));
    await waitFor(() => expect(pending).toHaveLength(2));
    await answerAll();
    await waitFor(() => expect(drawnIds(result.current.data)).toEqual(["12/1517/2322", "12/1518/2322"]));

    rerender({ at: request(window(13, 3034, 3036, 4644, 4645)), on: true });
    await waitFor(() => expect(pending).toHaveLength(6));
    await act(async () => {
      for (const tile of pending.splice(0, 5)) tile.answer();
    });
    expect(drawnIds(result.current.data)).toEqual(["12/1517/2322", "12/1518/2322"]);

    await answerAll();
    await waitFor(() => expect(drawnIds(result.current.data)).toHaveLength(6));
    expect(drawnIds(result.current.data).every((id) => id.startsWith("13/"))).toBe(true);
  });

  it("reports a failed tile and asks again only for it", async () => {
    answerEveryTile();
    fetchLeadMapTile.mockImplementation(async (_params: unknown, tileRequest: LeadMapTileRequest) => {
      if (tileId(tileRequest.tile) === "12/1518/2322") throw new SectionError("bad", 400, "map_tile_invalid");
      return answerOf(tileRequest.tile);
    });
    const { result } = renderTiles(request(window(12, 1517, 1518, 2322, 2322)));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(drawnIds(result.current.data)).toEqual(["12/1517/2322"]);
    expect(result.current.error).toBeInstanceOf(SectionError);

    answerEveryTile();
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(asked()).toEqual(["12/1517/2322", "12/1518/2322", "12/1518/2322"]);
    expect(drawnIds(result.current.data)).toEqual(["12/1517/2322", "12/1518/2322"]);
  });
});
