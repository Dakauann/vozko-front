"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { easeKeys, keysEasing, removeKeys, type KeySpot, type RelatedKeys } from "@/lib/studio/focus-lanes";
import { allSmooth, easeKeySides, setSmooth, type EaseSides } from "@/lib/studio/keyframe-ease";
import { momentEasing, momentKeys, removeMoment, setMomentEasing, toggleKeyAt } from "@/lib/studio/keyframe-edit";
import { EASINGS, isNamedEasing, type AnimatedProperty, type Easing, type Keyframes, type KeyRef } from "@/lib/studio/keyframes";
import { findClip, updateClip } from "@/lib/studio/timeline";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";

export type KeyMenuTarget =
  | { kind: "keys"; clipId: string; property: AnimatedProperty; atMs: number }
  | { kind: "lane"; clipId: string; property: AnimatedProperty; atMs: number }
  | { kind: "key"; clipId: string; property: AnimatedProperty; atMs: number }
  | { kind: "moment"; clipId: string; atMs: number };

const ITEM = "gap-2 text-xs focus:bg-accent-hover focus:text-foreground";

const EASING_SHORTCUTS: Partial<Record<Easing, string>> = { hold: "Ctrl+Alt+H" };

const SIDE_SHORTCUTS: Record<EaseSides, string> = { both: "F9", in: "Shift+F9", out: "Ctrl+Shift+F9" };

const EASE_SIDES: readonly EaseSides[] = ["both", "in", "out"];

const RELATED: readonly RelatedKeys[] = ["previous", "following", "equal"];

function EaseMenu({ smooth, onSides, onSmooth, onVelocity }: { smooth: boolean; onSides: (sides: EaseSides) => void; onSmooth: (smooth: boolean) => void; onVelocity?: () => void }) {
  const t = useTranslations("studio.video.keyframes");
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className={ITEM}>{t("menu.ease")}</ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-64 border-border-strong">
        {EASE_SIDES.map((sides) => (
          <Item key={sides} label={t(`menu.easeSides.${sides}`)} shortcut={SIDE_SHORTCUTS[sides]} onSelect={() => onSides(sides)} />
        ))}
        <ContextMenuSeparator />
        <Item label={smooth ? t("menu.smoothOff") : t("menu.smoothOn")} onSelect={() => onSmooth(!smooth)} />
        {onVelocity ? <Item label={t("menu.velocity")} shortcut="Ctrl+Shift+K" onSelect={onVelocity} /> : null}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

function easedPatch(keyframes: Keyframes | undefined, keys: readonly KeyRef[], sides: EaseSides) {
  return { keyframes: easeKeySides(keyframes, keys, sides).keyframes };
}

function Item({ label, shortcut, onSelect }: { label: string; shortcut?: string; onSelect: () => void }) {
  return (
    <ContextMenuItem className={ITEM} onSelect={onSelect}>
      {label}
      {shortcut ? <ContextMenuShortcut className="font-sans text-2xs">{shortcut}</ContextMenuShortcut> : null}
    </ContextMenuItem>
  );
}

function CurveMenu({ current, onPick }: { current: Easing | null; onPick: (easing: Easing) => void }) {
  const t = useTranslations("studio.video.keyframes");
  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger className={ITEM}>{t("menu.curve")}</ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-56 border-border-strong">
        <ContextMenuRadioGroup value={current && isNamedEasing(current) ? current : ""} onValueChange={(value) => onPick(value as Easing)}>
          {EASINGS.map((easing) => (
            <ContextMenuRadioItem key={easing} value={easing} className={ITEM}>
              {t(`easings.${easing}`)}
              {EASING_SHORTCUTS[easing] ? <ContextMenuShortcut className="font-sans text-2xs">{EASING_SHORTCUTS[easing]}</ContextMenuShortcut> : null}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

export function KeyframeMenu({ target, children }: { target: KeyMenuTarget | null; children: ReactNode }) {
  const t = useTranslations("studio.video.keyframes");
  const { commands, playback } = useVideoEditor();
  const clip = useEditorState((s) => (target ? (findClip(s.document, target.clipId)?.clip ?? null) : null));
  const selectedKeys = useViewState((s) => s.selectedKeys);
  const name = target && target.kind !== "moment" ? t(`properties.${target.property}`) : "";
  const seek = () => {
    if (clip && target) playback.seek(clip.startMs + target.atMs);
  };
  const atMoment = (build: (local: number) => void) => {
    if (!clip || !target) return;
    playback.seek(clip.startMs + target.atMs);
    build(target.atMs);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64 border-border-strong">
        {clip && target?.kind === "keys" ? (
          <>
            <Item label={selectedKeys.length > 1 ? t("menu.removeMany", { count: selectedKeys.length }) : t("menu.removeOne")} shortcut="Delete" onSelect={() => commands.remove(false)} />
            <CurveMenu current={keysEasing(clip.keyframes, selectedKeys as KeySpot[])} onPick={commands.easeKeys} />
            <EaseMenu smooth={allSmooth(clip.keyframes, selectedKeys)} onSides={commands.easeSides} onSmooth={commands.smoothKeys} onVelocity={() => commands.openKeyDialog("velocity")} />
            <ContextMenuSub>
              <ContextMenuSubTrigger className={ITEM}>{t("menu.assistants")}</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-60 border-border-strong">
                <Item label={t("menu.reverse")} onSelect={commands.reverseKeys} />
                <Item label={t("menu.stretch")} onSelect={() => commands.openKeyDialog("stretch")} />
                <Item label={t("menu.rove")} onSelect={commands.roveKeys} />
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <Item label={t("menu.selectProperty", { name })} onSelect={() => commands.selectPropertyKeys(clip.id, target.property)} />
            {RELATED.map((mode) => (
              <Item key={mode} label={t(`menu.select.${mode}`)} onSelect={() => commands.selectRelatedKeys(mode)} />
            ))}
            <Item label={t("menu.goTo")} onSelect={seek} />
          </>
        ) : null}
        {clip && target?.kind === "lane" ? (
          <>
            <Item label={t("menu.addHere", { name })} onSelect={() => atMoment(() => commands.patchKeyframes(clip.id, (current, local, aspect) => toggleKeyAt(current, target.property, local, aspect)))} />
            <Item label={t("menu.selectProperty", { name })} onSelect={() => commands.selectPropertyKeys(clip.id, target.property)} />
          </>
        ) : null}
        {clip && target?.kind === "key" ? (
          <>
            <Item label={t("menu.removeOne")} shortcut="Delete" onSelect={() => commands.apply((doc) => updateClip(doc, clip.id, { keyframes: removeKeys(clip.keyframes, [target]) }))} />
            <CurveMenu current={keysEasing(clip.keyframes, [target])} onPick={(easing) => commands.apply((doc) => updateClip(doc, clip.id, { keyframes: easeKeys(clip.keyframes, [target], easing) }))} />
            <EaseMenu
              smooth={allSmooth(clip.keyframes, [target])}
              onSides={(sides) => commands.apply((doc) => updateClip(doc, clip.id, easedPatch(clip.keyframes, [target], sides)))}
              onSmooth={(smooth) => commands.apply((doc) => updateClip(doc, clip.id, { keyframes: setSmooth(clip.keyframes, [target], smooth) }))}
            />
            <ContextMenuSeparator />
            <Item label={t("menu.goTo")} onSelect={seek} />
          </>
        ) : null}
        {clip && target?.kind === "moment" ? (
          <>
            <Item label={t("menu.removeMoment")} onSelect={() => atMoment(() => commands.patchKeyframes(clip.id, (current, local) => removeMoment(current, local)))} />
            <CurveMenu current={momentEasing(clip, target.atMs)} onPick={(easing) => atMoment(() => commands.patchKeyframes(clip.id, (current, local) => setMomentEasing(current, local, easing)))} />
            <EaseMenu
              smooth={allSmooth(clip.keyframes, momentKeys(clip, target.atMs))}
              onSides={(sides) => atMoment(() => commands.patchKeyframes(clip.id, (current, local) => easedPatch(current.keyframes, momentKeys(current, local), sides)))}
              onSmooth={(smooth) => atMoment(() => commands.patchKeyframes(clip.id, (current, local) => ({ keyframes: setSmooth(current.keyframes, momentKeys(current, local), smooth) })))}
            />
            <ContextMenuSeparator />
            <Item label={t("menu.goTo")} onSelect={seek} />
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
