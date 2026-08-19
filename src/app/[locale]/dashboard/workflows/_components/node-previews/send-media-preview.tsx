"use client";

import type { ComponentType } from "react";
import {
  DownloadSimple,
  FileText,
  Image as ImageIcon,
  Microphone,
  Play,
  VideoCamera,
} from "@/components/icons";
import type { IconProps } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  ChatSurface,
  WA_BUBBLE_MUTED,
  WA_BUBBLE_TEXT,
} from "../message-node-primitives";
import { useResolvedMedia } from "./media-node-preview";

// Outgoing green bubble (a media message is a message the business sends).
const WA_MEDIA_BUBBLE = "bg-[#d9fdd3] dark:bg-[#005c4b]";

function fileNameFromUrl(url: string): string {
  return url.split("?")[0].split("/").pop() || "";
}

function hideOnError(e: { currentTarget: HTMLElement }) {
  e.currentTarget.style.display = "none";
}

// action_send_media: renders the media exactly as WhatsApp shows it (image,
// video with a play overlay, a voice-note bar, or a document card) inside the
// outgoing green bubble, with the caption below.
export function SendMediaPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const name = (config._display_media_id as string) || "";
  const rawUrl = (config.media_url as string) || "";
  const previewUrl = (config._media_preview_url as string) || rawUrl;
  const mediaId = (config.media_id as string) || "";
  const rawType = (
    ((config._media_type as string) ?? "") ||
    (rawUrl.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?|$)/i)
      ? "image"
      : rawUrl.match(/\.(mp4|webm|mov)(\?|$)/i)
        ? "video"
        : rawUrl.match(/\.(mp3|wav|ogg|m4a|opus)(\?|$)/i)
          ? "audio"
          : rawUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv)(\?|$)/i)
            ? "document"
            : "")
  ).toLowerCase();
  const caption = (config.caption as string) || "";

  const { url, type, loading } = useResolvedMedia(mediaId, previewUrl, rawType);

  if (!name && !rawUrl && !mediaId) {
    return (
      <ChatSurface>
        <div
          className={cn(
            "rounded-lg rounded-tl-sm px-2 py-3 text-center shadow-sm",
            WA_MEDIA_BUBBLE,
          )}
        >
          <span className="text-2xs italic text-black/40 dark:text-white/40">
            Nenhuma mídia
          </span>
        </div>
      </ChatSurface>
    );
  }

  return (
    <ChatSurface>
      <div
        className={cn(
          "max-w-full overflow-hidden rounded-lg rounded-tl-sm p-[3px] shadow-sm",
          WA_MEDIA_BUBBLE,
        )}
      >
        <WhatsAppMedia
          url={url}
          type={type}
          name={name || fileNameFromUrl(rawUrl)}
          loading={loading}
        />
        {caption.trim() && (
          <p
            className={cn(
              "line-clamp-2 px-1.5 pb-0.5 pt-1 text-2xs leading-snug",
              WA_BUBBLE_TEXT,
            )}
          >
            {caption}
          </p>
        )}
      </div>
    </ChatSurface>
  );
}

function WhatsAppMedia({
  url,
  type,
  name,
  loading,
}: {
  url: string;
  type: string;
  name: string;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="h-24 w-full animate-pulse rounded-md bg-black/10 dark:bg-white/10" />
    );
  }

  const isImage = type.includes("image") || type === "sticker";
  const isVideo = type.includes("video");
  const isAudio = type.includes("audio");

  if (isImage) {
    return (
      <div className="overflow-hidden rounded-md">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={name || "imagem"}
            className="block max-h-32 w-full object-cover"
            onError={hideOnError}
          />
        ) : (
          <MediaPlaceholder icon={ImageIcon} label="Imagem" />
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="relative overflow-hidden rounded-md">
        {url ? (
          <video
            src={url}
            className="block max-h-32 w-full object-cover"
            muted
            preload="metadata"
            onError={hideOnError}
          />
        ) : (
          <MediaPlaceholder icon={VideoCamera} label="Vídeo" />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45">
            <Play size={15} weight="fill" className="ml-0.5 text-white" />
          </span>
        </span>
      </div>
    );
  }

  if (isAudio) {
    // WhatsApp voice-note bar: play control, a track with a scrubber, mic + time.
    return (
      <div className="flex items-center gap-2 px-1.5 py-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 dark:bg-white/15">
          <Play
            size={13}
            weight="fill"
            className="ml-0.5 text-[#008069] dark:text-[#e9edef]"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="relative h-[3px] w-full rounded-full bg-black/15 dark:bg-white/25">
            <span className="absolute left-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#008069] dark:bg-white" />
          </div>
          <div className="mt-1 flex items-center gap-1">
            <Microphone size={10} className={WA_BUBBLE_MUTED} />
            <span className={cn("text-2xs", WA_BUBBLE_MUTED)}>0:00</span>
          </div>
        </div>
      </div>
    );
  }

  // Document card.
  const ext = (name.split(".").pop() || "arquivo").toUpperCase().slice(0, 10);
  return (
    <div className="flex items-center gap-2 rounded-md bg-black/[0.04] px-2 py-2 dark:bg-white/[0.06]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white shadow-sm dark:bg-white/15">
        <FileText size={17} weight="fill" className="text-[#dd4b3e]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-2xs font-medium", WA_BUBBLE_TEXT)}>
          {name || "Documento"}
        </p>
        <p className={cn("truncate text-2xs", WA_BUBBLE_MUTED)}>
          {ext} · Documento
        </p>
      </div>
      <DownloadSimple size={15} className={cn("shrink-0", WA_BUBBLE_MUTED)} />
    </div>
  );
}

function MediaPlaceholder({
  icon: Icon,
  label,
}: {
  icon: ComponentType<IconProps>;
  label: string;
}) {
  return (
    <div className="flex h-24 w-full items-center justify-center gap-1.5 bg-black/10 dark:bg-white/10">
      <Icon size={18} weight="duotone" className="text-black/30 dark:text-white/40" />
      <span className="text-2xs text-black/40 dark:text-white/40">{label}</span>
    </div>
  );
}
