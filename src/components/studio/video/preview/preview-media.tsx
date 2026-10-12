"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { HaloNode, SourceSize } from "@/lib/studio/media-halo";
import { boxStyle, contentStretch, syncVideo, type VisualItem } from "@/lib/studio/playback";

import { useAssetUrl } from "../use-asset";
import { PreviewHalo } from "./preview-halo";

interface PreviewMediaProps {
  item: VisualItem;
  playing: boolean;
  rate: number;
  halo?: HaloNode | null;
  haloRatio?: number;
}

type MediaProps = Pick<PreviewMediaProps, "item" | "playing" | "rate"> & { onSize: (size: SourceSize) => void };

function PreviewVideo({ item, playing, rate, onSize }: MediaProps) {
  const url = useAssetUrl(item.assetId);
  const element = useRef<HTMLVideoElement>(null);
  const latest = useRef({ item, playing, rate });

  const apply = useCallback(() => {
    const video = element.current;
    if (!video || video.readyState < 1) return;
    const { item: current, playing: isPlaying, rate: currentRate } = latest.current;
    const command = syncVideo(video.currentTime * 1000, current.sourceMs, { playing: isPlaying, rate: currentRate, active: current.active, speed: current.speed, backward: current.backward });
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
      onLoadedMetadata={(event) => {
        onSize({ width: event.currentTarget.videoWidth, height: event.currentTarget.videoHeight });
        apply();
      }}
      onSeeked={apply}
      className="pointer-events-none h-full w-full select-none"
      style={{ objectFit: item.fit }}
    />
  );
}

function PreviewImage({ item, onSize }: Pick<MediaProps, "item" | "onSize">) {
  const url = useAssetUrl(item.assetId);
  if (!url) return <div className="h-full w-full bg-muted" />;
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      onLoad={(event) => onSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      className="pointer-events-none h-full w-full select-none"
      style={{ objectFit: item.fit }}
    />
  );
}

export function PreviewMedia({ item, playing, rate, halo, haloRatio = 1 }: PreviewMediaProps) {
  const stretch = contentStretch(item);
  const [size, setSize] = useState<SourceSize | null>(null);
  const placed = (scaleX: number, scaleY: number) => ({ width: `${stretch.width * 100}%`, height: `${stretch.height * 100}%`, transform: `translate(-50%, -50%) scale(${scaleX}, ${scaleY})` });
  return (
    <div className="absolute" style={{ ...boxStyle(item), visibility: item.active ? "visible" : "hidden" }} data-clip-id={item.clipId}>
      {halo ? (
        <div className="absolute left-1/2 top-1/2" style={placed(1 / stretch.width, 1 / stretch.height)}>
          <PreviewHalo halo={halo} source={size} ratio={haloRatio} />
        </div>
      ) : null}
      <div className="absolute left-1/2 top-1/2" style={placed(stretch.scaleX, stretch.scaleY)}>
        {item.type === "video" ? <PreviewVideo item={item} playing={playing} rate={rate} onSize={setSize} /> : <PreviewImage item={item} onSize={setSize} />}
      </div>
    </div>
  );
}
