"use client";

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";

import {
  activeMarks,
  canonicalHtml,
  domToParagraphs,
  insertPlainText,
  insertText,
  isCollapsed,
  placeSelection,
  readSelection,
  renderParagraphs,
  sameParagraphs,
  setLink,
  splitParagraph,
  toggleMark,
  type ActiveMarks,
  type Mark,
  type TextRange,
} from "@/lib/email-design/rich-text";
import type { Paragraph } from "@/lib/email-design/types";
import { cn } from "@/lib/utils";

export interface RichTextHandle {
  selection: () => TextRange | null;
  toggle: (mark: Mark) => void;
  link: (href: string | null, range: TextRange | null) => void;
  insert: (text: string, range: TextRange | null) => void;
  focus: () => void;
}

interface RichTextEditorProps {
  paragraphs: Paragraph[];
  onChange: (paragraphs: Paragraph[], group?: string) => void;
  onMarks?: (marks: ActiveMarks) => void;
  style: CSSProperties;
  linkColor: string;
  label: string;
  fieldKey: string;
  readOnly?: boolean;
  className?: string;
}

const MARK_KEYS: Record<string, Mark> = { b: "bold", i: "italic", u: "underline" };
const START: TextRange = { start: { paragraph: 0, offset: 0 }, end: { paragraph: 0, offset: 0 } };

export const RichTextEditor = forwardRef<RichTextHandle, RichTextEditorProps>(function RichTextEditor(
  { paragraphs, onChange, onMarks, style, linkColor, label, fieldKey, readOnly, className },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rendered = useRef(false);
  const composing = useRef(false);
  const lastRange = useRef<TextRange | null>(null);
  const callbacks = useRef({ onChange, onMarks });

  useLayoutEffect(() => {
    callbacks.current = { onChange, onMarks };
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (rendered.current && sameParagraphs(domToParagraphs(root), paragraphs)) return;
    const focused = root.ownerDocument.activeElement === root;
    const selection = focused ? readSelection(root) : null;
    renderParagraphs(root, paragraphs);
    rendered.current = true;
    if (selection) placeSelection(root, selection);
  }, [paragraphs]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const owner = root.ownerDocument;
    const onSelection = () => {
      const selection = owner.getSelection();
      if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return;
      const range = readSelection(root);
      if (!range) return;
      lastRange.current = range;
      callbacks.current.onMarks?.(activeMarks(domToParagraphs(root), range));
    };
    owner.addEventListener("selectionchange", onSelection);
    return () => owner.removeEventListener("selectionchange", onSelection);
  }, []);

  const current = (): Paragraph[] => (rootRef.current ? domToParagraphs(rootRef.current) : paragraphs);

  const selectionOrLast = (): TextRange => {
    const root = rootRef.current;
    return (root && readSelection(root)) || lastRange.current || START;
  };

  const apply = (next: Paragraph[], caret: TextRange, group?: string) => {
    const root = rootRef.current;
    if (!root) return;
    renderParagraphs(root, next);
    root.focus();
    placeSelection(root, caret);
    lastRange.current = caret;
    callbacks.current.onChange(next, group);
    callbacks.current.onMarks?.(activeMarks(next, caret));
  };

  const toggle = (mark: Mark) => {
    const range = selectionOrLast();
    if (isCollapsed(range)) return;
    apply(toggleMark(current(), range, mark), range);
  };

  useImperativeHandle(ref, () => ({
    selection: () => {
      const root = rootRef.current;
      return (root && readSelection(root)) || lastRange.current;
    },
    toggle,
    link: (href, range) => {
      const target = range ?? selectionOrLast();
      const edit = setLink(current(), target, href);
      apply(edit.paragraphs, isCollapsed(target) ? { start: edit.caret, end: edit.caret } : target);
    },
    insert: (text, range) => {
      const edit = insertText(current(), range ?? selectionOrLast(), text);
      apply(edit.paragraphs, { start: edit.caret, end: edit.caret });
    },
    focus: () => rootRef.current?.focus(),
  }));

  const onInput = () => {
    const root = rootRef.current;
    if (!root || composing.current) return;
    const next = domToParagraphs(root);
    if (canonicalHtml(root.ownerDocument, next) !== root.innerHTML) {
      const selection = readSelection(root);
      renderParagraphs(root, next);
      if (selection) placeSelection(root, selection);
    }
    callbacks.current.onChange(next, "type");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (composing.current || event.nativeEvent.isComposing) return;
    if (event.key === "Enter") {
      event.preventDefault();
      const range = selectionOrLast();
      const edit = event.shiftKey ? insertText(current(), range, "\n") : splitParagraph(current(), range);
      apply(edit.paragraphs, { start: edit.caret, end: edit.caret });
      return;
    }
    const mark = MARK_KEYS[event.key.toLowerCase()];
    if (mark && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      toggle(mark);
    }
  };

  return (
    <div
      ref={rootRef}
      role="textbox"
      aria-multiline="true"
      aria-label={label}
      aria-readonly={readOnly || undefined}
      data-email-field={fieldKey}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      spellCheck
      onInput={onInput}
      onKeyDown={onKeyDown}
      onPaste={(event) => {
        event.preventDefault();
        if (readOnly) return;
        const text = event.clipboardData.getData("text/plain");
        const edit = insertPlainText(current(), selectionOrLast(), text);
        apply(edit.paragraphs, { start: edit.caret, end: edit.caret });
      }}
      onDrop={(event) => event.preventDefault()}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
        onInput();
      }}
      style={{ ...style, whiteSpace: "pre-wrap", overflowWrap: "anywhere", ["--email-link" as string]: linkColor }}
      className={cn(
        "outline-none [&>p]:m-0 [&>p:not(:last-child)]:mb-[16px] [&_a]:text-[var(--email-link)] [&_a]:underline",
        className,
      )}
    />
  );
});
