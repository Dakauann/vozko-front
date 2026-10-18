import { cssFontOf } from "@/lib/studio/fonts";
import type { RunStyle, TextRange } from "@/lib/studio/text-runs";

export const FALLBACK_INK = "#000000";

export function partCss(style: RunStyle, fontScale: number): string {
  const px = style.fontSize * fontScale;
  return [
    `font: ${cssFontOf(style.fontId, style.fontWeight, style.italic, px)}`,
    `color: ${style.fill || FALLBACK_INK}`,
    `letter-spacing: ${style.letterSpacing * px}px`,
    `text-decoration: ${style.underline ? "underline" : "none"}`,
    `text-transform: ${style.caps ? "uppercase" : "none"}`,
  ].join("; ");
}

export interface RichPart {
  text: string;
  css: string;
}

const TAIL_ATTRIBUTE = "data-rich-tail";

const BLOCK_TAGS: ReadonlySet<string> = new Set(["DIV", "P"]);

function readInto(node: Node, out: string[]): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push(child.nodeValue ?? "");
      return;
    }
    if (!(child instanceof Element)) return;
    if (child.tagName === "BR") {
      if (!child.hasAttribute(TAIL_ATTRIBUTE)) out.push("\n");
      return;
    }
    const sofar = out.join("");
    if (BLOCK_TAGS.has(child.tagName) && sofar !== "" && !sofar.endsWith("\n")) out.push("\n");
    readInto(child, out);
  });
}

export function editableText(root: Node): string {
  const out: string[] = [];
  readInto(root, out);
  return out.join("");
}

export function domOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = root.ownerDocument.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return editableText(range.cloneContents()).length;
}

export function readSelection(root: HTMLElement): TextRange | null {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.anchorNode || !selection.focusNode) return null;
  if (!root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null;
  const anchor = domOffset(root, selection.anchorNode, selection.anchorOffset);
  const focus = domOffset(root, selection.focusNode, selection.focusOffset);
  return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
}

function pointAt(root: HTMLElement, offset: number): [Node, number] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let last: [Node, number] = [root, 0];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = node.nodeValue?.length ?? 0;
    if (remaining <= length) return [node, remaining];
    remaining -= length;
    last = [node, length];
  }
  return last;
}

export function placeSelection(root: HTMLElement, start: number, end: number): void {
  const selection = root.ownerDocument.getSelection();
  if (!selection) return;
  const range = root.ownerDocument.createRange();
  const [startNode, startOffset] = pointAt(root, start);
  const [endNode, endOffset] = pointAt(root, end);
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  selection.removeAllRanges();
  selection.addRange(range);
}

export function renderParts(root: HTMLElement, parts: readonly RichPart[], tail: boolean): void {
  const doc = root.ownerDocument;
  const nodes: Node[] = parts.map((part) => {
    const span = doc.createElement("span");
    span.style.cssText = part.css;
    span.dataset.css = part.css;
    span.textContent = part.text;
    return span;
  });
  if (tail) {
    const filler = doc.createElement("br");
    filler.setAttribute(TAIL_ATTRIBUTE, "");
    nodes.push(filler);
  }
  root.replaceChildren(...nodes);
}

function partMatches(node: Node | undefined, part: RichPart): boolean {
  if (!(node instanceof HTMLSpanElement) || node.dataset.css !== part.css) return false;
  return [...node.childNodes].every((child) => child.nodeType === Node.TEXT_NODE) && node.textContent === part.text;
}

export function domMatches(root: HTMLElement, parts: readonly RichPart[], tail: boolean): boolean {
  const children = [...root.childNodes];
  if (children.length !== parts.length + (tail ? 1 : 0)) return false;
  if (!parts.every((part, i) => partMatches(children[i], part))) return false;
  if (!tail) return true;
  const last = children[children.length - 1];
  return last instanceof HTMLBRElement && last.hasAttribute(TAIL_ATTRIBUTE);
}
