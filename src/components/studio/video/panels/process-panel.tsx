"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Sparkle, Waveform } from "@/components/icons";
import { canStart } from "@/lib/media-generation/limits";
import { CLIP_JOB_SOURCES } from "@/lib/studio/job-sources";
import { findClip } from "@/lib/studio/timeline";

import { useVideoEditor } from "../editor-context";
import { useClipPick } from "../drafts";
import { useJobs, useRunningKinds } from "../jobs";
import { ClipPicker } from "./clip-picker";
import { JobList } from "./job-status";

type ProcessKind = "denoise" | "cutout";

function ProcessSection({ kind }: { kind: ProcessKind }) {
  const t = useTranslations(`studio.video.process.${kind}`);
  const { store, commands } = useVideoEditor();
  const [clipId, setClipId] = useClipPick(kind);
  const jobs = useJobs(kind);
  const blocked = !canStart(kind, useRunningKinds());

  const start = () => {
    const found = clipId ? findClip(store.getState().document, clipId) : null;
    if (!found?.clip.assetId) return;
    void commands.startJob(kind, { kind, sourceMediaId: found.clip.assetId }, { clipId: found.clip.id });
  };

  return (
    <section className="space-y-3 border-b border-border p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {kind === "denoise" ? <Waveform className="h-4 w-4" aria-hidden /> : <Sparkle className="h-4 w-4" aria-hidden />}
        {t("title")}
      </h3>
      <p className="text-xs text-muted-foreground">{t("description")}</p>
      <ClipPicker label={t("source")} accepts={CLIP_JOB_SOURCES[kind]} value={clipId} onChange={setClipId} />
      <Button variant="outline" size="sm" className="w-full" title={t("run")} disabled={blocked || !clipId} onClick={start} />
      <JobList kind={kind} jobs={jobs} blocked={blocked} />
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
