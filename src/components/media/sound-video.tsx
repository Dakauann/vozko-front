"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { SpeakerHigh, SpeakerSlash } from "@/components/icons";
import { firstFrameSrc } from "@/lib/media/first-frame";
import { cn } from "@/lib/utils";

export function SoundVideo({
  src,
  label,
  autoPlay = false,
  controls = false,
  className,
  videoClassName,
}: {
  src: string;
  label?: string;
  autoPlay?: boolean;
  controls?: boolean;
  className?: string;
  videoClassName?: string;
}) {
  const t = useTranslations("mediaPlayer");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const next = !muted;
    video.muted = next;
    setMuted(next);
    if (!next && video.paused) void video.play().catch(() => undefined);
  };

  return (
    <span className={cn("relative block", className)}>
      <video
        ref={videoRef}
        src={firstFrameSrc(src)}
        aria-label={label ?? t("video")}
        muted
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        loop={autoPlay}
        controls={controls}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        className={cn("h-full w-full object-cover", videoClassName)}
      />
      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={!muted}
        aria-label={muted ? t("unmute") : t("mute")}
        title={muted ? t("unmute") : t("mute")}
        className={cn(
          "absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          controls ? "top-2" : "bottom-2",
        )}
      >
        {muted ? <SpeakerSlash className="h-4 w-4" aria-hidden /> : <SpeakerHigh className="h-4 w-4" aria-hidden />}
      </button>
    </span>
  );
}
