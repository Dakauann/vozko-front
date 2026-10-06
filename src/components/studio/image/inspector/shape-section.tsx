"use client";

import { useTranslations } from "next-intl";

import type { Layer } from "@/lib/studio/document";
import { LAYER_RANGES } from "@/lib/studio/layer-ranges";
import type { LayerPatch } from "@/lib/studio/layers";

import { ColorField, InspectorSection, LABEL_CLASS, NumberField, SliderField, SwitchToggle, ToggleButton } from "../controls";
import { useImageEditor } from "../editor-state";
import { GradientFields, ShadowSection } from "./effects";

function isLine(layer: Layer): boolean {
  return layer.shape === "line" || layer.shape === "arrow";
}

export function ShapeSection({ layers }: { layers: Layer[] }) {
  const t = useTranslations("studio.image.inspector.shape");
  const { commands } = useImageEditor();
  const first = layers[0];
  const ids = layers.map((l) => l.id);
  const locked = layers.every((l) => l.locked);
  const lines = layers.every(isLine);
  const rects = layers.every((l) => l.shape === "rect");
  const patch = (next: LayerPatch) => commands.patchLayers(ids, next);
  const stroked = (first.strokeWidth ?? 0) > 0;

  return (
    <>
      <InspectorSection title={t(lines ? "lineTitle" : "title")}>
        {lines ? (
          <>
            <ColorField label={t("color")} value={first.stroke ?? ""} disabled={locked} onCommit={(stroke) => patch({ stroke })} />
            <NumberField
              label={t("strokeWidth")}
              value={first.strokeWidth ?? 0}
              min={1}
              max={LAYER_RANGES.strokeWidth[1]}
              suffix="px"
              disabled={locked}
              onCommit={(strokeWidth) => patch({ strokeWidth })}
            />
            <div role="group" aria-label={t("heads")} className="flex items-center gap-1">
              <span className={LABEL_CLASS}>{t("heads")}</span>
              <ToggleButton label={t("headStart")} pressed={Boolean(first.arrowStart)} disabled={locked} onClick={() => patch({ arrowStart: first.arrowStart ? undefined : true })}>
                {t("headStartShort")}
              </ToggleButton>
              <ToggleButton label={t("headEnd")} pressed={Boolean(first.arrowEnd)} disabled={locked} onClick={() => patch({ arrowEnd: first.arrowEnd ? undefined : true })}>
                {t("headEndShort")}
              </ToggleButton>
            </div>
          </>
        ) : (
          <>
            {first.gradient ? null : (
              <ColorField label={t("fill")} value={first.fill ?? ""} allowEmpty emptyLabel={t("none")} disabled={locked} onCommit={(fill) => patch({ fill: fill || undefined })} />
            )}
            <GradientFields gradient={first.gradient} fallback={first.fill ?? ""} disabled={locked} onChange={(gradient) => patch({ gradient })} />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{t("border")}</span>
              <SwitchToggle
                label={t("border")}
                checked={stroked}
                disabled={locked}
                onChange={(on) => patch(on ? { stroke: first.stroke || "#111111", strokeWidth: 4 } : { strokeWidth: 0 })}
              />
            </div>
            {stroked ? (
              <>
                <ColorField label={t("borderColor")} value={first.stroke ?? ""} disabled={locked} onCommit={(stroke) => patch({ stroke })} />
                <NumberField
                  label={t("strokeWidth")}
                  value={first.strokeWidth ?? 0}
                  min={0}
                  max={LAYER_RANGES.strokeWidth[1]}
                  suffix="px"
                  disabled={locked}
                  onCommit={(strokeWidth) => patch({ strokeWidth })}
                />
              </>
            ) : null}
            {rects ? (
              <SliderField
                label={t("radius")}
                value={Math.round((first.radius ?? 0) * 100)}
                min={0}
                max={100}
                step={1}
                format={(value) => `${value}%`}
                disabled={locked}
                onStart={commands.beginLive}
                onEnd={commands.endLive}
                onChange={(value) => patch({ radius: value === 0 ? undefined : value / 100 })}
              />
            ) : null}
          </>
        )}
        {lines || stroked ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{t("dash")}</span>
            <SwitchToggle label={t("dash")} checked={Boolean(first.dash)} disabled={locked} onChange={(dash) => patch({ dash: dash || undefined })} />
          </div>
        ) : null}
      </InspectorSection>
      <ShadowSection layer={first} disabled={locked} onPatch={patch} />
    </>
  );
}

export function IconSection({ layers }: { layers: Layer[] }) {
  const t = useTranslations("studio.image.inspector.icon");
  const { commands } = useImageEditor();
  const first = layers[0];
  const ids = layers.map((l) => l.id);
  const locked = layers.every((l) => l.locked);
  const patch = (next: LayerPatch) => commands.patchLayers(ids, next);
  return (
    <>
      <InspectorSection title={t("title")}>
        <ColorField label={t("color")} value={first.fill ?? ""} disabled={locked} onCommit={(fill) => patch({ fill })} />
      </InspectorSection>
      <ShadowSection layer={first} disabled={locked} onPatch={patch} />
    </>
  );
}
