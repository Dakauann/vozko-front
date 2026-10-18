import type { Alignment, DistributeAxis } from "./arrange";
import type { EaseSides } from "./keyframe-ease";
import type { Easing } from "./keyframes";
import { activatesOnEnter, imageZoomActionFor, isEditableTarget, type ImageZoomAction, type KeyStroke } from "./keymap";

export type VideoExtraAction =
  | { type: "addMarker" }
  | { type: "addClipMarker" }
  | { type: "nudgeKeysOrJumpMarker"; direction: 1 | -1; frames: 1 | 10 }
  | { type: "jumpKey"; direction: 1 | -1 }
  | { type: "toggleKey" }
  | { type: "easeKeys"; easing: Easing }
  | { type: "easeSides"; sides: EaseSides }
  | { type: "keyVelocity" }
  | { type: "tool"; tool: "select" | "blade" | "slip" | "slide" }
  | { type: "cycleTrim" }
  | { type: "rollToPlayhead"; edge: "start" | "end" }
  | { type: "selectForward"; allTracks: boolean }
  | { type: "selectFromPlayhead"; direction: "after" | "before" }
  | { type: "markIn" }
  | { type: "markOut" }
  | { type: "clearRange" }
  | { type: "playRange" }
  | { type: "toggleLoop" }
  | { type: "lift" }
  | { type: "extract" }
  | { type: "copy" }
  | { type: "cut" }
  | { type: "nudge"; frames: number }
  | { type: "toggleDisabled" }
  | { type: "cutAll" }
  | { type: "zoomToFit" }
  | { type: "focus" }
  | { type: "toggleGraph" }
  | { type: "fitGraph"; selection: boolean }
  | { type: "trimToPlayhead"; edge: "start" | "end"; ripple: boolean }
  | { type: "moveToPlayhead"; edge: "start" | "end" }
  | { type: "align"; alignment: Alignment }
  | { type: "distribute"; axis: DistributeAxis }
  | { type: "group" }
  | { type: "ungroup" }
  | { type: "openGroup" }
  | { type: "closeGroup" }
  | { type: "escape" };

interface ShortcutRow {
  id: string;
  keys: string;
}

export const SHORTCUT_ROWS: readonly ShortcutRow[] = [
  { id: "playPause", keys: "Space" },
  { id: "shuttle", keys: "J K L" },
  { id: "frame", keys: "← →" },
  { id: "second", keys: "Shift + ← →" },
  { id: "startEnd", keys: "Home End" },
  { id: "select", keys: "A" },
  { id: "blade", keys: "B" },
  { id: "trim", keys: "T" },
  { id: "slip", keys: "Y" },
  { id: "slide", keys: "U" },
  { id: "rollStart", keys: "Shift + Q" },
  { id: "rollEnd", keys: "Shift + W" },
  { id: "trimStartToPlayhead", keys: "Q" },
  { id: "trimEndToPlayhead", keys: "W" },
  { id: "trimToPlayheadKeep", keys: "Ctrl + Alt + Q / W" },
  { id: "moveToPlayhead", keys: "[ ]" },
  { id: "split", keys: "S" },
  { id: "cutAll", keys: "Ctrl + B / Ctrl + K" },
  { id: "delete", keys: "Delete" },
  { id: "rippleDelete", keys: "Shift + Delete" },
  { id: "duplicate", keys: "Ctrl + D" },
  { id: "copyPaste", keys: "Ctrl + C / X / V" },
  { id: "pasteInsert", keys: "Ctrl + Shift + V" },
  { id: "nudge", keys: ", ." },
  { id: "nudgeTen", keys: "Shift + , ." },
  { id: "trimNudge", keys: ", ." },
  { id: "selectForward", keys: "Shift + A" },
  { id: "selectForwardAll", keys: "Ctrl + Shift + A" },
  { id: "selectAfter", keys: "Alt + Y" },
  { id: "selectBefore", keys: "Ctrl + Alt + Y" },
  { id: "markInOut", keys: "I O" },
  { id: "clearRange", keys: "Ctrl + Shift + X" },
  { id: "workArea", keys: "Alt + B / Alt + N" },
  { id: "playRange", keys: "Ctrl + Shift + Space" },
  { id: "loop", keys: "Shift + L" },
  { id: "previewZoom", keys: "Ctrl + = / Ctrl + -" },
  { id: "previewFit", keys: "Ctrl + 0 / Shift + 1" },
  { id: "previewActual", keys: "Shift + 0" },
  { id: "previewPan", keys: "Space + drag / middle drag" },
  { id: "lift", keys: ";" },
  { id: "extract", keys: "'" },
  { id: "disable", keys: "D" },
  { id: "marker", keys: "M" },
  { id: "clipMarker", keys: "Shift + M" },
  { id: "markerJump", keys: "Alt + ← →" },
  { id: "keyJump", keys: "Alt + [ ]" },
  { id: "keyToggle", keys: "Shift + K" },
  { id: "keyEase", keys: "F9" },
  { id: "keyEaseIn", keys: "Shift + F9" },
  { id: "keyEaseOut", keys: "Ctrl + Shift + F9" },
  { id: "keyHold", keys: "Ctrl + Alt + H" },
  { id: "keyVelocity", keys: "Ctrl + Shift + K" },
  { id: "keyNudge", keys: "Alt + ← →" },
  { id: "keyNudgeTen", keys: "Alt + Shift + ← →" },
  { id: "keyReversePaste", keys: "Ctrl + Alt + Shift + V" },
  { id: "snapping", keys: "N" },
  { id: "zoom", keys: "+ -" },
  { id: "zoomFit", keys: "Shift + Z" },
  { id: "focus", keys: "F" },
  { id: "leaveFocus", keys: "Esc" },
  { id: "graphEditor", keys: "Shift + F3" },
  { id: "graphFit", keys: "Shift + F" },
  { id: "graphFitSelection", keys: "Ctrl + Shift + F" },
  { id: "graphNudge", keys: "← → ↑ ↓" },
  { id: "graphSplit", keys: "Alt + drag" },
  { id: "graphAxis", keys: "Shift + drag" },
  { id: "undo", keys: "Ctrl + Z / Ctrl + Shift + Z" },
  { id: "insertDrag", keys: "Ctrl + drag" },
  { id: "overwriteDrag", keys: "Shift + drag" },
  { id: "rippleTrimDrag", keys: "Ctrl + drag edge" },
  { id: "unlinkedTrimDrag", keys: "Shift + drag" },
  { id: "forwardClick", keys: "Alt + click" },
  { id: "alignFrame", keys: "Alt + A D W S H V" },
  { id: "distributeFrame", keys: "Alt + Shift + H V" },
  { id: "frameSnapOff", keys: "Alt + drag" },
  { id: "frameAddSelect", keys: "Shift + click" },
  { id: "group", keys: "Ctrl + G" },
  { id: "ungroup", keys: "Ctrl + Shift + G" },
  { id: "openGroup", keys: "Enter" },
  { id: "closeGroup", keys: "Shift + Enter" },
];

function bracket(stroke: KeyStroke): 1 | -1 | null {
  if (stroke.code === "BracketRight" || stroke.key === "]") return 1;
  if (stroke.code === "BracketLeft" || stroke.key === "[") return -1;
  return null;
}

function nudgeDirection(stroke: KeyStroke): 1 | -1 | null {
  if (stroke.code === "Period" || stroke.key === "." || stroke.key === ">") return 1;
  if (stroke.code === "Comma" || stroke.key === "," || stroke.key === "<") return -1;
  return null;
}

function letter(stroke: KeyStroke): string {
  return stroke.key.length === 1 ? stroke.key.toLowerCase() : stroke.key;
}

function withModifier(stroke: KeyStroke): VideoExtraAction | null {
  const key = letter(stroke);
  if (stroke.altKey) return key === "y" && !stroke.shiftKey ? { type: "selectFromPlayhead", direction: "before" } : null;
  if (stroke.shiftKey) {
    if (key === "a") return { type: "selectForward", allTracks: true };
    if (key === "k") return { type: "keyVelocity" };
    if (key === "x") return { type: "clearRange" };
    if (key === "g") return { type: "ungroup" };
    if (stroke.key === " ") return { type: "playRange" };
    return null;
  }
  if (key === "g") return { type: "group" };
  if (key === "c") return { type: "copy" };
  if (key === "x") return { type: "cut" };
  if (key === "b" || key === "k") return { type: "cutAll" };
  return null;
}

function easeShortcut(stroke: KeyStroke): VideoExtraAction | null {
  const ctrl = stroke.ctrlKey || stroke.metaKey;
  if (stroke.key === "F9" && !stroke.altKey) {
    if (ctrl) return stroke.shiftKey ? { type: "easeSides", sides: "out" } : null;
    return { type: "easeSides", sides: stroke.shiftKey ? "in" : "both" };
  }
  return ctrl && stroke.altKey && !stroke.shiftKey && letter(stroke) === "h" ? { type: "easeKeys", easing: "hold" } : null;
}

function graphShortcut(stroke: KeyStroke): VideoExtraAction | null {
  if (!stroke.shiftKey || stroke.altKey) return null;
  const ctrl = stroke.ctrlKey || stroke.metaKey;
  if (stroke.key === "F3") return ctrl ? null : { type: "toggleGraph" };
  return letter(stroke) === "f" ? { type: "fitGraph", selection: ctrl } : null;
}

const ALIGN_KEYS: Readonly<Record<string, Alignment>> ={ a: "left", d: "right", h: "center", w: "top", s: "bottom", v: "middle" };

const DISTRIBUTE_KEYS: Readonly<Record<string, DistributeAxis>> = { h: "horizontal", v: "vertical" };

export const ALIGN_SHORTCUTS = Object.fromEntries(Object.entries(ALIGN_KEYS).map(([key, alignment]) => [alignment, `Alt+${key.toUpperCase()}`])) as Record<Alignment, string>;

export const DISTRIBUTE_SHORTCUTS = Object.fromEntries(Object.entries(DISTRIBUTE_KEYS).map(([key, axis]) => [axis, `Alt+Shift+${key.toUpperCase()}`])) as Record<DistributeAxis, string>;

function keyLetter(stroke: KeyStroke): string {
  const match = /^Key([A-Z])$/.exec(stroke.code ?? "");
  return match ? match[1].toLowerCase() : letter(stroke);
}

function layoutShortcut(stroke: KeyStroke): VideoExtraAction | null {
  const ctrl = stroke.ctrlKey || stroke.metaKey;
  const key = keyLetter(stroke);
  if (ctrl && stroke.altKey && !stroke.shiftKey && (key === "q" || key === "w")) return { type: "trimToPlayhead", edge: key === "q" ? "start" : "end", ripple: false };
  if (ctrl || !stroke.altKey) return null;
  if (stroke.shiftKey) return DISTRIBUTE_KEYS[key] ? { type: "distribute", axis: DISTRIBUTE_KEYS[key] } : null;
  const alignment = ALIGN_KEYS[key];
  return alignment ? { type: "align", alignment } : null;
}

function arrowDirection(stroke: KeyStroke): 1 | -1 | null {
  if (stroke.key === "ArrowLeft") return -1;
  return stroke.key === "ArrowRight" ? 1 : null;
}

export function videoExtraActionFor(stroke: KeyStroke): VideoExtraAction | null {
  if (isEditableTarget(stroke.target)) return null;
  const eased = easeShortcut(stroke) ?? graphShortcut(stroke);
  if (eased) return eased;
  const placed = layoutShortcut(stroke);
  if (placed) return placed;
  if (stroke.ctrlKey || stroke.metaKey) return withModifier(stroke);
  const key = letter(stroke);
  const arrow = stroke.altKey ? arrowDirection(stroke) : null;
  if (arrow !== null) return { type: "nudgeKeysOrJumpMarker", direction: arrow, frames: stroke.shiftKey ? 10 : 1 };
  if (stroke.altKey && !stroke.shiftKey) {
    if (key === "y") return { type: "selectFromPlayhead", direction: "after" };
    if (stroke.code === "KeyB") return { type: "markIn" };
    if (stroke.code === "KeyN") return { type: "markOut" };
    const side = bracket(stroke);
    return side === null ? null : { type: "jumpKey", direction: side };
  }
  if (stroke.altKey) return null;
  if (stroke.key === "Enter") return activatesOnEnter(stroke.target) ? null : { type: stroke.shiftKey ? "closeGroup" : "openGroup" };
  const nudge = nudgeDirection(stroke);
  if (nudge !== null) return { type: "nudge", frames: nudge * (stroke.shiftKey ? 10 : 1) };
  if (stroke.shiftKey) {
    if (key === "k") return { type: "toggleKey" };
    if (key === "a") return { type: "selectForward", allTracks: false };
    if (key === "z") return { type: "zoomToFit" };
    if (key === "q") return { type: "rollToPlayhead", edge: "start" };
    if (key === "w") return { type: "rollToPlayhead", edge: "end" };
    if (key === "l") return { type: "toggleLoop" };
    if (key === "m") return { type: "addClipMarker" };
    return null;
  }
  const edge = bracket(stroke);
  if (edge !== null) return { type: "moveToPlayhead", edge: edge === -1 ? "start" : "end" };
  switch (key) {
    case "m":
      return { type: "addMarker" };
    case "a":
      return { type: "tool", tool: "select" };
    case "b":
      return { type: "tool", tool: "blade" };
    case "t":
      return { type: "cycleTrim" };
    case "y":
      return { type: "tool", tool: "slip" };
    case "u":
      return { type: "tool", tool: "slide" };
    case "i":
      return { type: "markIn" };
    case "o":
      return { type: "markOut" };
    case ";":
      return { type: "lift" };
    case "'":
      return { type: "extract" };
    case "d":
      return { type: "toggleDisabled" };
    case "f":
      return { type: "focus" };
    case "q":
      return { type: "trimToPlayhead", edge: "start", ripple: true };
    case "w":
      return { type: "trimToPlayhead", edge: "end", ripple: true };
    case "Escape":
      return { type: "escape" };
  }
  return null;
}

export type PreviewZoomAction = Exclude<ImageZoomAction, { type: "fitSelection" }>;

export function previewZoomActionFor(stroke: KeyStroke): PreviewZoomAction | null {
  const action = imageZoomActionFor(stroke);
  return action && action.type !== "fitSelection" ? action : null;
}
