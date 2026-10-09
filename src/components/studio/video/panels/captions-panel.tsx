"use client";

import { useMemo, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ChatText, CircleNotch, UploadSimple } from "@/components/icons";
import { canStart } from "@/lib/media-generation/limits";
import { captionWindow, isCaptionMedia } from "@/lib/studio/captions";
import { STUDIO_LIMITS } from "@/lib/studio/document";
import { CLIP_JOB_SOURCES } from "@/lib/studio/job-sources";
import { findClip } from "@/lib/studio/timeline";

import { useAssetState, useVideoEditor } from "../editor-context";
import { useClipPick } from "../drafts";
import { placeCaptionText, readCaptions, type CaptionRefusal } from "../job-placement";
import { useJobs, useRunningKinds } from "../jobs";
import { ClipPicker } from "./clip-picker";
import { JobList } from "./job-status";

const FILE_PROBLEMS: Record<CaptionRefusal, string> = { unreadable: "captionsFileUnreadable", empty: "captionsEmpty", invalid: "captionsInvalid" };

function CaptionFile() {
  const t = useTranslations("studio.video.captions");
  const format = useFormatter();
  const { store, commands } = useVideoEditor();
  const medias = useAssetState((s) => s.library.medias);
  const [alignId, setAlignId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const files = useMemo(() => medias.filter(isCaptionMedia), [medias]);
  const trackName = t("trackName");

  const place = (text: string | null, unreadable: string) => {
    if (text === null) {
      commands.notify(unreadable, "error");
      return;
    }
    const source = alignId ? findClip(store.getState().document, alignId) : null;
    if (alignId && !source) {
      commands.notify("clipGone", "error");
      return;
    }
    const refusal = placeCaptionText(text, captionWindow(source?.clip ?? null), { store, captionTrackName: trackName });
    if (refusal) commands.notify(FILE_PROBLEMS[refusal], "error");
    else commands.notify("captionsPlaced");
  };

  const read = async (load: () => Promise<string | null>, unreadable: string) => {
    setBusy(true);
    const text = await load().catch(() => null);
    setBusy(false);
    place(text, unreadable);
  };

  const importFile = (file: File) => {
    if (file.size > STUDIO_LIMITS.maxDocumentBytes) {
      commands.notify("captionsInvalid", "error");
      return;
    }
    void read(() => file.text(), "captionsFileUnreadable");
  };

  return (
    <section className="space-y-3 border-t border-border pt-3">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{t("fileTitle")}</h3>
      <p className="text-xs text-muted-foreground">{t("fileDescription")}</p>
      <ClipPicker label={t("alignTo")} noneLabel={t("alignStart")} accepts={CLIP_JOB_SOURCES.captions} value={alignId} onChange={setAlignId} />
      <input
        ref={input}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) importFile(file);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        title={t("importFile")}
        icon={busy ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <UploadSimple className="h-3.5 w-3.5" />}
        iconVisible
        disabled={busy}
        onClick={() => input.current?.click()}
      />
      {files.length > 0 ? (
        <div className="space-y-1.5">
          <span className="block text-2xs text-muted-foreground">{t("libraryFiles")}</span>
          <ul className="space-y-1">
            {files.map((media) => {
              const name = media.description || trackName;
              const when = format.dateTime(new Date(media.createdAt), { dateStyle: "short", timeStyle: "short" });
              return (
                <li key={media.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={name}>
                    {name}
                    <span className="ml-1.5 text-2xs text-muted-foreground">{when}</span>
                  </span>
                  <Button variant="ghost" size="sm" title={t("place")} aria-label={t("placeFile", { name, when })} disabled={busy} onClick={() => void read(() => readCaptions(media.id), "captionsUnreadable")} />
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function CaptionsPanel() {
  const t = useTranslations("studio.video.captions");
  const { store, commands } = useVideoEditor();
  const [clipId, setClipId] = useClipPick("captions");
  const jobs = useJobs("captions");
  const blocked = !canStart("captions", useRunningKinds());

  const start = () => {
    const found = clipId ? findClip(store.getState().document, clipId) : null;
    if (!found?.clip.assetId) return;
    const { clip } = found;
    void commands.startJob("captions", { kind: "captions", sourceMediaId: clip.assetId! }, { clipId: clip.id, window: captionWindow(clip) });
  };

  return (
    <div className="space-y-3 p-3">
      <p className="text-xs text-muted-foreground">{t("description")}</p>
      <ClipPicker label={t("source")} accepts={CLIP_JOB_SOURCES.captions} value={clipId} onChange={setClipId} />
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        title={t("generate")}
        icon={<ChatText className="h-3.5 w-3.5" />}
        iconVisible
        disabled={blocked || !clipId}
        onClick={start}
      />
      <JobList kind="captions" jobs={jobs} blocked={blocked} />
      <CaptionFile />
      <p className="text-2xs text-muted-foreground">{t("styleHint")}</p>
    </div>
  );
}
