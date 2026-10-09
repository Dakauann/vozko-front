import type { Fit } from "./document";

export interface FitRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export function fitRect(sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number, fit: Fit): FitRect {
  const sourceRatio = sourceWidth / sourceHeight;
  const boxRatio = boxWidth / boxHeight;
  if (fit === "cover") {
    const sw = sourceRatio > boxRatio ? sourceHeight * boxRatio : sourceWidth;
    const sh = sourceRatio > boxRatio ? sourceHeight : sourceWidth / boxRatio;
    return { sx: (sourceWidth - sw) / 2, sy: (sourceHeight - sh) / 2, sw, sh, dx: 0, dy: 0, dw: boxWidth, dh: boxHeight };
  }
  const dw = sourceRatio > boxRatio ? boxWidth : boxHeight * sourceRatio;
  const dh = sourceRatio > boxRatio ? boxWidth / sourceRatio : boxHeight;
  return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight, dx: (boxWidth - dw) / 2, dy: (boxHeight - dh) / 2, dw, dh };
}
