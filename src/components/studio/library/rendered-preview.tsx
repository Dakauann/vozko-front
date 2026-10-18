"use client";

import { useEffect, useState } from "react";

import { libraryLocale } from "@/lib/studio/library/catalog";
import { imageContent } from "@/lib/studio/library/instantiate";
import type { LibraryItem, LibrarySlot } from "@/lib/studio/library/model";
import { cn } from "@/lib/utils";

import { useNearViewport } from "./item-preview";

const PREVIEW_CANVAS = { width: 480, height: 360 };
const PREVIEW_BOX = { x: 0.5, y: 0.5, w: 0.9, h: 0.84 };
export const PREVIEW_PAPER = "#ffffff";

const previews = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

function renderedPreview(item: LibraryItem, locale: string, text: (slot: LibrarySlot) => string): Promise<string> {
  const key = `${item.id}:${libraryLocale(locale)}`;
  const known = previews.get(key);
  if (known) return known;
  const job = queue.then(async () => {
    const content = imageContent(item, { canvas: PREVIEW_CANVAS, locale, text, box: PREVIEW_BOX });
    if (!content) throw new Error(`the library item ${item.id} has no picture to preview`);
    const { rasterizeLayers } = await import("@/components/studio/canvas/rasterize");
    const blob = await rasterizeLayers(content.layers, PREVIEW_CANVAS.width, PREVIEW_CANVAS.height, { background: PREVIEW_PAPER });
    return URL.createObjectURL(blob);
  });
  queue = job.catch(() => undefined);
  previews.set(key, job);
  job.catch(() => previews.delete(key));
  return job;
}

interface RenderedPreviewProps {
  item: LibraryItem;
  name: string;
  locale: string;
  sample: (slot: LibrarySlot) => string;
  compact?: boolean;
}

type Shown = { key: string; url: string } | { key: string; failed: true };

export function RenderedPreview({ item, name, locale, sample, compact }: RenderedPreviewProps) {
  const [ref, near] = useNearViewport<HTMLSpanElement>();
  const key = `${item.id}:${libraryLocale(locale)}`;
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    if (!near) return;
    let live = true;
    renderedPreview(item, locale, sample).then(
      (url) => live && setShown({ key, url }),
      () => live && setShown({ key, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [near, item, locale, sample, key]);

  const current = shown?.key === key ? shown : null;
  return (
    <span ref={ref} aria-hidden data-library-preview="render" className={cn("flex items-center justify-center overflow-hidden rounded-[calc(var(--radius)-2px)] bg-white", compact ? "h-9 w-full" : "h-full w-full")}>
      {current && "url" in current ? (
        <span className="h-full w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${current.url}")` }} />
      ) : current ? (
        <span className="truncate px-1 text-2xs font-medium text-neutral-900">{name}</span>
      ) : null}
    </span>
  );
}
