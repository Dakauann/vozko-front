import { produce } from "immer";

import type { VideoDocument } from "./document";
import { timelineAt, validPath, withTimelineAt, type GroupPath } from "./group-scope";
import type { StudioEditorState, StudioEditorStore } from "./store";

export interface ScopeSource {
  path: () => GroupPath;
  subscribe: (listener: () => void) => () => void;
}

type State = StudioEditorState<VideoDocument>;

function samePath(a: GroupPath, b: GroupPath): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function scopedStore(root: StudioEditorStore<VideoDocument>, scope: ScopeSource): StudioEditorStore<VideoDocument> {
  const pathIn = (doc: VideoDocument) => validPath(doc, scope.path());
  const within = (operation: (doc: VideoDocument) => VideoDocument) => (doc: VideoDocument) => withTimelineAt(doc, pathIn(doc), operation);
  const actions: Pick<State, "apply" | "applyAs" | "update" | "reset"> = {
    apply: (operation, nextSelection) => root.getState().apply(within(operation), nextSelection),
    applyAs: (group, operation) => root.getState().applyAs(group, within(operation)),
    update: (recipe, nextSelection) => root.getState().apply(within((doc) => produce(doc, recipe)), nextSelection),
    reset: (document) => {
      const state = root.getState();
      if (pathIn(state.document).length === 0) state.reset(document);
      else state.apply(within(() => document));
    },
  };
  let source: State | null = null;
  let sourcePath: GroupPath = [];
  let viewSource: VideoDocument | null = null;
  let view: VideoDocument | null = null;
  let derived: State | null = null;
  const derive = (): State => {
    const state = root.getState();
    const path = pathIn(state.document);
    if (derived && state === source && samePath(path, sourcePath)) return derived;
    if (state.document !== viewSource || !samePath(path, sourcePath) || !view) {
      viewSource = state.document;
      view = path.length === 0 ? state.document : (timelineAt(state.document, path) ?? state.document);
    }
    source = state;
    sourcePath = path;
    derived = { ...state, document: view, ...actions };
    return derived;
  };
  const listeners = new Set<(state: State, previous: State) => void>();
  let last: State | null = null;
  const notify = () => {
    const before = last ?? derive();
    const next = derive();
    last = next;
    if (next !== before) for (const listener of listeners) listener(next, before);
  };
  let detach: (() => void) | null = null;
  return {
    getState: derive,
    getInitialState: derive,
    setState: () => {
      throw new Error("the scoped editor store is written through its actions");
    },
    subscribe: (listener) => {
      if (listeners.size === 0) {
        last = derive();
        const stopRoot = root.subscribe(notify);
        const stopScope = scope.subscribe(notify);
        detach = () => {
          stopRoot();
          stopScope();
        };
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        detach?.();
        detach = null;
      };
    },
  };
}
