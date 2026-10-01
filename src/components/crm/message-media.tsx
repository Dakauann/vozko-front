"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { DownloadSimple, File as FileIcon, Image as ImageIcon, Pause, Play, SpeakerHigh, Spinner, X } from "@/components/icons";
import { getConversationMediaAction } from "@/app/actions/conversations";
import { mediaFrame, type FramedMedia, type MediaFrame } from "@/lib/conversations/media-frame";
import { placeholderDataUrl } from "@/lib/conversations/media-placeholder";
import type { EntryType, MediaLayout, MediaType } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";
import DocumentPreview from "./DocumentPreview";

const CARD_CLASS = "mb-1 flex h-[60px] w-[260px] max-w-full items-center gap-3 rounded-[--radius] bg-muted px-3";

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

const WAVEFORM_BARS = Array.from({ length: 32 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));

function formatTime(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);

  const cycleSpeed = useCallback(() => {
    setSpeed((prev) => {
      const next = prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1;
      if (audioRef.current) audioRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else void audio.play();
  }, [isPlaying]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressBarRef.current;
      const audio = audioRef.current;
      if (!bar || !audio || !duration) return;
      const rect = bar.getBoundingClientRect();
      audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
    },
    [duration],
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onLoaded = () => setDuration(audio.duration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("durationchange", onLoaded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("durationchange", onLoaded);
    };
  }, []);

  const played = Math.round(progress * WAVEFORM_BARS.length);

  return (
    <div className={cn(CARD_CLASS, "gap-2.5")}>
      <audio ref={audioRef} src={url} preload="metadata">
        <track kind="captions" />
      </audio>
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95"
      >
        {isPlaying ? <Pause weight="fill" className="h-4 w-4" /> : <Play weight="fill" className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div ref={progressBarRef} onClick={handleSeek} className="flex h-6 cursor-pointer items-center gap-[2px]">
          {WAVEFORM_BARS.map((h, i) => (
            <span
              key={i}
              className={cn("w-[2px] flex-1 rounded-full transition-colors", i < played ? "bg-primary" : "bg-muted-foreground/30")}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xs font-medium tabular-nums text-muted-foreground">
            {formatTime(isPlaying || currentTime ? currentTime : duration)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="rounded-[--radius] bg-card px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-muted-foreground shadow-sm transition-colors hover:text-foreground"
            aria-label="Velocidade de reprodução"
          >
            {speed}×
          </button>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary-ink"
        onClick={(e) => e.stopPropagation()}
        aria-label="Download audio"
      >
        <DownloadSimple weight="bold" className="h-3.5 w-3.5" />
      </a>
    </div>
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
    <div className={CARD_CLASS}>
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
      className={cn(CARD_CLASS, "cursor-pointer transition-colors hover:bg-border/70")}
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
