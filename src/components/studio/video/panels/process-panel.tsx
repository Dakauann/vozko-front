"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Sparkle, Waveform } from "@/components/icons";
import { useMediaGeneration, type MediaGenerationResult } from "@/hooks/use-media-generation";
import type { Clip, Track } from "@/lib/studio/document";
import { findClip, replaceClipAsset } from "@/lib/studio/timeline";

import { useVideoEditor } from "../editor-context";
import { ClipPicker } from "./clip-picker";
import { JobStatus } from "./job-status";

type ProcessKind = "denoise" | "cutout";

const ACCEPTS: Record<ProcessKind, (clip: Clip, track: Track) => boolean> = {
  denoise: (clip) => clip.type === "audio" && Boolean(clip.assetId),
  cutout: (clip) => clip.type === "image" && Boolean(clip.assetId),
};

function ProcessSection({ kind }: { kind: ProcessKind }) {
  const t = useTranslations(`studio.video.process.${kind}`);
  const { store, commands, assets } = useVideoEditor();
  const [clipId, setClipId] = useState<string | null>(null);
  const target = useRef<string | null>(null);

  const onDone = useCallback(
    (result: MediaGenerationResult) => {
      void assets.loadLibrary();
      const id = target.current;
      const { document, apply } = store.getState();
      if (!id || !findClip(document, id)) {
        commands.notify("clipGone", "error");
        return;
      }
      const next = replaceClipAsset(document, id, result.mediaId);
      if (next === document) commands.notify("clipLocked", "error");
      else apply(() => next, [id]);
    },
    [assets, commands, store],
  );

  const generation = useMediaGeneration({ onDone });
  const busy = generation.status === "generating";

  const start = () => {
    const found = clipId ? findClip(store.getState().document, clipId) : null;
    if (!found?.clip.assetId) return;
    target.current = found.clip.id;
    void generation.start({ kind, sourceMediaId: found.clip.assetId });
  };

  return (
    <section className="space-y-3 border-b border-border p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {kind === "denoise" ? <Waveform className="h-4 w-4" aria-hidden /> : <Sparkle className="h-4 w-4" aria-hidden />}
        {t("title")}
      </h3>
      <p className="text-xs text-muted-foreground">{t("description")}</p>
      <ClipPicker label={t("source")} accepts={ACCEPTS[kind]} value={clipId} onChange={setClipId} disabled={busy} />
      <Button variant="outline" size="sm" className="w-full" title={t("run")} disabled={busy || !clipId} onClick={start} />
      <JobStatus kind={kind} status={generation.status} settling={generation.settling} error={generation.error} />
      {generation.status === "done" ? <p className="text-xs text-muted-foreground">{t("done")}</p> : null}
    </section>
  );
}

export function ProcessPanel() {
  return (
    <div>
      <ProcessSection kind="denoise" />
      <ProcessSection kind="cutout" />
    </div>
  );
}
