"use client";

import { useCallback, useState } from "react";

import { uploadMediaAction } from "@/app/actions/medias";
import type { Media } from "@/lib/medias/types";
import { videoCanvasSize } from "@/lib/studio/document";
import { LOTTIE_MEDIA_TYPE, type LottieFileFault } from "@/lib/studio/lottie/lottie-file";
import type { LottieGap } from "@/lib/studio/lottie/lottie-gaps";
import { importLottieBytes, lottieClip, lottieName, type LottieImport, type LottieImportOptions } from "@/lib/studio/lottie/lottie-import";

import { useVideoEditor } from "./editor-context";
import { lottieSource } from "./lottie-files";

export type LottieRefusal = { fault: LottieFileFault } | { gaps: LottieGap[] };

interface LottieImporter {
  busy: boolean;
  refusal: LottieRefusal | null;
  dismiss: () => void;
  importFile: (file: File) => Promise<boolean>;
  insertMedia: (media: Pick<Media, "id" | "description">) => Promise<boolean>;
}

function refusalOf(result: Exclude<LottieImport, { ok: true }>): LottieRefusal {
  return "gaps" in result ? { gaps: result.gaps } : { fault: result.fault };
}

export function useLottieImport(): LottieImporter {
  const { store, view, commands, assets } = useVideoEditor();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<LottieRefusal | null>(null);

  const options = useCallback((name: string): LottieImportOptions => ({ canvas: videoCanvasSize(store.getState().document), atMs: view.getState().playheadMs, name }), [store, view]);

  const place = useCallback(
    (result: LottieImport): boolean => {
      if (!result.ok) {
        setRefusal(refusalOf(result));
        return false;
      }
      setRefusal(null);
      return commands.insertLibrary([result.clip]);
    },
    [commands],
  );

  const importFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const name = lottieName(file.name);
        const result = await importLottieBytes(new Uint8Array(await file.arrayBuffer()), options(name));
        if (!result.ok) return place(result);
        const form = new FormData();
        form.append("media", file);
        form.append("mediaType", LOTTIE_MEDIA_TYPE);
        form.append("description", name);
        const uploaded = await uploadMediaAction(form);
        if (uploaded.error || !uploaded.mediaId) {
          commands.notify("uploadFailed", "error");
          return false;
        }
        await assets.loadLibrary();
        return place(result);
      } finally {
        setBusy(false);
      }
    },
    [options, place, commands, assets],
  );

  const insertMedia = useCallback(
    async (media: Pick<Media, "id" | "description">) => {
      setBusy(true);
      try {
        const source = await lottieSource(media);
        return place(source.animation ? lottieClip(source.animation, options(source.name)) : { ok: false, fault: source.fault ?? "notLottie" });
      } finally {
        setBusy(false);
      }
    },
    [options, place],
  );

  return { busy, refusal, dismiss: () => setRefusal(null), importFile, insertMedia };
}
