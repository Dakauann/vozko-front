"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { useWorkspace } from "@/contexts/workspace-context";
import { useOutcomeCapture } from "@/hooks/use-outcome-capture";
import { CALLBACK_DISPOSITION } from "@/lib/call-lists/types";
import type { OutcomeSpec } from "@/lib/workspace/workspace-config/types";

export function callOutcomeLabel(code: string, outcomes: readonly Pick<OutcomeSpec, "code" | "label">[], callbackLabel: string): string {
  if (code === CALLBACK_DISPOSITION) return callbackLabel;
  return outcomes.find((outcome) => outcome.code === code)?.label ?? code;
}

export function useCallOutcomeLabel(): (code: string) => string | null {
  const t = useTranslations("callLists.queue");
  const { currentWorkspace } = useWorkspace();
  const { capture, loaded } = useOutcomeCapture(currentWorkspace?.id);
  const outcomes = useMemo(() => capture?.outcomes ?? [], [capture?.outcomes]);
  const callbackLabel = t("callbackDisposition");
  return (code: string) => (loaded ? callOutcomeLabel(code, outcomes, callbackLabel) : null);
}
