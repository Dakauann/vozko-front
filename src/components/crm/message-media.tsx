"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ArrowsOut, DownloadSimple, File as FileIcon, Image as ImageIcon, Play, SpeakerHigh, Spinner } from "@/components/icons";
import { AudioPlayer, MEDIA_CARD_CLASS } from "@/components/media/audio-player";
import { useConversationMediaUrl } from "@/hooks/use-conversation-media-url";
import { mediaFrame, type FramedMedia, type MediaFrame } from "@/lib/conversations/media-frame";
import type { GalleryItem } from "@/lib/conversations/media-gallery";
import { placeholderDataUrl } from "@/lib/conversations/media-placeholder";
import type { EntryType, MediaLayout, MediaType } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";
import DocumentPreview from "./DocumentPreview";
import { MediaGalleryDialog, useMediaGallery } from "./thread/MediaGallery";

const HOVER_BUTTON =
  "flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60";

function DownloadButton({ url }: { url: string }) {
  const t = useTranslations("crmConversation.thread.mediaState");
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download
      className={HOVER_BUTTON}
      onClick={(e) => e.stopPropagation()}
      aria-label={t("download")}
    >
      <DownloadSimple weight="bold" className="h-3.5 w-3.5" />
    </a>
  );
}

const UNAVAILABLE_ICON: Record<MediaType, ReactNode> = {
  image: <ImageIcon className="h-4 w-4 text-muted-foreground" />,
  sticker: <ImageIcon className="h-4 w-4 text-muted-foreground" />,
  video: <Play className="h-4 w-4 text-muted-foreground" />,
  audio: <SpeakerHigh className="h-4 w-4 text-muted-foreground" />,
  document: <FileIcon className="h-4 w-4 text-muted-foreground" />,
};

function FrameBox({
  frame,
  placeholder,
  transparent,
  children,
  className,
}: {
  frame: MediaFrame;
  placeholder: string | null;
  transparent?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-media-frame=""
      className={cn("group relative mb-1 max-w-full overflow-hidden rounded-[--radius]", !transparent && "bg-muted", className)}
      style={{ width: frame.width, aspectRatio: `${frame.width} / ${frame.height}` }}
    >
      {placeholder ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img aria-hidden alt="" src={placeholder} className="absolute inset-0 h-full w-full scale-110 object-cover blur-md" />
      ) : null}
      {children}
    </div>
  );
}

function FrameStatus({ type, loading }: { type: MediaType; loading: boolean }) {
  const t = useTranslations("crmConversation.thread.mediaState");
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
      {loading ? <Spinner className="h-5 w-5 animate-spin" /> : UNAVAILABLE_ICON[type]}
      {loading ? null : <span>{t("unavailable")}</span>}
    </div>
  );
}

function CardStatus({ type, loading }: { type: MediaType; loading: boolean }) {
  const t = useTranslations("crmConversation.thread.mediaState");
  return (
    <div className={MEDIA_CARD_CLASS}>
      {loading ? <Spinner className="h-4 w-4 animate-spin text-muted-foreground" /> : UNAVAILABLE_ICON[type]}
      <span className="text-xs text-muted-foreground">{loading ? t("loading") : t("unavailable")}</span>
    </div>
  );
}

function FramedImage({
  src,
  alt,
  fit,
  onOpen,
}: {
  src: string;
  alt: string;
  fit: MediaFrame["fit"];
  onOpen?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setShown(true);
  }, [src]);

  if (failed) return <FrameStatus type="image" loading={false} />;

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      decoding="async"
      loading="lazy"
      onLoad={() => setShown(true)}
      onError={() => setFailed(true)}
      className={cn(
        "absolute inset-0 h-full w-full transition-opacity duration-200",
        fit === "cover" ? "object-cover" : "object-contain",
        shown ? "opacity-100" : "opacity-0",
      )}
    />
  );

  if (!onOpen) return image;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={alt}
      className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {image}
    </button>
  );
}

function useOpenMedia(item: GalleryItem | null) {
  const gallery = useMediaGallery();
  const [single, setSingle] = useState<HTMLElement | null | false>(false);

  const open = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!item) return;
    if (gallery) gallery.open(item.messageId, event.currentTarget);
    else setSingle(event.currentTarget);
  };

  const lightbox =
    item && single !== false ? (
      <MediaGalleryDialog items={[item]} index={0} onIndexChange={() => undefined} onClose={() => setSingle(false)} returnFocusTo={single} />
    ) : null;

  return { open, lightbox };
}

export function MessageMedia({
  type,
  url,
  mediaId,
  entryType,
  entryId,
  messageId,
  text,
  layout,
}: {
  type?: MediaType;
  url?: string;
  mediaId?: string;
  entryType?: EntryType;
  entryId?: string;
  messageId?: string;
  text?: string;
  layout?: MediaLayout | null;
}) {
  const t = useTranslations("crmConversation.thread");
  const { mediaUrl, loading, error } = useConversationMediaUrl(url, mediaId, entryType, entryId);
  const [documentPreviewOpened, setDocumentPreviewOpened] = useState(false);
  const placeholder = useMemo(() => placeholderDataUrl(layout?.thumbhash), [layout?.thumbhash]);
  const galleryItem: GalleryItem | null =
    mediaUrl && (type === "image" || type === "video")
      ? { messageId: messageId ?? mediaUrl, type, url: mediaUrl, mediaId, entryType, entryId, caption: text ?? "" }
      : null;
  const { open, lightbox } = useOpenMedia(galleryItem);

  if (!type || (!mediaUrl && !mediaId)) return null;

  const unavailable = error || (!mediaUrl && !loading);

  if (type === "image" || type === "video" || type === "sticker") {
    const frame = mediaFrame(type as FramedMedia, layout);
    const sticker = type === "sticker";
    if (loading || unavailable || !mediaUrl) {
      return (
        <FrameBox frame={frame} placeholder={placeholder} transparent={sticker}>
          {placeholder && loading ? null : <FrameStatus type={type} loading={loading} />}
        </FrameBox>
      );
    }
    if (type === "video") {
      return (
        <>
          <FrameBox frame={frame} placeholder={placeholder} className="bg-black">
            <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <button type="button" onClick={open} aria-label={t("gallery.title")} className={HOVER_BUTTON}>
                <ArrowsOut weight="bold" className="h-3.5 w-3.5" />
              </button>
              <DownloadButton url={mediaUrl} />
            </div>
            <video src={mediaUrl} controls preload="metadata" className="absolute inset-0 h-full w-full object-contain" />
          </FrameBox>
          {lightbox}
        </>
      );
    }
    const alt = sticker ? t("mediaState.sticker") : text || t("media.image");
    return (
      <>
        <FrameBox frame={frame} placeholder={placeholder} transparent={sticker}>
          {sticker ? null : (
            <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <DownloadButton url={mediaUrl} />
            </div>
          )}
          <FramedImage src={mediaUrl} alt={alt} fit={sticker ? "contain" : frame.fit} onOpen={sticker ? undefined : open} />
        </FrameBox>
        {lightbox}
      </>
    );
  }

  if (loading || unavailable || !mediaUrl) {
    return <CardStatus type={type} loading={loading} />;
  }

  if (type === "audio") {
    return <AudioPlayer url={mediaUrl} />;
  }

  const fileName = text?.trim() || t("media.document");
  const ext = (mediaUrl.split("?")[0].split(".").pop() || "").toUpperCase().slice(0, 4);
  return (
    <div
      onClick={() => setDocumentPreviewOpened((prev) => !prev)}
      className={cn(MEDIA_CARD_CLASS, "cursor-pointer transition-colors hover:bg-border/70")}
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <FileIcon weight="fill" className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{fileName}</p>
        <p className="text-2xs text-muted-foreground">
          {ext ? `${ext} · ` : ""}
          {t("mediaState.tapToOpen")}
        </p>
      </div>
      <DownloadSimple weight="bold" className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <DocumentPreview previewDocumentUrl={mediaUrl} open={documentPreviewOpened} setOpen={setDocumentPreviewOpened} />
    </div>
  );
}
