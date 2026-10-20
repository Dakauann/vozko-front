import type { KeyStroke } from "./stroke";

export type Platform = "mac" | "other";

interface Chord {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

interface NavigatorLike {
  platform?: string;
  userAgentData?: { platform?: string };
}

const MODIFIERS = new Set(["Mod", "Shift", "Alt"]);
const MAC_PLATFORM = /mac|iphone|ipad|ipod/i;
const LATIN_LETTER = /^[a-z]$/;
const ASCII = /^[\x20-\x7e]$/;

const MODIFIER_LABELS: Record<Platform, Record<string, string>> = {
  mac: { Mod: "⌘", Shift: "⇧", Alt: "⌥" },
  other: { Mod: "Ctrl", Shift: "Shift", Alt: "Alt" },
};

const KEY_LABELS: Record<string, string> = {
  ArrowDown: "↓",
  ArrowUp: "↑",
  ArrowLeft: "←",
  ArrowRight: "→",
  Escape: "Esc",
};

export function platformOf(navigatorLike: NavigatorLike | undefined): Platform {
  const name = navigatorLike?.userAgentData?.platform || navigatorLike?.platform || "";
  return MAC_PLATFORM.test(name) ? "mac" : "other";
}

function splitChord(chord: string): string[] {
  return chord === "+" ? ["+"] : chord.split("+");
}

export function isValidChord(chord: string): boolean {
  const parts = splitChord(chord);
  const key = parts.at(-1) ?? "";
  if (key === "" || MODIFIERS.has(key)) return false;
  return parts.slice(0, -1).every((part) => MODIFIERS.has(part));
}

function parseChord(chord: string): Chord {
  const parts = splitChord(chord);
  const modifiers = new Set(parts.slice(0, -1));
  const key = parts.at(-1) ?? "";
  return {
    key: key.length === 1 ? key.toLowerCase() : key,
    mod: modifiers.has("Mod"),
    shift: modifiers.has("Shift"),
    alt: modifiers.has("Alt"),
  };
}

function isSymbol(key: string): boolean {
  return key.length === 1 && !LATIN_LETTER.test(key);
}

function commandModifierMatches(stroke: KeyStroke, wanted: boolean, platform: Platform): boolean {
  const primary = platform === "mac" ? stroke.metaKey : stroke.ctrlKey;
  const other = platform === "mac" ? stroke.ctrlKey : stroke.metaKey;
  return primary === wanted && !other;
}

function keyMatches(stroke: KeyStroke, key: string): boolean {
  if (key.length > 1) return stroke.key === key;
  if (isSymbol(key)) return stroke.key === key;
  if (stroke.key.toLowerCase() === key) return true;
  return !ASCII.test(stroke.key) && stroke.code === `Key${key.toUpperCase()}`;
}

export function matchesChord(stroke: KeyStroke, chord: string, platform: Platform): boolean {
  const wanted = parseChord(chord);
  if (!commandModifierMatches(stroke, wanted.mod, platform)) return false;
  if (stroke.altKey !== wanted.alt) return false;
  if (!isSymbol(wanted.key) && stroke.shiftKey !== wanted.shift) return false;
  return keyMatches(stroke, wanted.key);
}

export function chordKeys(chord: string, platform: Platform): string[] {
  const parts = splitChord(chord);
  const key = parts.at(-1) ?? "";
  const modifiers = parts.slice(0, -1).map((part) => MODIFIER_LABELS[platform][part] ?? part);
  const keyLabel = KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  return [...modifiers, keyLabel];
}
