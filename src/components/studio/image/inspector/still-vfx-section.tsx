"use client";

import { useFormatter, useTranslations } from "next-intl";

import { STILL_VFX_KINDS, stillParams } from "@/lib/studio/still-vfx";
import { addingVfx, movingVfx, patchingVfx, removingVfx, type StillVfxChange, type StillVfxTarget } from "@/lib/studio/still-vfx-edit";
import { freshVfx, paramSpec, vfxColor, vfxColors, vfxValue, type Vfx, type VfxParam } from "@/lib/studio/vfx";
import type { VfxPatch } from "@/lib/studio/vfx-edit";

import { EffectTiles } from "../../vfx/effect-tiles";
import { sliderStep, useOpenVfx, VfxActions, VfxRows } from "../../vfx/vfx-stack";
import { ColorField, InspectorSection, SliderField } from "../controls";
import { useImageEditor } from "../editor-state";

interface StillVfxSectionProps {
  target: StillVfxTarget;
  vfx: readonly Vfx[] | undefined;
  disabled: boolean;
}

export function StillVfxSection({ target, vfx, disabled }: StillVfxSectionProps) {
  const t = useTranslations("studio.image.vfx");
  const tv = useTranslations("studio.video.vfx");
  const { commands } = useImageEditor();
  const list = vfx ?? [];
  const { open, openIndex, setOpenId } = useOpenVfx(list);
  const onLayer = target.kind === "layer";
  const edit = (change: StillVfxChange) => commands.editVfx(target, change);

  const add = (kind: (typeof STILL_VFX_KINDS)[number]) => {
    const created = freshVfx(kind);
    if (edit(addingVfx(created))) setOpenId(created.id);
  };

  return (
    <InspectorSection id={onLayer ? "layerVfx" : "artboardVfx"} title={t("title")} group="effects">
      <p className="text-2xs text-muted-foreground">{onLayer ? t("layerIntro") : t("artboardIntro")}</p>
      <EffectTiles kinds={STILL_VFX_KINDS} label={t("add")} tileLabel={(kind) => tv("addKind", { kind: tv(`kinds.${kind}`) })} hint={(kind) => t(`hints.${kind}`)} side="left" disabled={disabled} onPick={add} />
      {list.length > 0 ? <VfxRows list={list} open={open} label={onLayer ? t("layerList") : t("artboardList")} onOpen={setOpenId} /> : null}
      {open ? (
        <StillVfxDetail
          key={open.id}
          vfx={open}
          disabled={disabled}
          canMoveUp={openIndex > 0}
          canMoveDown={openIndex < list.length - 1}
          onPatch={(patch) => edit(patchingVfx(open.id, patch))}
          onMove={(delta) => edit(movingVfx(open.id, openIndex + delta))}
          onRemove={() => {
            if (edit(removingVfx(open.id))) setOpenId(null);
          }}
        />
      ) : null}
    </InspectorSection>
  );
}

interface StillVfxDetailProps {
  vfx: Vfx;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onPatch: (patch: VfxPatch) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}

function StillVfxDetail({ vfx, disabled, canMoveUp, canMoveDown, onPatch, onMove, onRemove }: StillVfxDetailProps) {
  const tv = useTranslations("studio.video.vfx");
  const format = useFormatter();
  const { commands } = useImageEditor();

  const field = (name: VfxParam) => {
    const spec = paramSpec(vfx.kind, name)!;
    const { step, decimals } = sliderStep(spec.range);
    return (
      <SliderField
        key={name}
        label={tv(`params.${name}`)}
        value={vfxValue(vfx, name, 0)}
        min={spec.range[0]}
        max={spec.range[1]}
        step={step}
        format={(value) => format.number(value, { maximumFractionDigits: decimals })}
        disabled={disabled}
        onStart={commands.beginLive}
        onEnd={commands.endLive}
        onChange={(value) => onPatch({ params: { [name]: value } })}
      />
    );
  };

  return (
    <div role="group" aria-label={tv("detail")} className="space-y-2 rounded-md border border-border p-2">
      <VfxActions vfx={vfx} disabled={disabled} canMoveUp={canMoveUp} canMoveDown={canMoveDown} onPatch={onPatch} onMove={onMove} onRemove={onRemove} />
      {vfxColors(vfx.kind).map((name) => (
        <ColorField key={name} label={tv(`colors.${name}`)} value={vfxColor(vfx, name)} disabled={disabled} onCommit={(color) => onPatch({ colors: { [name]: color.slice(0, 7) } })} />
      ))}
      {stillParams(vfx.kind).map(field)}
    </div>
  );
}
