import { createStudioStore, type StudioEditorStore } from "@/lib/studio/store";

import type { Document } from "./types";

export type FormBuilderStore = StudioEditorStore<Document>;

export type BuilderSelection = { kind: "screen"; key: string } | { kind: "block"; key: string } | null;

const SCREEN_PREFIX = "screen:";
const BLOCK_PREFIX = "block:";

export function createFormBuilderStore(document: Document): FormBuilderStore {
  return createStudioStore<Document>(document);
}

export function screenSelection(key: string): string[] {
  return [SCREEN_PREFIX + key];
}

export function blockSelection(key: string): string[] {
  return [BLOCK_PREFIX + key];
}

export function readSelection(ids: readonly string[]): BuilderSelection {
  const id = ids[0];
  if (!id) return null;
  if (id.startsWith(SCREEN_PREFIX)) return { kind: "screen", key: id.slice(SCREEN_PREFIX.length) };
  if (id.startsWith(BLOCK_PREFIX)) return { kind: "block", key: id.slice(BLOCK_PREFIX.length) };
  return null;
}

export function typingGroup(target: string, property: string): string {
  return `${target}.${property}`;
}
