"use client";

import { useCallback, useState } from "react";

import { exitRiskFields } from "@/lib/whatsapp-templates/exit";

import { useTemplateExitVerdict } from "./use-template-exit";

export function useExitAcknowledgement(templateId: string, { required = true }: { required?: boolean } = {}) {
  const exitVerdict = useTemplateExitVerdict(templateId);
  const [given, setGiven] = useState({ templateId: "", checked: false });
  const acknowledged = given.templateId === templateId && given.checked;
  const judged = required && templateId !== "";
  const { verdict, error } = exitVerdict;
  const unknown = judged && (verdict === null || error !== null);
  const needed = judged && verdict !== null && verdict.campaignAcknowledgementRequired !== false;
  const setAcknowledged = useCallback((checked: boolean) => setGiven({ templateId, checked }), [templateId]);
  return {
    ...exitVerdict,
    templateId,
    needed,
    acknowledged,
    setAcknowledged,
    blocks: unknown || (needed && !acknowledged),
    fields: exitRiskFields(needed && acknowledged),
  };
}

export type ExitAcknowledgementGate = ReturnType<typeof useExitAcknowledgement>;
