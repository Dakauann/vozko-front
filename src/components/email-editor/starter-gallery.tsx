"use client";

import { useTranslations } from "next-intl";

import { emailLook, OUTER_PADDING } from "@/lib/email-design/look";
import type { Document, Starter } from "@/lib/email-design/types";
import { cn } from "@/lib/utils";

import { StaticEmail, useEmailViewLabels } from "./email-view";

interface StarterGalleryProps {
  starters: readonly Starter[];
  onPick: (document: Document) => void;
  className?: string;
}

const THUMB_WIDTH = 224;
const THUMB_HEIGHT = 280;

export function EmailThumbnail({ document, width = THUMB_WIDTH, height = THUMB_HEIGHT }: { document: Document; width?: number; height?: number }) {
  const labels = useEmailViewLabels();
  const look = emailLook(document.settings, "desktop");
  const natural = look.width + 2 * OUTER_PADDING;
  const scale = width / natural;
  return (
    <div aria-hidden className="pointer-events-none relative overflow-hidden" style={{ width, height, backgroundColor: look.background }}>
      <div style={{ width: natural, transform: `scale(${scale})`, transformOrigin: "top left", padding: `0 ${OUTER_PADDING}px` }}>
        <StaticEmail document={document} look={look} labels={labels} />
      </div>
    </div>
  );
}

export function StarterGallery({ starters, onPick, className }: StarterGalleryProps) {
  const t = useTranslations("emailEditor");
  const name = (key: string) => (t.has(`starters.${key}`) ? t(`starters.${key}`) : key);
  const description = (key: string) => (t.has(`gallery.descriptions.${key}`) ? t(`gallery.descriptions.${key}`) : "");

  return (
    <ul aria-label={t("gallery.label")} className={cn("grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-px overflow-hidden rounded-lg border border-border bg-border", className)}>
      {starters.map((starter) => (
        <li key={starter.key} className="bg-card">
          <button
            type="button"
            onClick={() => onPick(structuredClone(starter.document))}
            className="group flex h-full w-full flex-col items-center gap-3 p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="block overflow-hidden rounded-[--radius] border border-border shadow-sm transition-shadow duration-150 group-hover:shadow-md">
              <EmailThumbnail document={starter.document} />
            </span>
            <span className="block w-full">
              <span className="block text-sm font-semibold text-foreground">{name(starter.key)}</span>
              {description(starter.key) ? <span className="mt-0.5 block text-2xs leading-relaxed text-muted-foreground">{description(starter.key)}</span> : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
