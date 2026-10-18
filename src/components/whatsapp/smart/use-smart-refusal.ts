"use client";

import { useSmartText } from "./use-smart-text";

export function useSmartRefusal() {
  const { t, ruleText } = useSmartText();
  return (code: string | undefined, expected: Record<string, string> | undefined): string | null => {
    if (code === "smart_campaign_busy") return t("toast.busy");
    if (code !== "smart_campaign_blocked") return null;
    const rules = (expected?.reasons ?? "").split(",").filter(Boolean);
    const reasons = rules.map((rule) => ruleText({ rule, action: "pause", at: "" })).join("; ");
    return t("toast.blocked", { reasons });
  };
}
