"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { DownloadSimple, File as FileIcon, Image as ImageIcon, Play, SpeakerHigh, Spinner, X } from "@/components/icons";
import { getConversationMediaAction } from "@/app/actions/conversations";
import { AudioPlayer, MEDIA_CARD_CLASS } from "@/components/media/audio-player";
import { mediaFrame, type FramedMedia, type MediaFrame } from "@/lib/conversations/media-frame";
import { placeholderDataUrl } from "@/lib/conversations/media-placeholder";
import type { EntryType, MediaLayout, MediaType } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";
import DocumentPreview from "./DocumentPreview";

function useMediaUrl(url?: string, mediaId?: string, entryType?: EntryType, entryId?: string) {
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!url && !!mediaId);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (url || !mediaId || !entryType || !entryId || fetchedRef.current) return;
    fetchedRef.current = true;

    getConversationMediaAction(entryType, entryId, mediaId)
      .then((media) => {
        if (media?.url) setFetchedUrl(media.url);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [mediaId, url, entryType, entryId]);

  return { mediaUrl: url || fetchedUrl, loading, error };
}

function DownloadButton({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      aria-label="Download"
    >
      <DownloadSimple weight="bold" className="h-3.5 w-3.5" />
    </a>
  );
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          download
          onClick={(e) => e.stopPropagation()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Download"
        >
          <DownloadSimple weight="bold" className="h-5 w-5" />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          aria-label="Fechar"
        >
          <X weight="bold" className="h-5 w-5" />
        </button>
      </div>
      <motion.img
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </motion.div>
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
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-xs text-muted-foreground">
      {loading ? <Spinner className="h-5 w-5 animate-spin" /> : UNAVAILABLE_ICON[type]}
      {loading ? null : <span>Mídia não disponível</span>}
    </div>
  );
}

function CardStatus({ type, loading }: { type: MediaType; loading: boolean }) {
  return (
    <div className={MEDIA_CARD_CLASS}>
      {loading ? <Spinner className="h-4 w-4 animate-spin text-muted-foreground" /> : UNAVAILABLE_ICON[type]}
      <span className="text-xs text-muted-foreground">{loading ? "Carregando mídia..." : "Mídia não disponível"}</span>
    </div>
  );
}

function FramedImage({ src, alt, fit, onOpen }: { src: string; alt: string; fit: MediaFrame["fit"]; onOpen?: () => void }) {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setShown(true);
  }, [src]);

  if (failed) return <FrameStatus type="image" loading={false} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      decoding="async"
      loading="lazy"
      onLoad={() => setShown(true)}
      onError={() => setFailed(true)}
      onClick={onOpen}
      className={cn(
        "absolute inset-0 h-full w-full transition-opacity duration-200",
        fit === "cover" ? "object-cover" : "object-contain",
        shown ? "opacity-100" : "opacity-0",
        onOpen && "cursor-pointer",
      )}
    />
  );
}

export function MessageMedia({
  type,
  url,
  mediaId,
  entryType,
  entryId,
  text,
  layout,
}: {
  type?: MediaType;
  url?: string;
  mediaId?: string;
  entryType?: EntryType;
  entryId?: string;
  text?: string;
  layout?: MediaLayout | null;
}) {
  const { mediaUrl, loading, error } = useMediaUrl(url, mediaId, entryType, entryId);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [documentPreviewOpened, setDocumentPreviewOpened] = useState(false);
  const placeholder = useMemo(() => placeholderDataUrl(layout?.thumbhash), [layout?.thumbhash]);

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
        <FrameBox frame={frame} placeholder={placeholder} className="bg-black">
          <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
            <DownloadButton url={mediaUrl} />
          </div>
          <video src={mediaUrl} controls preload="metadata" className="absolute inset-0 h-full w-full object-contain" />
        </FrameBox>
      );
    }
    const alt = sticker ? "Sticker" : text || "Imagem";
    return (
      <>
        <FrameBox frame={frame} placeholder={placeholder} transparent={sticker}>
          {sticker ? null : (
            <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
              <DownloadButton url={mediaUrl} />
            </div>
          )}
          <FramedImage src={mediaUrl} alt={alt} fit={sticker ? "contain" : frame.fit} onOpen={sticker ? undefined : () => setLightboxOpen(true)} />
        </FrameBox>
        <AnimatePresence>
          {lightboxOpen ? <ImageLightbox src={mediaUrl} alt={alt} onClose={() => setLightboxOpen(false)} /> : null}
        </AnimatePresence>
      </>
    );
  }

  if (loading || unavailable || !mediaUrl) {
    return <CardStatus type={type} loading={loading} />;
  }

  if (type === "audio") {
    return <AudioPlayer url={mediaUrl} />;
  }

  const fileName = text?.trim() || "Documento";
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
        <p className="text-2xs text-muted-foreground">{ext ? `${ext} · ` : ""}Toque para abrir</p>
      </div>
      <DownloadSimple weight="bold" className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <DocumentPreview previewDocumentUrl={mediaUrl} open={documentPreviewOpened} setOpen={setDocumentPreviewOpened} />
    </div>
  );
}
