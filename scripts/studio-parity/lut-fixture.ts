import { cubeText } from "../../src/lib/studio/cube-lut";

export const LOOK_FILE = "look.cube";

export const LOOK_CUBE = cubeText(9, (r, g, b) => [Math.min(1, 0.06 + r * 0.9 + g * 0.08), Math.sqrt(g) * 0.85 + b * 0.1, Math.max(0, b * b * 0.8 + r * 0.05)], "Parity look");
