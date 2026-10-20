"use client";

import { createContext, useCallback, useContext, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";

import { CaretLeft, CaretRight, DownloadSimple, Spinner, X } from "@/components/icons";
import { withHostContainer } from "@/contexts/host-document-context";
import { useConversationMediaUrl } from "@/hooks/use-conversation-media-url";
import { galleryIndexOf, stepGallery, type GalleryItem } from "@/lib/conversations/media-gallery";

const GalleryPortal = withHostContainer(DialogPrimitive.Portal);

const ROUND_BUTTON =
  "flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:pointer-events-none disabled:opacity-30";

interface MediaGalleryContextValue {
  open: (messageId: string, returnFocusTo?: HTMLElement | null) => void;
}

const MediaGalleryContext = createContext<MediaGalleryContextValue | null>(null);

export function useMediaGallery(): MediaGalleryContextValue | null {
  return useContext(MediaGalleryContext);
}

function GallerySlide({ item }: { item: GalleryItem }) {
  const t = useTranslations("crmConversation.thread");
  const { mediaUrl, loading } = useConversationMediaUrl(item.url, item.mediaId, item.entryType, item.entryId);

  if (!mediaUrl) {
    return (
      <div className="flex flex-col items-center gap-2 text-sm text-white/80">
        {loading ? <Spinner className="h-6 w-6 animate-spin" /> : null}
        <span>{loading ? t("mediaState.loading") : t("mediaState.unavailable")}</span>
      </div>
    );
  }

  if (item.type === "video") {
    return <video key={mediaUrl} src={mediaUrl} controls autoPlay className="max-h-[80vh] max-w-[90vw] rounded-lg bg-black" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={mediaUrl} alt={item.caption || t("media.image")} className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
  );
}

function GalleryDownload({ item }: { item: GalleryItem }) {
  const t = useTranslations("crmConversation.thread.gallery");
  const { mediaUrl } = useConversationMediaUrl(item.url, item.mediaId, item.entryType, item.entryId);
  if (!mediaUrl) return null;
  return (
    <a href={mediaUrl} target="_blank" rel="noopener noreferrer" download aria-label={t("download")} title={t("download")} className={ROUND_BUTTON}>
      <DownloadSimple weight="bold" className="h-5 w-5" />
    </a>
  );
}

function arrowStep(event: KeyboardEvent<HTMLElement>): number {
  if ((event.target as Element).tagName === "VIDEO") return 0;
  if (event.key === "ArrowRight") return 1;
  if (event.key === "ArrowLeft") return -1;
  return 0;
}

export function MediaGalleryDialog({
  items,
  index,
  onIndexChange,
  onClose,
  returnFocusTo,
}: {
  items: readonly GalleryItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const t = useTranslations("crmConversation.thread.gallery");
  const item = items[index];
  if (!item) return null;

  const move = (delta: number) => onIndexChange(stepGallery(index, delta, items.length));

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => (open ? undefined : onClose())}>
      <GalleryPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/80" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo) return;
            event.preventDefault();
            returnFocusTo.focus();
          }}
          onKeyDown={(event) => {
            const delta = arrowStep(event);
            if (delta === 0) return;
            event.preventDefault();
            move(delta);
          }}
          className="fixed inset-0 z-[91] flex flex-col items-center justify-center gap-3 p-4 outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{t("title")}</DialogPrimitive.Title>
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2">
            <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-medium tabular-nums text-white" aria-live="polite">
              {t("counter", { current: String(index + 1), total: String(items.length) })}
            </span>
            <div className="flex items-center gap-2">
              <GalleryDownload key={item.messageId} item={item} />
              <DialogPrimitive.Close aria-label={t("close")} title={t("close")} className={ROUND_BUTTON}>
                <X weight="bold" className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="flex w-full items-center justify-between gap-2">
            <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label={t("previous")} title={t("previous")} className={ROUND_BUTTON}>
              <CaretLeft weight="bold" className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center">
              <GallerySlide key={item.messageId} item={item} />
            </div>
            <button
              type="button"
              onClick={() => move(1)}
              disabled={index === items.length - 1}
              aria-label={t("next")}
              title={t("next")}
              className={ROUND_BUTTON}
            >
              <CaretRight weight="bold" className="h-5 w-5" />
            </button>
          </div>
          {item.caption ? <p className="max-w-[90vw] truncate text-sm text-white/90">{item.caption}</p> : null}
        </DialogPrimitive.Content>
      </GalleryPortal>
    </DialogPrimitive.Root>
  );
}

interface OpenGallery {
  messageId: string;
  returnFocusTo: HTMLElement | null;
}

export function MediaGalleryProvider({ items, children }: { items: readonly GalleryItem[]; children: ReactNode }) {
  const [opened, setOpened] = useState<OpenGallery | null>(null);

  const open = useCallback((messageId: string, returnFocusTo?: HTMLElement | null) => {
    setOpened({ messageId, returnFocusTo: returnFocusTo ?? null });
  }, []);

  const value = useMemo(() => ({ open }), [open]);
  const index = opened ? galleryIndexOf(items, opened.messageId) : -1;

  return (
    <MediaGalleryContext.Provider value={value}>
      {children}
      {opened && index >= 0 ? (
        <MediaGalleryDialog
          items={items}
          index={index}
          onIndexChange={(next) => setOpened((current) => (current ? { ...current, messageId: items[next].messageId } : current))}
          onClose={() => setOpened(null)}
          returnFocusTo={opened.returnFocusTo}
        />
      ) : null}
    </MediaGalleryContext.Provider>
  );
}
