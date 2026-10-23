"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

interface PlainEditableProps {
  value: string;
  onChange: (value: string) => void;
  as: "h1" | "h2" | "h3";
  style: CSSProperties;
  label: string;
  fieldKey: string;
  maxLength?: number;
  className?: string;
}

function flatten(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s*[\r\n]+\s*/g, " ");
}

function caretOffset(root: HTMLElement): number | null {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || !root.contains(selection.anchorNode)) return null;
  const range = selection.getRangeAt(0).cloneRange();
  range.selectNodeContents(root);
  range.setEnd(selection.getRangeAt(0).endContainer, selection.getRangeAt(0).endOffset);
  return range.toString().length;
}

function placeCaret(root: HTMLElement, offset: number) {
  const selection = root.ownerDocument.getSelection();
  if (!selection) return;
  const text = root.firstChild;
  const range = root.ownerDocument.createRange();
  if (text && text.nodeType === 3) range.setStart(text, Math.min(offset, text.nodeValue?.length ?? 0));
  else range.setStart(root, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function writeText(root: HTMLElement, value: string) {
  root.textContent = value;
}

export function PlainEditable({ value, onChange, as: Tag, style, label, fieldKey, maxLength, className }: PlainEditableProps) {
  const rootRef = useRef<HTMLHeadingElement | null>(null);
  const composing = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || root.textContent === value) return;
    const focused = root.ownerDocument.activeElement === root;
    writeText(root, value);
    if (focused) placeCaret(root, value.length);
  }, [value]);

  const emit = () => {
    const root = rootRef.current;
    if (!root || composing.current) return;
    const raw = root.textContent ?? "";
    let next = flatten(raw);
    if (maxLength !== undefined && Array.from(next).length > maxLength) next = Array.from(next).slice(0, maxLength).join("");
    const canonical = root.childNodes.length === 0 || (root.childNodes.length === 1 && root.firstChild?.nodeType === 3);
    if (!canonical || next !== raw) {
      const offset = caretOffset(root) ?? next.length;
      writeText(root, next);
      placeCaret(root, offset);
    }
    onChange(next);
  };

  return (
    <Tag
      ref={rootRef}
      role="textbox"
      aria-label={label}
      data-email-field={fieldKey}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onInput={emit}
      onKeyDown={(event: React.KeyboardEvent<HTMLHeadingElement>) => {
        if (event.key === "Enter") event.preventDefault();
        if ((event.ctrlKey || event.metaKey) && ["b", "i", "u"].includes(event.key.toLowerCase())) event.preventDefault();
      }}
      onPaste={(event: React.ClipboardEvent<HTMLHeadingElement>) => {
        event.preventDefault();
        const root = rootRef.current;
        const selection = root?.ownerDocument.getSelection();
        if (!root || !selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!root.contains(range.startContainer)) return;
        range.deleteContents();
        const node = root.ownerDocument.createTextNode(flatten(event.clipboardData.getData("text/plain")));
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        root.normalize();
        emit();
      }}
      onDrop={(event: React.DragEvent<HTMLHeadingElement>) => event.preventDefault()}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={() => {
        composing.current = false;
        emit();
      }}
      style={{ ...style, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      className={cn("outline-none", className)}
    />
  );
}
