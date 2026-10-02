"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { isAdsError, setAdSpendCapAction } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { PencilSimple } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import { inputToMinor, minorToInput } from "@/lib/advertising/money";
import { activeSpendCap, spendCapProblem, spendCapUsage } from "@/lib/advertising/spend-cap";
import type { AdAccount } from "@/lib/advertising/types";

import { useAdsFormat } from "./use-ads-format";

function SpendCapForm({ account, onClose, onSaved }: { account: AdAccount; onClose: () => void; onSaved: (account: AdAccount) => void }) {
  const t = useTranslations("adsManager.spendCap");
  const { toast } = useToast();
  const fmt = useAdsFormat();
  const cap = activeSpendCap(account);
  const [input, setInput] = useState(() => (cap ? minorToInput(cap, account.currency) : ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = inputToMinor(input, account.currency);
  const problem = input.trim() ? spendCapProblem(amount, account.amountSpent) : null;

  const save = (next: number | null) => {
    setSaving(true);
    setError(null);
    void setAdSpendCapAction(account.id, next).then((result) => {
      setSaving(false);
      if (isAdsError(result)) {
        setError(result.error);
        return;
      }
      onSaved(result.data);
      toast({ title: next === null ? t("removed") : t("saved") });
    });
  };

  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {t("spentSoFar")} <span className="tabular-nums text-foreground">{fmt.minor(account.amountSpent, account.currency)}</span>
        </p>
        <ElevatedInput
          label={t("amountLabel", { currency: account.currency })}
          inputMode="decimal"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          controlSize="sm"
          error={problem ? t(`problems.${problem}`, { spent: fmt.minor(account.amountSpent, account.currency) }) : undefined}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {error ? <p className="text-sm text-destructive-ink" role="alert">{error}</p> : null}
      </div>
      <ElevatedDialogFooter className="sm:justify-between">
        <div>
          {cap ? <Button variant="ghost" size="sm" title={t("remove")} onClick={() => save(null)} disabled={saving} /> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="ghost" size="sm" title={t("cancel")} onClick={onClose} disabled={saving} />
          <Button
            variant="primary"
            size="sm"
            title={saving ? t("saving") : t("save")}
            onClick={() => save(amount)}
            disabled={saving || amount === null || problem !== null || amount === cap}
          />
        </div>
      </ElevatedDialogFooter>
    </>
  );
}

export function SpendCapControl({
  account,
  canUpdate,
  onSaved,
}: {
  account: AdAccount;
  canUpdate: boolean;
  onSaved: (account: AdAccount) => void;
}) {
  const t = useTranslations("adsManager.spendCap");
  const fmt = useAdsFormat();
  const [open, setOpen] = useState(false);
  const cap = activeSpendCap(account);
  const usage = spendCapUsage(account);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        {t("label")}{" "}
        <span className="tabular-nums text-foreground">{cap ? fmt.minor(cap, account.currency) : t("none")}</span>
      </span>
      <span aria-hidden>·</span>
      <span>
        {t("spent")} <span className="tabular-nums text-foreground">{fmt.minor(account.amountSpent, account.currency)}</span>
      </span>
      {usage !== null ? (
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" role="img" aria-label={t("usage", { percent: fmt.percent(usage * 100) })}>
          <span className={usage >= 0.9 ? "block h-full bg-warning" : "block h-full bg-chart-1"} style={{ width: `${usage * 100}%` }} />
        </span>
      ) : null}
      {canUpdate ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("edit")}
          title={t("edit")}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PencilSimple className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
      <ElevatedDialog open={open} onOpenChange={setOpen}>
        <ElevatedDialogContent>
          {open ? (
            <SpendCapForm
              account={account}
              onClose={() => setOpen(false)}
              onSaved={(updated) => {
                setOpen(false);
                onSaved(updated);
              }}
            />
          ) : null}
        </ElevatedDialogContent>
      </ElevatedDialog>
    </div>
  );
}
