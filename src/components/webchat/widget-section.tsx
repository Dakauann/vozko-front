"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CheckCircle, CircleNotch } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import type { WebchatWidgetRequest } from "@/lib/webchat/types";

export type SaveWidget = (payload: WebchatWidgetRequest) => Promise<boolean>;

export function useSectionDraft<T>(source: T): [T, (next: T) => void, boolean] {
  const fingerprint = JSON.stringify(source);
  const [seen, setSeen] = useState(fingerprint);
  const [draft, setDraft] = useState(source);
  if (seen !== fingerprint) {
    setSeen(fingerprint);
    setDraft(source);
  }
  const dirty = JSON.stringify(draft) !== fingerprint;
  return [draft, setDraft, dirty];
}

export function WidgetSection({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <ElevatedContainer className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer}
    </ElevatedContainer>
  );
}

export function SectionSave({
  dirty,
  valid = true,
  canUpdate,
  onSave,
}: {
  dirty: boolean;
  valid?: boolean;
  canUpdate: boolean;
  onSave: () => Promise<boolean>;
}) {
  const t = useTranslations("webchat.detail");
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  if (!canUpdate) return null;

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave();
    setSaving(false);
    setSavedOnce(ok);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
      {savedOnce && !dirty && (
        <span className="inline-flex items-center gap-1 text-xs text-healthy-ink">
          <CheckCircle weight="fill" className="h-3.5 w-3.5" />
          {t("saved")}
        </span>
      )}
      <Button
        variant="primary"
        title={saving ? t("saving") : t("save")}
        icon={saving ? <CircleNotch weight="bold" className="h-4 w-4 animate-spin" /> : undefined}
        iconVisible={saving}
        iconSide="left"
        onClick={() => void handleSave()}
        disabled={!dirty || !valid || saving}
        aria-busy={saving}
      />
    </div>
  );
}
