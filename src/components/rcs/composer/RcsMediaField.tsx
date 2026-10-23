"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowsClockwise, FileText, Image as ImageGlyph, Play, Trash, Waveform } from "@/components/icons";
import { formatBytes } from "@/lib/format/bytes";
import { firstFrameSrc } from "@/lib/media/first-frame";
import { RCS_MEDIA_KINDS, type RcsMedia, type RcsMediaKind } from "@/lib/rcs/types";
import { cn } from "@/lib/utils";

import { useComposer } from "./composer-context";
import { RcsMediaLibrarySheet } from "./RcsMediaLibrarySheet";

function Thumb({ media }: { media: RcsMedia }) {
  const base = "relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[--radius] border border-border bg-muted text-muted-foreground";
  if (media.kind === "image") {
    return (
      <span className={base}>
        <Image src={media.url} alt="" fill unoptimized sizes="56px" className="object-cover" />
      </span>
    );
  }
  if (media.kind === "video") {
    return (
      <span className={base}>
        <video src={firstFrameSrc(media.url)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        <Play aria-hidden weight="fill" className="absolute h-4 w-4 text-white drop-shadow" />
      </span>
    );
  }
  const Glyph = media.kind === "audio" ? Waveform : FileText;
  return (
    <span className={base}>
      <Glyph aria-hidden className="h-5 w-5" />
    </span>
  );
}

export function RcsMediaField({
  label,
  value,
  onChange,
  error,
  kinds = RCS_MEDIA_KINDS,
  optional = false,
}: {
  label: string;
  value?: RcsMedia;
  onChange: (media: RcsMedia | undefined) => void;
  error?: string;
  kinds?: readonly RcsMediaKind[];
  optional?: boolean;
}) {
  const t = useTranslations("rcs.media");
  const locale = useLocale();
  const { pickMedia, disabled } = useComposer();
  const [sheetOpen, setSheetOpen] = useState(false);

  const choose = () => {
    if (!pickMedia) {
      setSheetOpen(true);
      return;
    }
    void pickMedia({ kinds, current: value }).then((media) => {
      if (media) onChange(media);
    });
  };

  const details = value
    ? [t(`kinds.${value.kind}`), value.size_bytes ? formatBytes(value.size_bytes, locale) : null].filter(Boolean).join(" · ")
    : "";

  return (
    <div className="space-y-1.5">
      <p className="flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {optional ? <span className="text-2xs font-normal">{t("optional")}</span> : null}
      </p>
      {value ? (
        <div className={cn("flex items-center gap-3 rounded-[--radius] border bg-card p-2 pr-3", error ? "border-destructive" : "border-border")}>
          <Thumb media={value} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{value.name || t(`kinds.${value.kind}`)}</span>
            <span className="block truncate text-xs text-muted-foreground">{details}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            title={t("replace")}
            icon={<ArrowsClockwise className="h-3.5 w-3.5" />}
            iconVisible
            iconSide="left"
            disabled={disabled}
            onClick={choose}
          />
          <Button variant="ghost" size="icon" aria-label={t("remove")} icon={<Trash className="h-4 w-4" />} iconVisible disabled={disabled} onClick={() => onChange(undefined)} />
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={choose}
          className={cn(
            "flex w-full items-center gap-3 rounded-[--radius] border border-dashed bg-card px-3 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
            error ? "border-destructive" : "border-control-edge",
          )}
        >
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius] bg-muted text-muted-foreground">
            <ImageGlyph className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{t("choose")}</span>
            <span className="block text-xs text-muted-foreground">{t("chooseHint")}</span>
          </span>
        </button>
      )}
      {error ? <p className="text-xs font-medium text-destructive-ink">{error}</p> : null}
      <RcsMediaLibrarySheet
        open={sheetOpen}
        kinds={kinds}
        onOpenChange={setSheetOpen}
        onPicked={(media) => {
          setSheetOpen(false);
          onChange(media);
        }}
      />
    </div>
  );
}
