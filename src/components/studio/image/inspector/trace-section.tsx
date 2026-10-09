"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { VectorToolIcon } from "@/components/studio/canvas/vector/tool-icons";
import { useToast } from "@/hooks/use-toast";
import type { Layer } from "@/lib/studio/document";
import { TRACE_MODES, type TraceMode } from "@/lib/studio/trace/quantize";
import { TRACE_DEFAULTS, type TraceOptions } from "@/lib/studio/trace/trace";

import { IconButton, InspectorSection, SelectField, SliderField, SwitchToggle } from "../controls";
import { useImageEditor } from "../editor-state";
import { layerRaster } from "../trace/layer-raster";
import { traceInBackground } from "../trace/trace-client";

export function TraceSection({ layer }: { layer: Layer }) {
  const t = useTranslations("studio.vectors.trace");
  const { commands } = useImageEditor();
  const { toast } = useToast();
  const [options, setOptions] = useState<TraceOptions>(TRACE_DEFAULTS);
  const [running, setRunning] = useState(false);
  const locked = Boolean(layer.locked);
  const set = (patch: Partial<TraceOptions>) => setOptions((current) => ({ ...current, ...patch }));

  const run = async () => {
    setRunning(true);
    try {
      const raster = await layerRaster(layer);
      if (!raster) {
        toast({ title: t("failed"), variant: "destructive" });
        return;
      }
      const traced = await traceInBackground(raster, options);
      const outcome = commands.placeTrace(layer.id, traced, t("groupName", { name: layer.name ?? t("title") }));
      if (outcome.ok) toast({ title: t("done", { count: outcome.count }) });
      else toast({ title: t(outcome.reason === "empty" ? "nothing" : outcome.reason === "too_large" ? "tooLarge" : "failed"), variant: "destructive" });
    } catch {
      toast({ title: t("failed"), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  return (
    <InspectorSection title={t("title")}>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
      <SelectField<TraceMode> label={t("mode")} value={options.mode} disabled={running} options={TRACE_MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))} onChange={(mode) => set({ mode })} />
      {options.mode === "bw" ? (
        <SliderField label={t("threshold")} value={options.threshold} min={1} max={254} step={1} disabled={running} onChange={(threshold) => set({ threshold })} />
      ) : (
        <SliderField label={t("colors")} value={options.colors} min={2} max={16} step={1} disabled={running} onChange={(colors) => set({ colors })} />
      )}
      <SliderField label={t("detail")} value={Math.round(options.detail * 100)} min={0} max={100} step={1} format={(value) => `${value}%`} disabled={running} onChange={(detail) => set({ detail: detail / 100 })} />
      <SliderField label={t("noise")} value={options.noise} min={0} max={200} step={1} format={(value) => `${value} px`} disabled={running} onChange={(noise) => set({ noise })} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{t("ignoreWhite")}</span>
        <SwitchToggle label={t("ignoreWhite")} checked={options.ignoreWhite} disabled={running} onChange={(ignoreWhite) => set({ ignoreWhite })} />
      </div>
      <IconButton label={running ? t("running") : t("run")} showLabel disabled={running || locked} onClick={() => void run()}>
        <VectorToolIcon tool="pen" className="h-4 w-4" />
      </IconButton>
    </InspectorSection>
  );
}
