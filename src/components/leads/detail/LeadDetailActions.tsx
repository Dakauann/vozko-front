"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { BellSlash, DotsThree, PencilSimple, Prohibit, ShieldCheck, UserMinus } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LeadOptOutDialog } from "@/components/leads/LeadOptOutDialog";
import { anonymizeLeadAction, blockLeadAction } from "@/app/actions/leads";
import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";
import { withBlockOutcome, withRecord } from "@/lib/leads/detail";
import type { LeadDetail } from "@/lib/leads/types";

type Confirmation = "block" | "optOut" | "anonymize";
type Confirmed = Exclude<Confirmation, "optOut">;

export interface LeadDetailPermissions {
  edit: boolean;
  block: boolean;
  anonymize: boolean;
}

export function LeadDetailActions({
  lead,
  permissions,
  onEdit,
  onChange,
  onAnonymized,
}: {
  lead: LeadDetail;
  permissions: LeadDetailPermissions;
  onEdit: () => void;
  onChange: (change: (detail: LeadDetail) => LeadDetail) => void;
  onAnonymized: () => void;
}) {
  const t = useTranslations("leadDetail");
  const tErrors = useTranslations("leads");
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  const refused = (title: string, error: CodedError) =>
    toast.error(title, { description: codedErrorMessage(tErrors, error, "") || undefined });

  const setBlocked = async (blocked: boolean): Promise<boolean> => {
    const result = await blockLeadAction(lead.id, blocked);
    if (result.error) {
      refused(t("block.failed"), result.error);
      return false;
    }
    const { outcome } = result;
    onChange((detail) => withBlockOutcome(detail, outcome));
    toast.success(outcome.blocked ? t("block.blocked") : t("block.unblocked"));
    return true;
  };

  const unblock = async () => {
    setUnblocking(true);
    try {
      await setBlocked(false);
    } finally {
      setUnblocking(false);
    }
  };

  const anonymize = async (): Promise<boolean> => {
    const result = await anonymizeLeadAction(lead.id);
    if (result.error) {
      refused(t("anonymize.failed"), result.error);
      return false;
    }
    toast.success(t("anonymize.done"));
    onAnonymized();
    return true;
  };

  const confirmations: Record<Confirmed, { run: () => Promise<boolean>; tone: "danger" | "default" }> = {
    block: { run: () => setBlocked(true), tone: "danger" },
    anonymize: { run: anonymize, tone: "danger" },
  };

  const optedOut = !!lead.optedOutAt;
  const hasMenu = permissions.block || permissions.edit || permissions.anonymize;

  return (
    <>
      {permissions.edit ? (
        <Button
          variant="secondary"
          size="sm"
          icon={<PencilSimple className="h-3.5 w-3.5" weight="bold" />}
          iconVisible
          iconSide="left"
          title={t("actions.edit")}
          onClick={onEdit}
        />
      ) : null}
      {hasMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("actions.more")}
              icon={<DotsThree className="h-4 w-4" weight="bold" />}
              iconVisible
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {permissions.block ? (
              lead.blocked ? (
                <DropdownMenuItem disabled={unblocking} onSelect={() => void unblock()}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {t("actions.unblock")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setConfirming("block")}>
                  <Prohibit className="mr-2 h-4 w-4" />
                  {t("actions.block")}
                </DropdownMenuItem>
              )
            ) : null}
            {permissions.edit ? (
              <DropdownMenuItem disabled={optedOut} onSelect={() => setConfirming("optOut")}>
                <BellSlash className="mr-2 h-4 w-4" />
                {t("actions.optOut")}
              </DropdownMenuItem>
            ) : null}
            {permissions.anonymize ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive-ink" onSelect={() => setConfirming("anonymize")}>
                  <UserMinus className="mr-2 h-4 w-4" />
                  {t("actions.anonymize")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {confirming === "optOut" ? (
        <LeadOptOutDialog
          leadId={lead.id}
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          onRecorded={(record) => onChange((detail) => withRecord(detail, record))}
        />
      ) : confirming ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          title={t(`${confirming}.title`)}
          description={t(`${confirming}.description`)}
          confirmLabel={t(`${confirming}.confirm`)}
          cancelLabel={t("cancel")}
          tone={confirmations[confirming].tone}
          onConfirm={confirmations[confirming].run}
        />
      ) : null}
    </>
  );
}
