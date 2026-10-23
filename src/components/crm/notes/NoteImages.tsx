"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Image as ImageIcon } from "@/components/icons";
import { MediaGalleryDialog } from "@/components/crm/thread/MediaGallery";
import { mediaFrame } from "@/lib/conversations/media-frame";
import type { GalleryItem } from "@/lib/conversations/media-gallery";
import { placeholderDataUrl } from "@/lib/conversations/media-placeholder";
import type { NoteImage } from "@/lib/conversations/notes";
import { cn } from "@/lib/utils";

interface NoteImagesProps {
  noteId: string;
  images: readonly NoteImage[] | undefined;
}

interface Opened {
  index: number;
  returnFocusTo: HTMLElement;
}

function Thumbnail({
  image,
  label,
  fit,
  onOpen,
}: {
  image: NoteImage;
  label: string;
  fit: "contain" | "cover";
  onOpen: (target: HTMLElement) => void;
}) {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  const placeholder = useMemo(() => placeholderDataUrl(image.thumbhash), [image.thumbhash]);

  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setShown(true);
  }, [image.url]);

  return (
    <button
      type="button"
      onClick={(event) => onOpen(event.currentTarget)}
      aria-label={label}
      title={label}
      className="group/thumb relative block h-full w-full cursor-zoom-in overflow-hidden rounded-[--radius] bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {placeholder && !shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img aria-hidden alt="" src={placeholder} className="absolute inset-0 h-full w-full scale-110 object-cover blur-md" />
      ) : null}
      {failed ? (
        <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <ImageIcon weight="bold" className="h-5 w-5" />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={image.url}
          alt=""
          decoding="async"
          loading="lazy"
          onLoad={() => setShown(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full transition-[opacity,transform] duration-200 ease-out group-hover/thumb:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover/thumb:scale-100",
            fit === "cover" ? "object-cover" : "object-contain",
            shown ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </button>
  );
}

export function NoteImages({ noteId, images }: NoteImagesProps) {
  const t = useTranslations("crmMessage.notes.images");
  const [opened, setOpened] = useState<Opened | null>(null);
  const list = images ?? [];
  const items = useMemo<GalleryItem[]>(
    () => list.map((image) => ({ messageId: `${noteId}:${image.id}`, type: "image", url: image.url, caption: "" })),
    [list, noteId],
  );

  if (list.length === 0) return null;

  const label = (index: number) => t("open", { index: index + 1, count: list.length });
  const open = (index: number) => (target: HTMLElement) => setOpened({ index, returnFocusTo: target });
  const single = list.length === 1;
  const frame = single ? mediaFrame("image", list[0]) : null;

  return (
    <div aria-label={t("label", { count: list.length })} role="group" className="mb-1.5">
      {single && frame ? (
        <div className="max-w-full" style={{ width: frame.width, aspectRatio: `${frame.width} / ${frame.height}` }}>
          <Thumbnail image={list[0]} label={label(0)} fit={frame.fit} onOpen={open(0)} />
        </div>
      ) : (
        <div className="grid w-full max-w-[280px] grid-cols-2 gap-1">
          {list.map((image, index) => (
            <div
              key={image.id}
              className={cn("aspect-square", list.length === 3 && index === 0 && "col-span-2 aspect-[2/1]")}
            >
              <Thumbnail image={image} label={label(index)} fit="cover" onOpen={open(index)} />
            </div>
          ))}
        </div>
      )}
      {opened ? (
        <MediaGalleryDialog
          items={items}
          index={opened.index}
          onIndexChange={(index) => setOpened((current) => (current ? { ...current, index } : current))}
          onClose={() => setOpened(null)}
          returnFocusTo={opened.returnFocusTo}
        />
      ) : null}
    </div>
  );
}
