import { describe, expect, it } from "vitest";

import {
  DEFAULT_COMPOSER_LINES,
  GROW_COMPOSER_LINES,
  MAX_COMPOSER_LINES,
  MIN_COMPOSER_LINES,
  clampComposerHeight,
  composerBoxHeight,
  composerLine,
  composerLines,
  composerMaxHeight,
} from "./composer-height";

const REM = 16;

describe("composer sizes", () => {
  it("measures in whole lines: two at least, three by default, ten before it scrolls", () => {
    expect(composerLine(REM)).toBe(24);
    expect(composerLines(MIN_COMPOSER_LINES, REM)).toBe(68);
    expect(composerLines(DEFAULT_COMPOSER_LINES, REM)).toBe(92);
    expect(composerLines(GROW_COMPOSER_LINES, REM)).toBe(260);
    expect(composerLines(MAX_COMPOSER_LINES, REM)).toBe(500);
  });

  it("scales with the root font size, like the rest of the interface", () => {
    expect(composerLine(14.72)).toBe(22);
    expect(composerLines(DEFAULT_COMPOSER_LINES, 14.72)).toBe(85);
  });

  it("never lets the box take more than half the screen", () => {
    expect(composerMaxHeight(1200, REM)).toBe(500);
    expect(composerMaxHeight(600, REM)).toBe(300);
    expect(composerMaxHeight(100, REM)).toBe(68);
  });

  it("does not cap by the screen before the screen is known", () => {
    expect(composerMaxHeight(0, REM)).toBe(500);
  });

  it("keeps a chosen height between the limits, in whole pixels", () => {
    expect(clampComposerHeight(10, 900, REM)).toBe(68);
    expect(clampComposerHeight(150.4, 900, REM)).toBe(150);
    expect(clampComposerHeight(2000, 900, REM)).toBe(450);
  });
});

describe("composerBoxHeight", () => {
  it("shows the chosen height while the text fits in it", () => {
    expect(composerBoxHeight(44, 92, 900, REM)).toBe(92);
  });

  it("grows with the text up to the cap, then the text scrolls", () => {
    expect(composerBoxHeight(150, 92, 900, REM)).toBe(150);
    expect(composerBoxHeight(2000, 92, 900, REM)).toBe(260);
  });

  it("keeps a height chosen above the cap", () => {
    expect(composerBoxHeight(44, 400, 900, REM)).toBe(400);
    expect(composerBoxHeight(2000, 400, 900, REM)).toBe(400);
  });

  it("fits a short screen", () => {
    expect(composerBoxHeight(2000, 92, 400, REM)).toBe(200);
    expect(composerBoxHeight(2000, 400, 400, REM)).toBe(200);
  });
});
