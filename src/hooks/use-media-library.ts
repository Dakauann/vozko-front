"use client";

import { useCallback, useEffect, useState } from "react";

import { isActionError } from "@/app/actions/action-result";
import { listLibraryAction } from "@/app/actions/medias";
import type { Media } from "@/lib/medias/types";

export type MediaLibraryState = { status: "loading" } | { status: "failed" } | { status: "ready"; medias: Media[] };

type Loaded = { attempt: number; state: Exclude<MediaLibraryState, { status: "loading" }> };

export function useMediaLibrary(): MediaLibraryState & { reload: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listLibraryAction().then((result) => {
      if (cancelled) return;
      setLoaded({ attempt, state: isActionError(result) ? { status: "failed" } : { status: "ready", medias: result.data } });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  const state: MediaLibraryState = loaded?.attempt === attempt ? loaded.state : { status: "loading" };

  return { ...state, reload };
}
