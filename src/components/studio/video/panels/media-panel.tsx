"use client";

import { useMemo, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";

import { uploadMediaAction } from "@/app/actions/medias";
import Button from "@/components/elevated-design/button";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ArrowClockwise, CircleNotch, Plus, UploadSimple, Waveform } from "@/components/icons";
import { firstFrameSrc } from "@/lib/media/first-frame";
import type { Media } from "@/lib/medias/types";
import { clipTypeForMedia, type MediaClipType } from "@/lib/studio/media-clips";

import { useAssetState, useVideoEditor } from "../editor-context";
import { CLIP_KIND_TONES, kindTile, MEDIA_KIND } from "../clip-tones";
import { MEDIA_DRAG_TYPE } from "../timeline/timeline-geometry";

type Filter = "all" | MediaClipType;

const FILTERS: Filter[] = ["all", "video", "image", "audio"];

function uploadType(file: File): MediaClipType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
}

function KindBadge({ type }: { type: MediaClipType }) {
  const kind = MEDIA_KIND[type];
  const Glyph = CLIP_KIND_TONES[kind].glyph;
  return (
    <span className={`${kindTile(kind)} absolute bottom-1 left-1 flex h-4 w-4 items-center justify-center`} aria-hidden>
      <Glyph className="h-2.5 w-2.5" />
    </span>
  );
}

function MediaThumb({ media, type }: { media: Media; type: MediaClipType }) {
  if (type === "image") return <img src={media.previewUrl || media.url} alt="" draggable={false} className="h-full w-full object-cover" />;
  if (type === "video") return <video src={firstFrameSrc(media.url)} muted playsInline preload="metadata" aria-hidden className="pointer-events-none h-full w-full object-cover" />;
  return (
    <span className="flex h-full w-full items-center justify-center bg-muted">
      <span className={`${kindTile("audio")} flex h-9 w-9 items-center justify-center`} aria-hidden>
        <Waveform className="h-5 w-5" />
      </span>
    </span>
  );
}

export function MediaPanel() {
  const t = useTranslations("studio.video.media");
  const { assets, commands } = useVideoEditor();
  const library = useAssetState((s) => s.library);
  const [filter, setFilter] = useState<Filter>("all");
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const items = useMemo(
    () =>
      library.medias
        .map((media) => ({ media, type: clipTypeForMedia(media.type) }))
        .filter((entry): entry is { media: Media; type: MediaClipType } => entry.type !== null && (filter === "all" || entry.type === filter)),
    [library.medias, filter],
  );

  const upload = async (file: File) => {
    const type = uploadType(file);
    if (!type) {
      commands.notify("unsupportedMedia", "error");
      return;
    }
    setUploading(true);
    const form = new FormData();
    form.append("media", file);
    form.append("mediaType", type);
    form.append("description", file.name);
    const result = await uploadMediaAction(form);
    setUploading(false);
    if (result.error || !result.mediaId) {
      commands.notify("uploadFailed", "error");
      return;
    }
    await assets.loadLibrary();
    await commands.insertMedia({ id: result.mediaId, type });
  };

  const startDrag = (media: Media) => (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify({ id: media.id, type: media.type }));
    event.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="space-y-3 p-3">
      <input
        ref={input}
        type="file"
        accept="image/*,video/*,audio/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        title={uploading ? t("uploading") : t("upload")}
        icon={uploading ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <UploadSimple className="h-3.5 w-3.5" />}
        iconVisible
        disabled={uploading}
        onClick={() => input.current?.click()}
      />
      <ElevatedPillToggle<Filter>
        aria-label={t("filter")}
        value={filter}
        onChange={setFilter}
        className="flex w-full [&>button]:flex-1"
        options={FILTERS.map((option) => ({ value: option, label: t(`filters.${option}`) }))}
      />
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
      {library.status === "loading" && library.medias.length === 0 ? <p className="text-xs text-muted-foreground">{t("loading")}</p> : null}
      {library.status === "failed" ? (
        <div className="space-y-2">
          <p role="alert" className="notice notice-fault px-2 py-1.5 text-xs">
            <span className="notice-ink font-medium">{t("failed")}</span>
          </p>
          <Button variant="outline" size="sm" title={t("retry")} icon={<ArrowClockwise className="h-3.5 w-3.5" />} iconVisible onClick={() => void assets.loadLibrary()} />
        </div>
      ) : null}
      {library.status === "ready" && items.length === 0 ? <p className="text-xs text-muted-foreground">{t("empty")}</p> : null}
      <ul className="grid grid-cols-2 gap-2">
        {items.map(({ media, type }) => (
          <li key={media.id} className="group relative">
            <div
              draggable
              onDragStart={startDrag(media)}
              title={media.description}
              className="relative aspect-square cursor-grab overflow-hidden rounded-md border border-border bg-muted active:cursor-grabbing"
            >
              <MediaThumb media={media} type={type} />
              <KindBadge type={type} />
            </div>
            <span className="mt-1 block truncate text-2xs text-muted-foreground">{media.description || t(`filters.${type}`)}</span>
            <button
              type="button"
              aria-label={t("add", { name: media.description || t(`filters.${type}`) })}
              title={t("addHint")}
              onClick={() => void commands.insertMedia(media)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground opacity-0 shadow transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
