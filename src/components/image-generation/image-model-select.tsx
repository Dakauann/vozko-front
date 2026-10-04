"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { useImageModels } from "@/hooks/use-image-models";

export function ImageModelSelect({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (model: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("imageGeneration");
  const state = useImageModels();
  const mostPopular = state.status === "ready" ? state.models[0].id : null;

  useEffect(() => {
    if (!value && mostPopular) onChange(mostPopular);
  }, [value, mostPopular, onChange]);

  if (state.status === "failed") {
    return (
      <p role="alert" className="text-xs text-destructive-ink">
        {t("modelsUnavailable")}
      </p>
    );
  }
  if (state.status === "loading") {
    return <p className="text-xs text-muted-foreground">{t("modelsLoading")}</p>;
  }
  return (
    <div className="space-y-1">
      <ElevatedSelect label={t("model")} value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
        {state.models.map((model) => (
          <ElevatedSelectItem key={model.id} value={model.id}>
            {model.name}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      <p className="text-xs text-muted-foreground">{t("modelHint")}</p>
    </div>
  );
}
