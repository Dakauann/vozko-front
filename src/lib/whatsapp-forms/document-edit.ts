import { produce, type Draft } from "immer";

import { newKey, type RandomBytes } from "./keys";
import type { Block, Condition, Display, DisplayKind, Document, Field, FieldKind, Option, Route, Screen } from "./types";

export type BlockSpec = { field: FieldKind } | { display: DisplayKind };

export interface BlockCopy {
  label: string;
  text: string;
  options: string[];
}

export interface ScreenCopy {
  title: string;
  submitLabel: string;
}

export interface BlockLocation {
  screen: number;
  block: number;
}

const CHOICE_KINDS: readonly FieldKind[] = ["single_choice_radio", "single_choice_dropdown", "multi_choice_checkbox", "multi_choice_chips"];
const SINGLE_CHOICE_KINDS: readonly FieldKind[] = ["single_choice_radio", "single_choice_dropdown"];

export function hasOptions(kind: FieldKind): boolean {
  return CHOICE_KINDS.includes(kind);
}

export function isSingleChoice(kind: FieldKind): boolean {
  return SINGLE_CHOICE_KINDS.includes(kind);
}

export function isConditionSource(kind: FieldKind): boolean {
  return hasOptions(kind) || kind === "opt_in";
}

export function createOption(title: string, random?: RandomBytes): Option {
  return { id: newKey("o_", random), title };
}

export function createField(kind: FieldKind, copy: BlockCopy, random?: RandomBytes): Field {
  return {
    key: newKey("f_", random),
    kind,
    label: copy.label,
    required: false,
    sensitive: false,
    ...(hasOptions(kind) ? { options: copy.options.map((title) => createOption(title, random)) } : {}),
  };
}

export function createBlock(spec: BlockSpec, copy: BlockCopy, random?: RandomBytes): Block {
  const key = newKey("b_", random);
  if ("field" in spec) return { key, field: createField(spec.field, copy, random) };
  const display: Display = { kind: spec.display };
  if (spec.display !== "image") display.text = copy.text;
  return { key, display };
}

export function createScreen(copy: ScreenCopy, random?: RandomBytes): Screen {
  return { key: newKey("s_", random), title: copy.title, submitLabel: copy.submitLabel, blocks: [], route: {} };
}

export function screenIndex(document: Document, screenKey: string): number {
  return document.screens.findIndex((screen) => screen.key === screenKey);
}

export function locateBlock(document: Document, blockKey: string): BlockLocation | null {
  for (let s = 0; s < document.screens.length; s++) {
    const b = document.screens[s].blocks.findIndex((block) => block.key === blockKey);
    if (b >= 0) return { screen: s, block: b };
  }
  return null;
}

export function findBlock(document: Document, blockKey: string): Block | null {
  const at = locateBlock(document, blockKey);
  return at ? document.screens[at.screen].blocks[at.block] : null;
}

export function findFieldBlock(document: Document, fieldKey: string): { block: Block; location: BlockLocation } | null {
  for (let s = 0; s < document.screens.length; s++) {
    const b = document.screens[s].blocks.findIndex((block) => block.field?.key === fieldKey);
    if (b >= 0) return { block: document.screens[s].blocks[b], location: { screen: s, block: b } };
  }
  return null;
}

function moved<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

function dropRouteTarget(route: Draft<Route>, target: string) {
  if (route.next === target) delete route.next;
  if (route.branches) {
    route.branches = route.branches.filter((branch) => branch.next !== target);
    if (route.branches.length === 0) delete route.branches;
  }
}

function dropFieldReferences(draft: Draft<Document>, fieldKey: string) {
  for (const screen of draft.screens) {
    if (screen.route.branchOn === fieldKey) {
      delete screen.route.branchOn;
      delete screen.route.branches;
    }
    for (const block of screen.blocks) {
      if (block.visibleIf?.fieldKey === fieldKey) delete block.visibleIf;
    }
  }
}

function dropOptionReferences(draft: Draft<Document>, fieldKey: string, optionId: string) {
  for (const screen of draft.screens) {
    if (screen.route.branchOn === fieldKey && screen.route.branches) {
      screen.route.branches = screen.route.branches.filter((branch) => branch.optionId !== optionId);
      if (screen.route.branches.length === 0) delete screen.route.branches;
    }
    for (const block of screen.blocks) {
      if (block.visibleIf?.fieldKey === fieldKey && block.visibleIf.value === optionId) delete block.visibleIf;
    }
  }
}

function withField(document: Document, blockKey: string, recipe: (field: Draft<Field>, draft: Draft<Document>) => void): Document {
  const at = locateBlock(document, blockKey);
  if (!at || !document.screens[at.screen].blocks[at.block].field) return document;
  return produce(document, (draft) => {
    const field = draft.screens[at.screen].blocks[at.block].field;
    if (field) recipe(field, draft);
  });
}

export function addScreen(document: Document, screen: Screen, index = document.screens.length): Document {
  return produce(document, (draft) => {
    draft.screens.splice(Math.max(0, Math.min(index, draft.screens.length)), 0, screen);
  });
}

export function updateScreen(document: Document, screenKey: string, patch: Partial<Pick<Screen, "title" | "submitLabel">>): Document {
  const index = screenIndex(document, screenKey);
  if (index < 0) return document;
  return produce(document, (draft) => {
    Object.assign(draft.screens[index], patch);
  });
}

export function moveScreen(document: Document, from: number, to: number): Document {
  const screens = moved(document.screens, from, to);
  if (screens === document.screens) return document;
  return produce(document, (draft) => {
    draft.screens = screens as Draft<Screen>[];
  });
}

export function removeScreen(document: Document, screenKey: string): Document {
  const index = screenIndex(document, screenKey);
  if (index < 0) return document;
  const fieldKeys = document.screens[index].blocks.flatMap((block) => (block.field ? [block.field.key] : []));
  return produce(document, (draft) => {
    draft.screens.splice(index, 1);
    for (const screen of draft.screens) dropRouteTarget(screen.route, screenKey);
    for (const key of fieldKeys) dropFieldReferences(draft, key);
  });
}

export function setRoute(document: Document, screenKey: string, route: Route): Document {
  const index = screenIndex(document, screenKey);
  if (index < 0) return document;
  return produce(document, (draft) => {
    draft.screens[index].route = route;
  });
}

export function setBranching(document: Document, screenKey: string, fieldKey: string | null): Document {
  const index = screenIndex(document, screenKey);
  if (index < 0) return document;
  return produce(document, (draft) => {
    const route = draft.screens[index].route;
    delete route.branches;
    if (fieldKey) route.branchOn = fieldKey;
    else delete route.branchOn;
  });
}

export function setBranch(document: Document, screenKey: string, optionId: string, next: string | null): Document {
  const index = screenIndex(document, screenKey);
  if (index < 0) return document;
  return produce(document, (draft) => {
    const route = draft.screens[index].route;
    const branches = (route.branches ?? []).filter((branch) => branch.optionId !== optionId);
    if (next) branches.push({ optionId, next });
    if (branches.length > 0) route.branches = branches;
    else delete route.branches;
  });
}

export function setNextScreen(document: Document, screenKey: string, next: string | null): Document {
  const index = screenIndex(document, screenKey);
  if (index < 0) return document;
  return produce(document, (draft) => {
    const route = draft.screens[index].route;
    if (next) route.next = next;
    else delete route.next;
  });
}

export function insertBlock(document: Document, screenKey: string, block: Block, index?: number): Document {
  const s = screenIndex(document, screenKey);
  if (s < 0) return document;
  return produce(document, (draft) => {
    const blocks = draft.screens[s].blocks;
    blocks.splice(index === undefined ? blocks.length : Math.max(0, Math.min(index, blocks.length)), 0, block);
  });
}

export function moveBlock(document: Document, blockKey: string, toScreenKey: string, toIndex: number): Document {
  const at = locateBlock(document, blockKey);
  const target = screenIndex(document, toScreenKey);
  if (!at || target < 0) return document;
  if (at.screen === target) {
    const blocks = moved(document.screens[target].blocks, at.block, toIndex);
    if (blocks === document.screens[target].blocks) return document;
    return produce(document, (draft) => {
      draft.screens[target].blocks = blocks as Draft<Block>[];
    });
  }
  return produce(document, (draft) => {
    const [block] = draft.screens[at.screen].blocks.splice(at.block, 1);
    const blocks = draft.screens[target].blocks;
    blocks.splice(Math.max(0, Math.min(toIndex, blocks.length)), 0, block);
  });
}

export function removeBlock(document: Document, blockKey: string): Document {
  const at = locateBlock(document, blockKey);
  if (!at) return document;
  const fieldKey = document.screens[at.screen].blocks[at.block].field?.key;
  return produce(document, (draft) => {
    draft.screens[at.screen].blocks.splice(at.block, 1);
    if (fieldKey) dropFieldReferences(draft, fieldKey);
  });
}

export function updateField(document: Document, blockKey: string, patch: Partial<Omit<Field, "key" | "kind" | "options">>): Document {
  return withField(document, blockKey, (field) => {
    for (const [name, value] of Object.entries(patch) as [keyof Field, unknown][]) {
      if (value === undefined || value === "") delete field[name];
      else (field as Record<string, unknown>)[name] = value;
    }
  });
}

export function changeFieldKind(document: Document, blockKey: string, kind: FieldKind, copy: BlockCopy, random?: RandomBytes): Document {
  const block = findBlock(document, blockKey);
  if (!block?.field || block.field.kind === kind) return document;
  const keepsOptions = hasOptions(kind) && hasOptions(block.field.kind);
  const keepsReferences = keepsOptions && isSingleChoice(kind) === isSingleChoice(block.field.kind);
  const fieldKey = block.field.key;
  return withField(document, blockKey, (field, draft) => {
    field.kind = kind;
    delete field.binding;
    delete field.min;
    delete field.max;
    delete field.minDate;
    delete field.maxDate;
    delete field.mimeTypes;
    delete field.pattern;
    delete field.termsUrl;
    if (!keepsOptions) {
      if (hasOptions(kind)) field.options = copy.options.map((title) => createOption(title, random));
      else delete field.options;
    }
    if (!keepsReferences) dropFieldReferences(draft, fieldKey);
  });
}

export function addOption(document: Document, blockKey: string, option: Option): Document {
  return withField(document, blockKey, (field) => {
    field.options = [...(field.options ?? []), option];
  });
}

export function updateOption(document: Document, blockKey: string, optionId: string, patch: Partial<Omit<Option, "id">>): Document {
  return withField(document, blockKey, (field) => {
    const option = field.options?.find((candidate) => candidate.id === optionId);
    if (!option) return;
    for (const [name, value] of Object.entries(patch) as [keyof Option, string | undefined][]) {
      if (name === "description" && !value) delete option.description;
      else if (value !== undefined) option[name] = value;
    }
  });
}

export function moveOption(document: Document, blockKey: string, from: number, to: number): Document {
  const block = findBlock(document, blockKey);
  const options = block?.field?.options;
  if (!options) return document;
  const next = moved(options, from, to);
  if (next === options) return document;
  return withField(document, blockKey, (field) => {
    field.options = next as Draft<Option>[];
  });
}

export function removeOption(document: Document, blockKey: string, optionId: string): Document {
  const block = findBlock(document, blockKey);
  if (!block?.field) return document;
  const fieldKey = block.field.key;
  return withField(document, blockKey, (field, draft) => {
    field.options = (field.options ?? []).filter((option) => option.id !== optionId);
    dropOptionReferences(draft, fieldKey, optionId);
  });
}

export function updateDisplay(document: Document, blockKey: string, patch: Partial<Omit<Display, "kind">>): Document {
  const at = locateBlock(document, blockKey);
  if (!at || !document.screens[at.screen].blocks[at.block].display) return document;
  return produce(document, (draft) => {
    const display = draft.screens[at.screen].blocks[at.block].display;
    if (!display) return;
    for (const [name, value] of Object.entries(patch) as [keyof Display, string | undefined][]) {
      if (!value) delete display[name];
      else (display as Record<string, string>)[name] = value;
    }
  });
}

export function setVisibleIf(document: Document, blockKey: string, condition: Condition | null): Document {
  const at = locateBlock(document, blockKey);
  if (!at) return document;
  return produce(document, (draft) => {
    const block = draft.screens[at.screen].blocks[at.block];
    if (condition) block.visibleIf = condition;
    else delete block.visibleIf;
  });
}

export interface FieldRef {
  field: Field;
  screenKey: string;
  blockKey: string;
}

export function documentFields(document: Document): FieldRef[] {
  return document.screens.flatMap((screen) =>
    screen.blocks.flatMap((block) => (block.field ? [{ field: block.field, screenKey: screen.key, blockKey: block.key }] : [])),
  );
}

export function fieldsBefore(document: Document, blockKey: string): FieldRef[] {
  const at = locateBlock(document, blockKey);
  if (!at) return [];
  const refs: FieldRef[] = [];
  for (let s = 0; s <= at.screen; s++) {
    const screen = document.screens[s];
    const end = s === at.screen ? at.block : screen.blocks.length;
    for (let b = 0; b < end; b++) {
      const field = screen.blocks[b].field;
      if (field) refs.push({ field, screenKey: screen.key, blockKey: screen.blocks[b].key });
    }
  }
  return refs;
}

export function screensAfter(document: Document, screenKey: string): Screen[] {
  const index = screenIndex(document, screenKey);
  return index < 0 ? [] : document.screens.slice(index + 1);
}
