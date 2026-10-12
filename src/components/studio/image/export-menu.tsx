"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { CircleNotch, DownloadSimple, FloppyDisk, Megaphone } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRouter } from "@/i18n/routing";
import { createDialogHref } from "@/lib/advertising/editor-entry";
import { adExportBlock, adExportRequest } from "@/lib/studio/ad-export";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { Artboard } from "@/lib/studio/document";
import { resolvedArtboards } from "@/lib/studio/components";
import { DEFAULT_JPEG_QUALITY, exportFileName, isRasterFormat, type ExportFormat, type ExportScale } from "@/lib/studio/image-edits";
import { PDF_PRESETS, type PdfPreset } from "@/lib/studio/pdf-export";
import { uniqueNames, zipStore } from "@/lib/studio/zip";
import { cn } from "@/lib/utils";

import { useArtboardNames } from "./artboard-names";
import { Notice, OUTLINE_BUTTON_CLASS, PRIMARY_BUTTON_CLASS, SliderField, SwitchToggle } from "./controls";
import { currentArtboard, useActiveArtboard, useImageDoc, useImageEditor } from "./editor-state";
import { artboardTitle, exportFailure, loadRaster, rasterizedLayers, renderExport, saveRendered, type Raster, type RenderedArtboard } from "./export-artboards";
import { useDocumentReadiness } from "./use-document-readiness";
import { useLayerLabeler } from "./use-layer-label";

type Target = "download" | "library" | "ad";
type Scope = "active" | "all";

const ZIP_TYPE = "application/zip";

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

function VectorNote({ artboards, transparent }: { artboards: readonly Artboard[]; transparent: boolean }) {
  const t = useTranslations("studio.image.export");
  const count = useMemo(() => rasterizedLayers(artboards, transparent), [artboards, transparent]);
  return (
    <div className="space-y-0.5 text-2xs text-muted-foreground">
      <p>{t("vectorHint")}</p>
      {count > 0 ? <p>{t("rasterized", { count })}</p> : null}
    </div>
  );
}

export function ExportMenu() {
  const t = useTranslations("studio.image.export");
  const layerLabel = useLayerLabeler();
  const { store, ui, projectId, projectName } = useImageEditor();
  const project = useImageDoc((s) => s.document);
  const artboards = project.artboards;
  const active = useActiveArtboard();
  const names = useArtboardNames();
  const [scope, setScope] = useState<Scope>("active");
  const several = artboards.length > 1;
  const chosen: readonly Artboard[] = useMemo(() => resolvedArtboards(project, several && scope === "all" ? artboards : [active]), [project, several, scope, artboards, active]);
  const readiness = useDocumentReadiness(chosen.flatMap((a) => a.layers));
  const { toast } = useToast();
  const router = useRouter();
  const { can, permissionsLoading } = useWorkspace();
  const ad = useTranslations("adFromMedia");
  const [format, setFormat] = useState<ExportFormat>("png");
  const [scale, setScale] = useState<ExportScale>(1);
  const [quality, setQuality] = useState(Math.round(DEFAULT_JPEG_QUALITY * 100));
  const [transparent, setTransparent] = useState(true);
  const [preset, setPreset] = useState<PdfPreset>("digital");
  const [busy, setBusy] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);
  const anyClear = chosen.some((a) => a.canvas.background === "" && !a.canvas.gradient);
  const canBeTransparent = anyClear && format !== "jpeg";
  const rasterFormat = isRasterFormat(format);
  const onePdf = format === "pdf";

  const titleOf = (artboard: Artboard) => artboardTitle(projectName, names, artboards.length, artboard.id);

  const requestFor = (target: Target) => {
    const request = { format, scale, quality: quality / 100, transparent, preset };
    return target === "ad" ? adExportRequest(request) : request;
  };


  const deliver = async (raster: Raster, rendered: RenderedArtboard[], target: Target) => {
    if (target === "download") {
      if (rendered.length === 1) return download(rendered[0].blob, rendered[0].fileName);
      const files = uniqueNames(rendered.map((r) => r.fileName));
      const zipped = zipStore(await Promise.all(rendered.map(async (r, i) => ({ name: files[i], data: new Uint8Array(await r.blob.arrayBuffer()) }))));
      return download(new Blob([zipped], { type: ZIP_TYPE }), exportFileName(projectName, format, scale).replace(/\.[a-z]+$/, ".zip"));
    }
    const result = await saveRendered(raster, rendered, projectId);
    if (!result.ok) return setError(t("errors.upload", { reason: result.reason }));
    const saved = result.saved;
    if (target === "ad") return router.push(createDialogHref({ media: { kind: "image", mediaId: saved[0].mediaId } }));
    const image = rendered.every((r) => isRasterFormat(r.format));
    toast({
      title: saved.length === 1 ? t(image ? "saved" : "savedFile") : t(image ? "savedMany" : "savedFiles", { count: saved.length }),
      description: (
        <a href={saved[saved.length - 1].mediaUrl} target="_blank" rel="noreferrer" className="font-medium text-primary-ink underline underline-offset-2">
          {t(image ? "openSaved" : "openFile")}
        </a>
      ),
    });
  };

  const run = async (target: Target) => {
    const doc = store.getState().document;
    const targets = resolvedArtboards(doc, several && scope === "all" ? doc.artboards : [currentArtboard(store, ui)]);
    setBusy(target);
    setError(null);
    let raster: Raster;
    try {
      raster = await loadRaster();
    } catch {
      setBusy(null);
      setError(t("errors.render"));
      return;
    }
    let rendered: RenderedArtboard[];
    try {
      rendered = await renderExport(raster, targets, requestFor(target), titleOf, projectName);
    } catch (failure) {
      setBusy(null);
      const failed = exportFailure(failure, raster);
      setError(failed.key === "errors.lut" ? t(failed.key, { name: layerLabel(failed.layer) }) : t(failed.key));
      return;
    }
    await deliver(raster, rendered, target);
    setBusy(null);
  };

  const disabled = readiness !== "ready" || busy !== null;
  const canAdvertise = !permissionsLoading && can("ads", "create");
  const adBlock = adExportBlock(format, chosen.length);

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
            <p className="text-2xs text-muted-foreground">{scope === "all" ? t(onePdf ? "scopeAllPdfHint" : "scopeAllHint") : names.get(active.id)}</p>
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
              { value: "pdf", label: "PDF" },
              { value: "svg", label: "SVG" },
            ]}
          />
        </div>
        {rasterFormat ? (
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
        ) : null}
        {onePdf ? (
          <div className="space-y-1">
            <span className="block text-xs text-muted-foreground">{t("preset")}</span>
            <ElevatedPillToggle<PdfPreset> aria-label={t("preset")} value={preset} onChange={setPreset} options={PDF_PRESETS.map((value) => ({ value, label: t(`presets.${value}`) }))} />
            <p className="text-2xs text-muted-foreground">{t(`presetHints.${preset}`)}</p>
          </div>
        ) : null}
        {rasterFormat ? null : <VectorNote artboards={chosen} transparent={transparent} />}
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
            {several && scope === "all" && !onePdf ? t("downloadZip") : t("download")}
          </button>
          <button type="button" disabled={disabled} onClick={() => void run("library")} className={cn(PRIMARY_BUTTON_CLASS, "h-8")}>
            {busy === "library" ? <CircleNotch className="h-4 w-4 animate-spin" aria-hidden /> : <FloppyDisk className="h-4 w-4" aria-hidden />}
            {t("save")}
          </button>
          {canAdvertise ? (
            <button type="button" disabled={disabled || adBlock !== null} title={ad("useInAdHint")} onClick={() => void run("ad")} className={cn(OUTLINE_BUTTON_CLASS, "h-8")}>
              {busy === "ad" ? <CircleNotch className="h-4 w-4 animate-spin" aria-hidden /> : <Megaphone className="h-4 w-4" aria-hidden />}
              {ad("useInAd")}
            </button>
          ) : null}
          {canAdvertise && adBlock ? <p className="text-2xs text-muted-foreground">{ad(adBlock)}</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
