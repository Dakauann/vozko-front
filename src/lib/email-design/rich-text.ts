import type { Paragraph, Run } from "./types";

export type Mark = "bold" | "italic" | "underline";

export interface TextPosition {
  paragraph: number;
  offset: number;
}

export interface TextRange {
  start: TextPosition;
  end: TextPosition;
}

export interface ActiveMarks {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  href: string | null;
}

interface Edit {
  paragraphs: Paragraph[];
  caret: TextPosition;
}

const MARKS: readonly Mark[] = ["bold", "italic", "underline"];

export function paragraphText(paragraph: Paragraph): string {
  return paragraph.runs.map((run) => run.text).join("");
}

function sameFormat(a: Run, b: Run): boolean {
  return Boolean(a.bold) === Boolean(b.bold) && Boolean(a.italic) === Boolean(b.italic) && Boolean(a.underline) === Boolean(b.underline) && (a.link?.href ?? null) === (b.link?.href ?? null);
}

function cleanRun(run: Run): Run {
  const out: Run = { text: run.text };
  if (run.bold) out.bold = true;
  if (run.italic) out.italic = true;
  if (run.underline) out.underline = true;
  if (run.link) out.link = { href: run.link.href };
  return out;
}

export function normalizeRuns(runs: readonly Run[]): Run[] {
  const out: Run[] = [];
  for (const run of runs) {
    if (run.text === "") continue;
    const last = out[out.length - 1];
    if (last && sameFormat(last, run)) {
      out[out.length - 1] = { ...last, text: last.text + run.text };
      continue;
    }
    out.push(cleanRun(run));
  }
  return out;
}

export function normalizeParagraphs(paragraphs: readonly Paragraph[]): Paragraph[] {
  const out = paragraphs.map((paragraph) => ({ runs: normalizeRuns(paragraph.runs) }));
  return out.length > 0 ? out : [{ runs: [] }];
}

export function sameParagraphs(a: readonly Paragraph[], b: readonly Paragraph[]): boolean {
  return JSON.stringify(normalizeParagraphs(a)) === JSON.stringify(normalizeParagraphs(b));
}

function comparePositions(a: TextPosition, b: TextPosition): number {
  return a.paragraph === b.paragraph ? a.offset - b.offset : a.paragraph - b.paragraph;
}

export function orderedRange(range: TextRange): TextRange {
  return comparePositions(range.start, range.end) <= 0 ? range : { start: range.end, end: range.start };
}

export function isCollapsed(range: TextRange): boolean {
  return comparePositions(range.start, range.end) === 0;
}

export function clampPosition(paragraphs: readonly Paragraph[], position: TextPosition): TextPosition {
  const last = Math.max(0, paragraphs.length - 1);
  const paragraph = Math.min(Math.max(position.paragraph, 0), last);
  const length = paragraphs[paragraph] ? paragraphText(paragraphs[paragraph]).length : 0;
  return { paragraph, offset: Math.min(Math.max(position.offset, 0), length) };
}

function clampRange(paragraphs: readonly Paragraph[], range: TextRange): TextRange {
  const ordered = orderedRange(range);
  return { start: clampPosition(paragraphs, ordered.start), end: clampPosition(paragraphs, ordered.end) };
}

function splitRuns(runs: readonly Run[], offset: number): [Run[], Run[]] {
  const before: Run[] = [];
  const after: Run[] = [];
  let cursor = 0;
  for (const run of runs) {
    const end = cursor + run.text.length;
    if (end <= offset) before.push(run);
    else if (cursor >= offset) after.push(run);
    else {
      before.push({ ...run, text: run.text.slice(0, offset - cursor) });
      after.push({ ...run, text: run.text.slice(offset - cursor) });
    }
    cursor = end;
  }
  return [before, after];
}

function mapRange(paragraphs: readonly Paragraph[], range: TextRange, map: (run: Run) => Run): Paragraph[] {
  const { start, end } = clampRange(paragraphs, range);
  return normalizeParagraphs(
    paragraphs.map((paragraph, index) => {
      if (index < start.paragraph || index > end.paragraph) return paragraph;
      const from = index === start.paragraph ? start.offset : 0;
      const to = index === end.paragraph ? end.offset : paragraphText(paragraph).length;
      const [head, rest] = splitRuns(paragraph.runs, from);
      const [middle, tail] = splitRuns(rest, to - from);
      return { runs: [...head, ...middle.map(map), ...tail] };
    }),
  );
}

function runsIn(paragraphs: readonly Paragraph[], range: TextRange): Run[] {
  const { start, end } = clampRange(paragraphs, range);
  const out: Run[] = [];
  for (let index = start.paragraph; index <= end.paragraph; index += 1) {
    const paragraph = paragraphs[index];
    if (!paragraph) continue;
    const from = index === start.paragraph ? start.offset : 0;
    const to = index === end.paragraph ? end.offset : paragraphText(paragraph).length;
    const [, rest] = splitRuns(paragraph.runs, from);
    const [middle] = splitRuns(rest, to - from);
    out.push(...middle.filter((run) => run.text !== ""));
  }
  return out;
}

function runAt(paragraphs: readonly Paragraph[], position: TextPosition): Run | null {
  const paragraph = paragraphs[position.paragraph];
  if (!paragraph) return null;
  let cursor = 0;
  let previous: Run | null = null;
  for (const run of paragraph.runs) {
    const end = cursor + run.text.length;
    if (position.offset > cursor && position.offset <= end) return run;
    if (position.offset === 0 && cursor === 0) return run;
    previous = run;
    cursor = end;
  }
  return previous;
}

export function activeMarks(paragraphs: readonly Paragraph[], range: TextRange): ActiveMarks {
  const clamped = clampRange(paragraphs, range);
  const runs = isCollapsed(clamped) ? [runAt(paragraphs, clamped.start)].filter((run): run is Run => run !== null) : runsIn(paragraphs, clamped);
  if (runs.length === 0) return { bold: false, italic: false, underline: false, href: null };
  const href = runs.every((run) => run.link && run.link.href === runs[0].link?.href) ? (runs[0].link?.href ?? null) : null;
  return {
    bold: runs.every((run) => run.bold),
    italic: runs.every((run) => run.italic),
    underline: runs.every((run) => run.underline),
    href,
  };
}

export function toggleMark(paragraphs: readonly Paragraph[], range: TextRange, mark: Mark): Paragraph[] {
  const clamped = clampRange(paragraphs, range);
  if (isCollapsed(clamped)) return normalizeParagraphs(paragraphs);
  const on = !runsIn(paragraphs, clamped).every((run) => run[mark]);
  return mapRange(paragraphs, clamped, (run) => {
    const next = { ...run };
    if (on) next[mark] = true;
    else delete next[mark];
    return next;
  });
}

export function setLink(paragraphs: readonly Paragraph[], range: TextRange, href: string | null): Edit {
  const clamped = clampRange(paragraphs, range);
  if (isCollapsed(clamped)) {
    if (!href) return { paragraphs: normalizeParagraphs(paragraphs), caret: clamped.start };
    const inserted = insertRuns(paragraphs, clamped.start, [{ text: href, link: { href } }]);
    return inserted;
  }
  const next = mapRange(paragraphs, clamped, (run) => {
    const out = { ...run };
    if (href) out.link = { href };
    else delete out.link;
    return out;
  });
  return { paragraphs: next, caret: clamped.end };
}

export function deleteRange(paragraphs: readonly Paragraph[], range: TextRange): Edit {
  const { start, end } = clampRange(paragraphs, range);
  if (paragraphs.length === 0) return { paragraphs: [{ runs: [] }], caret: { paragraph: 0, offset: 0 } };
  const [head] = splitRuns(paragraphs[start.paragraph].runs, start.offset);
  const [, tail] = splitRuns(paragraphs[end.paragraph].runs, end.offset);
  const merged: Paragraph = { runs: normalizeRuns([...head, ...tail]) };
  const next = [...paragraphs.slice(0, start.paragraph), merged, ...paragraphs.slice(end.paragraph + 1)];
  return { paragraphs: normalizeParagraphs(next), caret: start };
}

function insertRuns(paragraphs: readonly Paragraph[], position: TextPosition, runs: Run[]): Edit {
  const base = paragraphs.length > 0 ? paragraphs : [{ runs: [] }];
  const at = clampPosition(base, position);
  const [head, tail] = splitRuns(base[at.paragraph].runs, at.offset);
  const length = runs.reduce((sum, run) => sum + run.text.length, 0);
  const next = base.map((paragraph, index) => (index === at.paragraph ? { runs: normalizeRuns([...head, ...runs, ...tail]) } : paragraph));
  return { paragraphs: normalizeParagraphs(next), caret: { paragraph: at.paragraph, offset: at.offset + length } };
}

function formatAt(paragraphs: readonly Paragraph[], position: TextPosition): Omit<Run, "text"> {
  const run = runAt(paragraphs, position);
  if (!run) return {};
  const format: Omit<Run, "text"> = {};
  for (const mark of MARKS) if (run[mark]) format[mark] = true;
  if (run.link) format.link = { href: run.link.href };
  return format;
}

export function insertText(paragraphs: readonly Paragraph[], range: TextRange, text: string): Edit {
  const removed = deleteRange(paragraphs, range);
  if (text === "") return removed;
  return insertRuns(removed.paragraphs, removed.caret, [{ ...formatAt(paragraphs, orderedRange(range).start), text }]);
}

export function splitParagraph(paragraphs: readonly Paragraph[], range: TextRange): Edit {
  const removed = deleteRange(paragraphs, range);
  const at = removed.caret;
  const [head, tail] = splitRuns(removed.paragraphs[at.paragraph].runs, at.offset);
  const next = [...removed.paragraphs.slice(0, at.paragraph), { runs: normalizeRuns(head) }, { runs: normalizeRuns(tail) }, ...removed.paragraphs.slice(at.paragraph + 1)];
  return { paragraphs: next, caret: { paragraph: at.paragraph + 1, offset: 0 } };
}

export function insertPlainText(paragraphs: readonly Paragraph[], range: TextRange, text: string): Edit {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let edit = insertText(paragraphs, range, lines[0]);
  for (const line of lines.slice(1)) {
    const split = splitParagraph(edit.paragraphs, { start: edit.caret, end: edit.caret });
    edit = insertText(split.paragraphs, { start: split.caret, end: split.caret }, line);
  }
  return edit;
}

interface Atom {
  node: Node;
  text: string;
  start: number;
  format: Omit<Run, "text">;
  isBreak: boolean;
}

const BLOCK_TAGS = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "UL", "OL", "BLOCKQUOTE", "PRE", "SECTION", "ARTICLE", "HEADER", "FOOTER", "TABLE", "TR", "TD", "TH", "TBODY", "THEAD"]);
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "IFRAME", "OBJECT", "IMG", "VIDEO", "AUDIO", "SVG", "NOSCRIPT"]);

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function hasBlockDescendant(element: Element): boolean {
  for (const child of Array.from(element.children)) {
    if (BLOCK_TAGS.has(child.tagName) || hasBlockDescendant(child)) return true;
  }
  return false;
}

function formatFor(element: Element, format: Omit<Run, "text">): Omit<Run, "text"> {
  switch (element.tagName) {
    case "STRONG":
    case "B":
      return { ...format, bold: true };
    case "EM":
    case "I":
      return { ...format, italic: true };
    case "U":
      return { ...format, underline: true };
    case "A": {
      const href = element.getAttribute("href");
      return href ? { ...format, link: { href } } : format;
    }
  }
  return format;
}

function walk(root: Node): Atom[][] {
  const paragraphs: Atom[][] = [];
  let current: Atom[] | null = null;
  let leaf = false;

  const finish = () => {
    if (current && (current.length > 0 || leaf)) {
      const last = current[current.length - 1];
      if (last && last.isBreak) last.text = "";
      let cursor = 0;
      for (const atom of current) {
        atom.start = cursor;
        cursor += atom.text.length;
      }
      paragraphs.push(current);
    }
    current = null;
    leaf = false;
  };

  const push = (atom: Omit<Atom, "start">) => {
    if (!current) {
      current = [];
      leaf = false;
    }
    current.push({ ...atom, start: 0 });
  };

  const visit = (node: Node, format: Omit<Run, "text">) => {
    if (node.nodeType === 3) {
      push({ node, text: (node.nodeValue ?? "").replace(/\u00a0/g, " "), format, isBreak: false });
      return;
    }
    if (!isElement(node) || SKIPPED_TAGS.has(node.tagName)) return;
    if (node.tagName === "BR") {
      push({ node, text: "\n", format, isBreak: true });
      return;
    }
    if (BLOCK_TAGS.has(node.tagName)) {
      finish();
      if (!hasBlockDescendant(node)) {
        current = [];
        leaf = true;
      }
      node.childNodes.forEach((child) => visit(child, format));
      finish();
      return;
    }
    const next = formatFor(node, format);
    node.childNodes.forEach((child) => visit(child, next));
  };

  root.childNodes.forEach((child) => visit(child, {}));
  finish();
  return paragraphs;
}

export function domToParagraphs(root: Node): Paragraph[] {
  const paragraphs = walk(root).map((atoms) => ({ runs: normalizeRuns(atoms.map((atom) => ({ ...atom.format, text: atom.text }))) }));
  return normalizeParagraphs(paragraphs);
}

function appendText(parent: Node, text: string) {
  const owner = parent.ownerDocument ?? document;
  const parts = text.split("\n");
  parts.forEach((part, index) => {
    if (index > 0) parent.appendChild(owner.createElement("br"));
    if (part !== "") parent.appendChild(owner.createTextNode(part));
  });
}

function runNode(owner: globalThis.Document, run: Run): Node {
  const fragment = owner.createDocumentFragment();
  appendText(fragment, run.text);
  let node: Node = fragment;
  const wrap = (tag: string) => {
    const element = owner.createElement(tag);
    element.appendChild(node);
    node = element;
  };
  if (run.underline) wrap("u");
  if (run.italic) wrap("em");
  if (run.bold) wrap("strong");
  if (run.link) {
    const anchor = owner.createElement("a");
    anchor.setAttribute("href", run.link.href);
    anchor.appendChild(node);
    node = anchor;
  }
  return node;
}

export function renderParagraphs(root: HTMLElement, paragraphs: readonly Paragraph[]) {
  const owner = root.ownerDocument;
  const fragment = owner.createDocumentFragment();
  for (const paragraph of normalizeParagraphs(paragraphs)) {
    const element = owner.createElement("p");
    for (const run of paragraph.runs) element.appendChild(runNode(owner, run));
    const text = paragraphText(paragraph);
    if (text === "" || text.endsWith("\n")) element.appendChild(owner.createElement("br"));
    fragment.appendChild(element);
  }
  root.replaceChildren(fragment);
}

export function canonicalHtml(owner: globalThis.Document, paragraphs: readonly Paragraph[]): string {
  const scratch = owner.createElement("div");
  renderParagraphs(scratch, paragraphs);
  return scratch.innerHTML;
}

function containsNode(container: Node, node: Node): boolean {
  return container === node || container.contains(node);
}

export function pointToPosition(root: Node, node: Node, offset: number): TextPosition | null {
  if (!containsNode(root, node)) return null;
  const paragraphs = walk(root);
  if (paragraphs.length === 0) return { paragraph: 0, offset: 0 };
  if (node.nodeType === 3) {
    for (let paragraph = 0; paragraph < paragraphs.length; paragraph += 1) {
      const atom = paragraphs[paragraph].find((candidate) => candidate.node === node);
      if (atom) return { paragraph, offset: atom.start + Math.min(offset, atom.text.length) };
    }
  }
  const owner = root.ownerDocument ?? (root as globalThis.Document);
  const probe = owner.createRange();
  probe.setStart(node, offset);
  probe.collapse(true);
  let previous: { paragraph: number; atom: Atom } | null = null;
  for (let paragraph = 0; paragraph < paragraphs.length; paragraph += 1) {
    for (const atom of paragraphs[paragraph]) {
      if (probe.comparePoint(atom.node, 0) >= 0) {
        if (previous && previous.paragraph !== paragraph && containsNode(node, previous.atom.node)) {
          return { paragraph: previous.paragraph, offset: previous.atom.start + previous.atom.text.length };
        }
        return { paragraph, offset: atom.start };
      }
      previous = { paragraph, atom };
    }
  }
  if (previous) return { paragraph: previous.paragraph, offset: previous.atom.start + previous.atom.text.length };
  return { paragraph: paragraphs.length - 1, offset: 0 };
}

function indexInParent(node: Node): number {
  return node.parentNode ? Array.prototype.indexOf.call(node.parentNode.childNodes, node) : 0;
}

export function positionToPoint(root: HTMLElement, position: TextPosition): { node: Node; offset: number } {
  const paragraphs = walk(root);
  const atoms = paragraphs[Math.min(Math.max(position.paragraph, 0), paragraphs.length - 1)] ?? [];
  for (const atom of atoms) {
    if (!atom.isBreak && position.offset >= atom.start && position.offset <= atom.start + atom.text.length) {
      return { node: atom.node, offset: position.offset - atom.start };
    }
    if (atom.isBreak && position.offset <= atom.start) return { node: atom.node.parentNode ?? root, offset: indexInParent(atom.node) };
  }
  const last = atoms[atoms.length - 1];
  if (last) {
    if (!last.isBreak) return { node: last.node, offset: last.text.length };
    const parent = last.node.parentNode ?? root;
    return { node: parent, offset: indexInParent(last.node) + (last.text === "" ? 0 : 1) };
  }
  const element = root.children[position.paragraph];
  return element ? { node: element, offset: 0 } : { node: root, offset: root.childNodes.length };
}

export function readSelection(root: HTMLElement): TextRange | null {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const start = pointToPosition(root, range.startContainer, range.startOffset);
  const end = pointToPosition(root, range.endContainer, range.endOffset);
  if (!start || !end) return null;
  return { start, end };
}

export function placeSelection(root: HTMLElement, range: TextRange) {
  const selection = root.ownerDocument.getSelection();
  if (!selection) return;
  const start = positionToPoint(root, range.start);
  const end = positionToPoint(root, range.end);
  const dom = root.ownerDocument.createRange();
  dom.setStart(start.node, start.offset);
  dom.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(dom);
}
