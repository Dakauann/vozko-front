"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { ArrowSquareOut } from "@/components/icons";
import { MediaDownloadButton } from "@/components/media/media-download-button";
import type { ChatImage } from "@/lib/aichat/types";

export function ChatImageView({ image }: { image: ChatImage }) {
  const t = useTranslations("aiChatPage.image");
  return (
    <figure className="max-w-sm space-y-1.5">
      <a
        href={image.url}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-[--radius] border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Image
          src={image.url}
          alt={image.alt}
          width={0}
          height={0}
          sizes="(max-width: 640px) 100vw, 384px"
          unoptimized
          className="h-auto w-full"
        />
      </a>
      <figcaption className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="line-clamp-1">{image.alt}</span>
        <span className="flex shrink-0 items-start gap-3">
          <MediaDownloadButton mediaId={image.mediaId} description={image.alt} />
          <a
            href={image.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary-ink hover:underline"
          >
            {t("open")}
            <ArrowSquareOut className="h-3.5 w-3.5" aria-hidden />
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
