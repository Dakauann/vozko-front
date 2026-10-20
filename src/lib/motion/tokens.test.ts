import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import tailwindConfig from "../../../tailwind.config";
import {
  arrivalTransition,
  cssCubicBezier,
  durationMs,
  easing,
  stateTransition,
} from "./tokens";

const extend = tailwindConfig.theme.extend;

describe("motion tokens", () => {
  it("are the single source the tailwind config reads, never a second copy of the numbers", () => {
    const source = readFileSync(path.resolve(__dirname, "../../../tailwind.config.ts"), "utf8");
    expect(source).toContain('from "./src/lib/motion/tokens"');
    expect(source).not.toMatch(/cubic-bezier\(0\.33,\s*0,\s*0\.67,\s*1\)/);
    expect(source).not.toMatch(/cubic-bezier\(0\.1,\s*0\.9,\s*0\.2,\s*1\)/);
  });

  it("give CSS the same easings framer uses", () => {
    expect(extend.transitionTimingFunction).toEqual({
      DEFAULT: cssCubicBezier(easing.state),
      panel: cssCubicBezier(easing.panel),
      exit: cssCubicBezier(easing.exit),
    });
  });

  it("give CSS the same default duration framer uses", () => {
    expect(extend.transitionDuration).toEqual({ DEFAULT: `${durationMs.state}ms` });
  });

  it("drive the sanctioned typing loop and the accordion from the same curves", () => {
    expect(extend.animation["dot-pulse"]).toBe(
      `dot-pulse ${durationMs.dotPulse}ms ${cssCubicBezier(easing.state)} infinite`,
    );
    expect(extend.animation["accordion-down"]).toBe(
      `accordion-down ${durationMs.panel}ms ${cssCubicBezier(easing.panel)}`,
    );
    expect(extend.animation["accordion-up"]).toBe(
      `accordion-up ${durationMs.panel}ms ${cssCubicBezier(easing.panel)}`,
    );
  });

  it("make a live arrival a 150 ms decelerate and an in-place change a 150 ms symmetric ease", () => {
    expect(arrivalTransition).toEqual({ duration: 0.15, ease: easing.panel });
    expect(stateTransition).toEqual({ duration: 0.15, ease: easing.state });
  });

  it("write a curve the way CSS expects it", () => {
    expect(cssCubicBezier([0.1, 0.9, 0.2, 1])).toBe("cubic-bezier(0.1,0.9,0.2,1)");
  });
});
