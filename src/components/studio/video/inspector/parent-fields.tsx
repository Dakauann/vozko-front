"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import type { Clip } from "@/lib/studio/document";
import { parentChoices } from "@/lib/studio/parent-edit";
import { childIds } from "@/lib/studio/parenting";
import { sharedValue } from "@/lib/studio/selection-edit";

import { useEditorState, useVideoEditor } from "../editor-context";
import { useClipLabeler } from "../use-clip-label";
import { InspectorSection, SelectField, ToggleField } from "./fields";

const NONE = "none";

interface ParentFieldsProps {
  clips: readonly Clip[];
  disabled: boolean;
}

export function ParentFields({ clips, disabled }: ParentFieldsProps) {
  const t = useTranslations("studio.video.parenting");
  const { commands } = useVideoEditor();
  const label = useClipLabeler();
  const document = useEditorState((s) => s.document);
  const [keepVisual, setKeepVisual] = useState(true);
  const ids = clips.map((clip) => clip.id);
  const choices = parentChoices(document, ids);
  const shared = sharedValue(clips, (clip) => clip.parentId ?? NONE);
  const current = shared.kind === "same" ? shared.value : null;
  const children = clips.length === 1 ? childIds(document, clips[0].id) : [];
  const options = [{ value: NONE, label: t("none") }, ...choices.map((clip) => ({ value: clip.id, label: `${label(clip)} · ${clip.id.slice(-4)}` }))];
  const known = current === null || options.some((option) => option.value === current);

  return (
    <InspectorSection id="parent" title={t("title")} summary={current && current !== NONE ? t("following") : t("free")}>
      <SelectField<string>
        label={t("picker")}
        value={known ? current : null}
        options={options}
        disabled={disabled}
        onChange={(next) => commands.setParent(ids, next === NONE ? null : next, keepVisual)}
      />
      <ToggleField label={t("keepVisual")} checked={keepVisual} disabled={disabled} onChange={setKeepVisual} />
      <p className="text-2xs text-muted-foreground">{t("hint")}</p>
      {children.length > 0 ? (
        <Button variant="outline" size="sm" title={t("selectChildren", { count: children.length })} onClick={() => commands.selectChildren(clips[0].id)} />
      ) : null}
    </InspectorSection>
  );
}
