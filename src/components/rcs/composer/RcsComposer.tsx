"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { PanelSection } from "@/components/dashboard/PanelSection";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { ChatText, Image as ImageGlyph, Rectangle, Stack, type Icon } from "@/components/icons";
import { VariableBindingFields } from "@/components/leads/sends/VariableBindingFields";
import { Notice } from "@/components/ui/notice";
import { bindingPreviewValues, sizedBindings, type VariableBinding } from "@/lib/leads/sends";
import { RCS_EDITOR_MODES, editorModeOf, switchMode, updateCard, type RcsEditorMode } from "@/lib/rcs/content-edit";
import { issuesAt } from "@/lib/rcs/issues";
import { RCS_LIMITS } from "@/lib/rcs/limits";
import type { RcsContent } from "@/lib/rcs/types";
import { slotNames } from "@/lib/rcs/variables";
import { cn } from "@/lib/utils";

import type { RcsPreviewAgent } from "../preview/palette";
import { RcsPhonePreview } from "../preview/RcsPhonePreview";
import { ButtonListEditor } from "./ButtonEditor";
import { CardEditor, CarouselEditor } from "./CardEditor";
import { ComposerProvider, useComposer, useFieldIssue, useIssueMessages, type RcsMediaPicker } from "./composer-context";
import { RcsMediaField } from "./RcsMediaField";
import { RcsPricePill } from "./RcsPricePill";
import { RcsTextField } from "./RcsTextField";
import { useRcsContentCheck, type RcsContentCheckState } from "./use-rcs-content-check";
import { useVariableTools } from "./variable-tools";

const MODE_ICONS: Record<RcsEditorMode, Icon> = {
  text: ChatText,
  media: ImageGlyph,
  rich_card: Rectangle,
  carousel: Stack,
};

const MESSAGE_LEVEL_PATHS = ["", "cards", "suggestions"];

function MessageIssues() {
  const t = useTranslations("rcs.composer");
  const { issues } = useComposer();
  const messages = useIssueMessages();
  const found = MESSAGE_LEVEL_PATHS.flatMap((path) => issuesAt(issues, path));
  if (found.length === 0) return null;
  return (
    <Notice tone="fault" title={t("issuesTitle")}>
      <ul className="list-disc space-y-1 pl-4">
        {messages(found).map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </Notice>
  );
}

function ModeEditor({ mode, value, onChange }: { mode: RcsEditorMode; value: RcsContent; onChange: (content: RcsContent) => void }) {
  const t = useTranslations("rcs.composer");
  const { variables, disabled } = useComposer();
  const issue = useFieldIssue();

  if (mode === "rich_card") {
    return <CardEditor card={value.cards?.[0] ?? {}} index={0} onChange={(card) => onChange(updateCard({ ...value, cards: value.cards?.length ? value.cards : [{}] }, 0, card))} />;
  }
  if (mode === "carousel") return <CarouselEditor content={value} onChange={onChange} />;

  const text = (
    <RcsTextField
      label={mode === "media" ? t("text.caption") : t("text.label")}
      multiline
      placeholder={t("text.placeholder")}
      value={value.text ?? ""}
      onChange={(next) => onChange({ ...value, text: next })}
      max={RCS_LIMITS.maxTextRunes}
      error={issue("text")}
      variables={variables}
      variableStyle="chips"
      disabled={disabled}
    />
  );

  if (mode === "media") {
    return (
      <div className="space-y-4">
        <RcsMediaField label={t("media.label")} value={value.media} onChange={(media) => onChange({ ...value, media })} error={issue("media", true)} />
        {text}
      </div>
    );
  }
  return text;
}

export function RcsComposer({
  value,
  onChange,
  bindings,
  onBindingsChange,
  agent,
  onPickMedia,
  check,
  disabled = false,
  className,
}: {
  value: RcsContent;
  onChange: (content: RcsContent) => void;
  bindings: VariableBinding[];
  onBindingsChange: (bindings: VariableBinding[]) => void;
  agent: RcsPreviewAgent;
  onPickMedia?: RcsMediaPicker;
  check?: RcsContentCheckState;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("rcs.composer");
  const tKinds = useTranslations("rcs.kinds");
  const tShared = useTranslations("carrierMessaging");
  const [mode, setMode] = useState<RcsEditorMode>(() => editorModeOf(value));
  const shape = editorModeOf(value);
  if (shape !== mode && !(mode === "media" && shape === "text")) setMode(shape);
  const ownCheck = useRcsContentCheck(check ? {} : value);
  const checkState = check ?? ownCheck;
  const backendSlots = checkState.check?.variable_slots ?? 0;
  const slots = checkState.status === "ready" ? backendSlots : Math.max(backendSlots, bindings.length);
  const sized = sizedBindings(bindings, slots);
  const variables = useVariableTools(sizedBindings(bindings, Math.max(slots, bindings.length)), onBindingsChange);
  const issues = checkState.check?.issues ?? [];

  const chooseMode = (next: RcsEditorMode) => {
    setMode(next);
    onChange(switchMode(value, next));
  };

  return (
    <ComposerProvider value={{ issues, variables, pickMedia: onPickMedia, disabled }}>
      <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-start", className)}>
        <div className="min-w-0 space-y-8">
          <PanelSection title={t("message.title")} description={t("message.description")} actions={<RcsPricePill state={checkState} />}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <ElevatedPillToggle<RcsEditorMode>
                  size="md"
                  aria-label={t("modeLabel")}
                  value={mode}
                  onChange={chooseMode}
                  collapseLabels="sm"
                  options={RCS_EDITOR_MODES.map((option) => {
                    const Glyph = MODE_ICONS[option];
                    return { value: option, label: tKinds(option), icon: <Glyph aria-hidden className="h-3.5 w-3.5" />, disabled };
                  })}
                />
                <p className="text-xs text-muted-foreground">{t(`modeHints.${mode}`)}</p>
              </div>
              <MessageIssues />
              <ModeEditor mode={mode} value={value} onChange={onChange} />
            </div>
          </PanelSection>

          <PanelSection title={t("suggestions.title")} description={t("suggestions.description")}>
            <ButtonListEditor
              suggestions={value.suggestions ?? []}
              onChange={(suggestions) => onChange({ ...value, suggestions })}
              card={-1}
              max={RCS_LIMITS.maxMessageSuggestions}
              title={t("suggestions.listTitle")}
              hint={t("suggestions.hint", { max: RCS_LIMITS.maxMessageSuggestions })}
            />
          </PanelSection>

          {slots > 0 ? (
            <PanelSection title={tShared("variables.title")} description={tShared("variables.description")}>
              <VariableBindingFields
                slots={slotNames(slots)}
                binding={{
                  choices: variables.choices,
                  values: sized,
                  labelOf: variables.labelOf,
                  onChange: (index, binding) => onBindingsChange(sized.map((item, at) => (at === index ? binding : item))),
                }}
              />
            </PanelSection>
          ) : null}
        </div>

        <aside className="min-w-0 lg:sticky lg:top-16">
          <RcsPhonePreview content={value} agent={agent} values={bindingPreviewValues(sized, variables.labelOf)} expectsMedia={mode === "media"} />
        </aside>
      </div>
    </ComposerProvider>
  );
}
