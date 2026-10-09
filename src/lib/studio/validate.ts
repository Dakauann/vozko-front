import {
  DOCUMENT_VERSION,
  IMAGE_DOCUMENT_VERSION,
  IMAGE_SCHEMA,
  SHAPE_KINDS,
  STUDIO_LIMITS,
  VIDEO_ASPECTS,
  VIDEO_SCHEMA,
  BLEND_MODES,
  FILL_RULES,
  FRAME_KINDS,
  LINE_CAPS,
  LINE_JOINS,
  MAX_DASH_VALUES,
  GRADIENT_KINDS,
  RADIAL_RADIUS_RANGE,
  MOTION_EDGES,
  type Clip,
  type Marker,
  type Motion,
  type Gradient,
  type Artboard,
  type ImageDocument,
  type ImageSurface,
  type Layer,
  type LegacyImageDocument,
  type StudioDocument,
  type StudioGroup,
  type StudioKind,
  type Track,
  type Transform,
  type VideoDocument,
} from "./document";
import { upgradeImageDocument } from "./artboards";
import { isFontId } from "./fonts";
import { KEYFRAME_RANGES, keyframesIssue } from "./keyframes";
import { LAYER_RANGES } from "./layer-ranges";
import { isValidPath } from "./vector-path";

export const ISSUE_FIELDS = {
  kind: "kind",
  name: "name",
  document: "document",
  canvas: "document.canvas",
  artboards: "document.artboards",
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

const gradientSpec: PointerSpec = {
  pointer: { object: { from: "string", to: "string", angle: "number", kind: "string", via: "string", cx: "number", cy: "number", radius: "number" } },
};

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
    path: "string",
    fillRule: "string",
    lineCap: "string",
    lineJoin: "string",
    miterLimit: "number",
    dashArray: { array: "number" },
    dashOffset: "number",
    points: "int",
    inner: "number",
  },
};

const surfaceFields: Record<string, Kind> = {
  canvas: { object: { width: "int", height: "int", background: "string", gradient: gradientSpec } },
  layers: { array: layerSpec },
  groups: { array: { object: { id: "string", parentId: "string", name: "string", baseId: "string" } } },
};

const artboardSpec: ObjectSpec = { object: { id: "string", name: "string", x: "number", y: "number", ...surfaceFields } };

const imageSpec: ObjectSpec = { object: { schema: "string", version: "int", artboards: { array: artboardSpec } } };

const legacyImageSpec: ObjectSpec = { object: { schema: "string", version: "int", ...surfaceFields } };

const motionSpec: ObjectSpec = { object: { edge: "string", durationMs: "int" } };

const keyframeTrackSpec: ArraySpec = { array: { object: { atMs: "int", value: "number", easing: "string" } } };

const keyframesSpec: PointerSpec = {
  pointer: { object: { x: keyframeTrackSpec, y: keyframeTrackSpec, scale: keyframeTrackSpec, rotation: keyframeTrackSpec, opacity: keyframeTrackSpec, blur: keyframeTrackSpec } },
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
    blur: "number",
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
const FILL_RULE_VALUES = new Set<string>(["", ...FILL_RULES]);
const CAP_VALUES = new Set<string>(["", ...LINE_CAPS]);
const JOIN_VALUES = new Set<string>(["", ...LINE_JOINS]);

function strokeIssue(l: DecodedLayer): IssueCode | null {
  if (!CAP_VALUES.has(l.lineCap ?? "") || !JOIN_VALUES.has(l.lineJoin ?? "")) return "unknown";
  const dashes = l.dashArray ?? [];
  const styled = (l.lineCap ?? "") !== "" || (l.lineJoin ?? "") !== "" || (l.miterLimit ?? 0) !== 0 || dashes.length > 0 || (l.dashOffset ?? 0) !== 0;
  if (styled && l.type === "icon") return "invalid";
  if ((l.miterLimit ?? 0) !== 0 && !within(l.miterLimit ?? 0, ...LAYER_RANGES.miterLimit)) return "out_of_range";
  if (dashes.length > MAX_DASH_VALUES || dashes.some((v) => !within(v, ...LAYER_RANGES.dashValue)) || (dashes.length > 0 && dashes.every((v) => v === 0))) return "invalid";
  return within(l.dashOffset ?? 0, ...LAYER_RANGES.dashOffset) ? null : "out_of_range";
}

const GRADIENT_VALUES = new Set<string>(["", ...GRADIENT_KINDS]);

function gradientValid(g: Gradient | undefined): boolean {
  if (!g) return true;
  const kind = g.kind ?? "";
  if (!GRADIENT_VALUES.has(kind) || !isValidColor(g.from, true) || !isValidColor(g.to, true) || !isValidColor(g.via ?? "", false)) return false;
  if (!within(g.angle, -360, 360) || !within(g.cx ?? 0, 0, 1) || !within(g.cy ?? 0, 0, 1)) return false;
  return kind === "radial" ? within(g.radius ?? 0, ...RADIAL_RADIUS_RANGE) : within(g.radius ?? 0, 0, RADIAL_RADIUS_RANGE[1]);
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

function shapeLayerIssue(l: DecodedLayer): IssueCode | null {
  if (!(SHAPE_KINDS as readonly string[]).includes(l.shape ?? "")) return "unknown";
  const path = l.path ?? "";
  const points = l.points ?? 0;
  const inner = l.inner ?? 0;
  if ((l.shape === "path") !== (path !== "") || (path !== "" && !isValidPath(path))) return "invalid";
  if (l.shape !== "star") return points !== 0 || inner !== 0 ? "invalid" : null;
  if (points !== 0 && !within(points, ...LAYER_RANGES.starPoints)) return "out_of_range";
  if (inner !== 0 && !within(inner, ...LAYER_RANGES.starInner)) return "out_of_range";
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
  if (!BLEND_VALUES.has(l.blendMode ?? "") || !FRAME_VALUES.has(l.frame ?? "") || !FILL_RULE_VALUES.has(l.fillRule ?? "")) return "unknown";
  if ((l.fillRule ?? "") !== "" && !(l.type === "shape" && l.shape === "path")) return "invalid";
  const strokeCode = strokeIssue(l);
  if (strokeCode) return strokeCode;
  const h = l.highlight;
  if (!gradientValid(l.gradient) || (h && (!isValidColor(h.color, true) || !within(h.radius, 0, 1)))) return "invalid";
  if (!within(l.curve ?? 0, -1, 1)) return "out_of_range";
  switch (l.type) {
    case "image":
      return imageLayerIssue(l);
    case "text":
      return textLayerIssue(l);
    case "shape":
      return shapeLayerIssue(l);
    case "icon":
      return isValidToken(l.iconId ?? "") ? null : "invalid";
  }
  return "unknown";
}

function issue(field: IssueField, code: IssueCode): DocumentIssue {
  return { field, code };
}

interface SeenIds {
  layers: Set<string>;
  groups: Set<string>;
}

function freshIds(): SeenIds {
  return { layers: new Set(), groups: new Set() };
}

function surfaceIssueAmong(s: ImageSurface, seen: SeenIds): DocumentIssue | null {
  const { width, height, background } = s.canvas;
  const { minCanvasSide: lo, maxCanvasSide: hi } = STUDIO_LIMITS;
  if (width < lo || width > hi || height < lo || height > hi) return issue(ISSUE_FIELDS.canvas, "out_of_range");
  if (!isValidColor(background, false) || !gradientValid(s.canvas.gradient)) return issue(ISSUE_FIELDS.canvas, "invalid");
  for (const layer of s.layers) {
    if (seen.layers.has(layer.id)) return issue(ISSUE_FIELDS.layers, "duplicate");
    seen.layers.add(layer.id);
    const code = layerIssue(layer);
    if (code) return issue(ISSUE_FIELDS.layers, code);
  }
  const groupCode = groupsIssue(s.groups ?? [], s.layers);
  if (groupCode) return issue(ISSUE_FIELDS.layers, groupCode);
  for (const group of s.groups ?? []) {
    if (seen.groups.has(group.id)) return issue(ISSUE_FIELDS.layers, "duplicate");
    seen.groups.add(group.id);
  }
  return null;
}

function tooLarge(value: unknown): boolean {
  return new TextEncoder().encode(JSON.stringify(value)).length > STUDIO_LIMITS.maxDocumentBytes;
}

export function surfaceIssue(s: ImageSurface): DocumentIssue | null {
  return tooLarge(s) ? issue(ISSUE_FIELDS.document, "too_large") : surfaceIssueAmong(s, freshIds());
}

function artboardIssue(a: Artboard, artboardIds: Set<string>): DocumentIssue | null {
  const limit = STUDIO_LIMITS.maxArtboardCoordinate;
  if (!isValidToken(a.id) || runes(a.name ?? "") > STUDIO_LIMITS.maxLayerNameRunes) return issue(ISSUE_FIELDS.artboards, "invalid");
  if (artboardIds.has(a.id)) return issue(ISSUE_FIELDS.artboards, "duplicate");
  if (!within(a.x, -limit, limit) || !within(a.y, -limit, limit)) return issue(ISSUE_FIELDS.artboards, "out_of_range");
  artboardIds.add(a.id);
  return null;
}

function imageDocumentIssue(d: ImageDocument): DocumentIssue | null {
  if (d.schema !== IMAGE_SCHEMA || d.version !== IMAGE_DOCUMENT_VERSION) return issue(ISSUE_FIELDS.document, "unknown");
  if (d.artboards.length === 0) return issue(ISSUE_FIELDS.artboards, "required");
  const seen = freshIds();
  const artboardIds = new Set<string>();
  for (const artboard of d.artboards) {
    const found = artboardIssue(artboard, artboardIds) ?? surfaceIssueAmong(artboard, seen);
    if (found) return found;
  }
  return null;
}

function legacyImageIssue(d: LegacyImageDocument): DocumentIssue | null {
  if (d.schema !== IMAGE_SCHEMA || d.version !== DOCUMENT_VERSION) return issue(ISSUE_FIELDS.document, "unknown");
  return surfaceIssue(d);
}

function parseImage(raw: Record<string, unknown>): ParsedDocument<ImageDocument> {
  if (raw.version === DOCUMENT_VERSION) {
    const legacy = decodeObject(raw, legacyImageSpec);
    if (legacy === INVALID) return { ok: false, issue: issue(ISSUE_FIELDS.document, "invalid") };
    const found = legacyImageIssue(legacy as LegacyImageDocument);
    return found ? { ok: false, issue: found } : { ok: true, document: upgradeImageDocument(raw as unknown as LegacyImageDocument) };
  }
  const decoded = decodeObject(raw, imageSpec);
  if (decoded === INVALID) return { ok: false, issue: issue(ISSUE_FIELDS.document, "invalid") };
  const found = imageDocumentIssue(decoded as ImageDocument);
  return found ? { ok: false, issue: found } : { ok: true, document: raw as unknown as ImageDocument };
}

function groupsIssue(groups: readonly StudioGroup[], layers: readonly Layer[]): IssueCode | null {
  const homes = new Map(layers.map((l) => [l.id, l.groupId ?? ""]));
  const parents = new Map<string, string>();
  for (const g of groups) {
    if (!isValidToken(g.id) || ((g.parentId ?? "") !== "" && !isValidToken(g.parentId ?? "")) || runes(g.name ?? "") > STUDIO_LIMITS.maxLayerNameRunes) return "invalid";
    if ((g.baseId ?? "") !== "" && homes.get(g.baseId ?? "") !== g.id) return "invalid";
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
  if (kind === "audio") return c.type !== "audio" || assetId === "" || c.motionIn || c.motionOut || c.keyframes || (c.blur ?? 0) !== 0 ? "invalid" : null;
  if (c.blur !== undefined && !within(c.blur, KEYFRAME_RANGES.blur[0], KEYFRAME_RANGES.blur[1])) return "out_of_range";
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
  if (d.durationMs < 0 || d.durationMs > STUDIO_LIMITS.maxVideoMs) return issue(ISSUE_FIELDS.tracks, "out_of_range");
  if (!VIDEO_ASPECTS.includes(d.canvas.aspect)) return issue(ISSUE_FIELDS.canvas, "unknown");
  const ids = new Set<string>();
  for (const track of d.tracks) {
    if (!isValidToken(track.id) || ids.has(track.id) || (track.kind !== "visual" && track.kind !== "audio")) return issue(ISSUE_FIELDS.tracks, "invalid");
    ids.add(track.id);
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
  return markersIssue(d.markers ?? []);
}

export type ParsedDocument<D extends StudioDocument> = { ok: true; document: D } | { ok: false; issue: DocumentIssue };

export function parseDocument(kind: "image", raw: unknown): ParsedDocument<ImageDocument>;
export function parseDocument(kind: "video", raw: unknown): ParsedDocument<VideoDocument>;
export function parseDocument(kind: StudioKind, raw: unknown): ParsedDocument<StudioDocument>;
export function parseDocument(kind: StudioKind, raw: unknown): ParsedDocument<StudioDocument> {
  if (raw === undefined || raw === null) return { ok: false, issue: issue(ISSUE_FIELDS.document, "required") };
  if (tooLarge(raw)) return { ok: false, issue: issue(ISSUE_FIELDS.document, "too_large") };
  if (kind !== "image" && kind !== "video") return { ok: false, issue: issue(ISSUE_FIELDS.kind, "unknown") };
  if (!isRecord(raw)) return { ok: false, issue: issue(ISSUE_FIELDS.document, "invalid") };
  if (kind === "image") return parseImage(raw);
  const decoded = decodeObject(raw, videoSpec);
  if (decoded === INVALID) return { ok: false, issue: issue(ISSUE_FIELDS.document, "invalid") };
  const found = videoDocumentIssue(decoded as VideoDocument);
  return found ? { ok: false, issue: found } : { ok: true, document: raw as unknown as StudioDocument };
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
