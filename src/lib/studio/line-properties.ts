export const LINE_GROUPS = ["trim", "wave", "wiggle", "taper"] as const;

export type LineGroup = (typeof LINE_GROUPS)[number];

export const LINE_PROPERTIES = [
  "trimStart",
  "trimEnd",
  "trimOffset",
  "waveAmount",
  "waveLength",
  "waveSpeed",
  "wavePhase",
  "wiggleSize",
  "wiggleDetail",
  "wiggleRate",
  "taperStartLength",
  "taperEndLength",
  "taperStartWidth",
  "taperEndWidth",
  "taperStartEase",
  "taperEndEase",
] as const;

export type LineProperty = (typeof LINE_PROPERTIES)[number];

export const LINE_SLOTS = {
  trimStart: ["trim", "start"],
  trimEnd: ["trim", "end"],
  trimOffset: ["trim", "offset"],
  waveAmount: ["wave", "amount"],
  waveLength: ["wave", "wavelength"],
  waveSpeed: ["wave", "speed"],
  wavePhase: ["wave", "phase"],
  wiggleSize: ["wiggle", "size"],
  wiggleDetail: ["wiggle", "detail"],
  wiggleRate: ["wiggle", "rate"],
  taperStartLength: ["taper", "startLength"],
  taperEndLength: ["taper", "endLength"],
  taperStartWidth: ["taper", "startWidth"],
  taperEndWidth: ["taper", "endWidth"],
  taperStartEase: ["taper", "startEase"],
  taperEndEase: ["taper", "endEase"],
} as const satisfies Record<LineProperty, readonly [LineGroup, string]>;

export const LINE_RANGES: Record<LineProperty, readonly [number, number]> = {
  trimStart: [0, 1],
  trimEnd: [0, 1],
  trimOffset: [-3600, 3600],
  waveAmount: [0, 500],
  waveLength: [8, 4000],
  waveSpeed: [-20, 20],
  wavePhase: [-3600, 3600],
  wiggleSize: [0, 500],
  wiggleDetail: [0.05, 10],
  wiggleRate: [0, 30],
  taperStartLength: [0, 1],
  taperEndLength: [0, 1],
  taperStartWidth: [0, 1],
  taperEndWidth: [0, 1],
  taperStartEase: [-1, 1],
  taperEndEase: [-1, 1],
};

export const WIGGLE_SEED_RANGE = [0, 9999] as const;

export function isLineProperty(property: string): property is LineProperty {
  return (LINE_PROPERTIES as readonly string[]).includes(property);
}

export function lineGroupOf(property: LineProperty): LineGroup {
  return LINE_SLOTS[property][0];
}

export function linePropertiesOf(group: LineGroup): LineProperty[] {
  return LINE_PROPERTIES.filter((property) => LINE_SLOTS[property][0] === group);
}
