"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getAgentOptionsAction } from "@/app/actions/agents";
import type { ModelPricingInfo } from "@/lib/agents/types";
import type { CommentAnalysisSettings } from "@/lib/comment-analysis/types";
import { MAX_INSTRUCTIONS_LENGTH } from "@/lib/comment-analysis/types";
import type { EnabledChoice, OverrideDraft } from "@/lib/comment-analysis/override";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import { editableTopics, TopicsEditor } from "@/components/instagram/comment-analysis-topics-editor";

/*
 * The per-post override form, shared by the post detail dialog (editing a
 * live post) and the post composer (arming a post before it exists). Both
 * hold an OverrideDraft; this renders it against the account's effective
 * settings so every "inherit" placeholder says what would be inherited.
 */

/** The model list, loaded once the form is actually shown. */
export function useAiModelOptions(active: boolean) {
  const [models, setModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[] | undefined>();
  useEffect(() => {
    if (!active || models.length > 0) return;
    let cancelled = false;
    void getAgentOptionsAction().then((res) => {
      if (cancelled || !res.options) return;
      setModels(res.options.messaging ?? []);
      setModelPricing(res.options.modelPricing);
    });
    return () => {
      cancelled = true;
    };
  }, [active, models.length]);
  return { models, modelPricing };
}

export function OverrideFields({
  id,
  draft,
  onChange,
  effective,
  disabled,
}: {
  /** Distinguishes the switch ids when two forms are mounted. */
  id: string;
  draft: OverrideDraft;
  onChange: (next: OverrideDraft) => void;
  /** The account's settings, which is what a blank field inherits. */
  effective: CommentAnalysisSettings;
  disabled?: boolean;
}) {
  const t = useTranslations("commentAnalysis.post.override");
  const { models, modelPricing } = useAiModelOptions(true);
  const set = <K extends keyof OverrideDraft>(key: K, value: OverrideDraft[K]) => onChange({ ...draft, [key]: value });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <ElevatedSelect label={t("enabled.label")} value={draft.enabled} disabled={disabled} onValueChange={(v) => set("enabled", v as EnabledChoice)}>
          <ElevatedSelectItem value="inherit">{t("enabled.inherit", { value: effective.enabled ? t("enabled.on") : t("enabled.off") })}</ElevatedSelectItem>
          <ElevatedSelectItem value="on">{t("enabled.on")}</ElevatedSelectItem>
          <ElevatedSelectItem value="off">{t("enabled.off")}</ElevatedSelectItem>
        </ElevatedSelect>
        <ElevatedInput
          label={t("threshold.label")}
          type="number"
          min={1}
          max={100}
          value={draft.threshold}
          disabled={disabled}
          placeholder={t("threshold.inherit", { value: effective.severityThreshold })}
          onChange={(e) => set("threshold", e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <AIModelSelector label={t("model.label")} value={draft.model} models={models} modelPricing={modelPricing} disabled={disabled} onValueChange={(m) => set("model", m)} />
          </div>
          {draft.model ? <Button size="sm" variant="ghost" title={t("model.inherit")} disabled={disabled} onClick={() => set("model", "")} /> : null}
        </div>
        <p className="mt-1 text-2xs text-muted-foreground">{t("model.hint", { value: effective.model || t("model.default") })}</p>
      </div>

      <div>
        <ElevatedTextarea
          label={t("instructions.label")}
          value={draft.instructions}
          maxLength={MAX_INSTRUCTIONS_LENGTH}
          rows={3}
          disabled={disabled}
          placeholder={t("instructions.placeholder")}
          onChange={(e) => set("instructions", e.target.value)}
        />
        <p className="mt-1 text-2xs text-muted-foreground">{t("instructions.hint")}</p>
      </div>

      <div className="space-y-2">
        <ElevatedSwitch
          id={`${id}-own-topics`}
          label={t("topics.own")}
          checked={draft.ownTopics}
          disabled={disabled}
          onCheckedChange={(checked: boolean) => set("ownTopics", checked)}
        />
        {draft.ownTopics ? (
          <TopicsEditor topics={draft.topics} disabled={disabled} onChange={(next) => set("topics", next)} />
        ) : (
          <p className="text-2xs text-muted-foreground">{t("topics.inheritHint", { count: editableTopics(effective.topics).length })}</p>
        )}
      </div>
    </div>
  );
}
