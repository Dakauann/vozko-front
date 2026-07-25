"use client";

import { Pause, Play, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { softSurfaceShadow } from "@/components/elevated-design/shadow-presets";
import { useTranslations } from "next-intl";
import { Download } from "@phosphor-icons/react/dist/ssr";

interface CallRecordingPlayerProps {
  recordingUrl: string;
  durationSec?: number;
  callStart?: string;
  fileSize?: number;
  className?: string;
  compact?: boolean;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatCallDate(dateString?: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CallRecordingPlayer = memo(function CallRecordingPlayer({
  recordingUrl,
  durationSec,
  callStart,
  fileSize,
  className,
  compact = false,
}: CallRecordingPlayerProps) {
  const t = useTranslations("common");
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec ?? 0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError(t("audioLoadError"));
      setIsPlaying(false);
    };

    const handleCanPlay = () => {
      setIsLoaded(true);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    audio.addEventListener("canplay", handleCanPlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, []);

  const togglePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch(() => {
          setError("Não foi possível reproduzir");
        });
      }
      setIsPlaying(!isPlaying);
    },
    [isPlaying],
  );

  const downloadAudio = () => {
    const link = document.createElement("a");
    link.href = recordingUrl;
    link.download = `call_recording_${callStart ? new Date(callStart).getTime() : "unknown"}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleMute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const audio = audioRef.current;
      if (!audio) return;

      audio.muted = !isMuted;
      setIsMuted(!isMuted);
    },
    [isMuted],
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const audio = audioRef.current;
      const progress = progressRef.current;
      if (!audio || !progress) return;

      const rect = progress.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const newTime = percentage * duration;

      audio.currentTime = newTime;
      setCurrentTime(newTime);
    },
    [duration],
  );

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div
        className={cn(
          "rounded-xl border border-rose-600 bg-rose-500 px-3 py-2 text-xs text-white",
          className,
        )}
      >
        {error}
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-border bg-card/80 px-2 py-1.5",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <audio ref={audioRef} src={recordingUrl} preload="metadata" />

        <button
          type="button"
          onClick={togglePlay}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
            isPlaying
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground hover:bg-border",
          )}
        >
          {isPlaying ? (
            <Pause weight="fill" className="h-3 w-3" />
          ) : (
            <Play weight="fill" className="h-3 w-3" />
          )}
        </button>

        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="h-1 w-16 cursor-pointer rounded-full bg-border"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        {fileSize != null && fileSize > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {formatFileSize(fileSize)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-gradient-to-br from-muted to-card p-4",
        className,
      )}
      style={{ boxShadow: softSurfaceShadow }}
      onClick={(e) => e.stopPropagation()}
    >
      <audio ref={audioRef} src={recordingUrl} preload="metadata" />

      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!isLoaded && !durationSec}
          className={cn(
            "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all",
            isPlaying
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "bg-muted text-muted-foreground hover:bg-border",
            !isLoaded && !durationSec && "opacity-50 cursor-not-allowed",
          )}
        >
          {isPlaying ? (
            <Pause weight="fill" className="h-5 w-5" />
          ) : (
            <Play weight="fill" className="h-5 w-5 ml-0.5" />
          )}
        </button>

        {/* Progress and Info */}
        <div className="flex-1 min-w-0">
          {/* Progress Bar */}
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="h-2 w-full cursor-pointer rounded-full bg-border overflow-hidden mb-2"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary-600 transition-all"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          {/* Time and Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground tabular-nums">
                {formatTime(currentTime)}
              </span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {callStart && (
                <span className="text-[10px] text-muted-foreground">
                  {formatCallDate(callStart)}
                </span>
              )}
              {fileSize != null && fileSize > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {formatFileSize(fileSize)}
                </span>
              )}

              {/* Mute Button */}
              <button
                type="button"
                onClick={toggleMute}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors"
              >
                {isMuted ? (
                  <SpeakerSlash weight="fill" className="h-4 w-4" />
                ) : (
                  <SpeakerHigh weight="fill" className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={downloadAudio}
                className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors"
              >
                <Download weight="fill" className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default CallRecordingPlayer;
