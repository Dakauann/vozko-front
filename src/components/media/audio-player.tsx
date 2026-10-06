"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useTranslations } from "next-intl";

import { DownloadSimple, Pause, Play } from "@/components/icons";
import { cn } from "@/lib/utils";

export const MEDIA_CARD_CLASS = "mb-1 flex h-[60px] w-[260px] max-w-full items-center gap-3 rounded-[--radius] bg-muted px-3";

const WAVEFORM_BARS = Array.from({ length: 32 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
const SEEK_STEP_SECONDS = 5;

function formatTime(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  url,
  label,
  downloadable = true,
  className,
}: {
  url: string;
  label?: string;
  downloadable?: boolean;
  className?: string;
}) {
  const t = useTranslations("mediaPlayer");
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
    (e: MouseEvent<HTMLDivElement>) => {
      const bar = progressBarRef.current;
      const audio = audioRef.current;
      if (!bar || !audio || !duration) return;
      const rect = bar.getBoundingClientRect();
      audio.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
    },
    [duration],
  );

  const handleSeekKey = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const step = e.key === "ArrowRight" ? SEEK_STEP_SECONDS : e.key === "ArrowLeft" ? -SEEK_STEP_SECONDS : 0;
      if (step === 0) return;
      e.preventDefault();
      audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + step));
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
    <div role="group" aria-label={label ?? t("audio")} className={cn(MEDIA_CARD_CLASS, "gap-2.5", className)}>
      <audio ref={audioRef} src={url} preload="metadata">
        <track kind="captions" />
      </audio>
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? t("pause") : t("play")}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isPlaying ? <Pause weight="fill" className="h-4 w-4" aria-hidden /> : <Play weight="fill" className="ml-0.5 h-4 w-4" aria-hidden />}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          ref={progressBarRef}
          role="slider"
          tabIndex={0}
          aria-label={t("position")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration) || 0}
          aria-valuenow={Math.round(currentTime)}
          aria-valuetext={formatTime(currentTime)}
          onClick={handleSeek}
          onKeyDown={handleSeekKey}
          className="flex h-6 cursor-pointer items-center gap-[2px] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
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
            aria-label={t("speed")}
          >
            {speed}×
          </button>
        </div>
      </div>
      {downloadable ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary-ink"
          onClick={(e) => e.stopPropagation()}
          aria-label={t("download")}
        >
          <DownloadSimple weight="bold" className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
