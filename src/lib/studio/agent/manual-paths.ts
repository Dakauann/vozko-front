import type { ImageOpName } from "./image-ops";
import type { VideoOpName } from "./video-ops";

export interface ManualPath {
  file: string;
  control: string;
  how: string;
}

export type ManualEntry = { paths: readonly ManualPath[] } | { pending: string };

export type StudioToolEntry = ManualEntry | { perception: string };

const VIDEO = "components/studio/video";
const IMAGE = "components/studio/image";

function by(...paths: ManualPath[]): ManualEntry {
  return { paths };
}

function at(file: string, control: string, how: string): ManualPath {
  return { file, control, how };
}

const KEY_DIAMOND = at(`${VIDEO}/inspector/animation-fields.tsx`, "studio.video.keyframes.add", "Animation section: the key diamond records position, size, rotation and opacity at the playhead");
const FIELD_DIAMOND = at(`${VIDEO}/inspector/layer-style-fields.tsx`, "studio.video.keyframes.keyHere", "Color and outline fields: the diamond beside each field starts or keys a color animation");
const LANE_DIAMOND = at(`${VIDEO}/timeline/track-header.tsx`, "studio.video.keyframes.keyHere", "Focus mode (double click a clip or F): the diamond on each lane header keys that property");
const MASKS = `${VIDEO}/inspector/mask-fields.tsx`;
const PIXELS = `${IMAGE}/pixel-toolbar.tsx`;
const VFX = `${VIDEO}/inspector/vfx-fields.tsx`;
const VFX_STACK = "components/studio/vfx/vfx-stack.tsx";
const STILL_VFX = `${IMAGE}/inspector/still-vfx-section.tsx`;
const CHROMA = `${VIDEO}/inspector/chroma-key-fields.tsx`;
const LUMA = `${VIDEO}/inspector/luma-key-fields.tsx`;
const SPEED = `${VIDEO}/inspector/speed-fields.tsx`;
const TRACK_SOUND = `${VIDEO}/timeline/track-sound.tsx`;
const TRACK_MENU = `${VIDEO}/timeline/track-menu.tsx`;
const MARKER_EDITOR = `${VIDEO}/timeline/marker-editor.tsx`;
const ORGANIZE = `${VIDEO}/inspector/organize-fields.tsx`;
const PRESETS = `${VIDEO}/inspector/preset-fields.tsx`;
const TRANSITION = `${VIDEO}/inspector/transition-inspector.tsx`;
const CLIP = `${VIDEO}/inspector/clip-inspector.tsx`;
const BEHAVIORS = `${VIDEO}/inspector/behavior-fields.tsx`;
const TOOLBAR = `${VIDEO}/editor-toolbar.tsx`;
const BAR = `${VIDEO}/timeline/timeline-bar.tsx`;
const TEXT_RUNS = "components/studio/canvas/text-run-toolbar.tsx";
const CHART_FIELDS = "components/studio/chart/chart-fields.tsx";
const CHART_GRID = "components/studio/chart/data-grid.tsx";
const TABLE_FIELDS = "components/studio/table/table-fields.tsx";
const TABLE_CELLS = "components/studio/table/table-data-dialog.tsx";
const TABLE_CELL_TEXT = "components/studio/table/cell-text-editor.tsx";
const QR_FIELDS = "components/studio/qr/qr-fields.tsx";
const QR_SHORT_LINK = "components/studio/qr/short-link-field.tsx";
const PATH_OPS = "components/studio/inspector/path-ops-fields.tsx";
const CLIP_REPEAT = `${VIDEO}/inspector/repeat-fields.tsx`;

export const VIDEO_MANUAL_PATHS = {
  add_media: by(at(`${VIDEO}/panels/media-panel.tsx`, "studio.video.media.add", "Media panel: drag a file onto a lane or press its add button")),
  import_lottie: by(at(`${VIDEO}/panels/media-panel.tsx`, "studio.video.media.importLottie", "Media panel: import a .json or .lottie file, or press the add button of a Lottie file in the library; it becomes a group of editable clips or the panel lists what blocks it")),
  add_text: by(at(`${VIDEO}/panels/text-panel.tsx`, "studio.library.search.text", "Text panel: text blocks and ready styles; click to insert at the playhead or drag onto the frame or a lane")),
  add_element: by(
    at(`${VIDEO}/panels/elements-panel.tsx`, "studio.library.search.elements", "Elements panel: search or browse the library; click inserts at the playhead, drag places it on the frame or on a timeline lane"),
    at(`${VIDEO}/panels/elements-panel.tsx`, "studio.library.search.elements", "Elements panel, Frames and Grids: select video or image clips and click, or drag a frame onto a clip in the preview; Animated stickers insert at the playhead"),
    at(`${VIDEO}/panels/text-panel.tsx`, "studio.library.search.text", "Text panel: the text items of the same library"),
  ),
  add_shape: by(
    at(`${VIDEO}/panels/elements-panel.tsx`, "studio.library.search.elements", "Elements panel: the Shapes category with lines, banners and bubbles"),
    at(`${VIDEO}/inspector/layer-style-fields.tsx`, "studio.video.layer.path", "Inspector: the SVG path of a vector shape and its fill rule"),
  ),
  add_icon: by(at(`${VIDEO}/panels/elements-panel.tsx`, "studio.library.search.elements", "Elements panel: the Icons category, or search by name")),
  add_captions: by(at(`${VIDEO}/panels/captions-panel.tsx`, "studio.video.captions.placeFile", "Captions panel: place a caption file or generate captions")),
  move_clip: by(at(CLIP, "studio.video.inspector.start", "Drag the clip, or type its start in the inspector")),
  trim_clip: by(at(CLIP, "studio.video.inspector.duration", "Drag a clip edge, or type its duration in the inspector")),
  slip_clip: by(at(CLIP, "studio.video.inspector.trimIn", "Inspector trim start, or the slip tool (Y)")),
  roll_edit: by(at(BAR, "studio.video.timeline.bar.tools", "Timeline tools: roll (T cycles the trim tools), then drag a cut")),
  slide_clip: by(at(BAR, "studio.video.timeline.bar.tools", "Timeline tools: slide (U), then drag the clip")),
  split_clip: by(at(TOOLBAR, "studio.video.toolbar.split", "Toolbar split at the playhead (S), blade tool (B) or the clip menu")),
  delete_clips: by(at(TOOLBAR, "studio.video.toolbar.rippleDelete", "Toolbar delete or delete and close the gap; Delete and Shift+Delete")),
  duplicate_clips: by(at(TOOLBAR, "studio.video.toolbar.duplicate", "Toolbar duplicate (Ctrl+D) or the clip menu")),
  update_clip: by(
    at(CLIP, "studio.video.inspector.fadeIn", "Inspector: timing, frame, opacity, blur, volume and fades"),
    at(ORGANIZE, "studio.video.organize.name", "Organization section: clip name shown on the timeline"),
    at(ORGANIZE, "studio.video.organize.label", "Organization section: label color"),
    at(ORGANIZE, "studio.video.organize.guide", "Organization section: guide clip, shown in the preview and never exported (also the clip menu)"),
    at(CLIP, "studio.video.inspector.disabled", "Inspector: turn the clip off (also D or the clip menu)"),
    at(`${VIDEO}/inspector/placement-fields.tsx`, "studio.video.inspector.flip", "Inspector: flip horizontally or vertically"),
    at(MASKS, "studio.video.masks.matte", "Inspector masks: clip to the clip below"),
    at(MASKS, "studio.video.masks.matteChannel", "Inspector masks: clip by the picture or the brightness of the clip below, and invert it"),
    at(CLIP, "studio.video.inspector.blendMode", "Inspector frame: blend mode of a video or image clip, add included"),
    at(CLIP, "studio.video.inspector.motionBlur", "Inspector frame: motion blur switch on video, image and overlay clips"),
    at(CLIP, "studio.video.inspector.tilt", "Inspector 3D rotation section: rotation X and Y fields, each with a key diamond"),
    at(`${VIDEO}/inspector/layer-style-fields.tsx`, "studio.video.layer.fill", "Inspector: text, font, colors, outline, shadow, gradient and blend"),
    at(`${VIDEO}/inspector/stroke-style-fields.tsx`, "studio.vectors.stroke.pattern", "Inspector: dash pattern, ends, corners and miter limit"),
    at(`${VIDEO}/inspector/clip-style-fields.tsx`, "studio.video.styles.mediaHint", "Inspector Efeitos tab: fill, outline and effect lists on texts, shapes and icons; drop shadow, outer glow and outside outline on video and image clips"),
  ),
  animate_effect: by(at(`${VIDEO}/inspector/clip-style-fields.tsx`, "studio.video.styles.key", "Inspector Efeitos tab: the diamond beside an effect value (opacity, offset, blur, spread) keys it at the playhead")),
  animate: by(
    KEY_DIAMOND,
    FIELD_DIAMOND,
    LANE_DIAMOND,
    at(CLIP, "studio.video.inspector.rotationX", "Inspector 3D rotation section: the diamond beside rotation X or Y keys the turn in depth at the playhead"),
    at(`${VIDEO}/inspector/keyframe-fields.tsx`, "studio.video.keyframes.animate", "Animation section, Advanced: a stopwatch per property"),
    at(`${VIDEO}/inspector/morph-fields.tsx`, "studio.video.morph.key", "Forma animada section on a shape: the diamond keys its outline at the playhead (rectangles, ellipses, triangles and stars turn into a path), and each key picks its first vertex"),
    at(`${VIDEO}/preview/path-key-overlay.tsx`, "studio.video.morph.editHint", "Editar pontos no quadro: drag the points and handles on the frame; once the shape animates each change keys it at the playhead, and a double click picks the first vertex"),
  ),
  motion_preset: by(at(`${VIDEO}/inspector/preset-grid.tsx`, "studio.video.keyframes.presetsTitle", "Animation section: ready animations")),
  entrance: by(
    at(`${VIDEO}/inspector/motion-fields.tsx`, "studio.video.motion.entrance", "Inspector: the entrance gallery (fade, slides and every transition with a preview), its duration"),
    at(`${VIDEO}/inspector/motion-fields.tsx`, "studio.video.motion.transitionsGroup", "Inspector: an entrance transition shows its curve and options, the gradient map image included"),
  ),
  exit: by(
    at(`${VIDEO}/inspector/motion-fields.tsx`, "studio.video.motion.exit", "Inspector: the exit gallery (fade, slides and every transition with a preview), its duration"),
    at(`${VIDEO}/inspector/transition-option-fields.tsx`, "studio.video.transitions.mapPicture", "Inspector: a gradient wipe takes a library image as its tone map"),
  ),
  animate_text: by(at(`${VIDEO}/inspector/text-motion-fields.tsx`, "studio.video.textMotion.title", "Inspector: text animation in and out per letter, word or line")),
  set_speed: by(
    at(SPEED, "studio.video.speed.speed", "Inspector speed, presets, reverse and pitch"),
    at(SPEED, "studio.video.speed.targetDuration", "Inspector: retime to a length"),
    at(SPEED, "studio.video.speed.ripple", "Inspector: push the following clips or not"),
    at(SPEED, "studio.video.speed.stretchKeys", "Inspector: stretch the animation with the clip or not"),
    at(SPEED, "studio.video.speed.protectEdges", "Inspector: keep the timing of the keys near the start and the end while the rest stretches"),
    at(SPEED, "studio.video.speed.frameMix", "Inspector: frame mix blends neighbouring source frames in slow motion"),
  ),
  freeze_frame: by(at(SPEED, "studio.video.speed.freezeDuration", "Inspector: freeze frame length, then freeze at the playhead")),
  speed_ramp: by(
    at(SPEED, "studio.video.speed.ramp.mode", "Inspector: smooth ramp or steps"),
    at(SPEED, "studio.video.speed.ramp.steps", "Inspector: ramp target, length, steps and curve, applied at the playhead"),
  ),
  set_speed_curve: by(
    at(SPEED, "studio.video.speed.curve.presets", "Inspector speed curve: ready curves, smooth or straight, draw or remove the curve"),
    at(`${VIDEO}/inspector/speed-curve-editor.tsx`, "studio.video.speed.curve.graph", "Inspector speed curve: drag, add and remove points on the speed graph"),
  ),
  set_color: by(
    at(`${VIDEO}/inspector/color-grade-fields.tsx`, "studio.grade.intensity", "Inspector Cor tab: sliders, look intensity, looks and reset"),
    at(`${VIDEO}/inspector/keyed-slider.tsx`, "studio.video.keyframes.keyHere", "Inspector Cor tab: the diamond beside each slider keys the grade at the playhead"),
    at("components/studio/color/curve-editor.tsx", "studio.color.curves.graph", "Inspector Cor tab: curves per channel"),
    at("components/studio/color/color-sections.tsx", "studio.color.hsl.desaturate", "Inspector Cor tab: selective color, hue picker and sliders"),
    at("components/studio/color/color-sections.tsx", "studio.color.lut.import", "Inspector Cor tab: pick or import a LUT and its intensity"),
    at("components/studio/color/gradient-map-section.tsx", "studio.image.paint.gradientMap.interpolation", "Inspector Cor tab: gradient map"),
  ),
  set_chroma_key: by(at(CHROMA, "studio.chroma.color", "Inspector green screen: start, key color and sliders")),
  animate_chroma: by(at(CHROMA, "studio.chroma.key", "Inspector green screen: the diamond beside each slider")),
  remove_chroma_key: by(at(CHROMA, "studio.chroma.remove", "Inspector green screen: remove")),
  set_luma_key: by(at(LUMA, "studio.luma.mode", "Inspector luma key: start dark or light, mode and sliders")),
  animate_luma: by(at(LUMA, "studio.luma.key", "Inspector luma key: the diamond beside each slider")),
  remove_luma_key: by(at(LUMA, "studio.luma.remove", "Inspector luma key: remove")),
  add_mask: by(at(MASKS, "studio.video.masks.addShape", "Inspector masks: add a mask shape")),
  update_mask: by(at(MASKS, "studio.video.masks.mode", "Inspector masks: mode, invert, path and geometry")),
  animate_mask: by(
    at(MASKS, "studio.video.masks.key", "Inspector masks: the diamond beside each field"),
    at(MASKS, "studio.video.morph.edit", "Inspector masks: a path mask keys its SVG path with the diamond beside it, edits its points on the frame and picks the first vertex of each key"),
  ),
  move_mask: by(at(MASKS, "studio.video.masks.moveUp", "Inspector masks: move up or down")),
  remove_mask: by(at(MASKS, "studio.video.masks.remove", "Inspector masks: remove")),
  add_effect_clip: by(
    at(`${VIDEO}/panels/effects-panel.tsx`, "studio.video.vfx.panelAdd", "Effects panel: add an effect clip at the playhead"),
    at(`${VIDEO}/panels/effects-panel.tsx`, "studio.video.vfx.adjustmentAdd", "Effects panel: add an empty adjustment clip at the playhead"),
  ),
  set_camera: by(
    at(`${VIDEO}/inspector/camera-fields.tsx`, "studio.video.camera.zoom", "Inspector Câmera section of an effect clip: pan, zoom, rotation, lens blur and motion blur"),
    at(`${VIDEO}/inspector/camera-fields.tsx`, "studio.video.camera.reset", "Inspector Câmera section: remove the camera"),
  ),
  add_vfx: by(at(VFX, "studio.video.vfx.addKind", "Inspector effects: the before and after preview tiles add an effect")),
  update_vfx: by(
    at(VFX_STACK, "studio.video.vfx.shuffle", "Inspector effects: parameters, hide and shuffle the seed"),
    at(VFX, "studio.video.vfx.soundTrack", "Inspector effects: the sound track picker of an audio spectrum or waveform, the vfx_track_id"),
  ),
  animate_vfx: by(at(VFX, "studio.video.vfx.key", "Inspector effects: the diamond beside each keyable parameter")),
  move_vfx: by(at(VFX_STACK, "studio.video.vfx.moveUp", "Inspector effects: move up or down")),
  remove_vfx: by(at(VFX_STACK, "studio.video.vfx.remove", "Inspector effects: remove")),
  set_line: by(at(`${VIDEO}/inspector/line-fields.tsx`, "studio.video.line.sequential", "Inspector line animation: trim, wave, wiggle and taper")),
  set_path_ops: by(at(PATH_OPS, "studio.pathOps.title", "Inspector path operators: presets, add an operator, reorder, hide, remove and every number")),
  animate_path_op: by(at(PATH_OPS, "studio.pathOps.key", "Inspector path operators: the diamond beside each number keys it at the playhead")),
  set_repeat: by(at(CLIP_REPEAT, "studio.video.repeat.title", "Inspector repeater: presets, mode and every copy offset")),
  clear_repeat: by(at(CLIP_REPEAT, "studio.video.repeat.remove", "Inspector repeater: remove")),
  animate_repeat: by(at(CLIP_REPEAT, "studio.video.repeat.key", "Inspector repeater: the diamond beside each number keys it at the playhead")),
  set_counter: by(
    at(`${VIDEO}/inspector/counter-fields.tsx`, "studio.video.counter.title", "Inspector on a text clip: Contador section (count from, to, length, curve, decimals, separators, prefix and suffix)"),
    at(`${VIDEO}/panels/text-panel.tsx`, "studio.library.search.text", "Text panel: Contador inserts a text that counts"),
  ),
  remove_counter: by(at(`${VIDEO}/inspector/counter-fields.tsx`, "studio.video.counter.remove", "Inspector Contador section: Remover contador")),
  style_text: by(at(TEXT_RUNS, "studio.textRuns.label", "Double click a text in the preview (or Editar na prévia in the inspector), select letters and use the floating toolbar: color, font, weight, size, italic, underline, caps and spacing; Ctrl+B, Ctrl+I and Ctrl+U"), at(TABLE_CELL_TEXT, "studio.tables.cell.whole", "Table cells: in the inspector Text of one cell, select part of the text and use the same toolbar, without the size")),
  set_text_path: by(at(`${VIDEO}/inspector/text-path-fields.tsx`, "studio.video.textPath.title", "Inspector on a text clip: Texto em caminho section (shape, bend, custom path, position along the curve, alignment, upright, reverse)")),
  remove_text_path: by(at(`${VIDEO}/inspector/text-path-fields.tsx`, "studio.video.textPath.remove", "Inspector Texto em caminho section: Tirar do caminho")),
  add_text_animator: by(
    at(`${VIDEO}/inspector/text-animator-fields.tsx`, "studio.video.textAnimators.presetApply", "Animação tab on a text clip: Animadores de texto gallery adds a ready animator"),
    at(`${VIDEO}/inspector/text-animator-fields.tsx`, "studio.video.textAnimators.addCustom", "Animadores de texto: Novo animador adds an empty one to fill by hand"),
  ),
  update_text_animator: by(at(`${VIDEO}/inspector/text-animator-fields.tsx`, "studio.video.textAnimators.detail", "Animadores de texto: the open animator (unit, properties, selector, order, shape, ease)")),
  animate_text_animator: by(at(`${VIDEO}/inspector/text-animator-fields.tsx`, "studio.video.textAnimators.key", "Animadores de texto: the diamond beside start, end, offset and amount")),
  move_text_animator: by(at(`${VIDEO}/inspector/text-animator-fields.tsx`, "studio.video.textAnimators.moveUp", "Animadores de texto: move up or down")),
  remove_text_animator: by(at(`${VIDEO}/inspector/text-animator-fields.tsx`, "studio.video.textAnimators.remove", "Animadores de texto: remove")),
  add_track: by(at(BAR, "studio.video.timeline.bar.addVisual", "Timeline bar: new track"), at(TRACK_MENU, "studio.video.timeline.track.addAbove", "Track menu: new track above or below")),
  move_track: by(at(TRACK_MENU, "studio.video.timeline.track.moveUp", "Track menu: move up or down")),
  update_track: by(at(`${VIDEO}/timeline/track-header.tsx`, "studio.video.timeline.track.lock", "Track header: rename, hide, lock and mute"), at(TRACK_SOUND, "studio.video.trackSound.level", "Track sound: track level"), at(TRACK_MENU, "studio.video.timeline.track.labelColor", "Track menu: label color"), at(TRACK_MENU, "studio.video.timeline.track.shy", "Track menu: hide the track from the timeline (shy); the timeline bar shows them again")),
  remove_track: by(at(TRACK_MENU, "studio.video.timeline.track.remove", "Track menu: remove")),
  add_marker: by(
    at(BAR, "studio.video.timeline.bar.marker", "Timeline bar marker button (M) or the lane menu"),
    at(ORGANIZE, "studio.video.organize.addMarker", "Organization section: add a marker on the clip at the playhead (Shift+M or the clip menu)"),
  ),
  update_marker: by(
    at(MARKER_EDITOR, "studio.video.timeline.markers.label", "Marker flag or clip marker tick: name"),
    at(MARKER_EDITOR, "studio.video.timeline.markers.time", "Marker flag or clip marker tick: time or move to the playhead"),
    at(MARKER_EDITOR, "studio.video.timeline.markers.duration", "Marker flag or clip marker tick: duration for a range"),
    at(MARKER_EDITOR, "studio.video.timeline.markers.color", "Marker flag or clip marker tick: color"),
    at(MARKER_EDITOR, "studio.video.timeline.markers.note", "Marker flag or clip marker tick: note"),
  ),
  remove_marker: by(at(MARKER_EDITOR, "studio.video.timeline.markers.remove", "Marker flag or clip marker tick: remove")),
  mark_beats: by(at(ORGANIZE, "studio.video.organize.markBeats", "Organization section of a sound clip: mark the beats, every nth beat and a color")),
  apply_animation_preset: by(at(PRESETS, "studio.video.presets.apply", "Animation tab, Presets: apply a preset to the selected clips with the chosen timing")),
  link_clips: by(at(BAR, "studio.video.timeline.bar.link", "Timeline bar link or the clip menu")),
  unlink_clips: by(at(BAR, "studio.video.timeline.bar.unlink", "Timeline bar unlink, the clip menu or the inspector")),
  set_ducking: by(at(TRACK_SOUND, "studio.video.trackSound.triggers", "Track sound: the tracks that lower this one, and the duck settings")),
  clear_ducking: by(at(TRACK_SOUND, "studio.video.trackSound.clear", "Track sound: remove ducking")),
  bake_ducking: by(at(TRACK_SOUND, "studio.video.trackSound.bake", "Track sound: write the ducking as volume keys")),
  normalize_loudness: by(at(`${VIDEO}/inspector/normalize-fields.tsx`, "studio.video.sound.normalize", "Clip inspector or track sound: normalize loudness to a target")),
  set_canvas: by(at(TOOLBAR, "studio.video.toolbar.aspect", "Toolbar aspect"), at(`${VIDEO}/inspector/inspector.tsx`, "studio.video.inspector.background", "Project inspector (nothing selected): background color"), at(`${VIDEO}/inspector/inspector.tsx`, "studio.video.inspector.shutterAngle", "Project inspector (nothing selected): motion blur shutter angle and phase"), at(`${VIDEO}/inspector/inspector.tsx`, "studio.video.inspector.perspectiveAngle", "Project inspector (nothing selected): Perspectiva section, angle of view of the 3D rotation")),
  seek: by(at(`${VIDEO}/timeline/ruler.tsx`, "studio.video.timeline.playhead", "Click or scrub the ruler; arrows, Home and End")),
  select: by(at(`${VIDEO}/timeline/timeline-clip.tsx`, "studio.video.timeline.clipDescription", "Click, Shift click or marquee clips; click in the preview")),
  add_transition: by(at(`${VIDEO}/timeline/transition-chips.tsx`, "studio.video.transitions.addAt", "Hover a cut and add a transition, or pick one in the transitions panel")),
  update_transition: by(at(TRANSITION, "studio.video.transitions.kind", "Transition inspector: kind, duration, alignment, curve and options such as the dip color")),
  remove_transition: by(at(TRANSITION, "studio.video.transitions.remove", "Transition inspector: remove")),
  set_anchor: by(at(`${VIDEO}/inspector/placement-fields.tsx`, "studio.video.inspector.anchorGrid", "Inspector: anchor grid and fields, or drag the anchor handle in the preview")),
  scale_axes: by(at(`${VIDEO}/inspector/path-fields.tsx`, "studio.video.keyframes.scaleAxes.split", "Animation section: split or join the scale axes")),
  set_path: by(at(`${VIDEO}/inspector/path-fields.tsx`, "studio.video.keyframes.path.curve", "Animation section: curve the motion path")),
  ease_keys: by(
    at(`${VIDEO}/timeline/keyframe-menu.tsx`, "studio.video.keyframes.menu.ease", "Right click keys: ease both sides (F9), the arrival (Shift+F9) or the departure (Ctrl+Shift+F9)"),
    at(`${VIDEO}/timeline/keyframe-dialogs.tsx`, "studio.video.keyframes.velocity.title", "Right click keys, Ease, Velocity (Ctrl+Shift+K): speed and influence in and out"),
  ),
  smooth_keys: by(at(`${VIDEO}/timeline/keyframe-menu.tsx`, "studio.video.keyframes.menu.smoothOn", "Right click keys, Ease: automatic smooth speed through the key")),
  reverse_keys: by(at(`${VIDEO}/timeline/keyframe-menu.tsx`, "studio.video.keyframes.menu.reverse", "Right click keys, Assistants: reverse in time")),
  time_stretch_keys: by(at(`${VIDEO}/timeline/keyframe-dialogs.tsx`, "studio.video.keyframes.stretch.title", "Right click keys, Assistants, Stretch in time: percent from the first or last key")),
  rove_keys: by(at(`${VIDEO}/timeline/keyframe-menu.tsx`, "studio.video.keyframes.menu.rove", "Right click keys, Assistants: constant speed")),
  align_clips: by(
    at(`${VIDEO}/inspector/frame-layout-fields.tsx`, "studio.video.layout.alignGroup", "Inspector Align in frame: six align buttons (Alt+A, D, W, S, H, V), to the selection or the frame"),
    at(`${VIDEO}/inspector/frame-layout-fields.tsx`, "studio.video.layout.relativeTo", "Inspector Align in frame: align to the selection or to the frame when several clips are selected"),
  ),
  distribute_clips: by(at(`${VIDEO}/inspector/frame-layout-fields.tsx`, "studio.video.layout.distributeGroup", "Inspector Align in frame: distribute three or more clips (Alt+Shift+H, V)")),
  sequence_clips: by(
    at(`${VIDEO}/inspector/sequence-fields.tsx`, "studio.video.timing.sequence", "Inspector Sequence with several clips: gap and transition, in selection order"),
    at(`${VIDEO}/timeline/timeline-context-menu.tsx`, "studio.video.timeline.menu.sequence", "Clip menu: sequence the selected clips end to end"),
  ),
  stagger_clips: by(at(`${VIDEO}/inspector/sequence-fields.tsx`, "studio.video.timing.stagger", "Inspector Sequence with several clips: stagger step, in selection order")),
  parent_clip: by(
    at(`${VIDEO}/inspector/parent-fields.tsx`, "studio.video.parenting.picker", "Inspector Parent section: pick the parent or None, with keep position on or off"),
    at(`${VIDEO}/timeline/parent-whip.tsx`, "studio.video.parenting.whip", "Timeline clip label: drag the pick whip onto the parent clip (Shift jumps, Alt click releases)"),
  ),
  add_null: by(at(`${VIDEO}/panels/elements-panel.tsx`, "studio.library.search.elements", "Elements panel, Controls: add a null at the playhead")),
  group_clips: by(at(`${VIDEO}/timeline/timeline-context-menu.tsx`, "studio.video.timeline.menu.group", "Select clips, then the clip menu Group or Ctrl+G; the name is set in the inspector Group section")),
  ungroup_clips: by(
    at(`${VIDEO}/inspector/group-fields.tsx`, "studio.video.groups.ungroup", "Inspector Group section of a selected group: Ungroup, or Ctrl+Shift+G"),
    at(`${VIDEO}/timeline/timeline-context-menu.tsx`, "studio.video.timeline.menu.ungroup", "Clip menu of a group: Ungroup"),
  ),
  track_point: by(at(`${VIDEO}/inspector/tracking-fields.tsx`, "studio.video.tracking.trackPoint", "Tracking section of a video clip: track point, then click and drag the target box in the preview and press track")),
  attach_to_track: by(at(`${VIDEO}/inspector/tracking-fields.tsx`, "studio.video.tracking.attach", "Tracking section: pick the point, the clip and live link or position keys, then make it follow the point")),
  stabilize_clip: by(at(`${VIDEO}/inspector/tracking-fields.tsx`, "studio.video.tracking.stabilize", "Tracking section, Stabilize: pick one or two points, rotation, scale and smoothing, then stabilize; the zoom field adjusts the crop")),
  remove_tracker: by(at(`${VIDEO}/inspector/tracking-fields.tsx`, "studio.video.tracking.remove", "Tracking section: remove beside a tracked point")),
  add_behavior: by(at(BEHAVIORS, "studio.video.behaviors.add", "Inspector Animation, Behaviors: pick the property, then wiggle, loop keys, constant rate, overshoot, react to sound or spin")),
  update_behavior: by(at(BEHAVIORS, "studio.video.behaviors.title", "Inspector Animation, Behaviors: frequency, amount, variation, loop mode and side, rate, overshoot and the sound track on each behavior card")),
  remove_behavior: by(at(BEHAVIORS, "studio.video.behaviors.remove", "Inspector Animation, Behaviors: the trash button on the behavior card")),
  bake_behavior: by(at(BEHAVIORS, "studio.video.behaviors.bake", "Inspector Animation, Behaviors: Bake into keys on the behavior card, one linear key per frame")),
  add_chart: by(at(`${VIDEO}/panels/elements-panel.tsx`, "studio.library.search.elements", "Elements panel, Charts category: click inserts a chart at the playhead and opens the data grid")),
  update_chart_data: by(at(CHART_FIELDS, "studio.chart.editData", "Inspector Chart section: type, data grid (type, paste spreadsheet cells, import CSV), legend, axes, gridlines, labels, font, colors and number format"), at(CHART_GRID, "studio.chart.data.importCsv", "Data grid: paste cells from a spreadsheet or import a CSV file")),
  add_table: by(at(`${VIDEO}/panels/elements-panel.tsx`, "studio.library.search.elements", "Elements panel, Tables category: click inserts a table at the playhead and opens the cell grid")),
  add_qr_code: by(at(`${VIDEO}/panels/elements-panel.tsx`, "studio.library.search.elements", "Elements panel, QR Code category: click inserts a code at the playhead and opens the content form on a platform short link")),
  update_table: by(at(TABLE_FIELDS, "studio.tables.editCells", "Inspector Table section: header row, column widths and alignment, borders, banding, colors, font and padding"), at(TABLE_CELLS, "studio.tables.data.title", "Edit cells dialog: type, paste spreadsheet cells, import CSV, add and remove rows and columns"), at(TABLE_CELL_TEXT, "studio.tables.cell.row", "Inspector Table section, Text of one cell: pick the row and column and type the text")),
  update_qr_code: by(at(QR_FIELDS, "studio.qr.mode", "Inspector QR Code section: content (platform short link, WhatsApp, direct link or text), colors with the contrast check, error correction, margin and center logo"), at(QR_SHORT_LINK, "studio.qr.shortLink.create", "Platform short link: type the destination and create the link, or pick an existing one")),
  animate_chart: by(at(`${VIDEO}/inspector/chart-clip-fields.tsx`, "studio.chart.motion.style", "Inspector Animation, Chart animation: grow, draw, sweep or fade, order by series or category, duration, stagger and curve")),
} as const satisfies Partial<Record<VideoOpName, ManualEntry>>;

const LAYERS = `${IMAGE}/panels/layers-panel.tsx`;
const ACTIONS = `${IMAGE}/selection-actions.ts`;
const ARTBOARDS = `${IMAGE}/inspector/canvas-section.tsx`;
const REPEAT = `${IMAGE}/inspector/repeat-section.tsx`;
const INSTANCE = `${IMAGE}/inspector/instance-section.tsx`;
const STYLES = `${IMAGE}/inspector/styles-section.tsx`;
const LAYOUT = `${IMAGE}/inspector/layout-section.tsx`;

export const IMAGE_MANUAL_PATHS = {
  style_text: by(at(TEXT_RUNS, "studio.textRuns.label", "Double click a text on the canvas (or Editar texto), select letters and use the floating toolbar: color, font, weight, size, italic, underline, caps and spacing; Ctrl+B, Ctrl+I and Ctrl+U"), at(TABLE_CELL_TEXT, "studio.tables.cell.whole", "Table cells: in the inspector Text of one cell, select part of the text and use the same toolbar, without the size")),
  add_text: by(at(`${IMAGE}/panels/text-panel.tsx`, "studio.library.panels.text", "Text panel: heading, subheading or body; or paste text")),
  add_element: by(
    at(`${IMAGE}/panels/elements-panel.tsx`, "studio.library.panels.elements", "Elements panel: search or browse the library; click inserts on the active artboard, drag places it where it is dropped"),
    at(`${IMAGE}/panels/text-panel.tsx`, "studio.library.panels.text", "Text panel: the text items of the same library"),
  ),
  add_shape: by(at(`${IMAGE}/panels/elements-panel.tsx`, "studio.library.panels.elements", "Elements panel: the Shapes category; pen and draw tools for custom paths")),
  add_image: by(at(`${IMAGE}/panels/uploads-panel.tsx`, "studio.image.panels.uploads.upload", "Uploads panel, or paste an image")),
  add_icon: by(at(`${IMAGE}/panels/elements-panel.tsx`, "studio.library.panels.elements", "Elements panel: the Icons category, or search by name")),
  update_layer: by(
    at(`${IMAGE}/inspector/transform-section.tsx`, "studio.image.inspector.transform.rotation", "Inspector: position, size, rotation and opacity"),
    at(`${IMAGE}/inspector/text-section.tsx`, "studio.image.inspector.text.font", "Inspector: text style, curve and highlight"),
    at(`${IMAGE}/inspector/shape-section.tsx`, "studio.image.inspector.shape.border", "Inspector: shape fill, border, radius, points and fill rule"),
    at(`${IMAGE}/inspector/effects.tsx`, "studio.vectors.stroke.pattern", "Inspector: dash pattern, ends, corners and miter limit"),
    at(`${IMAGE}/inspector/image-section.tsx`, "studio.image.inspector.image.frame", "Inspector: frame, flip, filters and crop"),
    at(`${IMAGE}/inspector/paint-lists.tsx`, "studio.image.paint.strokes.width", "Inspector: stacked fills and strokes, each with its own stroke style"),
    at(`${IMAGE}/inspector/effects-list.tsx`, "studio.image.paint.effects.spread", "Inspector: shadows and glows"),
    at(`${IMAGE}/inspector/pattern-fields.tsx`, "studio.image.paint.pattern.tile", "Inspector: pattern fills"),
    at("components/studio/color/gradient-map-section.tsx", "studio.image.paint.gradientMap.interpolation", "Inspector Cor tab: gradient map"),
    at(LAYERS, "studio.image.panels.layers.blendMode", "Layers panel bar: blend mode and opacity"),
    at(ACTIONS, "studio.image.panels.layers.clip", "Arrange section or layer menu: clipping mask"),
  ),
  delete_layers: by(at(ACTIONS, "studio.image.actions.delete", "Delete key, toolbar, menus or the layers footer")),
  duplicate_layers: by(at(ACTIONS, "studio.image.actions.duplicate", "Ctrl+D, toolbar, menus or the layers footer")),
  order_layers: by(at(`${IMAGE}/inspector/arrange-section.tsx`, "studio.image.inspector.arrange.order", "Arrange section, toolbar, layer menu and shortcuts, or drag rows in the layers panel")),
  align_layers: by(at(`${IMAGE}/editor-toolbar.tsx`, "studio.image.toolbar.align", "Toolbar position menu, layer menu or the arrange section")),
  distribute_layers: by(at(`${IMAGE}/editor-toolbar.tsx`, "studio.image.toolbar.distribute", "Toolbar position menu, layer menu or the arrange section")),
  group_layers: by(at(ACTIONS, "studio.image.actions.group", "Ctrl+G, toolbar, menus or the layers footer")),
  ungroup_layers: by(at(ACTIONS, "studio.image.actions.ungroup", "Ctrl+Shift+G or the menus")),
  scaffold_layers: by(at(ACTIONS, "studio.image.actions.scaffold", "Ctrl+Alt+G, the layer menu or the arrange section")),
  set_hidden: by(at(LAYERS, "studio.image.panels.layers.hide", "Eye on each row, Ctrl+Shift+H or the menus")),
  set_locked: by(at(LAYERS, "studio.image.panels.layers.lock", "Lock on each row, Ctrl+Shift+L or the menus")),
  replace_image: by(at(`${IMAGE}/inspector/image-section.tsx`, "studio.image.inspector.image.replace", "Inspector: replace image")),
  fill_frame: by(
    at(`${IMAGE}/panels/uploads-panel.tsx`, "studio.image.panels.uploads.fillHint", "Uploads panel: drag a photo onto a frame or grid cell on the canvas, or select the frame and click a photo; double click the photo to pan and zoom it inside the frame"),
    at(`${IMAGE}/panels/elements-panel.tsx`, "studio.library.panels.elements", "Elements panel: the Frames and Grids categories insert empty frames"),
  ),
  update_artboard: by(
    at(ARTBOARDS, "studio.image.inspector.canvas.background", "Canvas section (nothing selected): name, size, background and gradient"),
    at(ARTBOARDS, "studio.image.artboards.positionX", "Canvas section: X and Y place the artboard, or drag the artboard by its name on the canvas"),
  ),
  add_artboard: by(at(ARTBOARDS, "studio.image.artboards.addShort", "Canvas section, layers dock or the canvas menu")),
  duplicate_artboard: by(at(ARTBOARDS, "studio.image.artboards.duplicateShort", "Canvas section, Ctrl+D on the artboard or duplicate as a size preset")),
  delete_artboard: by(at(ACTIONS, "studio.image.artboards.delete", "Delete on the selected artboard or the artboard menu")),
  move_to_artboard: by(at(LAYERS, "studio.image.panels.layers.rowLabel", "Drag layers onto another artboard on the canvas or in the layers panel")),
  arrange_artboards: by(
    at(`${IMAGE}/inspector/artboard-arrange-section.tsx`, "studio.image.artboards.arrange.title", "Canvas section, Arrange artboards: row, column or grid, gap, order, alignment and group by size, for the selected artboards or all of them"),
    at(ACTIONS, "studio.image.artboards.arrange.tidy", "Canvas menu: Tidy up artboards keeps the rows and evens the gaps"),
  ),
  select: by(at(ACTIONS, "studio.image.actions.selectAll", "Click, Shift or Ctrl click, Ctrl+A or rows in the layers panel")),
  combine_shapes: by(at(`${IMAGE}/inspector/shape-section.tsx`, "studio.vectors.ops.title", "Shape operations in the toolbar, layer menu or inspector"), at(`${IMAGE}/inspector/path-ops-section.tsx`, "studio.pathOps.live.title", "Inspector with two or more shapes: live merge keeps the upper shapes as editable merge operators")),
  set_path_ops: by(at(PATH_OPS, "studio.pathOps.title", "Inspector path operators on a selected shape: presets, add, reorder, hide, remove and every number")),
  set_color: by(
    at(`${IMAGE}/inspector/color-grade-section.tsx`, "studio.grade.intensity", "Inspector Cor tab: sliders, look intensity, looks and reset"),
    at("components/studio/color/curve-editor.tsx", "studio.color.curves.graph", "Inspector Cor tab: curves per channel"),
    at("components/studio/color/color-sections.tsx", "studio.color.hsl.desaturate", "Inspector Cor tab: selective color, hue picker and sliders"),
    at("components/studio/color/color-sections.tsx", "studio.color.lut.import", "Inspector Cor tab: pick or import a LUT and its intensity"),
    at("components/studio/color/gradient-map-section.tsx", "studio.image.paint.gradientMap.interpolation", "Inspector Cor tab: gradient map"),
  ),
  set_chroma_key: { pending: "Chroma key on image layers: another agent is finishing it" },
  remove_chroma_key: { pending: "Chroma key on image layers: another agent is finishing it" },
  import_svg: by(at(`${IMAGE}/panels/elements-panel.tsx`, "studio.vectors.svg.import", "Elements panel: import an SVG file, or paste SVG text")),
  repeat_layers: by(at(REPEAT, "studio.image.repeat.create", "Inspector repeat: radial, grid or mirror")),
  set_repeat: by(at(REPEAT, "studio.image.repeat.columns", "Inspector repeat: every count, gap, angle and flip")),
  clear_repeat: by(at(REPEAT, "studio.image.repeat.remove", "Inspector repeat: remove")),
  expand_repeat: by(at(REPEAT, "studio.image.repeat.expand", "Inspector repeat: expand into real layers")),
  create_component: by(at(ACTIONS, "studio.image.components.create", "Ctrl+Alt+K or the layer menu: the selection becomes a component artboard and an instance takes its place")),
  add_instance: by(at(`${IMAGE}/panels/components-list.tsx`, "studio.image.components.insert", "Elements panel: the Components list inserts an instance into the active artboard")),
  set_overrides: by(at(INSTANCE, "studio.image.components.instance.text", "Inspector component section: text, color, outline, font, weight, italic, icon, image, crop and visibility per part")),
  reset_overrides: by(at(INSTANCE, "studio.image.components.instance.resetAll", "Inspector component section: reset all, or the reset button on each changed part")),
  detach_instance: by(at(INSTANCE, "studio.image.components.instance.detach", "Inspector component section, Ctrl+Alt+B or the layer menu")),
  swap_component: by(at(INSTANCE, "studio.image.components.instance.swap", "Inspector component section: pick another component")),
  create_style: by(at(STYLES, "studio.image.styles.create", "Inspector styles section: the plus beside fill, outline, text, shadow or the artboard background saves it as a style")),
  update_style: by(at(STYLES, "studio.image.styles.edit", "Canvas inspector styles list (nothing selected): open a style to edit its name, role, color, gradient, text fields or shadow")),
  apply_style: by(at(STYLES, "studio.image.styles.none", "Inspector styles section: pick a style for fill, outline, text or shadow, or for the artboard background")),
  detach_style: by(at(STYLES, "studio.image.styles.detach", "Inspector styles section: unlink, or pick no style")),
  delete_style: by(at(STYLES, "studio.image.styles.delete", "Canvas inspector styles list: delete; linked layers keep their values")),
  set_layout: by(at(LAYOUT, "studio.image.layout.add", "Shift+A, the layer menu or the inspector auto layout section: direction, gap or spread, padding, alignment and sizing")),
  remove_layout: by(at(LAYOUT, "studio.image.layout.remove", "Inspector auto layout section: remove; the layers stay where they are")),
  set_layout_item: by(at(LAYOUT, "studio.image.layout.item.absolute", "Inspector layout item section: width and height fixed, fill or hug, or ignore the layout; dragging a child reorders it")),
  add_paint_layer: by(at(PIXELS, "studio.image.pixels.tools.brush", "Toolbar brush (B): the first stroke creates a paint layer above the selected layer")),
  paint_area: by(at(PIXELS, "studio.image.pixels.options.fill", "Selection tools (M, Shift+M, L), then Fill, Erase inside, Hide inside or Show inside in the pixel options bar")),
  crop_to_area: by(at(PIXELS, "studio.image.pixels.options.crop", "Selection tools, then Crop in the pixel options bar")),
  copy_area_to_layer: by(at(PIXELS, "studio.image.pixels.options.copy", "Selection tools, then Copy to layer (Ctrl+J) in the pixel options bar")),
  add_vfx: by(at(STILL_VFX, "studio.image.vfx.add", "Inspector effects of a photo, or of the artboard with nothing selected: the before and after preview tiles add an effect")),
  update_vfx: by(at(VFX_STACK, "studio.video.vfx.shuffle", "Inspector effects: pick an effect in the list, then its sliders, colors, hide and shuffle the seed")),
  move_vfx: by(at(VFX_STACK, "studio.video.vfx.moveUp", "Inspector effects: move up or down")),
  remove_vfx: by(at(VFX_STACK, "studio.video.vfx.remove", "Inspector effects: remove")),
  add_chart: by(at(`${IMAGE}/panels/elements-panel.tsx`, "studio.library.panels.elements", "Elements panel, Charts category: click inserts a chart on the active artboard and opens the data grid")),
  update_chart_data: by(at(CHART_FIELDS, "studio.chart.editData", "Inspector Chart section: type, data grid (type, paste spreadsheet cells, import CSV), legend, axes, gridlines, labels, font, colors and number format"), at(CHART_GRID, "studio.chart.data.importCsv", "Data grid: paste cells from a spreadsheet or import a CSV file")),
  add_table: by(at(`${IMAGE}/panels/elements-panel.tsx`, "studio.library.panels.elements", "Elements panel, Tables category: click inserts a table on the active artboard and opens the cell grid")),
  add_qr_code: by(at(`${IMAGE}/panels/elements-panel.tsx`, "studio.library.panels.elements", "Elements panel, QR Code category: click inserts a code on the active artboard and opens the content form on a platform short link")),
  update_table: by(at(TABLE_FIELDS, "studio.tables.editCells", "Inspector Table section: header row, column widths and alignment, borders, banding, colors, font and padding"), at(TABLE_CELLS, "studio.tables.data.title", "Edit cells dialog: type, paste spreadsheet cells, import CSV, add and remove rows and columns"), at(TABLE_CELL_TEXT, "studio.tables.cell.row", "Inspector Table section, Text of one cell: pick the row and column and type the text")),
  update_qr_code: by(at(QR_FIELDS, "studio.qr.mode", "Inspector QR Code section: content (platform short link, WhatsApp, direct link or text), colors with the contrast check, error correction, margin and center logo"), at(QR_SHORT_LINK, "studio.qr.shortLink.create", "Platform short link: type the destination and create the link, or pick an existing one")),
  expand_chart: by(at(CHART_FIELDS, "studio.chart.expand", "Inspector Chart section: Ungroup into shapes turns the chart into plain shapes and text in a group")),
} as const satisfies Partial<Record<ImageOpName, ManualEntry>>;

export const STUDIO_TOOL_PATHS: Readonly<Record<string, StudioToolEntry>> = {
  studio_edit_video: { perception: "Carries the video operations above; each one has its own manual path" },
  studio_edit_image: { perception: "Carries the image operations above; each one has its own manual path" },
  studio_animation_presets: by(at(PRESETS, "studio.video.presets.gallery", "Animation tab, Presets: the gallery of built-in and saved presets with live previews")),
  studio_save_animation_preset: by(at(PRESETS, "studio.video.presets.save", "Animation tab, Presets: name the selected clip's animation and save it for the workspace")),
  studio_export: by(
    at(`${IMAGE}/export-menu.tsx`, "studio.image.export.scope", "Image export menu: format, scale, quality, transparency, PDF preset and artboards"),
    at(`${VIDEO}/export/export-settings.tsx`, "studio.video.export.widthExact", "Video export: format, any width and frame rate, loop, colors, dither and quality"),
    at(`${VIDEO}/export/export-settings.tsx`, "studio.video.export.range", "Video export: the whole video or only the marked work area (mark in I and out O, or the timeline bar buttons)"),
    at(`${VIDEO}/export/export-settings.tsx`, "studio.video.export.frameAt", "Video export: PNG or JPEG saves the frame at the playhead to the library"),
  ),
  studio_generate_music: by(at(`${VIDEO}/panels/ai-panel.tsx`, "studio.video.ai.duration", "AI panel music tab: prompt, model, track and duration")),
  studio_generate_sfx: by(at(`${VIDEO}/panels/ai-panel.tsx`, "studio.video.ai.sfx.length", "AI panel sound effects tab")),
  studio_start_job: by(
    at(`${VIDEO}/panels/captions-panel.tsx`, "studio.video.captions.generate", "Captions panel: generate captions"),
    at(`${IMAGE}/remove-background.tsx`, "studio.image.removeBackground.run", "Image: remove the background"),
  ),
  studio_jobs: by(at(`${VIDEO}/panels/job-status.tsx`, "studio.video.jobs.list", "Job status lists in each panel, the jobs Elo started included")),
  studio_listen: { pending: "Phase 29 (audio management): live meters and loudness readouts for people are being built; until then a person listens" },
  studio_read: { perception: "How Elo reads the project; a person sees it in the layers panel, timeline and inspector" },
  studio_library_search: by(at("components/studio/library/library-panel.tsx", "studio.library.searchLabel", "Text and Elements panels: one search across every library category, in the person's language or in English")),
  studio_look: by(
    at(`${IMAGE}/editor-toolbar.tsx`, "studio.image.toolbar.depthOverlay", "View menu: Shadows and covered layers draws the direction of every shadow (red when it falls against the others), edges that cut a shadow and layers hidden under others, the same marks Elo's depth view draws"),
    at(`${IMAGE}/editor-toolbar.tsx`, "studio.image.toolbar.layoutOverlay", "View menu: Layout problems draws near misses, tight margins, almost touching edges and overlaps, the same marks Elo's guides view draws; the plain render is the screen itself"),
    at(`${VIDEO}/editor-toolbar.tsx`, "studio.video.toolbar.depthOverlay", "Video toolbar: the shadows button draws the same depth marks on the preview at the playhead"),
    at(`${VIDEO}/editor-toolbar.tsx`, "studio.video.toolbar.layoutOverlay", "Video toolbar: the layout button draws the same layout marks on the preview at the playhead"),
  ),
  studio_op_guide: { perception: "How Elo reads what each operation takes; a person reads the inspector labels and controls" },
  studio_ask: { perception: "Elo asking the person a question" },
};

export const ELO_TOOL_PATHS: Readonly<Record<string, StudioToolEntry>> = {
  ad_placement_look: by(at("components/advertising/placement-check.tsx", "adsEditor.placementCheck.hint", "Ad editor preview, Crop tab: one preview per placement with Meta's crop, the interface bands, the safe area, the resolution and the legible text size")),
  new_studio_project: by(
    at("components/studio/projects/create-project-dialog.tsx", "studio.create.title", "Studio projects page: New project, an empty image or video with its size, format and name"),
    at("components/ai-chat/chat-media.tsx", "studio.openFromMedia.action", "Any generated or sent media in the chat: Open in Studio"),
    at("components/advertising/placement-check.tsx", "adsEditor.placementCheck.openInStudio", "Ad editor, Crop tab: Edit in Studio makes one artboard per placement size with the ad image"),
  ),
  ask_user: { perception: "Elo asking the person a question; the person taps an option or writes the answer" },
};
