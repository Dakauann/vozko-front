import { describe, expect, it } from "vitest";

import { DEFAULT_PATTERN, drawPresetTile, PATTERN_PRESETS, patternIssue, patternLayout, patternPlacement, patternTileSize, scaledPattern, type Pattern, type TileContext } from "./pattern";

function preset(patch: Partial<Pattern> = {}): Pattern {
  return { ...DEFAULT_PATTERN, ...patch };
}

function recorder(): TileContext & { calls: string[] } {
  const calls: string[] = [];
  const note = (name: string) => (...args: unknown[]) => void calls.push(`${name}(${args.map((a) => (typeof a === "number" ? Math.round(a * 100) / 100 : a)).join(",")})`);
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    fillRect: note("fillRect"),
    beginPath: note("beginPath"),
    moveTo: note("moveTo"),
    lineTo: note("lineTo"),
    arc: note("arc"),
    quadraticCurveTo: note("quadraticCurveTo"),
    closePath: note("closePath"),
    fill: note("fill"),
    stroke: note("stroke"),
  };
}

describe("pattern paint", () => {
  it("accepts a preset and an uploaded tile with their own reference only", () => {
    expect(patternIssue(preset())).toBeNull();
    expect(patternIssue({ source: "asset", assetId: "m-1", size: 120, opacity: 0.8, tile: "brick-row", offset: 0.5 })).toBeNull();
  });

  it.each<[string, Pattern]>([
    ["an unknown source", preset({ source: "surface" as Pattern["source"] })],
    ["an unknown preset", preset({ presetId: "plaid" as Pattern["presetId"] })],
    ["a preset with an asset", preset({ assetId: "m-1" })],
    ["a preset without ink", preset({ color: "" })],
    ["an asset with a preset", { source: "asset", assetId: "m-1", presetId: "dots", size: 32, opacity: 1 }],
    ["an asset with ink", { source: "asset", assetId: "m-1", color: "#ff0000", size: 32, opacity: 1 }],
    ["an asset without its media", { source: "asset", assetId: " ", size: 32, opacity: 1 }],
    ["an unknown tile", preset({ tile: "spiral" as Pattern["tile"] })],
    ["a tile under 2 px", preset({ size: 1 })],
    ["a tile past 4096 px", preset({ size: 5000 })],
    ["tiles that overlap past 90 percent", preset({ size: 100, spacing: { x: -95, y: 0 } })],
    ["a gap past 2048 px", preset({ spacing: { x: 0, y: 3000 } })],
    ["a brick offset on a grid", preset({ offset: 0.5 })],
    ["a brick offset past one tile", preset({ tile: "brick-row", offset: 1.5 })],
    ["an angle past 180", preset({ angle: 200 })],
    ["an origin past one tile", preset({ origin: { x: 1.2, y: 0 } })],
    ["an opacity past 1", preset({ opacity: 2 })],
    ["an unknown blend", preset({ blendMode: "dissolve" as Pattern["blendMode"] })],
    ["a bad background", preset({ background: "white" })],
    ["a size that is not finite", preset({ size: Number.NaN })],
  ])("refuses %s", (_, pattern) => {
    expect(patternIssue(pattern)).not.toBeNull();
  });

  it("lays grid, brick and hex tiles on one repeating super tile", () => {
    expect(patternLayout(preset({ size: 20, spacing: { x: 10, y: 5 } }), 20, 20)).toMatchObject({ width: 30, height: 25 });
    const brick = patternLayout(preset({ tile: "brick-row", offset: 0.5 }), 32, 32);
    expect(brick).toMatchObject({ width: 32, height: 64 });
    expect(brick.placements).toEqual(expect.arrayContaining([{ x: 0, y: 0 }, { x: 16, y: 32 }, { x: -16, y: 32 }]));
    const column = patternLayout(preset({ tile: "brick-column", offset: 0.25 }), 32, 32);
    expect(column).toMatchObject({ width: 64, height: 32 });
    expect(column.placements).toEqual(expect.arrayContaining([{ x: 32, y: 8 }]));
    const hex = patternLayout(preset({ tile: "hex-row" }), 32, 32);
    expect(hex.width).toBe(32);
    expect(hex.height).toBeCloseTo(32 * Math.sqrt(3), 6);
    expect(hex.placements).toEqual(expect.arrayContaining([{ x: 16, y: (32 * Math.sqrt(3)) / 2 }]));
  });

  it("repeats a tile that spills past the super tile so the edges meet", () => {
    const overlap = patternLayout(preset({ size: 40, spacing: { x: -10, y: 0 } }), 40, 40);
    expect(overlap.width).toBe(30);
    expect(overlap.placements).toEqual(expect.arrayContaining([{ x: 0, y: 0 }, { x: -30, y: 0 }]));
    for (const p of overlap.placements) {
      expect(p.x + 40 > 0 && p.x < overlap.width && p.y + 40 > 0 && p.y < overlap.height).toBe(true);
    }
  });

  it("sizes uploaded tiles by width and keeps their aspect", () => {
    expect(patternTileSize(preset({ size: 24 }), null)).toEqual({ width: 24, height: 24 });
    expect(patternTileSize({ source: "asset", assetId: "m", size: 100, opacity: 1 }, { width: 400, height: 200 })).toEqual({ width: 100, height: 50 });
  });

  it("centers a tile on the layer and moves it by the origin phase", () => {
    const pattern = preset({ size: 20, origin: { x: 0.5, y: 0.25 }, angle: 30 });
    const layout = patternLayout(pattern, 20, 20);
    expect(patternPlacement(pattern, layout, { width: 200, height: 100 }, { width: 20, height: 20 })).toEqual({ x: 100, y: 50, rotation: 30, offsetX: 0, offsetY: 5 });
  });

  it("paints every preset with its ink over its paper", () => {
    for (const id of PATTERN_PRESETS) {
      const ctx = recorder();
      drawPresetTile(ctx, id, 10, "#ff0000", "#00000000");
      expect(ctx.calls[0]).toBe("fillRect(0,0,10,10)");
      expect(ctx.calls.some((call) => call.startsWith("fill(") || call.startsWith("stroke(") || call.startsWith("fillRect("))).toBe(true);
    }
    const bare = recorder();
    drawPresetTile(bare, "dots", 10, "#ff0000", "");
    expect(bare.calls).toContain("arc(5,5,2.5,0,6.28)");
    expect(bare.calls[0]).not.toBe("fillRect(0,0,10,10)");
  });

  it("scales tile size and gaps with the artboard and stays in range", () => {
    expect(scaledPattern(preset({ size: 40, spacing: { x: 10, y: -20 } }), 0.5)).toMatchObject({ size: 20, spacing: { x: 5, y: -10 } });
    expect(scaledPattern(preset({ size: 3 }), 0.1).size).toBe(2);
  });
});
