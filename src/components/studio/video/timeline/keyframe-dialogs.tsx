"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { ElevatedDialog, ElevatedDialogBody, ElevatedDialogContent, ElevatedDialogFooter, ElevatedDialogHeader, ElevatedDialogTitle } from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSegmentedControl from "@/components/elevated-design/elevated-segmented-control";
import { WarningCircle } from "@/components/icons";
import { keyVelocity, MIN_INFLUENCE, type EaseSide, type KeyVelocity, type SideChange, type StretchAnchor, type VelocityChange, type VelocityRefusal } from "@/lib/studio/keyframe-ease";
import { canvasAspect } from "@/lib/studio/document";
import { isColorProperty, type KeyRef } from "@/lib/studio/keyframes";
import { isMorphProperty } from "@/lib/studio/morph-keys";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { keyTarget } from "../key-commands";

const PERCENT = 100;
const SPEED_DECIMALS = 4;

function shown(value: number | null | undefined, scale = 1): string {
  return value === null || value === undefined ? "" : String(Number((value * scale).toFixed(SPEED_DECIMALS)));
}

function parsed(text: string): number | null {
  const value = Number(text.replace(",", "."));
  return text.trim() === "" || !Number.isFinite(value) ? null : value;
}

function speedsApply(keys: readonly KeyRef[]): boolean {
  const properties = new Set(keys.map((key) => key.property));
  return properties.size === 1 && keys.every((key) => !isColorProperty(key.property) && !isMorphProperty(key.property));
}

function Problem({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive-ink">
      <WarningCircle className="h-4 w-4 shrink-0" aria-hidden />
      {text}
    </p>
  );
}

interface SideDraft {
  speed: string;
  influence: string;
}

function draftOf(velocity: KeyVelocity | null, side: EaseSide): SideDraft {
  const found = velocity?.[side];
  return { speed: shown(found?.speed), influence: shown(found?.influence, PERCENT) };
}

function VelocityForm({ keys, velocity, onClose }: { keys: KeyRef[]; velocity: KeyVelocity | null; onClose: () => void }) {
  const t = useTranslations("studio.video.keyframes.velocity");
  const { commands } = useVideoEditor();
  const withSpeed = speedsApply(keys);
  const [drafts, setDrafts] = useState<Record<EaseSide, SideDraft>>({ in: draftOf(velocity, "in"), out: draftOf(velocity, "out") });
  const [continuous, setContinuous] = useState(velocity?.in?.speed !== undefined && velocity?.in?.speed === velocity?.out?.speed);
  const [problem, setProblem] = useState<string | null>(null);
  const sides = (["in", "out"] as const).filter((side) => velocity?.[side]);

  const edit = (side: EaseSide, field: keyof SideDraft, value: string) => {
    setDrafts((current) => {
      const next = { ...current, [side]: { ...current[side], [field]: value } };
      if (field === "speed" && continuous) for (const other of sides) next[other] = { ...next[other], speed: value };
      return next;
    });
  };

  const refusalText = (refusal: VelocityRefusal): string => {
    switch (refusal.kind) {
      case "influence":
        return t("errors.influence");
      case "noSide":
        return t("errors.noSide");
      case "notNumeric":
        return t("errors.notNumeric");
      case "flat":
        return t("errors.flat", { side: t(`sides.${refusal.side}`), time: refusal.atMs });
      case "steep":
        return refusal.range ? t("errors.steep", { side: t(`sides.${refusal.side}`), time: refusal.atMs, min: refusal.range[0], max: refusal.range[1] }) : t("errors.steepAny");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const change: VelocityChange = {};
    for (const side of sides) {
      const influence = parsed(drafts[side].influence);
      const speed = withSpeed ? parsed(drafts[side].speed) : null;
      const sideChange: SideChange = {};
      if (influence !== null) sideChange.influence = influence / PERCENT;
      if (speed !== null) sideChange.speed = speed;
      change[side] = sideChange;
    }
    const refusal = commands.setKeyVelocity(change);
    if (refusal) setProblem(refusalText(refusal));
    else onClose();
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
      </ElevatedDialogHeader>
      <ElevatedDialogBody className="space-y-4">
        <p className="text-xs text-muted-foreground">{withSpeed ? t("hint") : t("hintInfluence")}</p>
        {sides.map((side) => (
          <fieldset key={side} className="grid grid-cols-2 gap-3">
            <legend className="mb-1 text-xs font-medium text-foreground">{t(`sides.${side}`)}</legend>
            {withSpeed ? <ElevatedInput label={t("speed")} inputMode="decimal" value={drafts[side].speed} onChange={(e) => edit(side, "speed", e.target.value)} controlSize="sm" /> : null}
            <ElevatedInput label={t("influence")} inputMode="decimal" value={drafts[side].influence} onChange={(e) => edit(side, "influence", e.target.value)} controlSize="sm" min={MIN_INFLUENCE * PERCENT} max={PERCENT} />
          </fieldset>
        ))}
        {withSpeed && sides.length === 2 ? (
          <label className="flex items-center gap-2 text-xs text-foreground">
            <Checkbox checked={continuous} onCheckedChange={(checked) => setContinuous(checked === true)} />
            {t("continuous")}
          </label>
        ) : null}
        {problem ? <Problem text={problem} /> : null}
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button type="button" variant="ghost" title={t("cancel")} onClick={onClose} />
        <Button type="submit" variant="primary" title={t("apply")} disabled={sides.length === 0} />
      </ElevatedDialogFooter>
    </form>
  );
}

function StretchForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations("studio.video.keyframes.stretch");
  const { commands } = useVideoEditor();
  const [percent, setPercent] = useState("100");
  const [anchor, setAnchor] = useState<StretchAnchor>("first");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = parsed(percent);
    if (value === null || value <= 0) {
      setProblem(t("errors.percent"));
      return;
    }
    if (commands.stretchKeys(value / PERCENT, anchor)) onClose();
    else setProblem(t("errors.blocked"));
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
      </ElevatedDialogHeader>
      <ElevatedDialogBody className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        <ElevatedInput label={t("percent")} inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} controlSize="sm" autoFocus />
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">{t("anchor")}</p>
          <ElevatedSegmentedControl
            size="sm"
            value={anchor}
            onChange={(value) => setAnchor(value as StretchAnchor)}
            options={[
              { value: "first", label: t("anchors.first") },
              { value: "last", label: t("anchors.last") },
            ]}
          />
        </div>
        {problem ? <Problem text={problem} /> : null}
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button type="button" variant="ghost" title={t("cancel")} onClick={onClose} />
        <Button type="submit" variant="primary" title={t("apply")} />
      </ElevatedDialogFooter>
    </form>
  );
}

export function KeyframeDialogs() {
  const { view } = useVideoEditor();
  const dialog = useViewState((s) => s.keyDialog);
  const document = useEditorState((s) => s.document);
  const selection = useEditorState((s) => s.selection);
  const target = dialog ? keyTarget(document, view, selection, dialog === "velocity") : null;
  const first = target?.keys[0];
  const close = () => view.setState({ keyDialog: null });
  const formKey = target ? target.keys.map((key) => `${key.property}:${key.atMs}`).join(",") : "none";

  return (
    <ElevatedDialog open={dialog !== null && target !== null} onOpenChange={(open) => !open && close()}>
      <ElevatedDialogContent className="max-w-md">
        {target && first && dialog === "velocity" ? <VelocityForm key={formKey} keys={target.keys} velocity={keyVelocity(target.clip.keyframes, first.property, first.atMs, canvasAspect(document))} onClose={close} /> : null}
        {target && dialog === "stretch" ? <StretchForm key={formKey} onClose={close} /> : null}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
