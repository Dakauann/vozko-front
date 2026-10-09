"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { useToast } from "@/hooks/use-toast";
import type { SvgImportOutcome } from "@/lib/studio/svg-import";

const FAILURE_KEYS = { invalid: "invalid", empty: "empty", too_large: "tooLarge" } as const;

export function useSvgFeedback() {
  const t = useTranslations("studio.vectors.svg");
  const { toast } = useToast();
  const imported = useCallback(
    (outcome: SvgImportOutcome) => {
      if (!outcome.ok) {
        toast({ title: t(FAILURE_KEYS[outcome.reason]), variant: "destructive" });
        return;
      }
      toast({ title: t("imported", { count: outcome.count }), description: outcome.skipped > 0 ? t("skipped", { count: outcome.skipped }) : undefined });
    },
    [t, toast],
  );
  const copied = useCallback((ok: boolean) => toast(ok ? { title: t("copied") } : { title: t("copyFailed"), variant: "destructive" }), [t, toast]);
  return { imported, copied };
}

export async function copySvgText(svg: string | null): Promise<boolean> {
  if (!svg) return false;
  try {
    await navigator.clipboard.writeText(svg);
    return true;
  } catch {
    return false;
  }
}
