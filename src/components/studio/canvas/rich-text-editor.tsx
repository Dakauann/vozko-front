"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { DEFAULT_LINE_HEIGHT } from "@/components/studio/canvas/text-props";
import { STUDIO_LIMITS, type Layer } from "@/lib/studio/document";
import { cssFontOf } from "@/lib/studio/fonts";
import type { Counter } from "@/lib/studio/counter";
import { codePointIndex, styleRange, toggledPatch, utf16Index, type RunToggle, type TextEdit } from "@/lib/studio/text-run-editing";
import { baseRunStyle, counterTemplate, counterTemplateRange, counterTextRuns, retextRuns, textSpans, textStylePatch, type RunStylePatch, type TextRange, type TextRun } from "@/lib/studio/text-runs";
import { runes } from "@/lib/studio/tokens";

import { domMatches, editableText, FALLBACK_INK, partCss, placeSelection, readSelection, renderParts } from "./rich-text-dom";
import { TextRunToolbar } from "./text-run-toolbar";

export interface RichTextBox {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface RichTextCounter {
  counter: Pick<Counter, "prefix" | "suffix">;
  number: string;
}

export interface RichTextEditorProps {
  layer: Layer;
  box: RichTextBox;
  fontScale: number;
  surfaceHeight: number;
  counter?: RichTextCounter;
  onStyle: (patch: Partial<Layer>) => void;
  onDone: (edit: TextEdit) => void;
}

const TOOLBAR_ROOM_PX = 120;
const TOOLBAR_GAP_PX = 8;
const TOGGLE_KEYS: Record<string, RunToggle> = { b: "bold", i: "italic", u: "underline" };

function orNothing(runs: TextRun[] | undefined): TextRun[] | undefined {
  return runs && runs.length > 0 ? runs : undefined;
}

function sameRange(a: TextRange | null, b: TextRange | null): boolean {
  return a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end);
}

function staysInEditor(wrapper: HTMLElement | null, next: EventTarget | null): boolean {
  if (!wrapper || !(next instanceof Element)) return false;
  if (wrapper.contains(next)) return true;
  return next.closest("[data-radix-popper-content-wrapper]") !== null && wrapper.querySelector('[aria-expanded="true"]') !== null;
}

function toolbarPlacement(box: RichTextBox): { top: number; below: boolean } {
  const radians = (box.rotation * Math.PI) / 180;
  const width = box.width * Math.abs(box.scaleX);
  const height = box.height * Math.abs(box.scaleY);
  const half = (Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) / 2;
  const top = box.centerY - half;
  return top < TOOLBAR_ROOM_PX ? { top: box.centerY + half + TOOLBAR_GAP_PX, below: true } : { top: top - TOOLBAR_GAP_PX, below: false };
}

export function RichTextEditor({ layer, box, fontScale, surfaceHeight, counter, onStyle, onDone }: RichTextEditorProps) {
  const t = useTranslations("studio.textRuns");
  const [text, setText] = useState(layer.text ?? "");
  const [runs, setRuns] = useState<TextRun[] | undefined>(layer.runs);
  const [selection, setSelection] = useState<TextRange | null>(null);
  const [, bump] = useReducer((count: number) => count + 1, 0);
  const wrapper = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef<TextEdit>({ text, runs });
  const chosen = useRef<TextRange | null>(null);
  const pending = useRef<TextRange | null>(null);
  const composing = useRef(false);
  const finished = useRef(false);
  const done = useRef(onDone);

  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const readOnly = Boolean(counter);
  const template = counter ? counterTemplate(counter.counter) : text;
  const length = runes(template);
  const styled: Layer = { ...layer, text: template, runs };
  const shown = counter ? `${counter.counter.prefix ?? ""}${counter.number}${counter.counter.suffix ?? ""}` : text;
  const display: Layer = counter ? { ...styled, text: shown, runs: counterTextRuns(styled, counter.counter, counter.number) } : styled;
  const parts = textSpans(display).map((span) => ({ text: span.text, css: partCss(span.style, fontScale) }));
  const tail = shown === "" || shown.endsWith("\n");
  const toTemplate = (range: TextRange): TextRange => (counter ? counterTemplateRange(counter.counter, counter.number, range) : range);
  const effective = styleRange(selection ? toTemplate(selection) : null, length);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    done.current(latest.current);
  }, []);

  const domSelection = useCallback((): TextRange | null => {
    const element = root.current;
    if (!element || element.ownerDocument.activeElement !== element) return null;
    const value = editableText(element);
    const range = readSelection(element);
    return range ? { start: codePointIndex(value, range.start), end: codePointIndex(value, range.end) } : null;
  }, []);

  const noteSelection = useCallback(() => {
    const next = domSelection();
    if (!next) return;
    chosen.current = next;
    setSelection((previous) => (sameRange(previous, next) ? previous : next));
  }, [domSelection]);

  const choose = (range: TextRange) => {
    chosen.current = range;
    pending.current = range;
    setSelection(range);
  };

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const matches = domMatches(element, parts, tail);
    if (matches && !pending.current) return;
    const focused = element.ownerDocument.activeElement === element;
    const wanted = pending.current ?? (editableText(element) === shown ? domSelection() : null) ?? chosen.current;
    pending.current = null;
    if (!matches) renderParts(element, parts, tail);
    if (focused && wanted) placeSelection(element, utf16Index(shown, wanted.start), utf16Index(shown, wanted.end));
  });

  const live = useRef<{ readOnly: boolean; shownLength: number; replace: (insert: string) => void }>({ readOnly, shownLength: runes(shown), replace: () => undefined });

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const doc = element.ownerDocument;
    element.focus();
    const whole = { start: 0, end: live.current.shownLength };
    chosen.current = whole;
    pending.current = whole;
    setSelection(whole);
    doc.addEventListener("selectionchange", noteSelection);
    const guard = (event: InputEvent) => {
      if (live.current.readOnly || event.inputType.startsWith("format")) {
        event.preventDefault();
        return;
      }
      if (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak") {
        event.preventDefault();
        live.current.replace("\n");
      }
    };
    element.addEventListener("beforeinput", guard);
    return () => {
      doc.removeEventListener("selectionchange", noteSelection);
      element.removeEventListener("beforeinput", guard);
      finish();
    };
  }, [finish, noteSelection]);

  const retext = (next: string) => {
    const before = latest.current;
    const nextRuns = orNothing(retextRuns(before.runs ?? [], before.text, next, baseRunStyle(layer)));
    latest.current = { text: next, runs: nextRuns };
    setText(next);
    setRuns(nextRuns);
  };

  const replaceSelection = (insert: string) => {
    if (readOnly) return;
    const current = latest.current.text;
    const chars = [...current];
    const range = domSelection() ?? chosen.current ?? { start: chars.length, end: chars.length };
    const room = STUDIO_LIMITS.maxTextRunes - (chars.length - (range.end - range.start));
    const added = [...insert].slice(0, Math.max(0, room)).join("");
    retext(`${chars.slice(0, range.start).join("")}${added}${chars.slice(range.end).join("")}`);
    const caret = range.start + runes(added);
    choose({ start: caret, end: caret });
  };

  useEffect(() => {
    live.current = { readOnly, shownLength: runes(shown), replace: replaceSelection };
  });

  const onInput = () => {
    const element = root.current;
    if (!element || composing.current) return;
    const next = editableText(element);
    if (readOnly || next === latest.current.text || runes(next) > STUDIO_LIMITS.maxTextRunes) {
      pending.current = chosen.current;
      bump();
      return;
    }
    retext(next);
  };

  const restoreFocus = () => {
    pending.current = chosen.current;
    root.current?.focus();
    bump();
  };

  const applyStyle = (patch: RunStylePatch, refocus: boolean) => {
    const current = latest.current;
    const source = counter ? counterTemplate(counter.counter) : current.text;
    const total = runes(source);
    const range = styleRange(chosen.current ? toTemplate(chosen.current) : null, total);
    const result = textStylePatch({ ...layer, text: source, runs: current.runs }, range, patch, total);
    latest.current = { ...current, runs: result.runs };
    setRuns(result.runs);
    onStyle(counter ? result : { text: current.text, ...result });
    if (refocus) restoreFocus();
  };

  const clearStyles = () => {
    latest.current = { ...latest.current, runs: undefined };
    setRuns(undefined);
    onStyle(counter ? { runs: undefined } : { text: latest.current.text, runs: undefined });
    restoreFocus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const command = event.ctrlKey || event.metaKey;
    if (event.key === "Escape" || (event.key === "Enter" && command)) {
      event.preventDefault();
      event.stopPropagation();
      finish();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      replaceSelection("\n");
      return;
    }
    const toggle = command && !event.altKey ? TOGGLE_KEYS[event.key.toLowerCase()] : undefined;
    if (!toggle) return;
    event.preventDefault();
    event.stopPropagation();
    noteSelection();
    const source = counter ? counterTemplate(counter.counter) : latest.current.text;
    const total = runes(source);
    const range = styleRange(chosen.current ? toTemplate(chosen.current) : null, total);
    const patch = toggledPatch({ ...layer, text: source, runs: latest.current.runs }, range, toggle, total);
    if (patch) applyStyle(patch, false);
  };

  const placement = toolbarPlacement(box);
  const base = baseRunStyle(layer);
  const basePx = base.fontSize * fontScale;
  const lineHeight = layer.lineHeight || DEFAULT_LINE_HEIGHT;

  return (
    <div
      ref={wrapper}
      className="contents"
      onBlur={(event) => {
        if (staysInEditor(wrapper.current, event.relatedTarget)) return;
        finish();
      }}
    >
      <div
        data-text-run-toolbar
        className="pointer-events-none absolute z-[950]"
        style={{ left: box.centerX, top: placement.top, transform: `translate(-50%, ${placement.below ? "0" : "-100%"})` }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <TextRunToolbar layer={styled} range={effective} length={length} surfaceHeight={surfaceHeight} onPatch={applyStyle} onClear={runs ? clearStyles : undefined} />
      </div>
      <div
        className="pointer-events-none absolute z-[940] flex items-center"
        style={{
          left: box.centerX - box.width / 2,
          top: box.centerY - box.height / 2,
          width: box.width,
          minHeight: box.height,
          transform: `rotate(${box.rotation}deg) scale(${Math.abs(box.scaleX)}, ${Math.abs(box.scaleY)})`,
          transformOrigin: "50% 50%",
        }}
      >
        <div
          ref={root}
          role="textbox"
          aria-multiline
          aria-label={t("edit")}
          aria-readonly={readOnly || undefined}
          contentEditable
          tabIndex={0}
          suppressContentEditableWarning
          spellCheck={false}
          data-rich-text-editor
          onInput={onInput}
          onKeyDown={onKeyDown}
          onKeyUp={noteSelection}
          onMouseUp={noteSelection}
          onPointerDown={(event) => event.stopPropagation()}
          onCompositionStart={() => (composing.current = true)}
          onCompositionEnd={() => {
            composing.current = false;
            onInput();
          }}
          onPaste={(event) => {
            event.preventDefault();
            replaceSelection(event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n"));
          }}
          onDrop={(event) => event.preventDefault()}
          className="pointer-events-auto block w-full cursor-text select-text whitespace-pre-wrap break-words outline outline-2 outline-offset-2 outline-primary"
          style={{
            font: cssFontOf(base.fontId, base.fontWeight, base.italic, basePx),
            color: base.fill || FALLBACK_INK,
            minHeight: basePx * lineHeight,
            lineHeight,
            textAlign: layer.align || "left",
            opacity: layer.transform.opacity,
          }}
        />
      </div>
    </div>
  );
}
