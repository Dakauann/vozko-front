"use client";

import { createStore, type StoreApi } from "zustand/vanilla";

import { isActionError } from "@/app/actions/action-result";
import { getMediaAction, listLibraryAction } from "@/app/actions/medias";
import type { Media } from "@/lib/medias/types";
import { clipTypeForMedia } from "@/lib/studio/media-clips";

export type AssetStatus = "loading" | "ready" | "missing";

export interface AssetEntry {
  status: AssetStatus;
  media: Media | null;
  durationMs?: number;
}

export interface LibraryState {
  status: "loading" | "ready" | "failed";
  medias: Media[];
}

export interface AssetCatalogState {
  assets: Record<string, AssetEntry>;
  library: LibraryState;
}

export interface AssetCatalog {
  store: StoreApi<AssetCatalogState>;
  loadLibrary: () => Promise<void>;
  ensure: (assetId: string) => Promise<AssetEntry>;
  remember: (media: Media) => void;
  sourceDuration: (assetId: string) => Promise<number | undefined>;
}

const PROBE_TIMEOUT_MS = 15_000;

function probeDuration(url: string, kind: "audio" | "video"): Promise<number | undefined> {
  return new Promise((resolve) => {
    const element = document.createElement(kind);
    const timer = setTimeout(() => finish(undefined), PROBE_TIMEOUT_MS);
    function finish(value: number | undefined) {
      clearTimeout(timer);
      element.removeAttribute("src");
      element.load();
      resolve(value);
    }
    element.preload = "metadata";
    element.muted = true;
    element.onloadedmetadata = () => finish(Number.isFinite(element.duration) && element.duration > 0 ? Math.round(element.duration * 1000) : undefined);
    element.onerror = () => finish(undefined);
    element.src = url;
  });
}

export function createAssetCatalog(): AssetCatalog {
  const store = createStore<AssetCatalogState>()(() => ({ assets: {}, library: { status: "loading", medias: [] } }));
  const pending = new Map<string, Promise<AssetEntry>>();
  const durations = new Map<string, Promise<number | undefined>>();

  const put = (assetId: string, entry: AssetEntry) => store.setState((state) => ({ assets: { ...state.assets, [assetId]: { ...state.assets[assetId], ...entry } } }));

  const remember = (media: Media) => {
    if (store.getState().assets[media.id]?.media) return;
    put(media.id, { status: "ready", media });
  };

  const loadLibrary = async () => {
    store.setState((state) => ({ library: { ...state.library, status: state.library.medias.length > 0 ? "ready" : "loading" } }));
    const result = await listLibraryAction();
    if (isActionError(result)) {
      store.setState((state) => ({ library: { ...state.library, status: "failed" } }));
      return;
    }
    for (const media of result.data) remember(media);
    store.setState({ library: { status: "ready", medias: result.data } });
  };

  const ensure = (assetId: string): Promise<AssetEntry> => {
    const known = store.getState().assets[assetId];
    if (known && known.status !== "loading") return Promise.resolve(known);
    const running = pending.get(assetId);
    if (running) return running;
    put(assetId, { status: "loading", media: null });
    const loading = getMediaAction(assetId).then((media): AssetEntry => {
      const entry: AssetEntry = media ? { status: "ready", media } : { status: "missing", media: null };
      put(assetId, entry);
      pending.delete(assetId);
      return entry;
    });
    pending.set(assetId, loading);
    return loading;
  };

  const sourceDuration = (assetId: string): Promise<number | undefined> => {
    const known = store.getState().assets[assetId]?.durationMs;
    if (known !== undefined) return Promise.resolve(known);
    const running = durations.get(assetId);
    if (running) return running;
    const probing = ensure(assetId).then(async (entry) => {
      const type = entry.media ? clipTypeForMedia(entry.media.type) : null;
      if (!entry.media || (type !== "audio" && type !== "video")) return undefined;
      const durationMs = await probeDuration(entry.media.url, type);
      if (durationMs !== undefined) put(assetId, { ...store.getState().assets[assetId], durationMs });
      else durations.delete(assetId);
      return durationMs;
    });
    durations.set(assetId, probing);
    return probing;
  };

  return { store, loadLibrary, ensure, remember, sourceDuration };
}
