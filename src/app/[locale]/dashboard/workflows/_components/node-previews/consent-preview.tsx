"use client";

import { useTranslations } from "next-intl";

import { configText } from "@/lib/workflows/config-text";

import { EmptyPreview } from "../message-node-primitives";
import { DecisionBlock } from "./decision-block";

const MODE_DETAIL: Record<string, "purpose" | "note"> = {
  registrar: "purpose",
  retirar: "note",
};

export function ConsentPreview({ config }: { config: Record<string, unknown> }) {
  const t = useTranslations("workflowsPage.consent");
  const mode = configText(config.mode);
  const detailKey = MODE_DETAIL[mode];
  if (!detailKey) return <EmptyPreview label={t("noMode")} />;
  const detail = configText(config[detailKey]);
  return (
    <div className="space-y-1">
      <DecisionBlock>{t(mode as "registrar")}</DecisionBlock>
      {detail ? <p className="line-clamp-2 text-2xs text-muted-foreground">{t(detailKey, { [detailKey]: detail })}</p> : null}
    </div>
  );
}
