"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { uploadMediaAction } from "@/app/actions/medias";
import { AdImage } from "@/components/advertising/ad-image";
import { ArrowClockwise, CircleNotch, UploadSimple } from "@/components/icons";
import { useMediaLibrary } from "@/hooks/use-media-library";
import { libraryChoices } from "@/lib/advertising/library-media";
import { cn } from "@/lib/utils";

import { ICON_BUTTON_CLASS, Notice, OUTLINE_BUTTON_CLASS } from "./controls";

export const IMAGE_ACCEPT = "image/jpeg,image/png";

export type UploadOutcome = { mediaId: string; url: string } | { error: string | null };

export async function uploadImageFile(file: File): Promise<UploadOutcome> {
  if (!IMAGE_ACCEPT.split(",").includes(file.type)) return { error: null };
  const form = new FormData();
  form.append("media", file);
  form.append("mediaType", "image");
  form.append("description", file.name);
  const result = await uploadMediaAction(form);
  if (result.error || !result.mediaId || !result.mediaUrl) return { error: result.error ?? null };
  return { mediaId: result.mediaId, url: result.mediaUrl };
}

export interface ImageSourcePickerProps {
  onPick: (mediaId: string, url: string) => Promise<boolean>;
  uploadLabel: string;
  compact?: boolean;
}

export function ImageSourcePicker({ onPick, uploadLabel, compact }: ImageSourcePickerProps) {
  const t = useTranslations("studio.image.media");
  const library = useMediaLibrary();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (mediaId: string, url: string) => {
    setBusy(mediaId);
    setError(null);
    const ok = await onPick(mediaId, url);
    setBusy(null);
    if (!ok) setError(t("insertFailed"));
  };

  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    setError(null);
    for (const file of list) {
      setBusy("upload");
      const result = await uploadImageFile(file);
      if ("error" in result) {
        setBusy(null);
        setError(result.error ? t("uploadFailedWith", { reason: result.error }) : t("notImage"));
        return;
      }
      library.reload();
      await pick(result.mediaId, result.url);
    }
  };

  const choices = library.status === "ready" ? libraryChoices(library.medias, "image") : [];

  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept={IMAGE_ACCEPT} multiple={!compact} className="sr-only" aria-label={uploadLabel} onChange={(event) => {
        void upload(event.target.files);
        event.target.value = "";
      }} />
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => input.current?.click()}
        className={cn(OUTLINE_BUTTON_CLASS, "h-8 w-full border-dashed")}
      >
        {busy === "upload" ? <CircleNotch className="h-4 w-4 animate-spin" aria-hidden /> : <UploadSimple className="h-4 w-4" aria-hidden />}
        {busy === "upload" ? t("uploading") : uploadLabel}
      </button>
      <p className="text-2xs text-muted-foreground">{t("uploadHint")}</p>
      {error ? (
        <Notice tone="fault" title={error} />
      ) : null}
      <div className="flex items-center justify-between">
        <h4 className="legend text-muted-foreground">{t("library")}</h4>
        <button type="button" onClick={library.reload} aria-label={t("reload")} title={t("reload")} className={ICON_BUTTON_CLASS}>
          <ArrowClockwise className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {library.status === "loading" ? <p className="text-xs text-muted-foreground">{t("loading")}</p> : null}
      {library.status === "failed" ? (
        <Notice tone="fault" title={t("libraryFailed")} />
      ) : null}
      {library.status === "ready" && choices.length === 0 ? <p className="text-xs text-muted-foreground">{t("empty")}</p> : null}
      {choices.length > 0 ? (
        <ul className={cn("grid gap-1.5", compact ? "max-h-56 grid-cols-4 overflow-y-auto" : "grid-cols-2")} aria-label={t("library")}>
          {choices.map((choice) => (
            <li key={choice.mediaId}>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void pick(choice.mediaId, choice.url)}
                aria-label={t("pick")}
                title={t("pick")}
                className="relative block aspect-square w-full overflow-hidden rounded-[--radius] border border-border bg-card transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <AdImage src={choice.url} />
                {busy === choice.mediaId ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/60">
                    <CircleNotch className="h-4 w-4 animate-spin" aria-hidden />
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
