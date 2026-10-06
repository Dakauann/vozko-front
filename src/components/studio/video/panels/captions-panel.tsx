"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { fetchMediaFileAction } from "@/app/actions/medias";
import Button from "@/components/elevated-design/button";
import { ChatText } from "@/components/icons";
import { useMediaGeneration, type MediaGenerationResult } from "@/hooks/use-media-generation";
import { captionsFromVtt } from "@/lib/studio/captions";
import type { Clip, Track } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import type { SourceWindow } from "@/lib/studio/vtt";

import { useVideoEditor } from "../editor-context";
import { ClipPicker } from "./clip-picker";
import { JobStatus } from "./job-status";

function speaks(clip: Clip, track: Track): boolean {
  return Boolean(clip.assetId) && (clip.type === "audio" || (clip.type === "video" && track.kind === "visual"));
}

export function CaptionsPanel() {
  const t = useTranslations("studio.video.captions");
  const { store, commands } = useVideoEditor();
  const [clipId, setClipId] = useState<string | null>(null);
  const sourceWindow = useRef<SourceWindow | null>(null);

  const onDone = useCallback(
    async (result: MediaGenerationResult) => {
      const source = sourceWindow.current;
      if (!source) return;
      const { data } = await fetchMediaFileAction(result.mediaId);
      if (!data) {
        commands.notify("captionsUnreadable", "error");
        return;
      }
      const outcome = captionsFromVtt(store.getState().document, await data.blob.text(), source, t("trackName"));
      if (outcome.status === "empty") commands.notify("captionsEmpty");
      else if (outcome.status === "no_room") commands.notify("noRoom", "error");
      else store.getState().apply(() => outcome.document);
    },
    [commands, store, t],
  );

  const generation = useMediaGeneration({ onDone: (result) => void onDone(result) });
  const busy = generation.status === "generating";

  const start = () => {
    const found = clipId ? findClip(store.getState().document, clipId) : null;
    if (!found?.clip.assetId) return;
    sourceWindow.current = { startMs: found.clip.startMs, trimInMs: found.clip.trimInMs, durationMs: found.clip.durationMs };
    void generation.start({ kind: "captions", sourceMediaId: found.clip.assetId });
  };

  return (
    <div className="space-y-3 p-3">
      <p className="text-xs text-muted-foreground">{t("description")}</p>
      <ClipPicker label={t("source")} accepts={speaks} value={clipId} onChange={setClipId} disabled={busy} />
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        title={t("generate")}
        icon={<ChatText className="h-3.5 w-3.5" />}
        iconVisible
        disabled={busy || !clipId}
        onClick={start}
      />
      <JobStatus kind="captions" status={generation.status} settling={generation.settling} error={generation.error} />
      {generation.status === "done" ? <p className="text-xs text-muted-foreground">{t("done")}</p> : null}
      <p className="text-2xs text-muted-foreground">{t("styleHint")}</p>
    </div>
  );
}
