"use client";

import { useEffect, useState } from "react";

import { isActionError } from "@/app/actions/action-result";
import { listMediaModelsAction } from "@/app/actions/media-generation";
import type { MediaModel, ModelKind } from "@/lib/media-generation/types";

export type MediaModelsState = { status: "loading" } | { status: "failed" } | { status: "ready"; models: MediaModel[] };

type Loaded = { kind: ModelKind; state: Exclude<MediaModelsState, { status: "loading" }> };

export function useMediaModels(kind: ModelKind): MediaModelsState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMediaModelsAction(kind).then((result) => {
      if (cancelled) return;
      const failed = isActionError(result) || result.data.length === 0;
      setLoaded({ kind, state: failed ? { status: "failed" } : { status: "ready", models: result.data } });
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return loaded?.kind === kind ? loaded.state : { status: "loading" };
}
