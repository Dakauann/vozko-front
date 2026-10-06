"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { AssetUnavailableError } from "@/components/studio/canvas/asset-images";
import { FontUnavailableError } from "@/components/studio/canvas/ensure-font";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { CircleNotch, DownloadSimple, FloppyDisk } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_JPEG_QUALITY, exportFileName, rasterBackground, visibleLayers, type ExportFormat, type ExportScale } from "@/lib/studio/image-edits";
import { cn } from "@/lib/utils";

import { Notice, OUTLINE_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SliderField, SwitchToggle } from "./controls";
import { useImageDoc, useImageEditor } from "./editor-state";
import { useDocumentReadiness } from "./use-document-readiness";

type Target = "download" | "library";

type Raster = typeof import("@/components/studio/canvas/rasterize");

function failureKey(error: unknown, raster: Raster): string {
  if (error instanceof FontUnavailableError) return "errors.font";
  if (error instanceof AssetUnavailableError) return "errors.asset";
  if (error instanceof raster.RasterTimeoutError) return "errors.timeout";
  return "errors.render";
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportMenu() {
  const t = useTranslations("studio.image.export");
  const { store, projectName } = useImageEditor();
  const layers = useImageDoc((s) => s.document.layers);
  const background = useImageDoc((s) => (s.document.canvas.gradient ? "gradient" : s.document.canvas.background));
  const readiness = useDocumentReadiness(layers);
  const { toast } = useToast();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState<ExportScale>(1);
  const [quality, setQuality] = useState(Math.round(DEFAULT_JPEG_QUALITY * 100));
  const [transparent, setTransparent] = useState(true);
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canBeTransparent = background === "" && format === "png";

  const run = async (target: Target) => {
    const doc = store.getState().document;
    const fileName = exportFileName(projectName, format, scale);
    setBusy(target);
    setError(null);
    let raster: Raster;
    try {
      raster = await import("@/components/studio/canvas/rasterize");
    } catch {
      setBusy(null);
      setError(t("errors.render"));
      return;
    }
    let blob: Blob;
    try {
      blob = await raster.rasterizeLayers(visibleLayers(doc.layers), doc.canvas.width, doc.canvas.height, {
        background: doc.canvas.gradient ? undefined : rasterBackground(doc.canvas.background, format, transparent),
        backgroundGradient: doc.canvas.gradient,
        mimeType: format === "png" ? "image/png" : "image/jpeg",
        quality: format === "jpeg" ? quality / 100 : undefined,
        pixelRatio: scale,
      });
    } catch (failure) {
      setBusy(null);
      setError(t(failureKey(failure, raster)));
      return;
    }
    if (target === "download") {
      download(blob, fileName);
      setBusy(null);
      return;
    }
    const saved = await raster.uploadRaster(blob, projectName, fileName);
    setBusy(null);
    if ("error" in saved) {
      setError(t("errors.upload", { reason: saved.error }));
      return;
    }
    toast({
      title: t("saved"),
      description: (
        <a href={saved.data.mediaUrl} target="_blank" rel="noreferrer" className="font-medium text-primary-ink underline underline-offset-2">
          {t("openSaved")}
        </a>
      ),
    });
  };

  const disabled = readiness !== "ready" || busy !== null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" data-tour="studio-image-export" className={PRIMARY_BUTTON_CLASS}>
          <DownloadSimple className="h-4 w-4" aria-hidden />
          {t("open")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">{t("format")}</span>
          <ElevatedPillToggle<ExportFormat>
            aria-label={t("format")}
            value={format}
            onChange={setFormat}
            options={[
              { value: "png", label: "PNG" },
              { value: "jpeg", label: "JPG" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <span className="block text-xs text-muted-foreground">{t("scale")}</span>
          <ElevatedPillToggle<"1" | "2">
            aria-label={t("scale")}
            value={String(scale) as "1" | "2"}
            onChange={(value) => setScale(value === "2" ? 2 : 1)}
            options={[
              { value: "1", label: "1x" },
              { value: "2", label: "2x" },
            ]}
          />
        </div>
        {format === "jpeg" ? (
          <SliderField label={t("quality")} value={quality} min={10} max={100} step={1} format={(value) => `${value}%`} onChange={setQuality} />
        ) : null}
        {canBeTransparent ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-foreground">{t("transparent")}</span>
            <SwitchToggle label={t("transparent")} checked={transparent} onChange={setTransparent} />
          </div>
        ) : null}
        {background === "" && format === "jpeg" ? <p className="text-2xs text-muted-foreground">{t("jpegWhite")}</p> : null}
        {readiness === "loading" ? (
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t("loadingAssets")}
          </p>
        ) : null}
        {readiness === "failed" ? (
          <Notice tone="fault" title={t("errors.notReady")} />
        ) : null}
        {error ? (
          <Notice tone="fault" title={error} />
        ) : null}
        <div className="grid grid-cols-1 gap-2">
          <button type="button" disabled={disabled} onClick={() => void run("download")} className={cn(OUTLINE_BUTTON_CLASS, "h-8")}>
            {busy === "download" ? <CircleNotch className="h-4 w-4 animate-spin" aria-hidden /> : <DownloadSimple className="h-4 w-4" aria-hidden />}
            {t("download")}
          </button>
          <button type="button" disabled={disabled} onClick={() => void run("library")} className={cn(PRIMARY_BUTTON_CLASS, "h-8")}>
            {busy === "library" ? <CircleNotch className="h-4 w-4 animate-spin" aria-hidden /> : <FloppyDisk className="h-4 w-4" aria-hidden />}
            {t("save")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
