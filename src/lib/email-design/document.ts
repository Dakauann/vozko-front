import { CURRENT_VERSION, DEFAULT_DIVIDER_COLOR, MAX_BLOCKS } from "./limits";
import type { Block, BlockKind, BlockOf, ChildBlock, ColumnRatio, ColumnsBlock, Document, Settings } from "./types";

export type Container = { kind: "root" } | { kind: "column"; columnsId: string; column: number };

export interface Position {
  container: Container;
  index: number;
}

export interface BlockCopy {
  heading: string;
  text: string;
  button: string;
  footerCompany: string;
  footerAddress: string;
}

export interface FoundBlock {
  block: Block;
  position: Position;
}

export const ROOT: Container = { kind: "root" };

export const DEFAULT_BUTTON_HREF = "https://example.com";
export const DEFAULT_SOCIAL_URL = "https://instagram.com";
export const DEFAULT_SPACER_HEIGHT = 24;

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const ID_SUFFIX_LENGTH = 6;

export function columnCount(ratio: ColumnRatio): number {
  return ratio === "33-33-33" ? 3 : 2;
}

export function isChildKind(kind: BlockKind): boolean {
  return kind !== "columns" && kind !== "footer";
}

export function isChildBlock(block: Block): block is ChildBlock {
  return isChildKind(block.kind);
}

function eachBlock(blocks: readonly Block[], visit: (block: Block) => void) {
  for (const block of blocks) {
    visit(block);
    if (block.kind === "columns") {
      for (const column of block.columns.columns) eachBlock(column.blocks, visit);
    }
  }
}

export function collectIds(doc: Document): Set<string> {
  const ids = new Set<string>();
  eachBlock(doc.blocks, (block) => ids.add(block.id));
  return ids;
}

export function blockCount(doc: Document): number {
  let count = 0;
  eachBlock(doc.blocks, () => {
    count += 1;
  });
  return count;
}

export function canAddBlocks(doc: Document, amount = 1): boolean {
  return blockCount(doc) + amount <= MAX_BLOCKS;
}

export function createId(kind: BlockKind, taken: ReadonlySet<string>, random: () => number = Math.random): string {
  for (;;) {
    let suffix = "";
    for (let index = 0; index < ID_SUFFIX_LENGTH; index += 1) {
      suffix += ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length) % ID_ALPHABET.length];
    }
    const id = `${kind}-${suffix}`;
    if (!taken.has(id)) return id;
  }
}

export function createBlock<K extends BlockKind>(kind: K, copy: BlockCopy, taken: ReadonlySet<string> = new Set(), random?: () => number): BlockOf<K> {
  const id = createId(kind, taken, random);
  const blocks: { [P in BlockKind]: BlockOf<P> } = {
    heading: { id, kind: "heading", heading: { text: copy.heading, level: 2 } },
    text: { id, kind: "text", text: { paragraphs: [{ runs: [{ text: copy.text }] }] } },
    button: { id, kind: "button", button: { label: copy.button, href: DEFAULT_BUTTON_HREF } },
    image: { id, kind: "image", image: { src: "", alt: "", width: 100 } },
    divider: { id, kind: "divider", divider: { color: DEFAULT_DIVIDER_COLOR, thickness: 1 } },
    spacer: { id, kind: "spacer", spacer: { height: DEFAULT_SPACER_HEIGHT } },
    columns: { id, kind: "columns", columns: { ratio: "50-50", columns: [{ blocks: [] }, { blocks: [] }] } },
    social: { id, kind: "social", social: { links: [{ network: "instagram", url: DEFAULT_SOCIAL_URL }] } },
    footer: { id, kind: "footer", footer: { company_name: copy.footerCompany, address: copy.footerAddress } },
  };
  return blocks[kind];
}

export function emptyDocument(copy: BlockCopy): Document {
  return { version: CURRENT_VERSION, settings: {}, blocks: [createBlock("footer", copy)] };
}

export function footerIndex(doc: Document): number {
  return doc.blocks.findIndex((block) => block.kind === "footer");
}

function rootLimit(doc: Document): number {
  const footer = footerIndex(doc);
  return footer >= 0 ? footer : doc.blocks.length;
}

export function findBlock(doc: Document, id: string): FoundBlock | null {
  for (let index = 0; index < doc.blocks.length; index += 1) {
    const block = doc.blocks[index];
    if (block.id === id) return { block, position: { container: ROOT, index } };
  }
  for (const parent of doc.blocks) {
    if (parent.kind !== "columns") continue;
    for (let column = 0; column < parent.columns.columns.length; column += 1) {
      const children = parent.columns.columns[column].blocks;
      const index = children.findIndex((child) => child.id === id);
      if (index >= 0) return { block: children[index], position: { container: { kind: "column", columnsId: parent.id, column }, index } };
    }
  }
  return null;
}

function columnsParent(doc: Document, container: Container): ColumnsBlock | null {
  if (container.kind !== "column") return null;
  const parent = doc.blocks.find((block) => block.id === container.columnsId);
  if (!parent || parent.kind !== "columns") return null;
  return container.column >= 0 && container.column < parent.columns.columns.length ? parent : null;
}

function listOf(doc: Document, container: Container): readonly Block[] | null {
  if (container.kind === "root") return doc.blocks;
  const parent = columnsParent(doc, container);
  return parent ? parent.columns.columns[container.column].blocks : null;
}

function withList(doc: Document, container: Container, blocks: Block[]): Document {
  if (container.kind === "root") return { ...doc, blocks };
  return {
    ...doc,
    blocks: doc.blocks.map((block) => {
      if (block.id !== container.columnsId || block.kind !== "columns") return block;
      const columns = block.columns.columns.map((column, index) => (index === container.column ? { ...column, blocks } : column));
      return { ...block, columns: { ...block.columns, columns } };
    }),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function insertBlock(doc: Document, block: Block, position: Position): Document {
  if (block.kind === "footer") {
    if (position.container.kind !== "root" || footerIndex(doc) >= 0) return doc;
    return { ...doc, blocks: [...doc.blocks, block] };
  }
  if (position.container.kind === "column" && !isChildBlock(block)) return doc;
  const list = listOf(doc, position.container);
  if (!list) return doc;
  const max = position.container.kind === "root" ? rootLimit(doc) : list.length;
  const index = clamp(position.index, 0, max);
  return withList(doc, position.container, [...list.slice(0, index), block, ...list.slice(index)]);
}

export function removeBlock(doc: Document, id: string): Document {
  const found = findBlock(doc, id);
  if (!found || found.block.kind === "footer") return doc;
  const list = listOf(doc, found.position.container) ?? [];
  return withList(
    doc,
    found.position.container,
    list.filter((_, index) => index !== found.position.index),
  );
}

function sameContainer(a: Container, b: Container): boolean {
  if (a.kind === "root" || b.kind === "root") return a.kind === b.kind;
  return a.columnsId === b.columnsId && a.column === b.column;
}

export function moveBlock(doc: Document, id: string, target: Position): Document {
  const found = findBlock(doc, id);
  if (!found || found.block.kind === "footer") return doc;
  if (target.container.kind === "column" && (!isChildBlock(found.block) || !columnsParent(doc, target.container))) return doc;
  const shift = sameContainer(found.position.container, target.container) && found.position.index < target.index ? 1 : 0;
  const index = target.index - shift;
  if (sameContainer(found.position.container, target.container) && index === found.position.index) return doc;
  return insertBlock(removeBlock(doc, id), found.block, { container: target.container, index });
}

export function moveBlockBy(doc: Document, id: string, delta: -1 | 1): Document {
  const found = findBlock(doc, id);
  if (!found || found.block.kind === "footer") return doc;
  const { container, index } = found.position;
  if (container.kind === "root") {
    const next = index + delta;
    if (next < 0 || next >= rootLimit(doc)) return doc;
    return moveBlock(doc, id, { container, index: delta > 0 ? next + 1 : next });
  }
  const list = listOf(doc, container) ?? [];
  const next = index + delta;
  if (next >= 0 && next < list.length) return moveBlock(doc, id, { container, index: delta > 0 ? next + 1 : next });
  const parentIndex = doc.blocks.findIndex((block) => block.id === container.columnsId);
  return moveBlock(doc, id, { container: ROOT, index: delta > 0 ? parentIndex + 1 : parentIndex });
}

export function canMoveBy(doc: Document, id: string, delta: -1 | 1): boolean {
  return moveBlockBy(doc, id, delta) !== doc;
}

function cloneWithFreshIds(block: Block, taken: Set<string>, random?: () => number): Block {
  const id = createId(block.kind, taken, random);
  taken.add(id);
  if (block.kind !== "columns") return { ...structuredClone(block), id };
  const columns = block.columns.columns.map((column) => ({
    blocks: column.blocks.map((child) => cloneWithFreshIds(child, taken, random)),
  }));
  return { ...structuredClone(block), id, columns: { ...block.columns, columns } };
}

export function duplicateBlock(doc: Document, id: string, random?: () => number): { document: Document; id: string | null } {
  const found = findBlock(doc, id);
  if (!found || found.block.kind === "footer") return { document: doc, id: null };
  const copy = cloneWithFreshIds(found.block, collectIds(doc), random);
  const document = insertBlock(doc, copy, { container: found.position.container, index: found.position.index + 1 });
  return { document, id: copy.id };
}

function mapBlocks(blocks: readonly Block[], id: string, update: (block: Block) => Block): Block[] {
  let changed = false;
  const next = blocks.map((block) => {
    if (block.id === id) {
      const updated = update(block);
      if (updated !== block) changed = true;
      return updated;
    }
    if (block.kind !== "columns") return block;
    let columnChanged = false;
    const columns = block.columns.columns.map((column) => {
      const children = mapBlocks(column.blocks, id, update);
      if (children === column.blocks) return column;
      columnChanged = true;
      return { ...column, blocks: children };
    });
    if (!columnChanged) return block;
    changed = true;
    return { ...block, columns: { ...block.columns, columns } };
  });
  return changed ? next : (blocks as Block[]);
}

export function updateBlock(doc: Document, id: string, update: (block: Block) => Block): Document {
  const blocks = mapBlocks(doc.blocks, id, update);
  return blocks === doc.blocks ? doc : { ...doc, blocks };
}

export function updateBlockOf<K extends BlockKind>(doc: Document, id: string, kind: K, update: (block: BlockOf<K>) => BlockOf<K>): Document {
  return updateBlock(doc, id, (block) => (block.kind === kind ? update(block as BlockOf<K>) : block));
}

export function compact<T extends object>(value: T): T {
  const out = { ...value } as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    if (out[key] === undefined || out[key] === "") delete out[key];
  }
  return out as T;
}

export function updateSettings(doc: Document, patch: Partial<Settings>): Document {
  return { ...doc, settings: compact({ ...doc.settings, ...patch }) };
}

export function setColumnsRatio(doc: Document, id: string, ratio: ColumnRatio): Document {
  return updateBlockOf(doc, id, "columns", (block) => {
    const count = columnCount(ratio);
    const current = block.columns.columns;
    let columns = current.slice(0, count);
    if (current.length > count) {
      const overflow = current.slice(count).flatMap((column) => column.blocks);
      const last = columns[count - 1];
      columns = [...columns.slice(0, count - 1), { ...last, blocks: [...last.blocks, ...overflow] }];
    }
    while (columns.length < count) columns = [...columns, { blocks: [] }];
    return { ...block, columns: { ratio, columns } };
  });
}
