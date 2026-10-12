"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { Waveform } from "@/components/icons";
import { STUDIO_ICONS } from "@/components/studio/canvas/icon-catalog";
import type { LibraryPreview } from "@/lib/studio/library/model";
import { cn } from "@/lib/utils";

const NEAR_MARGIN = "240px";

export function useNearViewport<T extends Element>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const element = ref.current;
    if (near || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setNear(true);
        observer.disconnect();
      },
      { rootMargin: NEAR_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);
  return [ref, near];
}

export function ItemPreview({ preview, name, className }: { preview: LibraryPreview; name: string; className?: string }) {
  if (preview.kind === "text") return <PreviewBody preview={preview} name={name} />;
  return <LazyPreview preview={preview} name={name} className={className} />;
}

function LazyPreview({ preview, name, className }: { preview: LibraryPreview; name: string; className?: string }) {
  const [ref, near] = useNearViewport<HTMLSpanElement>();
  return (
    <span ref={ref} aria-hidden className={cn("inline-flex shrink-0 items-center justify-center", className)}>
      {near ? <PreviewBody preview={preview} name={name} /> : null}
    </span>
  );
}

type Resolved = { from: LibraryPreview; preview: LibraryPreview | null };

function DeferredPreview({ preview, name }: { preview: Extract<LibraryPreview, { kind: "deferred" }>; name: string }) {
  const [resolved, setResolved] = useState<Resolved | null>(null);
  useEffect(() => {
    let live = true;
    preview.load().then(
      (next) => live && setResolved({ from: preview, preview: next }),
      () => live && setResolved({ from: preview, preview: null }),
    );
    return () => {
      live = false;
    };
  }, [preview]);
  const current = resolved?.from === preview ? resolved.preview : null;
  return current && current.kind !== "deferred" ? <PreviewBody preview={current} name={name} /> : null;
}

function SvgMarkup({ markup }: { markup: string }) {
  const html = useMemo(() => ({ __html: markup }), [markup]);
  return <span data-library-preview="svg" className="block h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={html} />;
}

function PreviewBody({ preview, name }: { preview: LibraryPreview; name: string }) {
  switch (preview.kind) {
    case "deferred":
      return <DeferredPreview preview={preview} name={name} />;
    case "svg":
      return <SvgMarkup markup={preview.markup} />;
    case "icon": {
      const Glyph = STUDIO_ICONS[preview.iconId];
      return Glyph ? <Glyph className="h-full w-full" aria-hidden /> : null;
    }
    case "image":
      return <span data-library-preview="image" className="h-full w-full bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url("${preview.src}")` }} />;
    case "text":
      return (
        <span className="truncate leading-tight" style={{ fontSize: preview.size, fontWeight: preview.weight }}>
          {name}
        </span>
      );
    case "sound":
      return <Waveform className="h-full w-full" aria-hidden />;
    case "render":
      return null;
  }
}
