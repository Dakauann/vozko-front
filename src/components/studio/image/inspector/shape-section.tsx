"use client";

import { useTranslations } from "next-intl";

import { VectorToolIcon } from "@/components/studio/canvas/vector/tool-icons";

import { takesArrowheads } from "@/lib/studio/arrowheads";
import { layerNodeCount } from "@/lib/studio/shape-ops";
import { STAR_DEFAULTS, type Layer } from "@/lib/studio/document";
import { LAYER_RANGES } from "@/lib/studio/layer-ranges";
import type { LayerPatch } from "@/lib/studio/layers";

import { ColorField, IconButton, InspectorSection, LABEL_CLASS, NumberField, SliderField, SwitchToggle, ToggleButton } from "../controls";
import { useImageEditor } from "../editor-state";
import { useSelectionActions, type MenuAction } from "../selection-actions";
import { GradientFields, ShadowSection, StrokeStyleFields } from "./effects";

function isLine(layer: Layer): boolean {
  return layer.shape === "line" || layer.shape === "arrow";
}

function ArrowheadToggles({ layer, locked, onPatch }: { layer: Layer; locked: boolean; onPatch: (patch: LayerPatch) => void }) {
  const t = useTranslations("studio.image.inspector.shape");
  return (
    <div role="group" aria-label={t("heads")} className="flex items-center gap-1">
      <span className={LABEL_CLASS}>{t("heads")}</span>
      <ToggleButton label={t("headStart")} pressed={Boolean(layer.arrowStart)} disabled={locked} onClick={() => onPatch({ arrowStart: layer.arrowStart ? undefined : true })}>
        {t("headStartShort")}
      </ToggleButton>
      <ToggleButton label={t("headEnd")} pressed={Boolean(layer.arrowEnd)} disabled={locked} onClick={() => onPatch({ arrowEnd: layer.arrowEnd ? undefined : true })}>
        {t("headEndShort")}
      </ToggleButton>
    </div>
  );
}

function ShapeOpButtons({ label, actions, showLabel }: { label: string; actions: MenuAction[]; showLabel?: boolean }) {
  if (actions.length === 0) return null;
  return (
    <div role="group" aria-label={label} className={showLabel ? "flex flex-wrap gap-1" : "flex items-center gap-1"}>
      {showLabel ? null : <span className={LABEL_CLASS}>{label}</span>}
      {actions.map((action) => (
        <IconButton key={action.id} label={action.label} showLabel={showLabel} disabled={action.disabled} onClick={action.run}>
          {action.icon}
        </IconButton>
      ))}
    </div>
  );
}

const CONVERTIBLE = new Set<Layer["shape"]>(["rect", "ellipse", "triangle", "star"]);

function VectorFields({ layers, locked }: { layers: Layer[]; locked: boolean }) {
  const t = useTranslations("studio.vectors.inspector");
  const to = useTranslations("studio.vectors.ops");
  const { commands } = useImageEditor();
  const actions = useSelectionActions();
  const ids = layers.map((l) => l.id);
  const paths = layers.every((l) => l.shape === "path");
  const convertible = layers.every((l) => CONVERTIBLE.has(l.shape));
  if (paths) {
    return (
      <>
        <div className="flex items-center justify-between gap-2" title={t("fillRuleHint")}>
          <span className="text-xs text-muted-foreground">{t("fillRule")}</span>
          <SwitchToggle
            label={t("fillRule")}
            checked={layers[0].fillRule === "evenodd"}
            disabled={locked}
            onChange={(on) => commands.patchLayers(ids, { fillRule: on ? "evenodd" : undefined })}
          />
        </div>
        {layers.length === 1 ? (
          <IconButton label={t("editPoints")} showLabel disabled={locked} onClick={() => commands.startPathEdit(layers[0].id)}>
            <VectorToolIcon tool="pen" className="h-4 w-4" />
          </IconButton>
        ) : null}
        {layers.length === 1 ? <p className="text-2xs text-muted-foreground">{to("points", { count: layerNodeCount(layers[0]) })}</p> : null}
        <ShapeOpButtons label={to("title")} actions={actions.paths} showLabel />
      </>
    );
  }
  if (!convertible) return null;
  return (
    <IconButton label={t("convert")} showLabel disabled={locked} onClick={() => commands.convertToPath(ids)}>
      <VectorToolIcon tool="pen" className="h-4 w-4" />
    </IconButton>
  );
}

export function ShapeSection({ layers }: { layers: Layer[] }) {
  const t = useTranslations("studio.image.inspector.shape");
  const to = useTranslations("studio.vectors.ops");
  const { commands } = useImageEditor();
  const actions = useSelectionActions();
  const first = layers[0];
  const ids = layers.map((l) => l.id);
  const locked = layers.every((l) => l.locked);
  const lines = layers.every(isLine);
  const rects = layers.every((l) => l.shape === "rect");
  const stars = layers.every((l) => l.shape === "star");
  const patch = (next: LayerPatch) => commands.patchLayers(ids, next);
  const stroked = (first.strokeWidth ?? 0) > 0;
  const openPaths = !lines && layers.every(takesArrowheads);

  return (
    <>
      <InspectorSection title={t(lines ? "lineTitle" : "title")}>
        {layers.length > 1 ? <ShapeOpButtons label={to("title")} actions={actions.shapes} /> : null}
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
            <ArrowheadToggles layer={first} locked={locked} onPatch={patch} />
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
                {openPaths ? <ArrowheadToggles layer={first} locked={locked} onPatch={patch} /> : null}
              </>
            ) : null}
            {stars ? (
              <>
                <NumberField
                  label={t("points")}
                  value={first.points || STAR_DEFAULTS.points}
                  min={LAYER_RANGES.starPoints[0]}
                  max={LAYER_RANGES.starPoints[1]}
                  disabled={locked}
                  onCommit={(points) => patch({ points: Math.round(points) })}
                />
                <SliderField
                  label={t("inner")}
                  value={Math.round((first.inner || STAR_DEFAULTS.inner) * 100)}
                  min={Math.round(LAYER_RANGES.starInner[0] * 100)}
                  max={Math.round(LAYER_RANGES.starInner[1] * 100)}
                  step={1}
                  format={(value) => `${value}%`}
                  disabled={locked}
                  onStart={commands.beginLive}
                  onEnd={commands.endLive}
                  onChange={(value) => patch({ inner: value / 100 })}
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
        {lines ? null : <VectorFields layers={layers} locked={locked} />}
        {lines || stroked ? <StrokeStyleFields layer={first} disabled={locked} onPatch={patch} /> : null}
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
