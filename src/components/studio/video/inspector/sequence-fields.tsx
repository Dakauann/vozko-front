"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { STUDIO_LIMITS, type Clip } from "@/lib/studio/document";
import { transitionKindsFor, type TransitionKind } from "@/lib/studio/transitions";

import { useVideoEditor } from "../editor-context";
import { FieldGrid, InspectorSection, NumberField, SelectField } from "./fields";

const MS = 1000;
const DEFAULT_STEP_MS = 200;
const NO_TRANSITION = "none";

type TransitionChoice = TransitionKind | typeof NO_TRANSITION;

export function SequenceFields({ clips, disabled }: { clips: readonly Clip[]; disabled: boolean }) {
  const t = useTranslations("studio.video.timing");
  const tt = useTranslations("studio.video.transitions");
  const { commands } = useVideoEditor();
  const [gapMs, setGapMs] = useState(0);
  const [stepMs, setStepMs] = useState(DEFAULT_STEP_MS);
  const [transition, setTransition] = useState<TransitionChoice>(NO_TRANSITION);
  const ids = clips.map((clip) => clip.id);
  const kinds = transitionKindsFor(clips[0]?.type === "audio" ? "audio" : "visual");
  const limit = STUDIO_LIMITS.maxVideoMs / MS;

  return (
    <InspectorSection title={t("title")}>
      <FieldGrid>
        <NumberField label={t("gap")} unit="s" decimals={2} step={0.1} min={-limit} max={limit} value={gapMs / MS} disabled={disabled} onCommit={(seconds) => setGapMs(Math.round(seconds * MS))} />
        <SelectField<TransitionChoice>
          label={t("transition")}
          value={transition}
          disabled={disabled}
          options={[{ value: NO_TRANSITION, label: t("none") }, ...kinds.map((kind) => ({ value: kind, label: tt(`kinds.${kind}`) }))]}
          onChange={setTransition}
        />
      </FieldGrid>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        title={t("sequence")}
        onClick={() => commands.sequenceClips(ids, { gapMs, ...(transition === NO_TRANSITION ? {} : { transition: { kind: transition } }) })}
      />
      <p className="text-2xs text-muted-foreground">{t("gapHint")}</p>
      <div className="space-y-2 border-t border-border pt-2">
        <NumberField label={t("step")} unit="s" decimals={2} step={0.05} min={-limit} max={limit} value={stepMs / MS} disabled={disabled} onCommit={(seconds) => setStepMs(Math.round(seconds * MS))} />
        <Button variant="outline" size="sm" disabled={disabled} title={t("stagger")} onClick={() => commands.staggerClips(ids, stepMs)} />
      </div>
      <p className="text-2xs text-muted-foreground">{t("orderHint")}</p>
    </InspectorSection>
  );
}
