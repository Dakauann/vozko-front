import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BASEMAP_TOKENS,
  cssTokenColor,
  DISTRICT_FILL_ALPHA,
  HEAT_TOKEN,
  MAP_TOKEN_NAMES,
  basemapPalette,
  mapPalette,
  tokenToHex,
  tokenToHsl,
  type TokenReader,
} from "./palette";
import { heatLegendRamp, heatRamp } from "./heat";
import { toneStyle } from "./tones";
import { TONE_KEYS } from "./types";

const LIGHT: Record<string, string> = {
  "--background": "200 24% 97%",
  "--foreground": "206 15% 9%",
  "--card": "0 0% 100%",
  "--popover": "0 0% 100%",
  "--secondary": "204 20% 95%",
  "--muted": "204 16% 93%",
  "--muted-foreground": "206 9% 38%",
  "--accent-hover": "204 16% 89%",
  "--border": "204 14% 88%",
  "--border-strong": "205 12% 76%",
  "--control-edge": "205 12% 53%",
  "--primary": "164 100% 38%",
  "--chart-1": "164 100% 32%",
  "--chart-2": "231 60% 56%",
  "--chart-3": "43 92% 45%",
  "--chart-4": "199 89% 42%",
  "--chart-5": "321 50% 46%",
  "--warning-ink": "32 94% 29%",
  "--primary-edge": "164 100% 30%",
};

const reader = (tokens: Record<string, string>): TokenReader => (name) => tokens[name] ?? "";

describe("tokenToHsl", () => {
  it("turns a token triple into a colour MapLibre can parse", () => {
    expect(tokenToHsl(" 231 60% 56% ")).toBe("hsl(231, 60%, 56%)");
  });

  it("adds alpha when asked", () => {
    expect(tokenToHsl("231 60% 56%", 0.4)).toBe("hsla(231, 60%, 56%, 0.4)");
  });

  it.each(["", "red", "231 60%", "231 60% 56% 1", "a b c"])("refuses %j", (value) => {
    expect(tokenToHsl(value)).toBeNull();
  });
});

describe("tokenToHex", () => {
  it.each([
    ["0 0% 100%", "#ffffff"],
    ["206 15% 9%", "#14171a"],
    ["164 100% 38%", "#00c28e"],
    ["231 60% 56%", "#4b60d2"],
  ])("converts %s to %s", (token, hex) => {
    expect(tokenToHex(token)).toBe(hex);
  });

  it("refuses a value that is not a triple", () => {
    expect(tokenToHex("nope")).toBeNull();
  });
});

describe("basemapPalette", () => {
  it("maps every basemap role to a token in both themes", () => {
    for (const theme of ["light", "dark"] as const) {
      expect(Object.keys(BASEMAP_TOKENS[theme]).sort()).toEqual(
        ["boundary", "building", "halo", "label", "land", "landcover", "placeLabel", "rail", "road", "roadCasing", "water"],
      );
    }
  });

  it("draws light land on the canvas, water a step darker and roads on the sheet", () => {
    const palette = basemapPalette("light", reader(LIGHT));
    expect(palette?.land).toBe("hsl(200, 24%, 97%)");
    expect(palette?.water).toBe("hsl(204, 16%, 89%)");
    expect(palette?.road).toBe("hsl(0, 0%, 100%)");
    expect(palette?.roadCasing).toBe("hsl(204, 14%, 88%)");
    expect(palette?.label).toBe("hsl(206, 9%, 38%)");
    expect(palette?.placeLabel).toBe("hsl(206, 15%, 9%)");
  });

  it("keeps water darker than land in dark, the dark-map convention", () => {
    expect(BASEMAP_TOKENS.dark.water).toBe("--background");
    expect(BASEMAP_TOKENS.dark.land).toBe("--card");
    expect(BASEMAP_TOKENS.dark.road).toBe("--accent-hover");
  });

  it("refuses to build a palette when a token is missing", () => {
    const partial = Object.fromEntries(Object.entries(LIGHT).filter(([name]) => name !== "--border"));
    expect(basemapPalette("light", reader(partial))).toBeNull();
  });
});

describe("mapPalette", () => {
  it("resolves the data colours from the tokens", () => {
    const palette = mapPalette(reader(LIGHT), "light");
    expect(palette?.tones["chart-2"]).toBe("hsl(231, 60%, 56%)");
    expect(palette?.tones.neutral).toBe("hsl(206, 9%, 38%)");
    expect(palette?.surface).toBe("hsl(0, 0%, 100%)");
    expect(palette?.primary).toBe("hsl(164, 100%, 38%)");
    expect(palette?.primaryHex).toBe("#00c28e");
    expect(palette?.surfaceHex).toBe("#ffffff");
    expect(palette?.primaryEdgeHex).toBe("#009970");
    expect(palette?.mutedInk).toBe("hsl(206, 9%, 38%)");
  });

  it("paints an uncoloured dot in chart-2 and outlines clusters in chart-2 at 0.9, the artifact cluster ring", () => {
    const palette = mapPalette(reader(LIGHT), "light");
    expect(palette?.dot).toBe("hsl(231, 60%, 56%)");
    expect(palette?.clusterStroke).toBe("hsla(231, 60%, 56%, 0.9)");
  });

  it("fills a drawn area with the primary colour at 0.07", () => {
    expect(mapPalette(reader(LIGHT), "light")?.primaryFill).toBe("hsla(164, 100%, 38%, 0.07)");
  });

  it("builds the heat ramp from chart-2 in the direction of the theme", () => {
    expect(mapPalette(reader(LIGHT), "light")?.heat).toEqual(heatRamp("231 60% 56%", "light"));
    expect(mapPalette(reader(LIGHT), "dark")?.heat).toEqual(heatRamp("231 60% 56%", "dark"));
    expect(mapPalette(reader(LIGHT), "light")?.heatLegend).toEqual(heatLegendRamp("231 60% 56%", "light"));
  });

  it("rings approximate leads in the warning ink of the theme", () => {
    expect(mapPalette(reader(LIGHT), "light")?.approximate).toBe("hsl(32, 94%, 29%)");
    expect(mapPalette(reader({ ...LIGHT, "--warning-ink": "" }), "light")).toBeNull();
  });

  it("refuses to build a palette when a token is missing", () => {
    expect(mapPalette(reader({ ...LIGHT, "--chart-2": "" }), "light")).toBeNull();
    expect(mapPalette(reader({ ...LIGHT, "--primary-edge": "" }), "light")).toBeNull();
  });
});

describe("MAP_TOKEN_NAMES", () => {
  it("lists every token the map reads, once, so a theme change is noticed and nothing else is", () => {
    expect(MAP_TOKEN_NAMES).toEqual([
      "--accent-hover",
      "--background",
      "--border",
      "--border-strong",
      "--card",
      "--chart-2",
      "--chart-3",
      "--chart-4",
      "--chart-5",
      "--control-edge",
      "--foreground",
      "--muted",
      "--muted-foreground",
      "--popover",
      "--primary",
      "--primary-edge",
      "--secondary",
      "--warning-ink",
    ]);
  });
});

function themeTokens(selector: ":root" | ".dark"): Record<string, string> {
  const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");
  const opening = css.match(new RegExp(`\\n  ${selector.replace(".", "\\.")} \\{`));
  if (!opening || opening.index === undefined) throw new Error(`no ${selector} block in globals.css`);
  const end = css.indexOf("\n  }", opening.index + opening[0].length);
  const block = css.slice(opening.index, end);
  return Object.fromEntries([...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

function hueAndSaturation(value: string): [number, number] {
  const match = value.match(/^(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%/);
  if (!match) throw new Error(`not a token triple: ${value}`);
  return [Number(match[1]), Number(match[2])];
}

function hueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return Math.min(delta, 360 - delta);
}

describe("map tones against the real theme", () => {
  it.each([":root", ".dark"] as const)("never paints a classification dot in the selection green (%s)", (selector) => {
    const tokens = themeTokens(selector);
    const reserved = ["--primary", "--ring"].map((name) => tokens[name]);
    expect(reserved.every(Boolean)).toBe(true);
    for (const tone of TONE_KEYS) {
      const value = tokens[toneStyle(tone).token];
      expect(value, tone).toBeTruthy();
      expect(reserved, tone).not.toContain(value);
      const [hue, saturation] = hueAndSaturation(value);
      for (const green of reserved) {
        const [greenHue] = hueAndSaturation(green);
        expect(saturation < 25 || hueDistance(hue, greenHue) >= 30, tone).toBe(true);
      }
    }
  });
});

describe("cssTokenColor", () => {
  it("references the token so the legend follows the theme the map paints", () => {
    expect(cssTokenColor(HEAT_TOKEN)).toBe("hsl(var(--chart-2))");
    expect(cssTokenColor(HEAT_TOKEN, DISTRICT_FILL_ALPHA)).toBe("hsl(var(--chart-2) / 0.28)");
  });
});
