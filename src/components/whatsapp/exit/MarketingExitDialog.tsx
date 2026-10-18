"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import type { TemplateDraftPurpose } from "@/lib/whatsapp-templates/draft";
import { EMPTY_LEAD_EXIT_DRAFT, planOf, type LeadExitPlan } from "@/lib/whatsapp-templates/exit-draft";

import { LeadExitChoice } from "./LeadExitChoice";

interface MarketingExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  room: { button: boolean };
  allowedKinds: readonly string[];
  footerText: string;
  busy: boolean;
  purpose: TemplateDraftPurpose;
  onApplyPlan: (plan: LeadExitPlan) => void;
}

const DIALOG_COPY = {
  create: { namespace: "templateExit.createDialog", submit: "applyAndCreate" },
  edit: { namespace: "templateExit.editDialog", submit: "applyAndSave" },
} as const;

function MarketingExitBody({ onOpenChange, templateName, room, allowedKinds, footerText, busy, purpose, onApplyPlan }: Omit<MarketingExitDialogProps, "open">) {
  const copy = DIALOG_COPY[purpose];
  const t = useTranslations(copy.namespace);
  const [draft, setDraft] = useState({ ...EMPTY_LEAD_EXIT_DRAFT, footerText });
  const plan = planOf(draft);

  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("description", { name: templateName })}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <ElevatedDialogBody>
        <LeadExitChoice draft={draft} onChange={setDraft} room={room} allowedKinds={allowedKinds} />
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button type="button" variant="secondary" title={t("back")} onClick={() => onOpenChange(false)} disabled={busy} />
        <Button type="button" variant="primary" title={t(copy.submit)} disabled={!plan || busy} onClick={() => plan && onApplyPlan(plan)} />
      </ElevatedDialogFooter>
    </>
  );
}

export function MarketingExitDialog({ open, ...props }: MarketingExitDialogProps) {
  return (
    <ElevatedDialog open={open} onOpenChange={props.onOpenChange}>
      <ElevatedDialogContent className="max-w-[600px]">{open ? <MarketingExitBody {...props} /> : null}</ElevatedDialogContent>
    </ElevatedDialog>
  );
}
