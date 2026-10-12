export const LOTTIE_GAP_CODES = [
  "expression",
  "effects",
  "image",
  "text",
  "audio",
  "camera",
  "layerKind",
  "trackMatte",
  "threeD",
  "timeRemap",
  "timeStretch",
  "skew",
  "anchorMotion",
  "negativeScale",
  "blendMode",
  "gradient",
  "merge",
  "repeater",
  "roundCorners",
  "twist",
  "offsetPath",
  "pucker",
  "zigzag",
  "shapeKind",
  "starRoundness",
  "trimOnFill",
  "doubleTrim",
  "strokeWidthMotion",
  "dashMotion",
  "maskMode",
  "maskInMovingGroup",
  "missingAsset",
  "outOfBounds",
  "tooLong",
  "empty",
  "invalid",
] as const;

export type LottieGapCode = (typeof LOTTIE_GAP_CODES)[number];

export interface LottieGap {
  code: LottieGapCode;
  where: string;
}

export class LottieGaps {
  readonly list: LottieGap[] = [];

  add(code: LottieGapCode, where: string): void {
    if (this.list.some((gap) => gap.code === code && gap.where === where)) return;
    this.list.push({ code, where });
  }

  get empty(): boolean {
    return this.list.length === 0;
  }
}
