import { createStore, type StoreApi } from "zustand/vanilla";

import { isActionError, type ActionResult } from "@/app/actions/action-result";
import { createAnimationPresetAction, deleteAnimationPresetAction, listAnimationPresetsAction, renameAnimationPresetAction, type PresetInput } from "@/app/actions/studio-presets";
import { captureAnimation, PRESET_LIMITS, type AnimationPreset, type CaptureRefusal } from "@/lib/studio/animation-presets";
import type { VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";

export interface PresetApi {
  list: () => Promise<ActionResult<{ items: AnimationPreset[] }>>;
  create: (input: PresetInput) => Promise<ActionResult<AnimationPreset>>;
  rename: (id: string, change: { name?: string; description?: string }) => Promise<ActionResult<AnimationPreset>>;
  remove: (id: string) => Promise<ActionResult<true>>;
}

interface PresetLibraryState {
  status: "idle" | "loading" | "ready" | "failed";
  presets: AnimationPreset[];
}

export type SaveRefusal = CaptureRefusal | "missing" | "name" | "failed";

type SaveResult = { ok: true; preset: AnimationPreset; skipped: string[] } | { ok: false; reason: SaveRefusal; message?: string };

interface PresetLibrary {
  store: StoreApi<PresetLibraryState>;
  load: (force?: boolean) => Promise<AnimationPreset[] | null>;
  find: (id: string) => AnimationPreset | undefined;
  save: (doc: VideoDocument, clipId: string, name: string, description?: string) => Promise<SaveResult>;
  rename: (id: string, name: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
}

const DEFAULT_API: PresetApi = {
  list: listAnimationPresetsAction,
  create: createAnimationPresetAction,
  rename: renameAnimationPresetAction,
  remove: deleteAnimationPresetAction,
};

export function cleanPresetName(name: string): string | null {
  const clean = name.trim().replace(/\s+/g, " ");
  return clean !== "" && [...clean].length <= PRESET_LIMITS.nameRunes ? clean : null;
}

export function createPresetLibrary(api: PresetApi = DEFAULT_API): PresetLibrary {
  const store = createStore<PresetLibraryState>()(() => ({ status: "idle", presets: [] }));
  let loading: Promise<AnimationPreset[] | null> | null = null;
  const load = (force = false) => {
    if (loading && !force) return loading;
    if (!force && store.getState().status === "ready") return Promise.resolve(store.getState().presets);
    store.setState({ status: "loading" });
    loading = api.list().then((result) => {
      loading = null;
      if (isActionError(result)) {
        store.setState({ status: "failed" });
        return null;
      }
      store.setState({ status: "ready", presets: result.data.items });
      return result.data.items;
    });
    return loading;
  };
  const replace = (preset: AnimationPreset) => {
    const others = store.getState().presets.filter((entry) => entry.id !== preset.id);
    const builtIns = others.filter((entry) => entry.builtIn);
    store.setState({ presets: [...builtIns, preset, ...others.filter((entry) => !entry.builtIn)] });
  };
  return {
    store,
    load,
    find: (id) => store.getState().presets.find((preset) => preset.id === id),
    save: async (doc, clipId, name, description) => {
      const found = findClip(doc, clipId);
      if (!found) return { ok: false, reason: "missing" };
      const clean = cleanPresetName(name);
      if (!clean) return { ok: false, reason: "name" };
      const captured = captureAnimation(found.clip);
      if (!captured.ok) return { ok: false, reason: captured.reason };
      const note = description?.trim().slice(0, PRESET_LIMITS.descriptionRunes);
      const result = await api.create({ name: clean, ...(note ? { description: note } : {}), animation: captured.animation });
      if (isActionError(result)) return { ok: false, reason: "failed", message: result.error };
      replace(result.data);
      return { ok: true, preset: result.data, skipped: captured.skipped };
    },
    rename: async (id, name) => {
      const clean = cleanPresetName(name);
      if (!clean) return false;
      const result = await api.rename(id, { name: clean });
      if (isActionError(result)) return false;
      store.setState({ presets: store.getState().presets.map((preset) => (preset.id === id ? result.data : preset)) });
      return true;
    },
    remove: async (id) => {
      const result = await api.remove(id);
      if (isActionError(result)) return false;
      store.setState({ presets: store.getState().presets.filter((preset) => preset.id !== id) });
      return true;
    },
  };
}

export const presetLibrary = createPresetLibrary();
