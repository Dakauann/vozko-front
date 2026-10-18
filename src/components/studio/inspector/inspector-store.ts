import {
  activeGroup,
  isInspectorGroup,
  parseOpenSections,
  presentGroups,
  rememberSection,
  type InspectorGroupId,
} from "@/lib/studio/inspector-layout";

import { browserStorage, type StudioStorage } from "../browser-storage";

;

export type InspectorScope = "video" | "image";

type InspectorStorage = StudioStorage;

interface Entry {
  group: InspectorGroupId;
  matched: boolean;
}

export interface InspectorStore {
  readonly baseId: string;
  subscribe: (listener: () => void) => () => void;
  isOpen: (id: string, fallback: boolean) => boolean;
  setOpen: (id: string, open: boolean) => void;
  register: (key: string, group: InspectorGroupId) => void;
  unregister: (key: string) => void;
  setMatched: (key: string, matched: boolean) => void;
  groups: () => readonly InspectorGroupId[];
  activeGroup: () => InspectorGroupId | null;
  selectGroup: (group: InspectorGroupId) => void;
  query: () => string;
  setQuery: (query: string) => void;
  sectionCount: () => number;
  matchCount: () => number;
}

export function createInspectorStore(scope: InspectorScope, baseId: string, storage: InspectorStorage = browserStorage): InspectorStore {
  const sectionsKey = `studio-inspector:${scope}:sections`;
  const tabKey = `studio-inspector:${scope}:tab`;
  const storedTab = storage.read(tabKey);
  let open = parseOpenSections(storage.read(sectionsKey));
  let preferred: InspectorGroupId | null = isInspectorGroup(storedTab) ? storedTab : null;
  let query = "";
  let groups: readonly InspectorGroupId[] = [];
  let matches = 0;
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((listener) => listener());
  const refresh = () => {
    const next = presentGroups(Array.from(entries.values(), (entry) => entry.group));
    if (next.join() !== groups.join()) groups = next;
    matches = Array.from(entries.values()).filter((entry) => entry.matched).length;
    emit();
  };

  return {
    baseId,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isOpen: (id, fallback) => open[id] ?? fallback,
    setOpen(id, value) {
      open = rememberSection(open, id, value);
      storage.write(sectionsKey, JSON.stringify(open));
      emit();
    },
    register(key, group) {
      entries.set(key, { group, matched: entries.get(key)?.matched ?? true });
      refresh();
    },
    unregister(key) {
      if (entries.delete(key)) refresh();
    },
    setMatched(key, matched) {
      const entry = entries.get(key);
      if (!entry || entry.matched === matched) return;
      entries.set(key, { ...entry, matched });
      refresh();
    },
    groups: () => groups,
    activeGroup: () => activeGroup(groups, preferred),
    selectGroup(group) {
      preferred = group;
      storage.write(tabKey, group);
      emit();
    },
    query: () => query,
    setQuery(next) {
      if (next === query) return;
      query = next;
      emit();
    },
    sectionCount: () => entries.size,
    matchCount: () => matches,
  };
}
