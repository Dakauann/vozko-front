"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Image,
  SpeakerHigh,
  VideoCamera,
} from "@phosphor-icons/react";
import { getMediaAction } from "@/app/actions/medias";

// useResolvedMedia resolves a media reference (direct URL or saved media id) to a
// concrete url + type, fetching the saved media lazily. Shared by the neutral
// MediaNodePreview (VoIP) and the WhatsApp media render (send-media).
export function useResolvedMedia(
  mediaId: string | undefined,
  initialUrl: string | undefined,
  mediaType: string,
) {
  const [url, setUrl] = useState(initialUrl || "");
  const [type, setType] = useState(mediaType);
  const [loading, setLoading] = useState(!initialUrl && !!mediaId);

  useEffect(() => {
    if (url || !mediaId) return;
    let cancelled = false;
    getMediaAction(mediaId).then((media) => {
      if (cancelled) return;
      if (media) {
        setUrl(media.previewUrl || media.url || "");
        if (!type && media.type) setType(media.type.toLowerCase());
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [url, mediaId, type]);

  return { url, type, loading };
}

// MediaNodePreview resolves a media reference and renders an inline
// thumbnail/player for image, video, audio or document. Used by the legacy VoIP
// play-audio preview (neutral styling).
export function MediaNodePreview({
  name,
  previewUrl: initialUrl,
  mediaId,
  mediaType,
}: {
  name?: string;
  previewUrl?: string;
  mediaId?: string;
  mediaType: string;
}) {
  const { url, type, loading } = useResolvedMedia(mediaId, initialUrl, mediaType);

  const isImage = type.includes("image") || type === "sticker";
  const isVideo = type.includes("video") || type === "vsl_video";
  const isAudio = type.includes("audio");
  const isPdf = type.includes("pdf") || type.includes("document");

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 animate-pulse">
        <div className="h-4 w-4 rounded bg-muted" />
        <div className="h-3 w-20 rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {isImage && url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name || "Media"}
          className="h-auto max-h-24 w-full rounded-md object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {isImage && !url && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2">
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image size={16} weight="duotone" className="shrink-0 text-blue-500" />
          <span className="truncate text-[11px] text-foreground/70">
            {name || "Imagem"}
          </span>
        </div>
      )}
      {isVideo && url && (
        <div className="relative overflow-hidden rounded-md bg-black/5 dark:bg-white/5">
          <video
            src={url}
            className="max-h-20 w-full rounded-md object-cover"
            muted
            preload="metadata"
            onError={(e) => {
              (e.target as HTMLVideoElement).style.display = "none";
            }}
          />
          <span className="absolute bottom-1 right-1.5 rounded bg-background/80 px-1 text-[9px] text-muted-foreground">
            Vídeo
          </span>
        </div>
      )}
      {isVideo && !url && (
        <div className="relative flex h-16 items-center justify-center overflow-hidden rounded-md bg-muted/40">
          <VideoCamera size={24} weight="duotone" className="text-blue-500" />
          <span className="absolute bottom-1 right-1.5 rounded bg-background/80 px-1 text-[9px] text-muted-foreground">
            Vídeo
          </span>
        </div>
      )}
      {isAudio && url && (
        <div className="rounded-md bg-muted/40 px-2 py-1.5">
          <audio
            src={url}
            controls
            className="h-7 w-full [&::-webkit-media-controls-panel]:bg-transparent"
            preload="metadata"
          />
        </div>
      )}
      {isAudio && !url && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2">
          <SpeakerHigh size={16} weight="duotone" className="shrink-0 text-blue-500" />
          <span className="truncate text-[11px] text-foreground/70">
            {name || "Áudio"}
          </span>
        </div>
      )}
      {isPdf && url && (
        <div className="overflow-hidden rounded-md border border-border">
          <span className="flex items-center gap-2 bg-muted/40 px-2 py-1.5">
            <FileText size={16} weight="duotone" className="text-blue-500" />
            <span className="truncate text-[11px] text-foreground/70">
              {name || "Documento"}
            </span>
          </span>
        </div>
      )}
      {!isImage && !isVideo && !isAudio && !isPdf && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2">
          <FileText size={16} weight="duotone" className="shrink-0 text-blue-500" />
          <span className="truncate text-[11px] text-foreground/70">
            {name || "Documento"}
          </span>
        </div>
      )}
    </div>
  );
}
