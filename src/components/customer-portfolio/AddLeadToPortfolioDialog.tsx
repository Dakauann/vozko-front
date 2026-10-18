"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import type { LeadLookupMatch } from "@/app/actions/leads";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { CheckCircle, MagnifyingGlass } from "@/components/icons";
import { MemberCommandSelect } from "@/components/members/MemberCommandSelect";
import { useLeadLookup } from "@/hooks/use-lead-lookup";
import { formatPhoneForDisplay } from "@/lib/phone/display";

import { usePortfolioCommands } from "./use-portfolio-commands";

export function AddLeadToPortfolioDialog({ holderId, choosesHolder, onClose }: { holderId: string; choosesHolder: boolean; onClose: () => void }) {
  const t = useTranslations("customerPortfolio");
  const { busy, placeLead } = usePortfolioCommands();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<LeadLookupMatch | null>(null);
  const [holder, setHolder] = useState(holderId);
  const lookup = useLeadLookup(text, picked === null);

  const confirm = async () => {
    if (!picked) return;
    if (await placeLead(picked.id, holder)) onClose();
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("add.title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("add.description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-4">
          <div className="space-y-2">
            <ElevatedInput
              label={t("add.search")}
              placeholder={t("add.placeholder")}
              icon={<MagnifyingGlass weight="bold" className="h-4 w-4" />}
              value={picked ? picked.realName || formatPhoneForDisplay(picked.number) : text}
              disabled={busy}
              onChange={(event) => {
                setPicked(null);
                setText(event.target.value);
              }}
            />
            {picked ? null : lookup.searching ? (
              <p className="pl-1 text-xs text-muted-foreground">{t("add.searching")}</p>
            ) : lookup.failed ? (
              <p className="pl-1 text-xs text-destructive-ink">{t("add.failed")}</p>
            ) : lookup.settled && lookup.matches.length === 0 ? (
              <p className="pl-1 text-xs text-muted-foreground">{t("add.empty")}</p>
            ) : !lookup.settled ? (
              <p className="pl-1 text-xs text-muted-foreground">{t("add.hint")}</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-[--radius] border border-border">
                {lookup.matches.map((match) => (
                  <li key={match.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(match)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <span className="truncate font-medium text-foreground">{match.realName || formatPhoneForDisplay(match.number)}</span>
                      {match.realName && match.number ? <span className="shrink-0 text-xs text-muted-foreground">{formatPhoneForDisplay(match.number)}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {picked?.realName && picked.number ? (
              <p className="inline-flex items-center gap-1.5 pl-1 text-xs text-foreground">
                <CheckCircle weight="fill" className="h-3.5 w-3.5 text-primary" aria-hidden />
                {formatPhoneForDisplay(picked.number)}
              </p>
            ) : null}
          </div>
          {choosesHolder ? (
            <MemberCommandSelect
              value={holder}
              onChange={setHolder}
              text={{ label: t("member.label"), search: t("member.search"), empty: t("member.empty"), failed: t("member.failed") }}
              disabled={busy}
            />
          ) : null}
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("add.cancel")} onClick={onClose} disabled={busy} />
          <Button variant="primary" title={t("add.confirm")} onClick={() => void confirm()} disabled={busy || !picked || holder === ""} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
