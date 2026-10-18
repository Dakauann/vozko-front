"use client";

import { useTranslations } from "next-intl";

import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { UserCheck, UserPlus, X } from "@/components/icons";
import { useConversationHolding, usePortfolioAccess } from "@/hooks/use-customer-portfolio";
import type { EntryType } from "@/lib/conversations/types";
import { holdingState } from "@/lib/customer-portfolio/portfolio";
import { cn } from "@/lib/utils";

import { usePortfolioCommands } from "./use-portfolio-commands";

const CHIP = "inline-flex h-6 max-w-[14rem] items-center gap-1 rounded-[--radius] border border-border bg-card px-2 text-2xs font-semibold text-foreground";

export function ConversationPortfolio({ entryType, entryId, active }: { entryType: EntryType; entryId: string; active: boolean }) {
  const t = useTranslations("customerPortfolio");
  const { views, uses, userId } = usePortfolioAccess();
  const holding = useConversationHolding(entryType, entryId, active);
  const { busy, placeConversation, remove } = usePortfolioCommands();
  const current = holding.data;
  if (!views || !current) return null;

  const state = holdingState(current, userId);
  const entry = current.entry;
  if (state === "free" && !uses) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {state === "free" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void placeConversation(entryType, entryId)}
          className={cn(CHIP, "border-dashed border-control-edge text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60")}
        >
          <UserPlus weight="bold" className="h-3 w-3 shrink-0" aria-hidden />
          {t("conversation.add")}
        </button>
      ) : null}
      {state === "mine" && entry ? (
        <span className={CHIP}>
          <UserCheck weight="bold" className="h-3 w-3 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{t("conversation.mine")}</span>
          {uses ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove(entry.id)}
              aria-label={t("conversation.remove")}
              title={t("conversation.remove")}
              className="-mr-1 ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              <X weight="bold" className="h-2.5 w-2.5" aria-hidden />
            </button>
          ) : null}
        </span>
      ) : null}
      {state === "other" && entry ? (
        <span className={CHIP}>
          <UserCheck weight="bold" className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{t("conversation.other", { name: entry.holderName || t("page.unknownMember") })}</span>
        </span>
      ) : null}
      <ExplainerHint id="crm.customerPortfolio" />
    </div>
  );
}
