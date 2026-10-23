"use client";

import { useTranslations } from "next-intl";

import { ChatText } from "@/components/icons";
import { carrierNodeSummary } from "@/lib/workflows/carrier-node";

import { MessageBubble } from "../message-node-primitives";

export function SendCarrierPreview({ config }: { config: Record<string, unknown> }) {
  const t = useTranslations("workflowsPage.carrierNode");
  const summary = carrierNodeSummary(config);
  if (!summary) {
    return <p className="px-2 py-2 text-2xs text-muted-foreground">{t("unreadable")}</p>;
  }
  return (
    <div className="space-y-1.5 px-2 py-2" data-testid="send-carrier-preview">
      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-2xs font-semibold text-foreground">
        <ChatText aria-hidden className="h-3 w-3" />
        {t(`channels.${summary.channel}`)}
      </span>
      <MessageBubble body={summary.text} emptyBodyLabel={t("empty")} theme="neutral" />
    </div>
  );
}
