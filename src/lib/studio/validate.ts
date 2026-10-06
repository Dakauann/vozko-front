import {
  DOCUMENT_VERSION,
  IMAGE_SCHEMA,
  SHAPE_KINDS,
  STUDIO_LIMITS,
  VIDEO_ASPECTS,
  VIDEO_SCHEMA,
  BLEND_MODES,
  FRAME_KINDS,
  MOTION_EDGES,
  type Clip,
  type Marker,
  type Motion,
  type Gradient,
  type ImageDocument,
  type Layer,
  type StudioDocument,
  type StudioGroup,
  type StudioKind,
  type Track,
  type Transform,
  type VideoDocument,
} from "./document";
import { isFontId } from "./fonts";
import { KEYFRAME_LIMITS, keyframeCount, keyframesIssue } from "./keyframes";

export const ISSUE_FIELDS = {
  kind: "kind",
  name: "name",
  document: "document",
  canvas: "document.canvas",
  layers: "document.layers",
  tracks: "document.tracks",
  markers: "document.markers",
} as const;

export type IssueField = (typeof ISSUE_FIELDS)[keyof typeof ISSUE_FIELDS];

export type IssueCode = "required" | "invalid" | "unknown" | "too_large" | "too_many" | "out_of_range" | "duplicate" | "overlap";

export interface DocumentIssue {
  field: IssueField;
  code: IssueCode;
}

type Kind = "string" | "bool" | "number" | "int" | ObjectSpec | ArraySpec | PointerSpec;
type ObjectSpec = { object: Record<string, Kind> };
type ArraySpec = { array: Kind };
type PointerSpec = { pointer: ObjectSpec };

const transformSpec: ObjectSpec = { object: { x: "number", y: "number", w: "number", h: "number", rotation: "number", opacity: "number" } };

const gradientSpec: PointerSpec = { pointer: { object: { from: "string", to: "string", angle: "number" } } };

const layerSpec: ObjectSpec = {
  object: {
    id: "string",
    type: "string",
    name: "string",
    transform: transformSpec,
    hidden: "bool",
    locked: "bool",
    groupId: "string",
    assetId: "string",
    crop: { pointer: { object: { x: "number", y: "number", w: "number", h: "number" } } },
    flipX: "bool",
    flipY: "bool",
    radius: "number",
    filters: { pointer: { object: { brightness: "number", contrast: "number", saturation: "number", blur: "number" } } },
    text: "string",
    fontId: "string",
    fontSize: "number",
    fontWeight: "int",
    italic: "bool",
    align: "string",
    lineHeight: "number",
    letterSpacing: "number",
    fill: "string",
    stroke: "string",
    strokeWidth: "number",
    dash: "bool",
    shadow: { pointer: { object: { color: "string", blur: "number", x: "number", y: "number" } } },
    shape: "string",
    arrowStart: "bool",
    arrowEnd: "bool",
    iconId: "string",
    blendMode: "string",
    clip: "bool",
    gradient: gradientSpec,
    highlight: { pointer: { object: { color: "string", radius: "number" } } },
    curve: "number",
    frame: "string",
  },
};

const imageSpec: ObjectSpec = {
  object: {
    schema: "string",
    version: "int",
    canvas: { object: { width: "int", height: "int", background: "string", gradient: gradientSpec } },
    layers: { array: layerSpec },
    groups: { array: { object: { id: "string", parentId: "string", name: "string" } } },
  },
};

const motionSpec: ObjectSpec = { object: { edge: "string", durationMs: "int" } };

const keyframeTrackSpec: ArraySpec = { array: { object: { atMs: "int", value: "number", easing: "string" } } };

const keyframesSpec: PointerSpec = {
  pointer: { object: { x: keyframeTrackSpec, y: keyframeTrackSpec, scale: keyframeTrackSpec, rotation: keyframeTrackSpec, opacity: keyframeTrackSpec } },
};

const clipSpec: ObjectSpec = {
  object: {
    id: "string",
    type: "string",
    assetId: "string",
    startMs: "int",
    durationMs: "int",
    trimInMs: "int",
    volume: "number",
    fadeInMs: "int",
    fadeOutMs: "int",
    fit: "string",
    transform: transformSpec,
    layer: { pointer: layerSpec },
    linkId: "string",
    motionIn: { pointer: motionSpec },
    motionOut: { pointer: motionSpec },
    keyframes: keyframesSpec,
    disabled: "bool",
  },
};

const videoSpec: ObjectSpec = {
  object: {
    schema: "string",
    version: "int",
    canvas: { object: { aspect: "string", background: "string" } },
    durationMs: "int",
    tracks: { array: { object: { id: "string", kind: "string", name: "string", hidden: "bool", locked: "bool", muted: "bool", clips: { array: clipSpec } } } },
    markers: { array: { object: { id: "string", atMs: "int", label: "string" } } },
  },
};

const INVALID = Symbol("invalid");

type Decoded = unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function zeroOf(kind: Kind): Decoded {
  if (kind === "string") return "";
  if (kind === "bool") return false;
  if (kind === "number" || kind === "int") return 0;
  if ("pointer" in kind) return undefined;
  if ("array" in kind) return [];
  return decodeObject({}, kind);
}

function decodeValue(value: unknown, kind: Kind): Decoded | typeof INVALID {
  if (value === null) return zeroOf(kind);
  if (kind === "string") return typeof value === "string" ? value : INVALID;
  if (kind === "bool") return typeof value === "boolean" ? value : INVALID;
  if (kind === "number") return typeof value === "number" && Number.isFinite(value) ? value : INVALID;
  if (kind === "int") return typeof value === "number" && Number.isInteger(value) ? value : INVALID;
  if ("pointer" in kind) return decodeValue(value, kind.pointer);
  if ("array" in kind) {
    if (!Array.isArray(value)) return INVALID;
    const out: Decoded[] = [];
    for (const item of value) {
      const decoded = decodeValue(item, kind.array);
      if (decoded === INVALID) return INVALID;
      out.push(decoded);
    }
    return out;
  }
  return isRecord(value) ? decodeObject(value, kind) : INVALID;
}

function decodeObject(value: Record<string, unknown>, spec: ObjectSpec): Decoded | typeof INVALID {
  const out: Record<string, Decoded> = {};
  for (const key of Object.keys(value)) {
    if (!(key in spec.object)) return INVALID;
  }
  for (const [key, kind] of Object.entries(spec.object)) {
    const decoded = key in value && value[key] !== undefined ? decodeValue(value[key], kind) : zeroOf(kind);
    if (decoded === INVALID) return INVALID;
    out[key] = decoded;
  }
  return out;
}

const COLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const TOKEN = /^[a-z0-9][a-z0-9_-]*$/;
const ALIGNS = new Set(["", "left", "center", "right"]);

function runes(value: string): number {
  return [...value].length;
}

function within(v: number, lo: number, hi: number): boolean {
  return Number.isFinite(v) && v >= lo && v <= hi;
}

const BLEND_VALUES = new Set<string>(["", ...BLEND_MODES]);
const FRAME_VALUES = new Set<string>(["", ...FRAME_KINDS]);

function gradientValid(g: Gradient | undefined): boolean {
  return !g || (isValidColor(g.from, true) && isValidColor(g.to, true) && within(g.angle, -360, 360));
}

export function isValidColor(color: string, required: boolean): boolean {
  if (color === "") return !required;
  return COLOR.test(color);
}

export function isValidToken(token: string): boolean {
  return runes(token) <= STUDIO_LIMITS.maxTokenRunes && TOKEN.test(token);
}

type DecodedLayer = Required<Pick<Layer, "id" | "type" | "transform">> & Omit<Layer, "id" | "type" | "transform"> & Record<string, unknown>;

function layerTransformIssue(t: Transform): IssueCode | null {
  if (!within(t.x, -1, 2) || !within(t.y, -1, 2)) return "out_of_range";
  if (!within(t.w, 0.001, 4) || !within(t.h, 0.001, 4)) return "out_of_range";
  if (!within(t.rotation, -360, 360) || !within(t.opacity, 0, 1)) return "out_of_range";
  return null;
}

function imageLayerIssue(l: DecodedLayer): IssueCode | null {
  if ((l.assetId ?? "").trim() === "") return "required";
  const c = l.crop;
  if (c && (!within(c.x, 0, 1) || !within(c.y, 0, 1) || !within(c.w, 0.01, 1) || !within(c.h, 0.01, 1) || c.x + c.w > 1.0001 || c.y + c.h > 1.0001)) {
    return "out_of_range";
  }
  const f = l.filters;
  if (f && (!within(f.brightness, -1, 1) || !within(f.contrast, -100, 100) || !within(f.saturation, -2, 10) || !within(f.blur, 0, 40))) {
    return "out_of_range";
  }
  return null;
}

function textLayerIssue(l: DecodedLayer): IssueCode | null {
  const text = l.text ?? "";
  if (text.trim() === "" || runes(text) > STUDIO_LIMITS.maxTextRunes) return "invalid";
  if (!isFontId(l.fontId)) return "unknown";
  if (!within(l.fontSize ?? 0, 0.005, 0.5) || !within(l.lineHeight ?? 0, 0, 4) || !within(l.letterSpacing ?? 0, -0.5, 2)) return "out_of_range";
  const weight = l.fontWeight ?? 0;
  if (weight !== 0 && (weight < 100 || weight > 900 || weight % 100 !== 0)) return "out_of_range";
  if (!ALIGNS.has(l.align ?? "")) return "unknown";
  return null;
}

export function layerIssue(layer: Layer): IssueCode | null {
  const l = layer as DecodedLayer;
  if (!isValidToken(l.id) || ((l.groupId ?? "") !== "" && !isValidToken(l.groupId ?? "")) || runes(l.name ?? "") > STUDIO_LIMITS.maxLayerNameRunes) {
    return "invalid";
  }
  const transformCode = layerTransformIssue(l.transform);
  if (transformCode) return transformCode;
  if (!isValidColor(l.fill ?? "", false) || !isValidColor(l.stroke ?? "", false) || !within(l.strokeWidth ?? 0, 0, 200) || !within(l.radius ?? 0, 0, 1)) {
    return "invalid";
  }
  const s = l.shadow;
  if (s && (!isValidColor(s.color, true) || !within(s.blur, 0, 200) || !within(s.x, -500, 500) || !within(s.y, -500, 500))) return "invalid";
  if (!BLEND_VALUES.has(l.blendMode ?? "") || !FRAME_VALUES.has(l.frame ?? "")) return "unknown";
  const h = l.highlight;
  if (!gradientValid(l.gradient) || (h && (!isValidColor(h.color, true) || !within(h.radius, 0, 1)))) return "invalid";
  if (!within(l.curve ?? 0, -1, 1)) return "out_of_range";
  switch (l.type) {
    case "image":
      return imageLayerIssue(l);
    case "text":
      return textLayerIssue(l);
    case "shape":
      return (SHAPE_KINDS as readonly string[]).includes(l.shape ?? "") ? null : "unknown";
    case "icon":
      return isValidToken(l.iconId ?? "") ? null : "invalid";
  }
  return "unknown";
}

function issue(field: IssueField, code: IssueCode): DocumentIssue {
  return { field, code };
}

function imageDocumentIssue(d: ImageDocument): DocumentIssue | null {
  if (d.schema !== IMAGE_SCHEMA || d.version !== DOCUMENT_VERSION) return issue(ISSUE_FIELDS.document, "unknown");
  const { width, height, background } = d.canvas;
  const { minCanvasSide: lo, maxCanvasSide: hi } = STUDIO_LIMITS;
  if (width < lo || width > hi || height < lo || height > hi) return issue(ISSUE_FIELDS.canvas, "out_of_range");
  if (!isValidColor(background, false) || !gradientValid(d.canvas.gradient)) return issue(ISSUE_FIELDS.canvas, "invalid");
  if (d.layers.length > STUDIO_LIMITS.maxLayers || (d.groups ?? []).length > STUDIO_LIMITS.maxLayers) return issue(ISSUE_FIELDS.layers, "too_many");
  const seen = new Set<string>();
  for (const layer of d.layers) {
    if (seen.has(layer.id)) return issue(ISSUE_FIELDS.layers, "duplicate");
    seen.add(layer.id);
    const code = layerIssue(layer);
    if (code) return issue(ISSUE_FIELDS.layers, code);
  }
  const groupCode = groupsIssue(d.groups ?? []);
  return groupCode ? issue(ISSUE_FIELDS.layers, groupCode) : null;
}

function groupsIssue(groups: readonly StudioGroup[]): IssueCode | null {
  const parents = new Map<string, string>();
  for (const g of groups) {
    if (!isValidToken(g.id) || ((g.parentId ?? "") !== "" && !isValidToken(g.parentId ?? "")) || runes(g.name ?? "") > STUDIO_LIMITS.maxLayerNameRunes) return "invalid";
    if (parents.has(g.id)) return "duplicate";
    parents.set(g.id, g.parentId ?? "");
  }
  for (const g of groups) {
    let steps = 0;
    for (let at = g.parentId ?? ""; at !== ""; at = parents.get(at) ?? "") {
      if (!parents.has(at) || at === g.id || steps > groups.length) return "invalid";
      steps++;
    }
  }
  return null;
}

function clipTransformIssue(t: Transform): IssueCode | null {
  if (!within(t.x, 0, 1) || !within(t.y, 0, 1) || !within(t.opacity, 0, 1)) return "out_of_range";
  if (!within(t.w, 0.001, 4) || !within(t.h, 0.001, 4) || !within(t.rotation, -360, 360)) return "out_of_range";
  return null;
}

export function clipIssue(c: Clip, kind: Track["kind"], durationMs: number): IssueCode | null {
  if (c.startMs < 0 || c.trimInMs < 0 || c.durationMs < STUDIO_LIMITS.minClipMs || c.startMs + c.durationMs > durationMs) return "out_of_range";
  if (c.fadeInMs < 0 || c.fadeOutMs < 0 || c.fadeInMs + c.fadeOutMs > c.durationMs) return "out_of_range";
  if (!within(c.volume, 0, STUDIO_LIMITS.maxVolume)) return "out_of_range";
  if ((c.linkId ?? "") !== "" && !isValidToken(c.linkId ?? "")) return "invalid";
  const assetId = (c.assetId ?? "").trim();
  if (kind === "audio") return c.type !== "audio" || assetId === "" || c.motionIn || c.motionOut || c.keyframes ? "invalid" : null;
  switch (c.type) {
    case "video":
    case "image":
      if (assetId === "" || (c.fit !== "cover" && c.fit !== "contain")) return "invalid";
      break;
    case "overlay": {
      if (!c.layer || (c.assetId ?? "") !== "") return "invalid";
      const code = layerIssue(c.layer);
      if (code) return code;
      break;
    }
    default:
      return "unknown";
  }
  const motionCode = motionIssue(c.motionIn, c.motionOut, c.durationMs);
  if (motionCode) return motionCode;
  const keyframeCode = keyframesIssue(c.keyframes, c.transform);
  if (keyframeCode) return keyframeCode;
  return clipTransformIssue(c.transform);
}

export function motionIssue(motionIn: Motion | undefined, motionOut: Motion | undefined, durationMs: number): IssueCode | null {
  let total = 0;
  for (const motion of [motionIn, motionOut]) {
    if (!motion) continue;
    if (!(MOTION_EDGES as readonly string[]).includes(motion.edge)) return "unknown";
    if (motion.durationMs < STUDIO_LIMITS.minClipMs) return "out_of_range";
    total += motion.durationMs;
  }
  return total > durationMs ? "out_of_range" : null;
}

function markersIssue(markers: readonly Marker[]): DocumentIssue | null {
  if (markers.length > STUDIO_LIMITS.maxMarkers) return issue(ISSUE_FIELDS.markers, "too_many");
  const seen = new Set<string>();
  for (const marker of markers) {
    if (!isValidToken(marker.id)) return issue(ISSUE_FIELDS.markers, "invalid");
    if (seen.has(marker.id)) return issue(ISSUE_FIELDS.markers, "duplicate");
    if (marker.atMs < 0 || marker.atMs > STUDIO_LIMITS.maxVideoMs) return issue(ISSUE_FIELDS.markers, "out_of_range");
    if (runes(marker.label ?? "") > STUDIO_LIMITS.maxMarkerLabelRunes) return issue(ISSUE_FIELDS.markers, "too_large");
    seen.add(marker.id);
  }
  return null;
}

function videoDocumentIssue(d: VideoDocument): DocumentIssue | null {
  if (d.schema !== VIDEO_SCHEMA || d.version !== DOCUMENT_VERSION) return issue(ISSUE_FIELDS.document, "unknown");
  if (!isValidColor(d.canvas.background, true) || d.canvas.background.length !== 7) return issue(ISSUE_FIELDS.canvas, "invalid");
  if (d.tracks.length > STUDIO_LIMITS.maxTracks) return issue(ISSUE_FIELDS.tracks, "too_many");
  if (d.durationMs < 0 || d.durationMs > STUDIO_LIMITS.maxVideoMs) return issue(ISSUE_FIELDS.tracks, "out_of_range");
  if (!VIDEO_ASPECTS.includes(d.canvas.aspect)) return issue(ISSUE_FIELDS.canvas, "unknown");
  const ids = new Set<string>();
  let clips = 0;
  let keyframes = 0;
  for (const track of d.tracks) {
    if (!isValidToken(track.id) || ids.has(track.id) || (track.kind !== "visual" && track.kind !== "audio")) return issue(ISSUE_FIELDS.tracks, "invalid");
    ids.add(track.id);
    clips += track.clips.length;
    keyframes += track.clips.reduce((total, c) => total + keyframeCount(c.keyframes), 0);
    let lastEnd = 0;
    for (let i = 0; i < track.clips.length; i++) {
      const c = track.clips[i];
      if (!isValidToken(c.id) || ids.has(c.id)) return issue(ISSUE_FIELDS.tracks, "invalid");
      ids.add(c.id);
      const code = clipIssue(c, track.kind, d.durationMs);
      if (code) return issue(ISSUE_FIELDS.tracks, code);
      if (i > 0 && c.startMs < lastEnd) return issue(ISSUE_FIELDS.tracks, "overlap");
      lastEnd = c.startMs + c.durationMs;
    }
  }
  const visual = d.tracks.filter((t) => t.kind === "visual").length;
  if (visual > STUDIO_LIMITS.maxVisualTracks || d.tracks.length - visual > STUDIO_LIMITS.maxAudioTracks) return issue(ISSUE_FIELDS.tracks, "too_many");
  if (clips > STUDIO_LIMITS.maxClips || keyframes > KEYFRAME_LIMITS.perTimeline) return issue(ISSUE_FIELDS.tracks, "too_many");
  return markersIssue(d.markers ?? []);
}

export type ParsedDocument<D extends StudioDocument> = { ok: true; document: D } | { ok: false; issue: DocumentIssue };

export function parseDocument(kind: "image", raw: unknown): ParsedDocument<ImageDocument>;
export function parseDocument(kind: "video", raw: unknown): ParsedDocument<VideoDocument>;
export function parseDocument(kind: StudioKind, raw: unknown): ParsedDocument<StudioDocument>;
export function parseDocument(kind: StudioKind, raw: unknown): ParsedDocument<StudioDocument> {
  if (raw === undefined || raw === null) return { ok: false, issue: issue(ISSUE_FIELDS.document, "required") };
  const serialized = JSON.stringify(raw);
  if (new TextEncoder().encode(serialized).length > STUDIO_LIMITS.maxDocumentBytes) return { ok: false, issue: issue(ISSUE_FIELDS.document, "too_large") };
  if (kind !== "image" && kind !== "video") return { ok: false, issue: issue(ISSUE_FIELDS.kind, "unknown") };
  const decoded = isRecord(raw) ? decodeObject(raw, kind === "image" ? imageSpec : videoSpec) : INVALID;
  if (decoded === INVALID) return { ok: false, issue: issue(ISSUE_FIELDS.document, "invalid") };
  const found = kind === "image" ? imageDocumentIssue(decoded as ImageDocument) : videoDocumentIssue(decoded as VideoDocument);
  return found ? { ok: false, issue: found } : { ok: true, document: raw as StudioDocument };
}

export function documentIssue(kind: StudioKind, raw: unknown): DocumentIssue | null {
  const parsed = parseDocument(kind, raw);
  return parsed.ok ? null : parsed.issue;
}

export function projectNameIssue(name: string): DocumentIssue | null {
  const clean = name.split(/\s+/).filter(Boolean).join(" ");
  if (clean === "") return issue(ISSUE_FIELDS.name, "required");
  if (runes(clean) > STUDIO_LIMITS.maxProjectNameRunes) return issue(ISSUE_FIELDS.name, "too_large");
  return null;
}

export function canvasSizeIssue(size: { width: number; height: number }): DocumentIssue | null {
  const { minCanvasSide: lo, maxCanvasSide: hi } = STUDIO_LIMITS;
  const sides = [size.width, size.height];
  return sides.every((side) => Number.isInteger(side) && side >= lo && side <= hi) ? null : issue(ISSUE_FIELDS.canvas, "out_of_range");
}
