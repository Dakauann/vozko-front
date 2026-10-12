export function localStore(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function parseStoredSize(raw: string | null): number | null {
  if (!raw || !/^\d+(\.\d+)?$/.test(raw.trim())) return null;
  const size = Number(raw);
  return size > 0 ? size : null;
}

export function readStoredSize(storage: Pick<Storage, "getItem"> | null, key: string): number | null {
  try {
    return parseStoredSize(storage?.getItem(key) ?? null);
  } catch {
    return null;
  }
}

export function writeStoredSize(storage: Pick<Storage, "setItem"> | null, key: string, size: number): void {
  try {
    storage?.setItem(key, String(size));
  } catch {
    return;
  }
}
