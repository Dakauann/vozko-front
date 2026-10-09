import { useCallback, useSyncExternalStore } from "react";

const REMEMBERED_TRUNK_KEY = "dialer:trunk";

const rememberedInPage = new Map<string, string>();
const rememberedListeners = new Set<() => void>();

export function pickTrunk<T extends { id: string }>(dialable: readonly T[], chosenId: string | null, rememberedId: string | null): T | null {
  return (
    dialable.find((trunk) => trunk.id === chosenId) ??
    dialable.find((trunk) => trunk.id === rememberedId) ??
    dialable[0] ??
    null
  );
}

function rememberedKey(workspaceId: string): string {
  return `${REMEMBERED_TRUNK_KEY}:${workspaceId}`;
}

export function readRememberedTrunk(workspaceId: string): string | null {
  const inPage = rememberedInPage.get(workspaceId);
  if (inPage !== undefined) return inPage;
  try {
    return window.localStorage.getItem(rememberedKey(workspaceId));
  } catch {
    return null;
  }
}

export function rememberTrunk(workspaceId: string, trunkId: string): void {
  try {
    window.localStorage.setItem(rememberedKey(workspaceId), trunkId);
    rememberedInPage.delete(workspaceId);
  } catch {
    rememberedInPage.set(workspaceId, trunkId);
  }
  rememberedListeners.forEach((listener) => listener());
}

function subscribeRemembered(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(`${REMEMBERED_TRUNK_KEY}:`)) listener();
  };
  rememberedListeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    rememberedListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useRememberedTrunk(workspaceId: string): string | null {
  const read = useCallback(() => (workspaceId ? readRememberedTrunk(workspaceId) : null), [workspaceId]);
  return useSyncExternalStore(subscribeRemembered, read, () => null);
}
