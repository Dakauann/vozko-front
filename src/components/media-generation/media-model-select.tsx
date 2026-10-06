"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { useMediaModels } from "@/hooks/use-media-models";
import { preselectedModel } from "@/lib/media-generation/models";
import type { ModelKind } from "@/lib/media-generation/types";

export function MediaModelSelect({
  kind,
  value,
  onChange,
  preferred,
  disabled,
}: {
  kind: ModelKind;
  value: string | null;
  onChange: (model: string) => void;
  preferred?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("mediaGeneration");
  const state = useMediaModels(kind);
  const initial = state.status === "ready" ? preselectedModel(state.models, preferred) : null;

  useEffect(() => {
    if (!value && initial) onChange(initial);
  }, [value, initial, onChange]);

  if (state.status === "failed") {
    return (
      <p role="alert" className="text-xs text-destructive-ink">
        {t(`modelsUnavailable.${kind}`)}
      </p>
    );
  }
  if (state.status === "loading") {
    return <p className="text-xs text-muted-foreground">{t(`modelsLoading.${kind}`)}</p>;
  }
  return (
    <div className="space-y-1">
      <ElevatedSelect label={t(`model.${kind}`)} value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
        {state.models.map((model) => (
          <ElevatedSelectItem key={model.id} value={model.id}>
            {model.default ? t("recommendedModel", { name: model.name }) : model.name}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      <p className="text-xs text-muted-foreground">{t("modelHint")}</p>
    </div>
  );
}
