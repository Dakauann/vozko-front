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
import { EMPTY_LEAD_EXIT_DRAFT, planOf, type LeadExitPlan } from "@/lib/whatsapp-templates/exit-draft";

import { LeadExitChoice } from "./LeadExitChoice";

interface LeadExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: { button: boolean };
  allowedKinds: readonly string[];
  footerText: string;
  onApply: (plan: LeadExitPlan) => void;
}

function LeadExitDialogBody({ onOpenChange, room, allowedKinds, footerText, onApply }: Omit<LeadExitDialogProps, "open">) {
  const t = useTranslations("templateExit.choice");
  const [draft, setDraft] = useState({ ...EMPTY_LEAD_EXIT_DRAFT, footerText });
  const plan = planOf(draft);
  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <ElevatedDialogBody>
        <LeadExitChoice draft={draft} onChange={setDraft} room={room} allowedKinds={allowedKinds} />
      </ElevatedDialogBody>
      <ElevatedDialogFooter>
        <Button type="button" variant="secondary" title={t("cancel")} onClick={() => onOpenChange(false)} />
        <Button type="button" variant="primary" title={t("apply")} disabled={!plan} onClick={() => plan && onApply(plan)} />
      </ElevatedDialogFooter>
    </>
  );
}

export function LeadExitDialog({ open, ...props }: LeadExitDialogProps) {
  return (
    <ElevatedDialog open={open} onOpenChange={props.onOpenChange}>
      <ElevatedDialogContent className="max-w-[560px]">{open ? <LeadExitDialogBody {...props} /> : null}</ElevatedDialogContent>
    </ElevatedDialog>
  );
}
