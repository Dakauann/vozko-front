"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";

import { isAdsError, updateAdObjectAction } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import { Warning } from "@/components/icons";
import { buildCreative, type WizardForm } from "@/lib/advertising/draft";
import type { AdsOptions } from "@/lib/advertising/draft-types";
import type { AdAccount, AdRow } from "@/lib/advertising/types";
import { issuesFromCreativeEdit, type DraftIssue } from "@/lib/advertising/wizard-issues";

import { useAdsErrorText } from "../use-ads-error";
import { AdStep } from "../wizard/ad-step";
import { CardSections } from "../wizard/choice-row";
import { WizardProvider, useWizardValue } from "../wizard/wizard-context";
import { FooterSlot } from "./editor-footer";

export function CreativeSwap({
  form,
  setForm,
  account,
  accounts,
  options,
  onSaved,
  onCancel,
  actionsSlot,
}: {
  form: WizardForm;
  setForm: Dispatch<SetStateAction<WizardForm>>;
  account: AdAccount;
  accounts: AdAccount[];
  options: AdsOptions;
  onSaved: (row: AdRow) => void;
  onCancel: () => void;
  actionsSlot?: HTMLElement | null;
}) {
  const t = useTranslations("adsWizard");
  const errorText = useAdsErrorText();
  const [issues, setIssues] = useState<DraftIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = useWizardValue({ form, setForm, account, accounts, options, issues, canGenerate: true });

  const save = () => {
    const ad = form.ads[0];
    if (!ad || saving) return;
    setSaving(true);
    setError(null);
    void updateAdObjectAction(form.editAdId, { creative: buildCreative(ad, form.destination) }).then((result) => {
      setSaving(false);
      if (isAdsError(result)) {
        if (result.expected) {
          setIssues(issuesFromCreativeEdit(result.expected));
          return;
        }
        setError(errorText(result));
        return;
      }
      onSaved(result.data);
    });
  };

  return (
    <WizardProvider value={value}>
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-foreground">{t("editTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("editDescription")}</p>
        </div>
        <CardSections>
          <AdStep index={0} />
        </CardSections>
        {error ? (
          <p className="flex items-center gap-2 text-sm text-destructive-ink" role="alert">
            <Warning className="h-4 w-4" aria-hidden />
            {error}
          </p>
        ) : null}
        <FooterSlot slot={actionsSlot}>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" title={t("cancel")} onClick={onCancel} disabled={saving} />
            <Button variant="primary" title={saving ? t("savingCreative") : t("saveCreative")} onClick={save} disabled={saving} />
          </div>
        </FooterSlot>
      </div>
    </WizardProvider>
  );
}
