"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { optionsOf, removeTransition, TRANSITION_ALIGNMENTS, transitionKindsFor, TRANSITION_LIMITS, TRANSITION_SPECS, updateTransition, type Transition, type TransitionPatch } from "@/lib/studio/transitions";

import type { TrackKind } from "@/lib/studio/document";

import { useVideoEditor } from "../editor-context";
import { EasingPicker } from "./easing-picker";
import { FieldGrid, InspectorSection, NumberField, SelectField } from "./fields";
import { TransitionOptionFields } from "./transition-option-fields";

const MS = 1000;

export function TransitionInspector({ transition, trackKind, locked }: { transition: Transition; trackKind: TrackKind; locked: boolean }) {
  const t = useTranslations("studio.video.transitions");
  const { commands } = useVideoEditor();
  const patch = (next: TransitionPatch) => commands.editTransition((doc) => updateTransition(doc, transition.id, next));
  const sequential = TRANSITION_SPECS[transition.kind].sequential;
  const options = optionsOf(transition.kind);

  return (
    <fieldset disabled={locked} className="min-w-0">
      <InspectorSection title={t("timingTitle")}>
        <SelectField label={t("kind")} value={transition.kind} options={transitionKindsFor(trackKind).map((value) => ({ value, label: t(`kinds.${value}`) }))} onChange={(kind) => patch({ kind })} />
        <FieldGrid>
          <NumberField
            label={t("duration")}
            unit="s"
            decimals={2}
            step={0.05}
            min={TRANSITION_LIMITS.minMs / MS}
            max={TRANSITION_LIMITS.maxMs / MS}
            value={transition.durationMs / MS}
            onCommit={(seconds) => patch({ durationMs: Math.round(seconds * MS) })}
            onNudge={(delta) => patch({ durationMs: Math.round(transition.durationMs + delta * MS) })}
          />
          <SelectField
            label={t("alignment")}
            value={transition.alignment}
            options={(sequential ? (["center"] as const) : TRANSITION_ALIGNMENTS).map((value) => ({ value, label: t(`alignments.${value}`) }))}
            onChange={(alignment) => patch({ alignment })}
          />
        </FieldGrid>
        <EasingPicker label={t("easing")} value={transition.easing} disabled={locked} hidden={["hold"]} onPick={(easing) => patch({ easing })} />
      </InspectorSection>
      {options.length > 0 ? (
        <InspectorSection title={t("optionsTitle")}>
          <TransitionOptionFields shaped={transition} allowed={options} edge={false} patch={patch} />
        </InspectorSection>
      ) : null}
      <div className="px-3 py-3">
        <Button variant="outline" size="sm" title={t("remove")} onClick={() => commands.editTransition((doc) => removeTransition(doc, transition.id))} />
      </div>
    </fieldset>
  );
}
