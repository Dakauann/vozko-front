"use client";

import { useEffect, useState } from "react";

import { lutAtlas, parseCube, type CubeFault, type LutAtlas } from "@/lib/studio/cube-lut";
import { firstUnreadableLut, type LutUse } from "@/lib/studio/lut-uses";

import { loadMediaFile } from "./media-files";

export class LutUnavailableError extends Error {
  constructor(
    readonly assetId: string,
    readonly fault: CubeFault | "missing",
  ) {
    super(`studio LUT ${assetId} could not be read: ${fault}`);
  }
}

export class LutBlockedError extends Error {
  constructor(readonly use: LutUse) {
    super(`studio LUT ${use.assetId} could not be read`);
  }
}

const atlases = new Map<string, Promise<LutAtlas>>();

export function loadLutAtlas(assetId: string): Promise<LutAtlas> {
  const cached = atlases.get(assetId);
  if (cached) return cached;
  const loading = loadMediaFile(assetId).then(async (file) => {
    if (!file) throw new LutUnavailableError(assetId, "missing");
    const parsed = parseCube(await file.blob.text());
    if (!parsed.ok) throw new LutUnavailableError(assetId, parsed.fault);
    return lutAtlas(parsed.lut);
  });
  atlases.set(assetId, loading);
  loading.catch(() => atlases.delete(assetId));
  return loading;
}

export function lutReadable(assetId: string): Promise<boolean> {
  return loadLutAtlas(assetId).then(
    () => true,
    () => false,
  );
}

export async function assertLutsReadable(uses: readonly LutUse[]): Promise<void> {
  const blocked = await firstUnreadableLut(uses, lutReadable);
  if (blocked) throw new LutBlockedError(blocked);
}

export async function readableLuts(operations: readonly { lut_media_id?: string }[]): Promise<ReadonlySet<string>> {
  const ids = [...new Set(operations.flatMap((op) => (op.lut_media_id ? [op.lut_media_id] : [])))];
  const read = await Promise.all(ids.map(lutReadable));
  return new Set(ids.filter((_, i) => read[i]));
}

export type LoadedLut = { status: "none" } | { status: "loading" } | { status: "ready"; atlas: LutAtlas } | { status: "failed"; error: Error };

export function konvaLut(loaded: LoadedLut): LutAtlas | "missing" | null {
  if (loaded.status === "ready") return loaded.atlas;
  return loaded.status === "failed" ? "missing" : null;
}

export function useLoadedLut(assetId: string | null): LoadedLut {
  const [state, setState] = useState<{ key: string | null; value: LoadedLut }>({ key: null, value: { status: "loading" } });

  useEffect(() => {
    if (assetId === null) return;
    let cancelled = false;
    loadLutAtlas(assetId).then(
      (atlas) => !cancelled && setState({ key: assetId, value: { status: "ready", atlas } }),
      (error: unknown) => !cancelled && setState({ key: assetId, value: { status: "failed", error: error instanceof Error ? error : new LutUnavailableError(assetId, "missing") } }),
    );
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (assetId === null) return { status: "none" };
  return state.key === assetId ? state.value : { status: "loading" };
}
