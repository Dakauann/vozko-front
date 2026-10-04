"use client";

import { useEffect, useState } from "react";

import { isActionError } from "@/app/actions/action-result";
import { listImageModelsAction } from "@/app/actions/image-generation";
import type { ImageModel } from "@/lib/image-generation/types";

export type ImageModelsState = { status: "loading" } | { status: "failed" } | { status: "ready"; models: ImageModel[] };

export function useImageModels(): ImageModelsState {
  const [state, setState] = useState<ImageModelsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void listImageModelsAction().then((result) => {
      if (cancelled) return;
      if (isActionError(result) || result.data.length === 0) {
        setState({ status: "failed" });
        return;
      }
      setState({ status: "ready", models: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
