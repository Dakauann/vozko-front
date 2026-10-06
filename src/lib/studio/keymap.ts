import type { OrderDirection } from "./layers";

export interface KeyStroke {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  target?: EventTarget | null;
}

export type HistoryAction = { type: "undo" } | { type: "redo" };

export type ImageAction =
  | HistoryAction
  | { type: "group" }
  | { type: "ungroup" }
  | { type: "duplicate" }
  | { type: "order"; direction: OrderDirection }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "delete" }
  | { type: "selectAll" }
  | { type: "deselect" };

export type VideoAction =
  | HistoryAction
  | { type: "togglePlay" }
  | { type: "shuttle"; direction: -1 | 0 | 1 }
  | { type: "stepFrames"; frames: number }
  | { type: "stepMs"; ms: number }
  | { type: "seekStart" }
  | { type: "seekEnd" }
  | { type: "split" }
  | { type: "delete" }
  | { type: "rippleDelete" }
  | { type: "duplicate" }
  | { type: "zoom"; direction: 1 | -1 }
  | { type: "toggleSnapping" };

export const NUDGE_PX = 1;
export const NUDGE_SHIFT_PX = 10;
export const STEP_SHIFT_MS = 1000;

const EDITABLE_INPUTS = new Set(["text", "search", "email", "number", "password", "tel", "url", "date", "time", "datetime-local", "month", "week", ""]);

export function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string") return false;
  const element = target as HTMLElement;
  if (element.isContentEditable) return true;
  const tag = element.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") return EDITABLE_INPUTS.has(((element as HTMLInputElement).type ?? "").toLowerCase());
  return element.closest?.("[contenteditable=''],[contenteditable='true']") != null;
}

function mod(stroke: KeyStroke): boolean {
  return stroke.ctrlKey || stroke.metaKey;
}

function lower(stroke: KeyStroke): string {
  return stroke.key.length === 1 ? stroke.key.toLowerCase() : stroke.key;
}

function historyAction(stroke: KeyStroke): HistoryAction | null {
  if (!mod(stroke) || stroke.altKey) return null;
  const key = lower(stroke);
  if (key === "z") return stroke.shiftKey ? { type: "redo" } : { type: "undo" };
  if (key === "y" && !stroke.shiftKey) return { type: "redo" };
  return null;
}

function isDelete(stroke: KeyStroke): boolean {
  return stroke.key === "Delete" || stroke.key === "Backspace";
}

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

function bracket(stroke: KeyStroke): "]" | "[" | null {
  if (stroke.code === "BracketRight" || stroke.key === "]" || stroke.key === "}") return "]";
  if (stroke.code === "BracketLeft" || stroke.key === "[" || stroke.key === "{") return "[";
  return null;
}

export function imageActionFor(stroke: KeyStroke): ImageAction | null {
  if (isEditableTarget(stroke.target)) return null;
  const history = historyAction(stroke);
  if (history) return history;
  const key = lower(stroke);
  if (mod(stroke)) {
    const side = bracket(stroke);
    if (side) {
      const direction: OrderDirection = side === "]" ? (stroke.altKey ? "front" : "forward") : stroke.altKey ? "back" : "backward";
      return { type: "order", direction };
    }
    if (stroke.altKey) return null;
    if (key === "g") return stroke.shiftKey ? { type: "ungroup" } : { type: "group" };
    if (key === "d" && !stroke.shiftKey) return { type: "duplicate" };
    if (key === "a" && !stroke.shiftKey) return { type: "selectAll" };
    return null;
  }
  if (stroke.altKey) return null;
  if (key in ARROWS) {
    const [x, y] = ARROWS[key];
    const step = stroke.shiftKey ? NUDGE_SHIFT_PX : NUDGE_PX;
    return { type: "nudge", dx: x * step, dy: y * step };
  }
  if (isDelete(stroke) && !stroke.shiftKey) return { type: "delete" };
  if (key === "Escape") return { type: "deselect" };
  return null;
}

export function videoActionFor(stroke: KeyStroke): VideoAction | null {
  if (isEditableTarget(stroke.target)) return null;
  const history = historyAction(stroke);
  if (history) return history;
  const key = lower(stroke);
  if (mod(stroke)) return key === "d" && !stroke.shiftKey && !stroke.altKey ? { type: "duplicate" } : null;
  if (stroke.altKey) return null;
  if (isDelete(stroke)) return stroke.shiftKey ? { type: "rippleDelete" } : { type: "delete" };
  if (key === "ArrowLeft" || key === "ArrowRight") {
    if (capturesArrowKeys(stroke.target)) return null;
    const sign = key === "ArrowLeft" ? -1 : 1;
    return stroke.shiftKey ? { type: "stepMs", ms: sign * STEP_SHIFT_MS } : { type: "stepFrames", frames: sign };
  }
  if (stroke.key === "+" || stroke.key === "=" || stroke.code === "NumpadAdd") return { type: "zoom", direction: 1 };
  if (stroke.key === "-" || stroke.key === "_" || stroke.code === "NumpadSubtract") return { type: "zoom", direction: -1 };
  if (stroke.shiftKey) return null;
  switch (key) {
    case " ":
      return { type: "togglePlay" };
    case "j":
      return { type: "shuttle", direction: -1 };
    case "k":
      return { type: "shuttle", direction: 0 };
    case "l":
      return { type: "shuttle", direction: 1 };
    case "Home":
      return { type: "seekStart" };
    case "End":
      return { type: "seekEnd" };
    case "s":
      return { type: "split" };
    case "n":
      return { type: "toggleSnapping" };
  }
  return null;
}

export function bindKeymap<A>(target: Pick<Window, "addEventListener" | "removeEventListener">, resolve: (stroke: KeyStroke) => A | null, handle: (action: A) => void): () => void {
  const listener = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    const action = resolve(event);
    if (action === null) return;
    event.preventDefault();
    handle(action);
  };
  target.addEventListener("keydown", listener as EventListener);
  return () => target.removeEventListener("keydown", listener as EventListener);
}

export type ImageZoomAction = { type: "zoom"; direction: 1 | -1 } | { type: "fit" };

export function imageZoomActionFor(stroke: KeyStroke): ImageZoomAction | null {
  if (!mod(stroke) || stroke.altKey || isEditableTarget(stroke.target)) return null;
  if (stroke.key === "+" || stroke.key === "=" || stroke.code === "NumpadAdd") return { type: "zoom", direction: 1 };
  if (stroke.key === "-" || stroke.key === "_" || stroke.code === "NumpadSubtract") return { type: "zoom", direction: -1 };
  if (stroke.key === "0" || stroke.code === "Numpad0") return { type: "fit" };
  return null;
}

const ARROW_OWNER_ROLES = new Set(["slider", "spinbutton", "menu", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "listbox", "radio", "radiogroup", "tab", "tablist", "combobox"]);

export function capturesArrowKeys(target: EventTarget | null | undefined): boolean {
  if (!target || typeof (target as HTMLElement).getAttribute !== "function") return false;
  if ((target as HTMLElement).tagName === "INPUT" && (target as HTMLInputElement).type === "range") return true;
  const owner = (target as HTMLElement).closest?.("[role]");
  return owner != null && ARROW_OWNER_ROLES.has(owner.getAttribute("role") ?? "");
}

function insideOverlay(target: EventTarget | null | undefined): boolean {
  return typeof (target as HTMLElement | null)?.closest === "function" && (target as HTMLElement).closest("[role=dialog],[role=menu],[role=alertdialog]") != null;
}

export function canvasActionFor(stroke: KeyStroke): ImageAction | null {
  const action = imageActionFor(stroke);
  if (action?.type === "nudge" && capturesArrowKeys(stroke.target)) return null;
  if (action?.type === "deselect" && insideOverlay(stroke.target)) return null;
  return action;
}
