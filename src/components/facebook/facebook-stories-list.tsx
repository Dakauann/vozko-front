"use client";

import { ArrowSquareOut, FilmStrip, Image as ImageIcon } from "@/components/icons";
import { useTranslations } from "next-intl";

import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { FacebookStory } from "@/lib/facebook/types";
import { cn } from "@/lib/utils";

export function FacebookStoriesList({ stories }: { stories: FacebookStory[] }) {
  const t = useTranslations("facebook.stories");

  if (stories.length === 0) {
    return (
      <ElevatedContainer className="px-6 py-10 text-center text-sm text-muted-foreground">{t("empty")}</ElevatedContainer>
    );
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {stories.map((story) => {
        const isVideo = story.mediaType.toLowerCase().includes("video");
        const Icon = isVideo ? FilmStrip : ImageIcon;
        return (
          <li key={story.id} className="flex items-center gap-3 rounded-[--radius] border border-border p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{isVideo ? t("video") : t("photo")}</p>
              <p className="text-2xs text-muted-foreground">
                <span
                  className={cn(
                    "mr-1.5 rounded px-1 py-0.5",
                    story.status === "PUBLISHED" ? "bg-muted text-healthy-ink" : "bg-muted text-muted-foreground",
                  )}
                >
                  {story.status === "PUBLISHED" ? t("live") : t("archived")}
                </span>
                {story.createdTime ? new Date(story.createdTime).toLocaleString() : null}
              </p>
            </div>
            {story.url ? (
              <a
                href={story.url}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("open")}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowSquareOut className="h-4 w-4" />
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
