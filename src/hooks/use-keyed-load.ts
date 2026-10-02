"use client";

import { useCallback, useEffect, useState } from "react";

export function useKeyedLoad<T>(key: string | null, load: () => Promise<T>) {
  const [token, setToken] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; value: T } | null>(null);
  const fullKey = key === null ? null : `${key}#${token}`;

  useEffect(() => {
    if (fullKey === null) return;
    let cancelled = false;
    void load().then((value) => {
      if (!cancelled) setLoaded({ key: fullKey, value });
    });
    return () => {
      cancelled = true;
    };
  }, [fullKey, load]);

  const fresh = loaded !== null && loaded.key === fullKey;
  const reload = useCallback(() => setToken((current) => current + 1), []);
  const update = useCallback(
    (change: (value: T) => T) => setLoaded((current) => (current ? { key: current.key, value: change(current.value) } : current)),
    [],
  );

  return {
    value: fresh ? loaded.value : null,
    latest: loaded?.value ?? null,
    loading: fullKey !== null && !fresh,
    reload,
    update,
  };
}
