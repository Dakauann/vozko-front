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
  LINE_END_KINDS,
  LINE_JOINS,
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
import { animatedProperties, COLOR_PROPERTIES, colorFramesOf, isAudioProperty, KEYFRAME_RANGES, keyframesIssue } from "./keyframes";
import { LAYER_RANGES } from "./layer-ranges";
import { layerPaintIssue } from "./layer-paint";
import { repeatsIssue } from "./repeat";
import { layoutsIssue } from "./auto-layout";
import { carriesPixels, pixelLayerIssue } from "./pixel-surface";
import { paintsProperty } from "./paint";
import { speedIssue } from "./clip-time";
import { carriesPlacement, placementIssue } from "./clip-placement";
import { motionBlurIssue, shutterIssue } from "./motion-blur";
import { carriesTilt, perspectiveIssue, tiltIssue } from "./clip-tilt";
import { TILT_PROPERTIES, type TiltProperty } from "./tilt-properties";
import { duckingIssue, trackGainIssue } from "./ducking";
import { clipPanIssue, trackPanIssue } from "./audio-pan";
import { CHROMA_PROPERTIES, chromaIssue, type ChromaProperty } from "./chroma-key";
import { LUMA_PROPERTIES, lumaIssue, type LumaProperty } from "./luma-key";
import { matteIssue } from "./matte";
import { clipBlendIssue } from "./clip-blend";
import { MASK_PROPERTIES, maskIssue, type MaskProperty } from "./masks";
import { lineIssue } from "./line-animation";
import { LINE_PROPERTIES, type LineProperty } from "./line-properties";
import { nullClipIssue, parentsIssue, positionRange } from "./parenting";
import { behaviorsIssue, behaviorTracksIssue } from "./behaviors";
import { VFX_COLORS, VFX_PARAMS, vfxIssue, type VfxColor, type VfxParam } from "./vfx";
import { adjustmentClipIssue, cameraOutsideIssue } from "./adjustment";
import { CAMERA_FIELDS, CAMERA_PROPERTIES, type CameraField, type CameraProperty } from "./clip-camera";
import { stillVfxIssue } from "./still-vfx";
import { effectVfxIssue, vfxTracksIssue } from "./vfx-tracks";
import { isValidToken, runes } from "./tokens";
import { GRADE_FIELDS, gradeIssue, type GradeField } from "./color-grade";
import { CURVE_CHANNELS, type CurveChannel } from "./color-curves";
import { HUE_FIELDS, type HueField } from "./hue-secondary";
import { gradeKeysIssue } from "./grade-keys";
import { gradientMapIssue } from "./gradient-map";
import { isSpeedProperty } from "./speed-range";
import { textAnimationIssue } from "./text-animation";
import { textAnimatorsIssue } from "./text-animator";
import { ANIMATOR_COLORS, ANIMATOR_NUMBERS, RANGE_KEYS, type AnimatorColor, type AnimatorNumber, type SelectorKey } from "./text-selectors";
import { counterIssue } from "./counter";
import { textPathIssue } from "./text-path";
import { stabilizeIssue, trackersIssue } from "./point-track";
import { groupClipIssue, isGroupClip } from "./group-scope";
import { soundAssetIssue } from "./builtin-sounds";
import { markerListIssue } from "./markers";
import { clipOrganizeIssue, trackOrganizeIssue } from "./organize";
import { clipRunLength, textRunsIssue } from "./text-runs";
import { TEXT_KEY_PROPERTIES, type TextKeyProperty } from "./text-properties";
import { transitionsIssue, type TransitionIssue } from "./transitions";
import { edgeTransitionsIssue } from "./edge-transitions";
import { dashPatternFits } from "./stroke-presets";
import { isValidPath } from "./vector-path";
import { clipMorphIssue } from "./morph-keys";
import { EFFECT_PROPERTIES, effectKeysIssue, withoutEffectKeys, type EffectProperty } from "./effect-keys";
import { clipStyleIssue } from "./clip-style";
import { PATH_OP_FIELDS, pathOpsIssue, stillPathOpsIssue, type PathOpField } from "./path-ops";
import { CLIP_REPEAT_FIELDS, clipRepeatClipIssue, type ClipRepeatField } from "./clip-repeat";
import { INSTANCE_FIELDS, overridableFields, overriddenLayer, setFields, type InstanceOverride } from "./components";
import { chartLayerIssue } from "./chart";
import { tableLayerIssue } from "./table";
import { qrLayerIssue } from "./qr";
import { chartInIssue } from "./chart-animation";
import { backgroundIssue, linkedSlots, slotIssue, STYLE_KINDS, STYLE_RANGES, STYLE_ROLES, TEXT_STYLE_FIELDS, type StudioStyle, type StyleKind } from "./shared-styles";

const ISSUE_FIELDS = {
  kind: "kind",
  name: "name",
  document: "document",
  canvas: "document.canvas",
  artboards: "document.artboards",
  layers: "document.layers",
  tracks: "document.tracks",
  markers: "document.markers",
  styles: "document.styles",
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
type PointerSpec = { pointer: Kind };

const transformSpec: ObjectSpec = { object: { x: "number", y: "number", w: "number", h: "number", rotation: "number", opacity: "number" } };

const gradientSpec: PointerSpec = {
  pointer: { object: { from: "string", to: "string", angle: "number", kind: "string", via: "string", cx: "number", cy: "number", radius: "number" } },
};

const curveSpec: PointerSpec = { pointer: { array: { object: { x: "number", y: "number" } } } };

const gradeSpec: PointerSpec = {
  pointer: {
    object: {
      ...(Object.fromEntries(GRADE_FIELDS.map((field) => [field, "number"])) as Record<GradeField, "number">),
      curves: { pointer: { object: Object.fromEntries(CURVE_CHANNELS.map((channel) => [channel, curveSpec])) as Record<CurveChannel, PointerSpec> } },
      hsl: { pointer: { object: Object.fromEntries(HUE_FIELDS.map((field) => [field, field === "hue" || field === "width" ? "number" : { pointer: "number" }])) as Record<HueField, Kind> } },
      lut: { pointer: { object: { assetId: "string", intensity: { pointer: "number" } } } },
    },
  },
};

const pointSpec: PointerSpec = { pointer: { object: { x: "number", y: "number" } } };

const patternSpec: PointerSpec = {
  pointer: {
    object: { source: "string", presetId: "string", assetId: "string", color: "string", background: "string", tile: "string", size: "number", spacing: pointSpec, offset: "number", angle: "number", origin: pointSpec, opacity: "number", blendMode: "string" },
  },
};

const chromaFields = { color: "string", similarity: "number", smoothness: "number", spill: "number" } as const;

const layerChromaSpec: PointerSpec = { pointer: { object: chromaFields } };

const gradientMapSpec: PointerSpec = { pointer: { object: { stops: { array: { object: { at: "number", color: "string" } } }, intensity: "number", reverse: "bool", interpolation: "string" } } };

const paintFields: Record<string, Kind> = { type: "string", color: "string", gradient: gradientSpec, pattern: patternSpec, opacity: "number", blendMode: "string", hidden: "bool" };

const strokePaintSpec: ObjectSpec = {
  object: { ...paintFields, width: "number", align: "string", dashArray: { array: "number" }, dashOffset: "number", lineCap: "string", lineJoin: "string", miterLimit: "number" },
};

const repeatFields: Record<string, Kind> = {
  mode: "string",
  count: "int",
  shown: "int",
  radius: "number",
  startAngle: "number",
  sweep: "number",
  direction: "string",
  upright: "bool",
  reverseOverlap: "bool",
  rows: "int",
  columns: "int",
  gapX: "number",
  gapY: "number",
  layout: "string",
  offset: "number",
  flipRows: "string",
  flipColumns: "string",
  angle: "number",
  gap: "number",
  side: "string",
};

const repeatSpec: PointerSpec = { pointer: { object: repeatFields } };

const pixelPointsSpec: ArraySpec = { array: "number" };

const pixelSurfaceSpec: PointerSpec = {
  pointer: {
    object: {
      width: "int",
      height: "int",
      ops: {
        array: {
          object: {
            kind: "string",
            id: "string",
            mode: "string",
            color: "string",
            size: "number",
            hardness: "number",
            opacity: "number",
            pressure: "bool",
            points: pixelPointsSpec,
            feather: "number",
            invert: "bool",
            parts: { array: { object: { mode: "string", points: pixelPointsSpec } } },
          },
        },
      },
    },
  },
};

const keyframeTrackSpec: ArraySpec = { array: { object: { atMs: "int", value: "number", easing: "string", smooth: "bool" } } };

const effectSpec: ObjectSpec = {
  object: {
    id: "string",
    type: "string",
    color: "string",
    opacity: "number",
    x: "number",
    y: "number",
    blur: "number",
    spread: "number",
    blendMode: "string",
    hidden: "bool",
    showBehind: "bool",
    source: "string",
    keyframes: { pointer: { object: Object.fromEntries(EFFECT_PROPERTIES.map((property) => [property, keyframeTrackSpec])) as Record<EffectProperty, ArraySpec> } },
  },
};

const layoutItemSpec: PointerSpec = { pointer: { object: { width: "string", height: "string", absolute: "bool" } } };

const layoutSpec: PointerSpec = {
  pointer: {
    object: {
      direction: "string",
      gap: "number",
      autoGap: "bool",
      padding: { pointer: { object: { top: "number", right: "number", bottom: "number", left: "number" } } },
      alignMain: "string",
      alignCross: "string",
      width: "string",
      height: "string",
    },
  },
};

const shadowSpec: PointerSpec = { pointer: { object: { color: "string", blur: "number", x: "number", y: "number" } } };

const vfxFields: Record<string, Kind> = {
  id: "string",
  kind: "string",
  seed: "int",
  hidden: "bool",
  params: { pointer: { object: Object.fromEntries(VFX_PARAMS.map((name) => [name, { pointer: "number" }])) as Record<VfxParam, PointerSpec> } },
  colors: { pointer: { object: Object.fromEntries(VFX_COLORS.map((name) => [name, { pointer: "string" }])) as Record<VfxColor, PointerSpec> } },
};

const stillVfxSpec: ArraySpec = { array: { object: vfxFields } };

const pathOpSpec: ObjectSpec = {
  object: {
    id: "string",
    kind: "string",
    hidden: "bool",
    ...(Object.fromEntries(PATH_OP_FIELDS.map((field) => [field, "number"])) as Record<PathOpField, Kind>),
    join: "string",
    points: "string",
    mode: "string",
    path: "string",
    fillRule: "string",
    keyframes: { pointer: { object: Object.fromEntries(PATH_OP_FIELDS.map((field) => [field, keyframeTrackSpec])) as Record<PathOpField, ArraySpec> } },
  },
};

const chartSpec: PointerSpec = {
  pointer: {
    object: {
      kind: "string",
      data: { object: { labels: { array: "string" }, series: { array: { object: { name: "string", values: { array: { pointer: "number" } } } } } } },
      style: {
        object: {
          palette: { array: "string" },
          fontId: "string",
          fontSize: "number",
          textColor: "string",
          gridColor: "string",
          axes: "bool",
          gridlines: "bool",
          legend: "string",
          valueLabels: "bool",
          barRadius: "number",
          barGap: "number",
          lineWidth: "number",
          smooth: "bool",
          points: "bool",
          hole: "number",
        },
      },
      format: { object: { locale: "string", decimals: "int", prefix: "string", suffix: "string", percent: "bool" } },
    },
  },
};

const runSpec: ObjectSpec = { object: { start: "int", end: "int", fill: "string", fontId: "string", fontWeight: "int", fontSize: "number", italic: { pointer: "bool" }, underline: "bool", caps: "bool", letterSpacing: { pointer: "number" } } };

const tableSpec: PointerSpec = {
  pointer: {
    object: {
      columns: { array: { object: { width: "number", align: "string" } } },
      rows: { array: { array: { object: { text: "string", runs: { array: runSpec } } } } },
      header: "bool",
      style: {
        object: {
          fontId: "string",
          fontSize: "number",
          lineHeight: "number",
          weight: "int",
          textColor: "string",
          fill: "string",
          headerFill: "string",
          headerText: "string",
          headerWeight: "int",
          banding: "bool",
          bandFill: "string",
          borders: "string",
          borderColor: "string",
          borderWidth: "number",
          padding: "number",
        },
      },
    },
  },
};

const qrSpec: PointerSpec = {
  pointer: {
    object: {
      link: { object: { kind: "string", shortLinkId: "string", url: "string", phone: "string", message: "string", text: "string" } },
      ecc: "string",
      quietZone: "int",
      dark: "string",
      light: "string",
      logo: { pointer: { object: { assetId: "string", scale: "number", aspect: "number" } } },
    },
  },
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
    color: gradeSpec,
    text: "string",
    fontId: "string",
    fontSize: "number",
    fontWeight: "int",
    italic: "bool",
    align: "string",
    lineHeight: "number",
    letterSpacing: "number",
    runs: { array: { object: { start: "int", end: "int", fill: "string", fontId: "string", fontWeight: "int", fontSize: "number", italic: { pointer: "bool" }, underline: "bool", caps: "bool", letterSpacing: { pointer: "number" } } } },
    fill: "string",
    stroke: "string",
    strokeWidth: "number",
    dash: "bool",
    shadow: shadowSpec,
    shape: "string",
    arrowStart: "bool",
    arrowEnd: "bool",
    arrowStartKind: "string",
    arrowEndKind: "string",
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
    pattern: patternSpec,
    gradientMap: gradientMapSpec,
    chromaKey: layerChromaSpec,
    fills: { array: { object: paintFields } },
    strokes: { array: strokePaintSpec },
    effects: { array: effectSpec },
    surface: pixelSurfaceSpec,
    mask: pixelSurfaceSpec,
    vfx: stillVfxSpec,
    pathOps: { array: pathOpSpec },
    chart: chartSpec,
    table: tableSpec,
    qr: qrSpec,
    fillStyleId: "string",
    strokeStyleId: "string",
    textStyleId: "string",
    effectStyleId: "string",
    layoutItem: layoutItemSpec,
    componentId: "string",
    overrides: {
      array: {
        object: {
          layerId: "string",
          text: "string",
          fill: "string",
          stroke: "string",
          fontId: "string",
          fontWeight: "int",
          italic: { pointer: "bool" },
          assetId: "string",
          crop: { pointer: { object: { x: "number", y: "number", w: "number", h: "number" } } },
          iconId: "string",
          hidden: { pointer: "bool" },
        },
      },
    },
  },
};

const surfaceFields: Record<string, Kind> = {
  canvas: { object: { width: "int", height: "int", background: "string", gradient: gradientSpec, backgroundStyleId: "string", vfx: stillVfxSpec } },
  layers: { array: layerSpec },
  groups: { array: { object: { id: "string", parentId: "string", name: "string", baseId: "string", repeat: repeatSpec, layout: layoutSpec, layoutItem: layoutItemSpec } } },
};

const artboardSpec: ObjectSpec = { object: { id: "string", name: "string", component: "bool", x: "number", y: "number", ...surfaceFields } };

const styleSpec: ObjectSpec = {
  object: {
    id: "string",
    kind: "string",
    name: "string",
    description: "string",
    color: "string",
    gradient: gradientSpec,
    role: "string",
    fontId: "string",
    fontWeight: "int",
    italic: { pointer: "bool" },
    fontSizePx: "number",
    lineHeight: "number",
    letterSpacing: "number",
    shadow: shadowSpec,
  },
};

const imageSpec: ObjectSpec = { object: { schema: "string", version: "int", artboards: { array: artboardSpec }, styles: { array: styleSpec } } };

const legacyImageSpec: ObjectSpec = { object: { schema: "string", version: "int", ...surfaceFields } };

const motionSpec: ObjectSpec = { object: { edge: "string", durationMs: "int" } };

const transitionOptionSpecs = {
  direction: { pointer: "string" },
  moving: { pointer: "string" },
  color: { pointer: "string" },
  angle: { pointer: "number" },
  shape: { pointer: "string" },
  originX: { pointer: "number" },
  originY: { pointer: "number" },
  clockwise: { pointer: "bool" },
  orientation: { pointer: "string" },
  reverse: { pointer: "bool" },
  amount: { pointer: "number" },
  softness: { pointer: "number" },
  size: { pointer: "number" },
  map: { pointer: "string" },
  mapAssetId: { pointer: "string" },
} as const;

const clipTransitionSpec: ObjectSpec = { object: { kind: "string", durationMs: "int", easing: "string", ...transitionOptionSpecs } };

const colorTrackSpec: ArraySpec = { array: { object: { atMs: "int", color: "string", easing: "string" } } };

const vectorSpec: PointerSpec = { pointer: { object: { x: "number", y: "number" } } };

const morphTrackSpec: ArraySpec = { array: { object: { atMs: "int", path: "string", easing: "string", firstVertex: vectorSpec } } };

const positionTrackSpec: ArraySpec = { array: { object: { atMs: "int", x: "number", y: "number", easing: "string", spatial: "string", in: vectorSpec, out: vectorSpec } } };

const chromaSpec: PointerSpec = {
  pointer: {
    object: {
      ...chromaFields,
      keyframes: { pointer: { object: Object.fromEntries(CHROMA_PROPERTIES.map((property) => [property, keyframeTrackSpec])) as Record<ChromaProperty, ArraySpec> } },
    },
  },
};

const lumaSpec: PointerSpec = {
  pointer: {
    object: {
      mode: "string",
      threshold: "number",
      softness: "number",
      keyframes: { pointer: { object: Object.fromEntries(LUMA_PROPERTIES.map((property) => [property, keyframeTrackSpec])) as Record<LumaProperty, ArraySpec> } },
    },
  },
};

const maskSpec: ObjectSpec = {
  object: {
    id: "string",
    shape: "string",
    mode: "string",
    x: "number",
    y: "number",
    w: "number",
    h: "number",
    rotation: "number",
    roundness: "number",
    points: "int",
    inner: "number",
    path: "string",
    feather: "number",
    expansion: "number",
    opacity: "number",
    invert: "bool",
    keyframes: { pointer: { object: { ...(Object.fromEntries(MASK_PROPERTIES.map((property) => [property, keyframeTrackSpec])) as Record<MaskProperty, ArraySpec>), path: morphTrackSpec } } },
  },
};

const vfxSpec: ObjectSpec = {
  object: {
    ...vfxFields,
    offsetMs: "int",
    trackId: "string",
    keyframes: { pointer: { object: Object.fromEntries(VFX_PARAMS.map((name) => [name, keyframeTrackSpec])) as Record<VfxParam, ArraySpec> } },
  },
};

const textAnimatorSpec: PointerSpec ={ pointer: { object: { unit: "string", style: "string", durationMs: "int", staggerMs: "int", easing: "string" } } };

const animatorPropertiesSpec: PointerSpec = {
  pointer: {
    object: {
      ...(Object.fromEntries(ANIMATOR_NUMBERS.map((name) => [name, { pointer: "number" }])) as Record<AnimatorNumber, PointerSpec>),
      ...(Object.fromEntries(ANIMATOR_COLORS.map((name) => [name, { pointer: "string" }])) as Record<AnimatorColor, PointerSpec>),
    },
  },
};

const textSelectorSpec: PointerSpec = {
  pointer: {
    object: {
      kind: "string",
      seed: "int",
      amount: "number",
      units: { pointer: "string" },
      start: { pointer: "number" },
      end: { pointer: "number" },
      offset: { pointer: "number" },
      order: { pointer: "string" },
      shape: { pointer: "string" },
      easeHigh: { pointer: "number" },
      easeLow: { pointer: "number" },
      rate: { pointer: "number" },
      loopMs: { pointer: "int" },
      correlation: { pointer: "number" },
      offsetMs: { pointer: "int" },
    },
  },
};

const textUnitAnimatorSpec: ObjectSpec = {
  object: {
    id: "string",
    unit: "string",
    properties: animatorPropertiesSpec,
    selector: textSelectorSpec,
    keyframes: { pointer: { object: Object.fromEntries(RANGE_KEYS.map((key) => [key, keyframeTrackSpec])) as Record<SelectorKey, ArraySpec> } },
  },
};

const lineTrackSpecs = Object.fromEntries(LINE_PROPERTIES.map((property) => [property, keyframeTrackSpec])) as Record<LineProperty, ArraySpec>;

const textTrackSpecs = Object.fromEntries(TEXT_KEY_PROPERTIES.map((property) => [property, keyframeTrackSpec])) as Record<TextKeyProperty, ArraySpec>;

const counterSpec: PointerSpec = { pointer: { object: { value: "number", decimals: "int", locale: "string", grouping: "bool", prefix: "string", suffix: "string" } } };

const textPathSpec: PointerSpec = { pointer: { object: { shape: "string", bend: { pointer: "number" }, path: "string", offset: "number", align: "string", upright: "bool", reverse: "bool" } } };

const gradeTrackSpecs = Object.fromEntries(GRADE_FIELDS.map((field) => [field, keyframeTrackSpec])) as Record<GradeField, ArraySpec>;

const cameraTrackSpecs = Object.fromEntries(CAMERA_PROPERTIES.map((property) => [property, keyframeTrackSpec])) as Record<CameraProperty, ArraySpec>;

const cameraSpec: PointerSpec = { pointer: { object: Object.fromEntries(CAMERA_FIELDS.map((field) => [field, "number"])) as Record<CameraField, "number"> } };

const tiltTrackSpecs = Object.fromEntries(TILT_PROPERTIES.map((property) => [property, keyframeTrackSpec])) as Record<TiltProperty, ArraySpec>;

const keyframesSpec: PointerSpec = {
  pointer: { object: { x: keyframeTrackSpec, y: keyframeTrackSpec, scale: keyframeTrackSpec, rotation: keyframeTrackSpec, opacity: keyframeTrackSpec, blur: keyframeTrackSpec, scaleX: keyframeTrackSpec, scaleY: keyframeTrackSpec, position: positionTrackSpec, gainDb: keyframeTrackSpec, pan: keyframeTrackSpec, fill: colorTrackSpec, stroke: colorTrackSpec, ...lineTrackSpecs, ...textTrackSpecs, ...gradeTrackSpecs, speed: keyframeTrackSpec, path: morphTrackSpec, ...cameraTrackSpecs, ...tiltTrackSpecs } },
};

const clipRepeatSpec: PointerSpec = {
  pointer: {
    object: {
      ...repeatFields,
      copies: "int",
      shift: "number",
      x: "number",
      y: "number",
      scale: { pointer: "number" },
      rotation: "number",
      startOpacity: { pointer: "number" },
      endOpacity: { pointer: "number" },
      order: "string",
      keyframes: { pointer: { object: Object.fromEntries(CLIP_REPEAT_FIELDS.map((field) => [field, keyframeTrackSpec])) as Record<ClipRepeatField, ArraySpec> } },
    },
  },
};

const lineSpec: PointerSpec = {
  pointer: {
    object: {
      trim: { pointer: { object: { start: "number", end: "number", offset: "number", sequential: "bool" } } },
      wave: { pointer: { object: { mode: "string", amount: "number", wavelength: "number", speed: "number", phase: "number", travel: "number" } } },
      wiggle: { pointer: { object: { size: "number", detail: "number", rate: "number", seed: "int", travel: "number" } } },
      taper: { pointer: { object: { startLength: "number", endLength: "number", startWidth: "number", endWidth: "number", startEase: "number", endEase: "number" } } },
    },
  },
};

const behaviorSpec: ObjectSpec = {
  object: {
    id: "string",
    kind: "string",
    property: "string",
    offsetMs: { pointer: "int" },
    frequency: { pointer: "number" },
    amount: { pointer: "number" },
    seed: { pointer: "int" },
    mode: "string",
    side: "string",
    rate: { pointer: "number" },
    amplitude: { pointer: "number" },
    decay: { pointer: "number" },
    trackId: "string",
    floorDb: { pointer: "number" },
    ceilingDb: { pointer: "number" },
  },
};

const trackerSpec: ObjectSpec = {
  object: { id: "string", name: "string", frameWidth: "int", frameHeight: "int", size: "number", referenceMs: "int", samples: { array: { object: { atMs: "int", x: "number", y: "number", confidence: "number" } } } },
};

const markerFieldSpecs: Record<string, Kind> = { id: "string", atMs: "int", durationMs: "int", label: "string", color: "string", note: "string" };

const stabilizeSpec: PointerSpec = { pointer: { object: { trackerId: "string", secondTrackerId: "string", rotation: "bool", scale: "bool", smoothMs: "int", zoom: "number" } } };

const clipSpec: ObjectSpec = {
  object: {
    id: "string",
    type: "string",
    assetId: "string",
    startMs: "int",
    durationMs: "int",
    trimInMs: "int",
    volume: "number",
    pan: "number",
    fadeInMs: "int",
    fadeOutMs: "int",
    fit: "string",
    transform: transformSpec,
    layer: { pointer: layerSpec },
    linkId: "string",
    parentId: "string",
    parentTracker: "string",
    trackers: { array: trackerSpec },
    stabilize: stabilizeSpec,
    behaviors: { array: behaviorSpec },
    motionIn: { pointer: motionSpec },
    motionOut: { pointer: motionSpec },
    transitionIn: { pointer: clipTransitionSpec },
    transitionOut: { pointer: clipTransitionSpec },
    keyframes: keyframesSpec,
    disabled: "bool",
    blur: "number",
    textIn: textAnimatorSpec,
    textOut: textAnimatorSpec,
    textAnimators: { array: textUnitAnimatorSpec },
    speed: { pointer: "number" },
    reverse: "bool",
    freeze: "bool",
    preservePitch: { pointer: "bool" },
    frameMix: "bool",
    color: gradeSpec,
    gradientMap: gradientMapSpec,
    chromaKey: chromaSpec,
    masks: { array: maskSpec },
    effects: { array: effectSpec },
    strokes: { array: strokePaintSpec },
    lumaKey: lumaSpec,
    matte: "bool",
    matteChannel: "string",
    matteInvert: "bool",
    blendMode: "string",
    line: lineSpec,
    anchor: vectorSpec,
    flipX: "bool",
    flipY: "bool",
    autoOrient: "bool",
    motionBlur: "bool",
    rotationX: "number",
    rotationY: "number",
    camera: cameraSpec,
    vfx: { array: vfxSpec },
    counter: counterSpec,
    textPath: textPathSpec,
    chartIn: { pointer: { object: { style: "string", order: "string", durationMs: "int", staggerMs: "int", easing: "string" } } },
    repeat: clipRepeatSpec,
    name: "string",
    labelColor: "string",
    markers: { array: { object: { ...markerFieldSpecs, beat: "bool" } } },
    guide: "bool",
  },
};

const transitionSpec: ObjectSpec = {
  object: {
    id: "string",
    fromClipId: "string",
    toClipId: "string",
    kind: "string",
    durationMs: "int",
    alignment: "string",
    easing: "string",
    ...transitionOptionSpecs,
  },
};

const trackSpec: ObjectSpec = {
  object: { id: "string", kind: "string", name: "string", labelColor: "string", shy: "bool", hidden: "bool", locked: "bool", muted: "bool", clips: { array: clipSpec }, transitions: { array: transitionSpec }, gainDb: { pointer: "number" }, pan: { pointer: "number" }, ducking: { pointer: { object: { triggerTrackIds: { array: "string" }, reduceDb: "number", attackMs: "int", releaseMs: "int", holdMs: "int", sensitivity: "number" } } } },
};

clipSpec.object.tracks = { array: trackSpec };

const videoSpec: ObjectSpec = {
  object: {
    schema: "string",
    version: "int",
    canvas: { object: { aspect: "string", background: "string", shutterAngle: { pointer: "number" }, shutterPhase: { pointer: "number" }, perspective: { pointer: "number" } } },
    durationMs: "int",
    tracks: { array: trackSpec },
    markers: { array: { object: markerFieldSpecs } },
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
const ALIGNS = new Set(["", "left", "center", "right"]);

function within(v: number, lo: number, hi: number): boolean {
  return Number.isFinite(v) && v >= lo && v <= hi;
}

const BLEND_VALUES = new Set<string>(["", ...BLEND_MODES]);
const FRAME_VALUES = new Set<string>(["", ...FRAME_KINDS]);
const FILL_RULE_VALUES = new Set<string>(["", ...FILL_RULES]);
const CAP_VALUES = new Set<string>(["", ...LINE_CAPS]);
const JOIN_VALUES = new Set<string>(["", ...LINE_JOINS]);

const LINE_END_VALUES = new Set<string>(["", ...LINE_END_KINDS]);

function lineEndIssue(l: DecodedLayer): IssueCode | null {
  if (!LINE_END_VALUES.has(l.arrowStartKind ?? "") || !LINE_END_VALUES.has(l.arrowEndKind ?? "")) return "unknown";
  if ((l.arrowStartKind && !l.arrowStart) || (l.arrowEndKind && !l.arrowEnd)) return "invalid";
  return null;
}

function strokeIssue(l: DecodedLayer): IssueCode | null {
  const endCode = lineEndIssue(l);
  if (endCode) return endCode;
  if (!CAP_VALUES.has(l.lineCap ?? "") || !JOIN_VALUES.has(l.lineJoin ?? "")) return "unknown";
  const dashes = l.dashArray ?? [];
  const styled = (l.lineCap ?? "") !== "" || (l.lineJoin ?? "") !== "" || (l.miterLimit ?? 0) !== 0 || dashes.length > 0 || (l.dashOffset ?? 0) !== 0;
  if (styled && l.type === "icon") return "invalid";
  if ((l.miterLimit ?? 0) !== 0 && !within(l.miterLimit ?? 0, ...LAYER_RANGES.miterLimit)) return "out_of_range";
  if (!dashPatternFits(dashes)) return "invalid";
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
  return (l.color ? gradeIssue(l.color) : null) ?? (l.chromaKey ? chromaIssue(l.chromaKey) : null);
}

function shapeLayerIssue(l: DecodedLayer): IssueCode | null {
  if (!(SHAPE_KINDS as readonly string[]).includes(l.shape ?? "")) return "unknown";
  const path = l.path ?? "";
  const points = l.points ?? 0;
  const inner = l.inner ?? 0;
  if ((l.shape === "path") !== (path !== "") || (path !== "" && !isValidPath(path))) return "invalid";
  if (l.shape === "polygon") return inner !== 0 ? "invalid" : points !== 0 && !within(points, ...LAYER_RANGES.starPoints) ? "out_of_range" : null;
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

function isZero(value: unknown): boolean {
  return value === undefined || value === "" || value === false || value === 0 || (Array.isArray(value) && value.length === 0);
}

function instanceLayerIssue(l: DecodedLayer): IssueCode | null {
  if (Object.entries(l).some(([key, value]) => !INSTANCE_FIELDS.includes(key) && !isZero(value))) return "invalid";
  return isValidToken(l.componentId ?? "") ? null : "invalid";
}

function overridesIssue(overrides: readonly InstanceOverride[], component: ImageSurface): IssueCode | null {
  const mains = new Map(component.layers.map((layer) => [layer.id, layer]));
  const seen = new Set<string>();
  for (const override of overrides) {
    const main = mains.get(override.layerId);
    if (!main) return "invalid";
    if (seen.has(override.layerId)) return "duplicate";
    seen.add(override.layerId);
    const fields = setFields(override);
    const allowed = overridableFields(main);
    if (fields.length === 0 || fields.some((field) => !allowed.includes(field))) return "invalid";
    const code = layerIssue(overriddenLayer(main, override));
    if (code) return code;
  }
  return null;
}

function shadowValid(s: { color: string; blur: number; x: number; y: number }): boolean {
  return isValidColor(s.color, true) && within(s.blur, 0, 200) && within(s.x, -500, 500) && within(s.y, -500, 500);
}

const STYLE_FIELDS: Record<StyleKind, readonly string[]> = { color: ["color", "gradient"], text: [...TEXT_STYLE_FIELDS, "role"], effect: ["shadow"] };
const ALL_STYLE_FIELDS = Object.values(STYLE_FIELDS).flat();

function isSet(value: unknown): boolean {
  return value !== undefined && value !== "" && value !== 0;
}

function textStyleIssue(s: StudioStyle): IssueCode | null {
  if (!TEXT_STYLE_FIELDS.some((field) => isSet(s[field]))) return "invalid";
  if (((s.fontId ?? "") !== "" && !isFontId(s.fontId)) || ((s.role ?? "") !== "" && !(STYLE_ROLES as readonly string[]).includes(s.role ?? ""))) return "unknown";
  const weight = s.fontWeight ?? 0;
  if (weight !== 0 && (weight < 100 || weight > 900 || weight % 100 !== 0)) return "out_of_range";
  if (isSet(s.fontSizePx) && !within(s.fontSizePx ?? 0, ...STYLE_RANGES.fontSizePx)) return "out_of_range";
  if (isSet(s.lineHeight) && !within(s.lineHeight ?? 0, ...LAYER_RANGES.lineHeight)) return "out_of_range";
  return isSet(s.letterSpacing) && !within(s.letterSpacing ?? 0, ...LAYER_RANGES.letterSpacing) ? "out_of_range" : null;
}

export function styleIssue(s: StudioStyle): IssueCode | null {
  if (!isValidToken(s.id) || s.name.trim() === "" || runes(s.name) > STUDIO_LIMITS.maxLayerNameRunes || runes(s.description ?? "") > STYLE_RANGES.descriptionRunes) return "invalid";
  if (!(STYLE_KINDS as readonly string[]).includes(s.kind)) return "unknown";
  if (ALL_STYLE_FIELDS.some((field) => !STYLE_FIELDS[s.kind].includes(field) && isSet(s[field as keyof StudioStyle]))) return "invalid";
  if (s.kind === "text") return textStyleIssue(s);
  if (s.kind === "effect") return s.shadow && shadowValid(s.shadow) ? null : "invalid";
  const solid = (s.color ?? "") !== "";
  if (solid === Boolean(s.gradient)) return "invalid";
  return (solid ? isValidColor(s.color ?? "", true) : gradientValid(s.gradient)) ? null : "invalid";
}

function stylesIssue(styles: readonly StudioStyle[]): IssueCode | null {
  const seen = new Set<string>();
  for (const style of styles) {
    if (seen.has(style.id)) return "duplicate";
    seen.add(style.id);
    const code = styleIssue(style);
    if (code) return code;
  }
  return null;
}

function styleLinksIssue(surfaces: readonly Pick<ImageSurface, "layers" | "canvas">[], styles: readonly StudioStyle[]): IssueCode | null {
  const byId = new Map(styles.map((style) => [style.id, style]));
  for (const surface of surfaces) {
    const background = surface.canvas.backgroundStyleId ?? "";
    if (background !== "" && backgroundIssue(surface.canvas, byId.get(background))) return "invalid";
    for (const layer of surface.layers) {
      if (linkedSlots(layer).some(([slot, id]) => slotIssue(layer, slot, byId.get(id), surface.canvas.height))) return "invalid";
    }
  }
  return null;
}

function componentsIssue(artboards: readonly Pick<Artboard, "id" | "component" | "layers" | "canvas">[]): IssueCode | null {
  const components = new Map(artboards.filter((a) => a.component).map((a) => [a.id, a]));
  for (const artboard of artboards) {
    for (const layer of artboard.layers) {
      if (layer.type !== "instance") continue;
      const component = components.get(layer.componentId ?? "");
      if (artboard.component || !component) return "invalid";
      const code = overridesIssue(layer.overrides ?? [], component);
      if (code) return code;
    }
  }
  return null;
}

export function layerIssue(layer: Layer, runLimit: number = runes(layer.text ?? "")): IssueCode | null {
  const l = layer as DecodedLayer;
  if (!isValidToken(l.id) || ((l.groupId ?? "") !== "" && !isValidToken(l.groupId ?? "")) || runes(l.name ?? "") > STUDIO_LIMITS.maxLayerNameRunes) {
    return "invalid";
  }
  const transformCode = layerTransformIssue(l.transform);
  if (transformCode) return transformCode;
  if (l.type === "instance") return instanceLayerIssue(l);
  if (l.type === "chart") return chartLayerIssue(l);
  if (l.type === "table") return tableLayerIssue(l);
  if (l.type === "qr") return qrLayerIssue(l);
  if ((l.componentId ?? "") !== "" || (l.overrides ?? []).length > 0 || l.chart || l.table || l.qr) return "invalid";
  if ([l.fillStyleId, l.strokeStyleId, l.textStyleId, l.effectStyleId].some((id) => (id ?? "") !== "" && !isValidToken(id ?? ""))) return "invalid";
  if (!isValidColor(l.fill ?? "", false) || !isValidColor(l.stroke ?? "", false) || !within(l.strokeWidth ?? 0, 0, 200) || !within(l.radius ?? 0, 0, 1)) {
    return "invalid";
  }
  const s = l.shadow;
  if (s && !shadowValid(s)) return "invalid";
  if (!BLEND_VALUES.has(l.blendMode ?? "") || !FRAME_VALUES.has(l.frame ?? "") || !FILL_RULE_VALUES.has(l.fillRule ?? "")) return "unknown";
  if ((l.fillRule ?? "") !== "" && !(l.type === "shape" && l.shape === "path")) return "invalid";
  const strokeCode = strokeIssue(l);
  if (strokeCode) return strokeCode;
  const h = l.highlight;
  if (!gradientValid(l.gradient) || (h && (!isValidColor(h.color, true) || !within(h.radius, 0, 1)))) return "invalid";
  if (!within(l.curve ?? 0, -1, 1)) return "out_of_range";
  if ((l.color || l.chromaKey || (l.vfx?.length ?? 0) > 0) && l.type !== "image") return "invalid";
  const vfxCode = stillVfxIssue(l.vfx ?? []);
  if (vfxCode) return vfxCode;
  const paintCode = layerPaintIssue(l, gradientValid) ?? pixelLayerIssue(l) ?? textRunsIssue(l, runLimit) ?? pathOpsIssue(l);
  if (paintCode) return paintCode;
  switch (l.type) {
    case "paint":
      return null;
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
  const vfxCode = stillVfxIssue(s.canvas.vfx ?? []);
  if (vfxCode) return issue(ISSUE_FIELDS.canvas, vfxCode);
  for (const layer of s.layers) {
    if (seen.layers.has(layer.id)) return issue(ISSUE_FIELDS.layers, "duplicate");
    seen.layers.add(layer.id);
    const code = layerIssue(layer) ?? stillPathOpsIssue(layer);
    if (code) return issue(ISSUE_FIELDS.layers, code);
  }
  const groupCode = groupsIssue(s.groups ?? [], s.layers) ?? repeatsIssue(s.groups ?? [], s.layers) ?? layoutsIssue(s.groups ?? [], s.layers);
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
  const componentCode = componentsIssue(d.artboards);
  if (componentCode) return issue(ISSUE_FIELDS.layers, componentCode);
  const styleCode = stylesIssue(d.styles ?? []);
  if (styleCode) return issue(ISSUE_FIELDS.styles, styleCode);
  return styleLinksIssue(d.artboards, d.styles ?? []) ? issue(ISSUE_FIELDS.layers, "invalid") : null;
}

function legacyImageIssue(d: LegacyImageDocument): DocumentIssue | null {
  if (d.schema !== IMAGE_SCHEMA || d.version !== DOCUMENT_VERSION) return issue(ISSUE_FIELDS.document, "unknown");
  const componentCode = componentsIssue([{ id: "", layers: d.layers, canvas: d.canvas }]) ?? styleLinksIssue([{ layers: d.layers, canvas: d.canvas }], []);
  return componentCode ? issue(ISSUE_FIELDS.layers, componentCode) : surfaceIssue(d);
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

function clipTransformIssue(t: Transform, [low, high]: readonly [number, number]): IssueCode | null {
  if (!within(t.x, low, high) || !within(t.y, low, high) || !within(t.opacity, 0, 1)) return "out_of_range";
  if (!within(t.w, 0.001, 4) || !within(t.h, 0.001, 4) || !within(t.rotation, -360, 360)) return "out_of_range";
  return null;
}

export function clipIssue(c: Clip, kind: Track["kind"], durationMs: number): IssueCode | null {
  if (c.startMs < 0 || c.trimInMs < 0 || c.durationMs < STUDIO_LIMITS.minClipMs || c.startMs + c.durationMs > durationMs) return "out_of_range";
  if (c.fadeInMs < 0 || c.fadeOutMs < 0 || c.fadeInMs + c.fadeOutMs > c.durationMs) return "out_of_range";
  if (!within(c.volume, 0, STUDIO_LIMITS.maxVolume)) return "out_of_range";
  if ((c.linkId ?? "") !== "" && !isValidToken(c.linkId ?? "")) return "invalid";
  const assetId = (c.assetId ?? "").trim();
  if (soundAssetIssue(c)) return "invalid";
  if ((c.counter || c.textPath || c.repeat) && c.type !== "overlay") return "invalid";
  if ((c.transitionIn || c.transitionOut) && c.type !== "video" && c.type !== "image" && c.type !== "overlay" && c.type !== "group") return "invalid";
  const trackingCode = trackersIssue(c) ?? stabilizeIssue(c);
  if (trackingCode) return trackingCode;
  if (c.type !== "group" && (c.tracks?.length ?? 0) > 0) return "invalid";
  const organizeCode = clipOrganizeIssue(c);
  if (organizeCode) return organizeCode;
  const behaviorCode = behaviorsIssue(c) ?? clipStyleIssue(c);
  if (behaviorCode) return behaviorCode;
  if (kind === "audio") {
    if (c.type !== "audio" || assetId === "" || c.motionIn || c.motionOut || c.textIn || c.textOut || c.color || c.chromaKey || c.lumaKey || c.matte || c.matteChannel || c.matteInvert || c.blendMode || (c.masks?.length ?? 0) > 0 || (c.vfx?.length ?? 0) > 0 || (c.textAnimators?.length ?? 0) > 0 || (c.blur ?? 0) !== 0 || carriesPlacement(c) || c.line || c.motionBlur || c.camera || carriesTilt(c)) return "invalid";
    return (c.gradientMap ? "invalid" : null) ?? clipPanIssue(c) ?? audioKeysIssue(c) ?? speedIssue(c);
  }
  if (animatedProperties(c.keyframes).some(isAudioProperty) || clipPanIssue(c)) return "invalid";
  if ((c.chromaKey || c.lumaKey) && c.type !== "video" && c.type !== "image") return "invalid";
  const compositeCode = clipBlendIssue(c) ?? matteIssue(c);
  if (compositeCode) return compositeCode;
  if (c.line && c.type !== "overlay") return "invalid";
  if (c.blur !== undefined && !within(c.blur, KEYFRAME_RANGES.blur[0], KEYFRAME_RANGES.blur[1])) return "out_of_range";
  const tiltCode = tiltIssue(c);
  if (tiltCode) return tiltCode;
  switch (c.type) {
    case "video":
    case "image":
      if (assetId === "" || (c.fit !== "cover" && c.fit !== "contain")) return "invalid";
      break;
    case "overlay": {
      if (!c.layer || (c.assetId ?? "") !== "" || carriesPixels(c.layer) || c.layer.type === "instance" || linkedSlots(c.layer).length > 0 || c.layer.layoutItem || (c.layer.vfx?.length ?? 0) > 0) return "invalid";
      const code = effectKeysIssue(c.layer.effects) ?? layerIssue({ ...c.layer, ...(c.layer.effects ? { effects: withoutEffectKeys(c.layer.effects) } : {}) }, clipRunLength(c));
      if (code) return code;
      break;
    }
    case "effect":
      return adjustmentClipIssue(c) ?? effectVfxIssue(c.vfx);
    case "null": {
      const code = nullClipIssue(c);
      if (code) return code;
      break;
    }
    case "group": {
      const code = groupClipIssue(c);
      if (code) return code;
      break;
    }
    default:
      return "unknown";
  }
  const motionCode = motionIssue(c.motionIn, c.motionOut, c.durationMs);
  if (motionCode) return motionCode;
  const edgeCode = edgeTransitionsIssue(c);
  if (edgeCode) return TRANSITION_ISSUES[edgeCode];
  const keyframeCode = cameraOutsideIssue(c) ?? keyframesIssue(c.keyframes, c.transform) ?? colorKeysIssue(c) ?? clipMorphIssue(c) ?? textAnimationIssue(c) ?? textAnimatorsIssue(c) ?? speedIssue(c) ?? clipGradeIssue(c) ?? (c.chromaKey ? chromaIssue(c.chromaKey) : null) ?? (c.lumaKey ? lumaIssue(c.lumaKey) : null) ?? maskIssue(c.masks ?? []) ?? vfxIssue(c.vfx ?? []) ?? placementIssue(c) ?? motionBlurIssue(c) ?? lineIssue(c) ?? counterIssue(c) ?? textPathIssue(c) ?? clipRepeatClipIssue(c) ?? chartInIssue(c);
  if (keyframeCode) return keyframeCode;
  return clipTransformIssue(c.transform, positionRange(c));
}

const TRANSITION_ISSUES: Record<TransitionIssue, IssueCode> = {
  apart: "invalid",
  kind: "unknown",
  duration: "out_of_range",
  alignment: "invalid",
  easing: "unknown",
  option: "invalid",
  covered: "invalid",
};

function audioKeysIssue(c: Clip): IssueCode | null {
  if (!c.keyframes) return null;
  if (!animatedProperties(c.keyframes).every((property) => isAudioProperty(property) || isSpeedProperty(property))) return "invalid";
  return keyframesIssue(c.keyframes, c.transform);
}

function clipGradeIssue(c: Clip): IssueCode | null {
  const graded = c.type === "video" || c.type === "image" || c.type === "group";
  if (c.color && !graded) return "invalid";
  if (c.gradientMap && !graded) return "invalid";
  return (c.color ? gradeIssue(c.color) : null) ?? (c.gradientMap ? gradientMapIssue(c.gradientMap) : null) ?? gradeKeysIssue(c);
}

function colorKeysIssue(c: Clip): IssueCode | null {
  const animated = COLOR_PROPERTIES.filter((property) => colorFramesOf(c.keyframes, property).length > 0);
  if (animated.length === 0) return null;
  const layer = c.type === "overlay" ? c.layer : undefined;
  return layer && animated.every((property) => paintsProperty(layer, property)) ? null : "invalid";
}

function motionIssue(motionIn: Motion | undefined, motionOut: Motion | undefined, durationMs: number): IssueCode | null {
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
  const code = markerListIssue(markers, STUDIO_LIMITS.maxVideoMs);
  return code ? issue(ISSUE_FIELDS.markers, code) : null;
}

function videoDocumentIssue(d: VideoDocument): DocumentIssue | null {
  if (d.schema !== VIDEO_SCHEMA || d.version !== DOCUMENT_VERSION) return issue(ISSUE_FIELDS.document, "unknown");
  if (!isValidColor(d.canvas.background, true) || d.canvas.background.length !== 7) return issue(ISSUE_FIELDS.canvas, "invalid");
  if (d.durationMs < 0 || d.durationMs > STUDIO_LIMITS.maxVideoMs) return issue(ISSUE_FIELDS.tracks, "out_of_range");
  if (!VIDEO_ASPECTS.includes(d.canvas.aspect)) return issue(ISSUE_FIELDS.canvas, "unknown");
  const shutterCode = shutterIssue(d.canvas) ?? perspectiveIssue(d.canvas);
  if (shutterCode) return issue(ISSUE_FIELDS.canvas, shutterCode);
  return timelineIssue(d, new Set<string>()) ?? markersIssue(d.markers ?? []);
}

function timelineIssue(d: VideoDocument, ids: Set<string>): DocumentIssue | null {
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
      const inner = isGroupClip(c) ? timelineIssue({ ...d, durationMs: STUDIO_LIMITS.maxVideoMs, tracks: c.tracks, markers: undefined }, ids) : null;
      if (inner) return inner;
    }
  }
  if (parentsIssue(d) || behaviorTracksIssue(d) || vfxTracksIssue(d)) return issue(ISSUE_FIELDS.tracks, "invalid");
  for (const track of d.tracks) {
    for (const transition of track.transitions ?? []) {
      if (!isValidToken(transition.id) || ids.has(transition.id)) return issue(ISSUE_FIELDS.tracks, "invalid");
      ids.add(transition.id);
    }
    const transitionCode = transitionsIssue(track);
    if (transitionCode) return issue(ISSUE_FIELDS.tracks, TRANSITION_ISSUES[transitionCode]);
    const audioCode = trackOrganizeIssue(track) ?? trackGainIssue(track) ?? trackPanIssue(track) ?? duckingIssue(track, d);
    if (audioCode) return issue(ISSUE_FIELDS.tracks, audioCode);
  }
  return null;
}

type ParsedDocument<D extends StudioDocument> = { ok: true; document: D } | { ok: false; issue: DocumentIssue };

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
