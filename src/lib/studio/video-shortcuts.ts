import { isEditableTarget, type KeyStroke } from "./keymap";

export type VideoExtraAction =
  | { type: "addMarker" }
  | { type: "jumpMarker"; direction: 1 | -1 }
  | { type: "jumpKey"; direction: 1 | -1 }
  | { type: "toggleKey" }
  | { type: "tool"; tool: "select" | "blade" | "slip" | "slide" }
  | { type: "cycleTrim" }
  | { type: "selectForward"; allTracks: boolean }
  | { type: "selectFromPlayhead"; direction: "after" | "before" }
  | { type: "markIn" }
  | { type: "markOut" }
  | { type: "clearRange" }
  | { type: "lift" }
  | { type: "extract" }
  | { type: "copy" }
  | { type: "cut" }
  | { type: "nudge"; frames: number }
  | { type: "toggleDisabled" }
  | { type: "cutAll" }
  | { type: "zoomToFit" }
  | { type: "focus" }
  | { type: "escape" };

export interface ShortcutRow {
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
  { id: "split", keys: "S" },
  { id: "cutAll", keys: "Ctrl + B / Ctrl + K" },
  { id: "delete", keys: "Delete" },
  { id: "rippleDelete", keys: "Shift + Delete" },
  { id: "duplicate", keys: "Ctrl + D" },
  { id: "copyPaste", keys: "Ctrl + C / X / V" },
  { id: "pasteInsert", keys: "Ctrl + Shift + V" },
  { id: "nudge", keys: ", ." },
  { id: "nudgeTen", keys: "Shift + , ." },
  { id: "selectForward", keys: "Shift + A" },
  { id: "selectForwardAll", keys: "Ctrl + Shift + A" },
  { id: "selectAfter", keys: "Alt + Y" },
  { id: "selectBefore", keys: "Ctrl + Alt + Y" },
  { id: "markInOut", keys: "I O" },
  { id: "clearRange", keys: "Ctrl + Shift + X" },
  { id: "lift", keys: ";" },
  { id: "extract", keys: "'" },
  { id: "disable", keys: "D" },
  { id: "marker", keys: "M" },
  { id: "markerJump", keys: "Alt + ← →" },
  { id: "keyJump", keys: "Alt + [ ]" },
  { id: "keyToggle", keys: "Shift + K" },
  { id: "snapping", keys: "N" },
  { id: "zoom", keys: "+ -" },
  { id: "zoomFit", keys: "Shift + Z" },
  { id: "focus", keys: "F" },
  { id: "leaveFocus", keys: "Esc" },
  { id: "undo", keys: "Ctrl + Z / Ctrl + Shift + Z" },
  { id: "insertDrag", keys: "Ctrl + drag" },
  { id: "overwriteDrag", keys: "Shift + drag" },
  { id: "rippleTrimDrag", keys: "Ctrl + drag edge" },
  { id: "forwardClick", keys: "Alt + click" },
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
    if (key === "x") return { type: "clearRange" };
    return null;
  }
  if (key === "c") return { type: "copy" };
  if (key === "x") return { type: "cut" };
  if (key === "b" || key === "k") return { type: "cutAll" };
  return null;
}

export function videoExtraActionFor(stroke: KeyStroke): VideoExtraAction | null {
  if (isEditableTarget(stroke.target)) return null;
  if (stroke.ctrlKey || stroke.metaKey) return withModifier(stroke);
  const key = letter(stroke);
  if (stroke.altKey && !stroke.shiftKey) {
    if (stroke.key === "ArrowLeft" || stroke.key === "ArrowRight") return { type: "jumpMarker", direction: stroke.key === "ArrowLeft" ? -1 : 1 };
    if (key === "y") return { type: "selectFromPlayhead", direction: "after" };
    const side = bracket(stroke);
    return side === null ? null : { type: "jumpKey", direction: side };
  }
  if (stroke.altKey) return null;
  const nudge = nudgeDirection(stroke);
  if (nudge !== null) return { type: "nudge", frames: nudge * (stroke.shiftKey ? 10 : 1) };
  if (stroke.shiftKey) {
    if (key === "k") return { type: "toggleKey" };
    if (key === "a") return { type: "selectForward", allTracks: false };
    if (key === "z") return { type: "zoomToFit" };
    return null;
  }
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
    case "Escape":
      return { type: "escape" };
  }
  return null;
}
