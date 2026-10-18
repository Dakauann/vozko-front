"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  movePortfolioEntryAction,
  placeConversationAction,
  placeLeadAction,
  removePortfolioEntryAction,
} from "@/app/actions/customer-portfolio";
import { usePortfolioAccess, useRefreshPortfolio } from "@/hooks/use-customer-portfolio";
import { codedErrorMessage, type CodedRefusal } from "@/lib/api/coded-error";
import type { ParsedAnswer } from "@/lib/api/parsed-request";
import type { EntryType } from "@/lib/conversations/types";
import { heldByOther, type PortfolioHolding } from "@/lib/customer-portfolio/portfolio";

export function usePortfolioError() {
  const t = useTranslations("customerPortfolio");
  return useCallback((error: CodedRefusal) => codedErrorMessage(t, error, t("errors.failed")), [t]);
}

export function usePortfolioCommands() {
  const t = useTranslations("customerPortfolio");
  const errorText = usePortfolioError();
  const refresh = useRefreshPortfolio();
  const { userId, manages } = usePortfolioAccess();
  const [busy, setBusy] = useState(false);

  const move = useCallback(
    async (entryId: string, holderId: string): Promise<boolean> => {
      setBusy(true);
      const answer = await movePortfolioEntryAction(entryId, holderId);
      setBusy(false);
      if (answer.error) {
        toast.error(errorText(answer.error));
        return false;
      }
      await refresh();
      toast.success(t("toast.moved", { name: answer.data.entry?.holderName ?? "" }));
      return true;
    },
    [errorText, refresh, t],
  );

  const refuse = useCallback(
    (error: CodedRefusal) => {
      const held = heldByOther(error);
      if (!held) {
        toast.error(errorText(error));
        return;
      }
      toast.error(t("toast.heldBy", { name: held.holderName || t("page.unknownMember") }), {
        action: manages && held.holderId !== userId ? { label: t("toast.moveToMe"), onClick: () => void move(held.entryId, userId) } : undefined,
      });
    },
    [errorText, manages, move, t, userId],
  );

  const place = useCallback(
    async (call: () => Promise<ParsedAnswer<PortfolioHolding>>): Promise<PortfolioHolding | null> => {
      setBusy(true);
      const answer = await call();
      setBusy(false);
      if (answer.error) {
        refuse(answer.error);
        return null;
      }
      await refresh();
      const holder = answer.data.entry;
      toast.success(holder && holder.holderId !== userId ? t("toast.placedFor", { name: holder.holderName ?? "" }) : t("toast.placed"));
      return answer.data;
    },
    [refresh, refuse, t, userId],
  );

  const placeConversation = useCallback(
    (entryType: EntryType, entryId: string, holderId?: string) => place(() => placeConversationAction(entryType, entryId, holderId)),
    [place],
  );

  const placeLead = useCallback((leadId: string, holderId?: string) => place(() => placeLeadAction(leadId, holderId)), [place]);

  const remove = useCallback(
    async (entryId: string): Promise<boolean> => {
      setBusy(true);
      const answer = await removePortfolioEntryAction(entryId);
      setBusy(false);
      if (answer.error) {
        toast.error(errorText(answer.error));
        return false;
      }
      await refresh();
      toast.success(t("toast.removed"));
      return true;
    },
    [errorText, refresh, t],
  );

  return { busy, placeConversation, placeLead, move, remove };
}
