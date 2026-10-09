"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { AssetUnavailableError } from "@/components/studio/canvas/asset-images";
import { FontUnavailableError } from "@/components/studio/canvas/ensure-font";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { CircleNotch, DownloadSimple, FloppyDisk } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { Artboard } from "@/lib/studio/document";
import { DEFAULT_JPEG_QUALITY, exportFileName, rasterBackground, visibleLayers, type ExportFormat, type ExportScale } from "@/lib/studio/image-edits";
import { uniqueNames, zipStore } from "@/lib/studio/zip";
import { cn } from "@/lib/utils";

import { useArtboardNames } from "./artboard-names";
import { Notice, OUTLINE_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SliderField, SwitchToggle } from "./controls";
import { currentArtboard, useActiveArtboard, useImageDoc, useImageEditor } from "./editor-state";
import { useDocumentReadiness } from "./use-document-readiness";

type Target = "download" | "library";
type Scope = "active" | "all";

type Raster = typeof import("@/components/studio/canvas/rasterize");

const ZIP_TYPE = "application/zip";

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

interface Rendered {
  blob: Blob;
  fileName: string;
  title: string;
}

export function ExportMenu() {
  const t = useTranslations("studio.image.export");
  const { store, ui, projectName } = useImageEditor();
  const artboards = useImageDoc((s) => s.document.artboards);
  const active = useActiveArtboard();
  const names = useArtboardNames();
  const [scope, setScope] = useState<Scope>("active");
  const several = artboards.length > 1;
  const chosen: readonly Artboard[] = several && scope === "all" ? artboards : [active];
  const readiness = useDocumentReadiness(chosen.flatMap((a) => a.layers));
  const { toast } = useToast();
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState<ExportScale>(1);
  const [quality, setQuality] = useState(Math.round(DEFAULT_JPEG_QUALITY * 100));
  const [transparent, setTransparent] = useState(true);
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const anyClear = chosen.some((a) => a.canvas.background === "" && !a.canvas.gradient);
  const canBeTransparent = anyClear && format === "png";

  const titleOf = (artboard: Artboard) => (several ? `${projectName} ${names.get(artboard.id) ?? ""}`.trim() : projectName);

  const render = async (raster: Raster, artboard: Artboard): Promise<Rendered> => {
    const blob = await raster.rasterizeLayers(visibleLayers(artboard.layers), artboard.canvas.width, artboard.canvas.height, {
      background: artboard.canvas.gradient ? undefined : rasterBackground(artboard.canvas.background, format, transparent),
      backgroundGradient: artboard.canvas.gradient,
      mimeType: format === "png" ? "image/png" : "image/jpeg",
      quality: format === "jpeg" ? quality / 100 : undefined,
      pixelRatio: scale,
    });
    const title = titleOf(artboard);
    return { blob, title, fileName: exportFileName(title, format, scale) };
  };

  const deliver = async (raster: Raster, rendered: Rendered[], target: Target) => {
    if (target === "download") {
      if (rendered.length === 1) return download(rendered[0].blob, rendered[0].fileName);
      const files = uniqueNames(rendered.map((r) => r.fileName));
      const zipped = zipStore(await Promise.all(rendered.map(async (r, i) => ({ name: files[i], data: new Uint8Array(await r.blob.arrayBuffer()) }))));
      return download(new Blob([zipped], { type: ZIP_TYPE }), exportFileName(projectName, format, scale).replace(/\.(png|jpg)$/, ".zip"));
    }
    const saved = [];
    for (const r of rendered) {
      const result = await raster.uploadRaster(r.blob, r.title, r.fileName);
      if ("error" in result) return setError(t("errors.upload", { reason: result.error }));
      saved.push(result.data);
    }
    toast({
      title: saved.length === 1 ? t("saved") : t("savedMany", { count: saved.length }),
      description: (
        <a href={saved[saved.length - 1].mediaUrl} target="_blank" rel="noreferrer" className="font-medium text-primary-ink underline underline-offset-2">
          {t("openSaved")}
        </a>
      ),
    });
  };

  const run = async (target: Target) => {
    const doc = store.getState().document;
    const targets = several && scope === "all" ? doc.artboards : [currentArtboard(store, ui)];
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
    const rendered: Rendered[] = [];
    try {
      for (const artboard of targets) rendered.push(await render(raster, artboard));
    } catch (failure) {
      setBusy(null);
      setError(t(failureKey(failure, raster)));
      return;
    }
    await deliver(raster, rendered, target);
    setBusy(null);
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
        {several ? (
          <div className="space-y-1">
            <span className="block text-xs text-muted-foreground">{t("scope")}</span>
            <ElevatedPillToggle<Scope>
              aria-label={t("scope")}
              value={scope}
              onChange={setScope}
              options={[
                { value: "active", label: t("scopeActive") },
                { value: "all", label: t("scopeAll", { count: artboards.length }) },
              ]}
            />
            <p className="text-2xs text-muted-foreground">{scope === "all" ? t("scopeAllHint") : names.get(active.id)}</p>
          </div>
        ) : null}
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
        {anyClear && format === "jpeg" ? <p className="text-2xs text-muted-foreground">{t("jpegWhite")}</p> : null}
        {readiness === "loading" ? (
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleNotch className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t("loadingAssets")}
          </p>
        ) : null}
        {readiness === "failed" ? <Notice tone="fault" title={t("errors.notReady")} /> : null}
        {error ? <Notice tone="fault" title={error} /> : null}
        <div className="grid grid-cols-1 gap-2">
          <button type="button" disabled={disabled} onClick={() => void run("download")} className={cn(OUTLINE_BUTTON_CLASS, "h-8")}>
            {busy === "download" ? <CircleNotch className="h-4 w-4 animate-spin" aria-hidden /> : <DownloadSimple className="h-4 w-4" aria-hidden />}
            {several && scope === "all" ? t("downloadZip") : t("download")}
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
