"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { useToast } from "@/hooks/use-toast";
import type { ShapeOpIssue } from "@/lib/studio/shape-ops";

export function useShapeOpFeedback() {
  const t = useTranslations("studio.vectors.ops.issues");
  const { toast } = useToast();
  return useCallback(
    (issue: ShapeOpIssue | null) => {
      if (issue) toast({ title: t(issue), variant: "destructive" });
    },
    [t, toast],
  );
}
