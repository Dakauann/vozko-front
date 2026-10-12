"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Plus } from "@/components/icons";
import { listensToTrack, refusedOnEffectClips, VFX_KINDS, type VfxKind } from "@/lib/studio/vfx";

import { EffectTiles } from "../../vfx/effect-tiles";
import { useEditorState, useVideoEditor } from "../editor-context";

export function EffectsPanel() {
  const t = useTranslations("studio.video.vfx");
  const { commands } = useVideoEditor();
  const hasSound = useEditorState((state) => state.document.tracks.some((track) => track.kind === "audio"));
  const unavailable = (kind: VfxKind) => (refusedOnEffectClips(kind) ? t("notOnEffectClips") : listensToTrack(kind) && !hasSound ? t("needsSound") : null);

  return (
    <div className="space-y-3 p-3">
      <div className="space-y-1">
        <Button variant="outline" size="sm" className="w-full" title={t("adjustmentAdd")} icon={<Plus className="h-3.5 w-3.5" />} iconVisible onClick={() => commands.insertEffect(null)} />
        <p className="text-2xs text-muted-foreground">{t("adjustmentHint")}</p>
      </div>
      <p className="text-2xs text-muted-foreground">{t("panelHint")}</p>
      <EffectTiles
        kinds={VFX_KINDS}
        label={t("title")}
        tileLabel={(kind) => t("panelAdd", { kind: t(`kinds.${kind}`) })}
        hint={(kind) => t(`hints.${kind}`)}
        side="right"
        unavailable={unavailable}
        onPick={(kind) => commands.insertEffect(kind)}
      />
    </div>
  );
}
