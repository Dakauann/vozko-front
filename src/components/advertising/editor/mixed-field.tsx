"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Lock } from "@/components/icons";
import type { MultiField } from "@/lib/advertising/editor-multi";

import { Hint } from "../wizard/choice-row";

export function MixedField({
  field,
  opened,
  disabled,
  eachLabel,
  onOpen,
  onKeep,
  children,
}: {
  field: MultiField | undefined;
  opened: boolean;
  disabled: boolean;
  eachLabel: string;
  onOpen: () => void;
  onKeep: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("adsEditor.multi");
  if (!field) return null;
  const reason = field.blocker ? (
    <Hint icon={<Lock className="h-3.5 w-3.5" aria-hidden />}>{t(`blockers.${field.blocker}`)}</Hint>
  ) : null;

  if (field.state.kind === "same") {
    return (
      <div className="space-y-2">
        <fieldset disabled={!!field.blocker} className="min-w-0 space-y-2">
          {children}
        </fieldset>
        {reason}
      </div>
    );
  }

  if (opened && !field.blocker) {
    return (
      <div className="space-y-2">
        {children}
        <button type="button" onClick={onKeep} disabled={disabled} className="text-xs font-semibold text-primary-ink hover:underline disabled:opacity-50">
          {t("keepMixed", { each: eachLabel })}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-[--radius] border border-dashed border-border p-3">
      <p className="text-xs text-muted-foreground">{t(`groups.${field.group}`)}</p>
      <p className="text-sm font-medium text-foreground">{t("mixedValues")}</p>
      {reason ?? (
        <button type="button" onClick={onOpen} disabled={disabled} className="text-sm font-semibold text-primary-ink hover:underline disabled:opacity-50">
          {t("setForAll")}
        </button>
      )}
    </div>
  );
}
