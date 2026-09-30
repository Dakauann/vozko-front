"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Pause, Play, SpinnerGap, UploadSimple } from "@/components/icons";
import { DEFAULT_HOLD_PRESET, type HoldMusicRef } from "@/lib/call-routing/types";
import { cn } from "@/lib/utils";

import { presetPreviewUrl, usePreviewPlayer, type HoldMusicLibrary } from "./use-hold-music-library";

type Source = "preset" | "upload";

interface HoldMusicPickerProps {
  value: HoldMusicRef;
  onChange: (ref: HoldMusicRef) => void;
  library: HoldMusicLibrary;
}

export function HoldMusicPicker({ value, onChange, library }: HoldMusicPickerProps) {
  const t = useTranslations("callQueues.holdMusic");
  const [source, setSource] = useState<Source>(value.mediaId ? "upload" : "preset");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = usePreviewPlayer();
  const selectedPreset = value.mediaId ? null : value.presetId || DEFAULT_HOLD_PRESET;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const result = await library.upload(file);
    setUploading(false);
    if (result.media) onChange({ mediaId: result.media.id });
    else setUploadError(result.error ?? t("uploadFailed"));
  };

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs font-semibold text-muted-foreground">{t("label")}</legend>
      <div role="tablist" aria-label={t("label")} className="grid grid-cols-2 rounded-[--radius] border border-border p-0.5">
        {(["preset", "upload"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={source === option}
            onClick={() => setSource(option)}
            className={cn(
              "h-8 rounded-[calc(var(--radius)-2px)] text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              source === option ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`sources.${option}`)}
          </button>
        ))}
      </div>

      {library.loading ? (
        <p className="py-3 text-center text-xs text-muted-foreground">{t("loading")}</p>
      ) : source === "preset" ? (
        <div role="radiogroup" aria-label={t("sources.preset")} className="grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
          {library.presets.map((preset) => (
            <MusicRow
              key={preset.id}
              selected={selectedPreset === preset.id}
              onSelect={() => onChange({ presetId: preset.id })}
              title={t.has(`presets.${preset.id}`) ? t(`presets.${preset.id}`) : preset.name}
              detail={t.has(`moods.${preset.mood}`) ? t(`moods.${preset.mood}`) : preset.mood}
              playing={preview.playing === `preset:${preset.id}`}
              loading={preview.loading === `preset:${preset.id}`}
              onPreview={() => preview.toggle(`preset:${preset.id}`, () => presetPreviewUrl(preset.id))}
              previewLabel={t("preview")}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div role="radiogroup" aria-label={t("sources.upload")} className="max-h-60 space-y-1 overflow-y-auto">
            {library.audios.length === 0 ? (
              <p className="rounded-[--radius] border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">{t("noUploads")}</p>
            ) : (
              library.audios.map((media) => (
                <MusicRow
                  key={media.id}
                  selected={value.mediaId === media.id}
                  onSelect={() => onChange({ mediaId: media.id })}
                  title={media.description || t("untitled")}
                  playing={preview.playing === `media:${media.id}`}
                  loading={preview.loading === `media:${media.id}`}
                  onPreview={() => preview.toggle(`media:${media.id}`, async () => media.url)}
                  previewLabel={t("preview")}
                />
              ))
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[--radius] border border-dashed border-control-edge text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {uploading ? <SpinnerGap className="h-4 w-4 animate-spin" aria-hidden /> : <UploadSimple className="h-4 w-4" aria-hidden />}
            {uploading ? t("uploading") : t("upload")}
          </button>
          <p className={cn("text-xs", uploadError ? "text-destructive-ink" : "text-muted-foreground")}>{uploadError ?? t("uploadHint")}</p>
        </div>
      )}
    </fieldset>
  );
}

function MusicRow({
  selected,
  onSelect,
  title,
  detail,
  playing,
  loading,
  onPreview,
  previewLabel,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  detail?: string;
  playing: boolean;
  loading: boolean;
  onPreview: () => void;
  previewLabel: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[--radius] border px-2 py-1.5 transition-colors",
        selected ? "border-primary bg-muted" : "border-border hover:bg-muted",
      )}
    >
      <button
        type="button"
        onClick={onPreview}
        aria-label={`${previewLabel}: ${title}`}
        aria-pressed={playing}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-control-edge text-foreground transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {loading ? (
          <SpinnerGap className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : playing ? (
          <Pause weight="fill" className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Play weight="fill" className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
      <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className="min-w-0 flex-1 text-left focus-visible:outline-none">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {detail ? <span className="block text-2xs text-muted-foreground">{detail}</span> : null}
      </button>
    </div>
  );
}
