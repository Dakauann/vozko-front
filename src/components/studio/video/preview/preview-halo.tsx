"use client";

import { useEffect, useRef } from "react";

import { haloCanvas } from "@/components/studio/canvas/halo-canvas";
import type { HaloNode, SourceSize } from "@/lib/studio/media-halo";

interface PreviewHaloProps {
  halo: HaloNode;
  source: SourceSize | null;
  ratio: number;
}

export function PreviewHalo({ halo, source, ratio }: PreviewHaloProps) {
  const target = useRef<HTMLCanvasElement>(null);
  const latest = useRef(halo);
  const width = source?.width ?? 0;
  const height = source?.height ?? 0;

  useEffect(() => {
    latest.current = halo;
  });

  useEffect(() => {
    let live = true;
    const shown = width > 0 && height > 0 ? { width, height } : null;
    void haloCanvas(latest.current, shown, ratio).then(
      (drawn) => {
        const canvas = target.current;
        if (!live || !canvas) return;
        canvas.width = drawn.width;
        canvas.height = drawn.height;
        canvas.getContext("2d")?.drawImage(drawn, 0, 0);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [halo.key, width, height, ratio]);

  const across = halo.base.width > 0 ? halo.padPx / halo.base.width : 0;
  const down = halo.base.height > 0 ? halo.padPx / halo.base.height : 0;
  return (
    <canvas
      ref={target}
      aria-hidden
      data-studio-halo
      className="pointer-events-none absolute"
      style={{ left: `${-across * 100}%`, top: `${-down * 100}%`, width: `${(1 + 2 * across) * 100}%`, height: `${(1 + 2 * down) * 100}%` }}
    />
  );
}
