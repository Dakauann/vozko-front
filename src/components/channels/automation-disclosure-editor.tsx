"use client";

import { Warning } from "@/components/icons";
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import Textarea from "@/components/elevated-design/elevated-textarea";

export interface DisclosureCheck {
  blocked: boolean;
  feedback: ReactNode;
}

export function AutomationDisclosureEditor({
  value,
  translationNamespace,
  onSave,
  check,
}: {
  value: string;
  translationNamespace: string;
  onSave: (text: string) => Promise<{ saved?: string; error?: string }>;
  check?: (text: string) => DisclosureCheck;
}) {
  const t = useTranslations(translationNamespace);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = text.trim() !== value.trim();
  const verdict = check?.(text.trim()) ?? null;

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await onSave(text.trim());
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.saved !== undefined) setText(result.saved);
    setSaved(true);
  };

  return (
    <ElevatedContainer className="space-y-3 p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("disclosureTitle")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("disclosureHint")}</p>
      </div>
      <Textarea
        value={text}
        rows={2}
        disabled={saving}
        placeholder={t("disclosurePlaceholder")}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
      />
      {verdict?.feedback ? <div aria-live="polite">{verdict.feedback}</div> : null}
      {error ? (
        <p className="flex items-start gap-2 text-xs text-destructive-ink">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        {saved ? <span className="text-xs text-healthy-ink">{t("saved")}</span> : null}
        <Button
          size="sm"
          variant="primary"
          title={saving ? t("saving") : t("disclosureSave")}
          disabled={saving || !dirty || Boolean(verdict?.blocked)}
          onClick={() => void save()}
        />
      </div>
    </ElevatedContainer>
  );
}
