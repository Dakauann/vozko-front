"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CircleNotch, Palette, Warning } from "@/components/icons";
import { readMediaFrame, useStudioProjectCreator } from "@/hooks/use-studio-project-creator";
import type { AdPlacements } from "@/lib/advertising/draft-types";
import type { MediaChoice } from "@/lib/advertising/draft";
import { libraryMedia, studioSizesFor } from "@/lib/advertising/placement-check";
import { frameLayout, planPlacementFrames, type FrameLayout, type PixelSize, type PlacementCatalog, type PlannedFrame } from "@/lib/advertising/placement-frames";
import { cn } from "@/lib/utils";

import { AdImage } from "./ad-image";

const PHONE_WIDTH = 390;
const MIN_TILE_SHARE = 30;
const PERCENT = 100;

type ImageRead = { status: "loading" } | { status: "error" } | { status: "ready"; size: PixelSize };

function useImageSize(url: string | undefined): ImageRead {
  const [read, setRead] = useState<{ url: string; size: PixelSize | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    readMediaFrame(url, "image").then(
      (frame) => alive && setRead({ url, size: { width: frame.width, height: frame.height } }),
      () => alive && setRead({ url, size: null }),
    );
    return () => {
      alive = false;
    };
  }, [url]);
  if (!url || read?.url !== url) return { status: "loading" };
  return read.size ? { status: "ready", size: read.size } : { status: "error" };
}

function percent(value: number): string {
  return `${Math.round(value * PERCENT * 100) / 100}%`;
}

function share(value: number): number {
  return Math.round(value * PERCENT);
}

function FramePreview({ url, layout, planned }: { url: string; layout: FrameLayout; planned: PlannedFrame }) {
  const t = useTranslations("adsEditor.placementCheck");
  const { crop, image, safe } = layout;
  const cropWidth = crop.x1 - crop.x0;
  const cropHeight = crop.y1 - crop.y0;
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-[--radius] border border-border bg-muted"
      style={{ aspectRatio: String(layout.ratio), width: `${Math.max(MIN_TILE_SHARE, (planned.frame.displayWidth / PHONE_WIDTH) * PERCENT)}%` }}
      data-frame={planned.frame.id}
    >
      {layout.background > 0 ? (
        <div className="absolute inset-0 scale-110 opacity-70 blur-xl" aria-hidden>
          <AdImage src={url} />
        </div>
      ) : null}
      <div className="absolute overflow-hidden" style={{ left: percent(image.x0), top: percent(image.y0), width: percent(image.x1 - image.x0), height: percent(image.y1 - image.y0) }}>
        <div className="absolute" style={{ left: percent(-crop.x0 / cropWidth), top: percent(-crop.y0 / cropHeight), width: percent(1 / cropWidth), height: percent(1 / cropHeight) }}>
          <AdImage src={url} />
        </div>
      </div>
      {planned.frame.safe ? (
        <>
          <div className="absolute inset-x-0 top-0 flex items-center justify-center bg-destructive/40 text-[0.625rem] font-semibold text-white" style={{ height: percent(safe.y0) }}>
            {t("bandTop")}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-destructive/40 text-[0.625rem] font-semibold text-white" style={{ height: percent(1 - safe.y1) }}>
            {t("bandBottom")}
          </div>
          <div className="absolute left-0 bg-destructive/40" style={{ top: percent(safe.y0), height: percent(safe.y1 - safe.y0), width: percent(safe.x0) }} aria-hidden />
          <div className="absolute right-0 bg-destructive/40" style={{ top: percent(safe.y0), height: percent(safe.y1 - safe.y0), width: percent(1 - safe.x1) }} aria-hidden />
          <div className="absolute border-2 border-warning" style={{ left: percent(safe.x0), top: percent(safe.y0), width: percent(safe.x1 - safe.x0), height: percent(safe.y1 - safe.y0) }} aria-hidden />
        </>
      ) : null}
    </div>
  );
}

function FrameFacts({ layout, planned }: { layout: FrameLayout; planned: PlannedFrame }) {
  const t = useTranslations("adsEditor.placementCheck");
  const shown =
    layout.background > 0
      ? t("background", { percent: share(layout.background) })
      : layout.cropLoss > 0
        ? t("cropped", { percent: share(layout.cropLoss) })
        : t("whole");
  const { recommended } = planned.frame;
  return (
    <ul className="space-y-0.5 text-2xs text-muted-foreground">
      <li>{shown}</li>
      <li className="tabular-nums">
        {t("visible", { width: layout.visible.width, height: layout.visible.height, recommendedWidth: recommended.width, recommendedHeight: recommended.height })}
      </li>
      <li>{t("minText", { px: layout.minTextPx })}</li>
      {layout.belowMinimum ? (
        <li className="flex items-center gap-1 font-medium text-destructive-ink">
          <Warning className="h-3 w-3 shrink-0" aria-hidden />
          {t("belowMinimum")}
        </li>
      ) : null}
    </ul>
  );
}

function FrameTile({ url, size, planned }: { url: string; size: PixelSize; planned: PlannedFrame }) {
  const t = useTranslations("adsEditor.placementCheck");
  const tp = useTranslations("adsWizard.placements");
  const layout = frameLayout(planned.frame, size.width, size.height);
  if (!layout) return null;
  const names = planned.positions.map((p) => `${tp(`platforms.${p.platform}`)} ${tp(`positions.${p.position}`)}`).join(", ");
  return (
    <li className="flex min-w-0 flex-col gap-1.5">
      <p className="text-2xs font-semibold text-foreground">{t(`frames.${planned.frame.id}`)}</p>
      <FramePreview url={url} layout={layout} planned={planned} />
      <FrameFacts layout={layout} planned={planned} />
      <p className="line-clamp-2 text-2xs text-muted-foreground" title={names}>
        {names}
      </p>
    </li>
  );
}

export function PlacementCheck({
  images,
  placements,
  catalog,
  beforeStudio,
}: {
  images: MediaChoice[];
  placements: AdPlacements;
  catalog: PlacementCatalog;
  beforeStudio?: () => Promise<unknown>;
}) {
  const t = useTranslations("adsEditor.placementCheck");
  const [picked, setPicked] = useState(0);
  const [studioError, setStudioError] = useState<string | null>(null);
  const { create, busy } = useStudioProjectCreator();
  const image = images[Math.min(picked, images.length - 1)];
  const read = useImageSize(image?.url);
  const plan = useMemo(() => planPlacementFrames(placements, catalog), [placements, catalog]);

  if (!image) return <p className="text-sm text-muted-foreground">{t("noImage")}</p>;

  const openInStudio = async () => {
    setStudioError(null);
    await beforeStudio?.();
    const outcome = await create({ kind: "image", name: t("studioName"), media: [{ mediaId: image.mediaId, url: image.url, type: "image" }], sizes: studioSizesFor(plan) }, "placements");
    if (!outcome.ok) setStudioError(outcome.error);
  };

  return (
    <div className="space-y-3">
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
      {images.length > 1 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("pickImage")}>
          {images.map((m, index) => (
            <button
              key={m.mediaId}
              type="button"
              onClick={() => setPicked(index)}
              aria-pressed={index === picked}
              className={cn(
                "rounded-[--radius] border px-2 py-1 text-2xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                index === picked ? "border-primary text-foreground" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t("imageNumber", { index: index + 1 })}
            </button>
          ))}
        </div>
      ) : null}
      {read.status === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CircleNotch className="h-4 w-4 animate-spin" aria-hidden />
          {t("loading")}
        </p>
      ) : read.status === "error" ? (
        <p className="text-sm text-destructive-ink" role="alert">
          {t("unreadable")}
        </p>
      ) : plan.frames.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noImagePlacement")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {plan.frames.map((planned) => (
            <FrameTile key={planned.frame.id} url={image.url} size={read.size} planned={planned} />
          ))}
        </ul>
      )}
      <div className="space-y-1 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => void openInStudio()}
          disabled={busy !== null || !libraryMedia(image) || plan.frames.length === 0}
          aria-busy={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-[--radius] border border-control-edge bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {busy !== null ? <CircleNotch className="h-4 w-4 animate-spin" aria-hidden /> : <Palette className="h-4 w-4" aria-hidden />}
          {t("openInStudio")}
        </button>
        <p className="text-2xs text-muted-foreground">{libraryMedia(image) ? t("openInStudioHint") : t("hostedImage")}</p>
        {studioError ? (
          <p className="text-2xs text-destructive-ink" role="alert">
            {studioError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
