"use client";

import { useCallback, useEffect, useRef } from "react";

import { boxStyle, syncVideo, type VisualItem } from "@/lib/studio/playback";

import { useAssetUrl } from "../use-asset";

interface PreviewMediaProps {
  item: VisualItem;
  playing: boolean;
  rate: number;
}

function PreviewVideo({ item, playing, rate }: PreviewMediaProps) {
  const url = useAssetUrl(item.assetId);
  const element = useRef<HTMLVideoElement>(null);
  const latest = useRef({ item, playing, rate });

  const apply = useCallback(() => {
    const video = element.current;
    if (!video || video.readyState < 1) return;
    const { item: current, playing: isPlaying, rate: currentRate } = latest.current;
    const command = syncVideo(video.currentTime * 1000, current.sourceMs, { playing: isPlaying, rate: currentRate, active: current.active });
    if (command.seekToMs !== null && !video.seeking) video.currentTime = command.seekToMs / 1000;
    if (video.playbackRate !== command.playbackRate) video.playbackRate = command.playbackRate;
    if (command.play && video.paused) void video.play().catch(() => undefined);
    if (!command.play && !video.paused) video.pause();
  }, []);

  useEffect(() => {
    latest.current = { item, playing, rate };
    apply();
  });

  if (!url) return <div className="h-full w-full bg-muted" />;
  return (
    <video
      ref={element}
      src={url}
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      onLoadedMetadata={apply}
      onSeeked={apply}
      className="pointer-events-none h-full w-full select-none"
      style={{ objectFit: item.fit }}
    />
  );
}

function PreviewImage({ item }: { item: VisualItem }) {
  const url = useAssetUrl(item.assetId);
  if (!url) return <div className="h-full w-full bg-muted" />;
  return <img src={url} alt="" draggable={false} className="pointer-events-none h-full w-full select-none" style={{ objectFit: item.fit }} />;
}

export function PreviewMedia({ item, playing, rate }: PreviewMediaProps) {
  return (
    <div className="absolute" style={{ ...boxStyle(item), visibility: item.active ? "visible" : "hidden" }} data-clip-id={item.clipId}>
      {item.type === "video" ? <PreviewVideo item={item} playing={playing} rate={rate} /> : <PreviewImage item={item} />}
    </div>
  );
}
