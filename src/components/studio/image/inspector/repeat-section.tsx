"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { Artboard, Layer } from "@/lib/studio/document";
import { defaultRepeat, MIRROR_SIDES, REPEAT_DIRECTIONS, REPEAT_FLIPS, REPEAT_LAYOUTS, REPEAT_MODES, REPEAT_RANGES, repeatIssue, type Repeat, type RepeatMode } from "@/lib/studio/repeat";
import { repeatLayers, selectionGroup, sourceBox } from "@/lib/studio/repeat-edits";
import { cn } from "@/lib/utils";

import { InspectorSection, Notice, NumberField, OUTLINE_BUTTON_CLASS, SelectField, SwitchRow } from "../controls";
import { useImageEditor } from "../editor-state";

const NONE = "none";

type Change = (patch: Partial<Repeat>) => void;

function RadialFields({ repeat, disabled, change }: { repeat: Repeat; disabled: boolean; change: Change }) {
  const t = useTranslations("studio.image.repeat");
  const count = repeat.count ?? 2;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t("count")} value={count} min={2} disabled={disabled} onCommit={(value) => change({ count: Math.round(value), shown: repeat.shown && repeat.shown < Math.round(value) ? repeat.shown : undefined })} />
        <NumberField label={t("shown")} value={repeat.shown || count} min={1} max={count} disabled={disabled} onCommit={(value) => change({ shown: Math.round(value) >= count ? undefined : Math.round(value) })} />
      </div>
      <NumberField label={t("radius")} value={Math.round(repeat.radius ?? 1)} min={REPEAT_RANGES.radius[0]} max={REPEAT_RANGES.radius[1]} suffix="px" disabled={disabled} onCommit={(radius) => change({ radius })} />
      <NumberField label={t("startAngle")} value={Math.round(repeat.startAngle ?? 0)} min={REPEAT_RANGES.startAngle[0]} max={REPEAT_RANGES.startAngle[1]} suffix="°" disabled={disabled} onCommit={(startAngle) => change({ startAngle })} />
      <NumberField label={t("sweep")} value={Math.round(repeat.sweep || 360)} min={REPEAT_RANGES.sweep[0]} max={REPEAT_RANGES.sweep[1]} suffix="°" disabled={disabled} onCommit={(sweep) => change({ sweep: sweep >= 360 ? undefined : sweep })} />
      <SelectField label={t("direction")} value={repeat.direction || "cw"} options={REPEAT_DIRECTIONS.map((value) => ({ value, label: t(`directions.${value}`) }))} disabled={disabled} onChange={(direction) => change({ direction: direction === "cw" ? undefined : direction })} />
      <SwitchRow label={t("upright")} checked={Boolean(repeat.upright)} disabled={disabled} onChange={(on) => change({ upright: on || undefined })} />
      <SwitchRow label={t("reverseOverlap")} checked={Boolean(repeat.reverseOverlap)} disabled={disabled} onChange={(on) => change({ reverseOverlap: on || undefined })} />
    </>
  );
}

function GridFields({ repeat, disabled, change }: { repeat: Repeat; disabled: boolean; change: Change }) {
  const t = useTranslations("studio.image.repeat");
  const brick = repeat.layout === "brick-row" || repeat.layout === "brick-column";
  const flipOptions = [{ value: NONE, label: t("flips.none") }, ...REPEAT_FLIPS.map((value) => ({ value, label: t(`flips.${value}`) }))];
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t("rows")} value={repeat.rows ?? 1} min={1} disabled={disabled} onCommit={(rows) => change({ rows: Math.round(rows) })} />
        <NumberField label={t("columns")} value={repeat.columns ?? 1} min={1} disabled={disabled} onCommit={(columns) => change({ columns: Math.round(columns) })} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t("gapX")} short="X" value={Math.round(repeat.gapX ?? 0)} min={REPEAT_RANGES.gap[0]} max={REPEAT_RANGES.gap[1]} suffix="px" disabled={disabled} onCommit={(gapX) => change({ gapX: gapX || undefined })} />
        <NumberField label={t("gapY")} short="Y" value={Math.round(repeat.gapY ?? 0)} min={REPEAT_RANGES.gap[0]} max={REPEAT_RANGES.gap[1]} suffix="px" disabled={disabled} onCommit={(gapY) => change({ gapY: gapY || undefined })} />
      </div>
      <SelectField
        label={t("layout")}
        value={repeat.layout || "grid"}
        options={REPEAT_LAYOUTS.map((value) => ({ value, label: t(`layouts.${value}`) }))}
        disabled={disabled}
        onChange={(layout) => change(layout === "grid" ? { layout: undefined, offset: undefined } : { layout, offset: repeat.offset || 0.5 })}
      />
      {brick ? <NumberField label={t("offset")} value={Math.round((repeat.offset ?? 0) * 100)} min={0} max={100} suffix="%" disabled={disabled} onCommit={(offset) => change({ offset: offset / 100 || undefined })} /> : null}
      <SelectField label={t("flipRows")} value={repeat.flipRows || NONE} options={flipOptions} disabled={disabled} onChange={(flip) => change({ flipRows: flip === NONE ? undefined : (flip as Repeat["flipRows"]) })} />
      <SelectField label={t("flipColumns")} value={repeat.flipColumns || NONE} options={flipOptions} disabled={disabled} onChange={(flip) => change({ flipColumns: flip === NONE ? undefined : (flip as Repeat["flipColumns"]) })} />
    </>
  );
}

function MirrorFields({ repeat, disabled, change }: { repeat: Repeat; disabled: boolean; change: Change }) {
  const t = useTranslations("studio.image.repeat");
  return (
    <>
      <NumberField label={t("angle")} value={Math.round(repeat.angle ?? 0)} min={REPEAT_RANGES.angle[0]} max={REPEAT_RANGES.angle[1]} suffix="°" disabled={disabled} onCommit={(angle) => change({ angle })} />
      <NumberField label={t("gap")} value={Math.round(repeat.gap ?? 0)} min={REPEAT_RANGES.gap[0]} max={REPEAT_RANGES.gap[1]} suffix="px" disabled={disabled} onCommit={(gap) => change({ gap: gap || undefined })} />
      <SelectField label={t("side")} value={repeat.side || "end"} options={MIRROR_SIDES.map((value) => ({ value, label: t(`sides.${value}`) }))} disabled={disabled} onChange={(side) => change({ side: side === "end" ? undefined : side })} />
    </>
  );
}

export function RepeatSection({ artboard, layers }: { artboard: Artboard; layers: Layer[] }) {
  const t = useTranslations("studio.image.repeat");
  const { commands } = useImageEditor();
  const [refused, setRefused] = useState(false);
  const ids = layers.map((l) => l.id);
  const groupId = selectionGroup(artboard, ids);
  const group = groupId ? artboard.groups?.find((g) => g.id === groupId) : undefined;
  const disabled = layers.some((l) => l.locked);
  const box = sourceBox(layers, artboard.canvas);
  const repeat = group?.repeat;
  const blocked = !repeat && repeatLayers(artboard, ids, defaultRepeat("mirror", box)).groupId === null;
  const apply = (next: Repeat) => {
    if (groupId && repeatIssue(next) === null) commands.setRepeat(groupId, next);
  };
  const change: Change = (patch) => {
    if (repeat) apply(Object.fromEntries(Object.entries({ ...repeat, ...patch }).filter(([, v]) => v !== undefined)) as unknown as Repeat);
  };
  return (
    <InspectorSection title={t("title")}>
      {repeat && groupId ? (
        <div className="space-y-2">
          <SelectField<RepeatMode> label={t("mode")} value={repeat.mode} options={REPEAT_MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))} disabled={disabled} onChange={(mode) => apply(defaultRepeat(mode, box))} />
          {repeat.mode === "radial" ? <RadialFields repeat={repeat} disabled={disabled} change={change} /> : null}
          {repeat.mode === "grid" ? <GridFields repeat={repeat} disabled={disabled} change={change} /> : null}
          {repeat.mode === "mirror" ? <MirrorFields repeat={repeat} disabled={disabled} change={change} /> : null}
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={disabled} onClick={() => setRefused(!commands.expandRepeat(groupId))}>
              {t("expand")}
            </button>
            <button type="button" className={OUTLINE_BUTTON_CLASS} disabled={disabled} onClick={() => commands.setRepeat(groupId, undefined)}>
              {t("remove")}
            </button>
          </div>
          {refused ? <Notice tone="fault" title={t("expandRefused")} /> : null}
        </div>
      ) : (
        <div role="group" aria-label={t("create")} className="flex flex-wrap gap-1">
          {REPEAT_MODES.map((mode) => (
            <button key={mode} type="button" className={cn(OUTLINE_BUTTON_CLASS, "h-7")} disabled={disabled || blocked} onClick={() => commands.repeat(defaultRepeat(mode, box))}>
              {t(`modes.${mode}`)}
            </button>
          ))}
        </div>
      )}
    </InspectorSection>
  );
}
