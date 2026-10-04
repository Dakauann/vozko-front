"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { confirmNumberLinkAction, isAdsError, requestNumberLinkAction, type AdsResult } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { CheckCircle, WhatsappLogo } from "@/components/icons";
import type { AdPage } from "@/lib/advertising/types";

import { useAdsErrorText } from "./use-ads-error";

type Step = "choose" | "code" | "linked";

const CODE_MAX_DIGITS = 8;

export function LinkWhatsAppNumber({ accountId, page, onLinked }: { accountId: string; page: AdPage; onLinked: () => void }) {
  const t = useTranslations("adsWizard.promotion.linkNumber");
  const errorText = useAdsErrorText();
  const linkable = page.linkable ?? [];
  const [number, setNumber] = useState(linkable[0]?.number ?? "");
  const [step, setStep] = useState<Step>("choose");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const failureText = (result: AdsResult<unknown>) => {
    if (!isAdsError(result)) return null;
    if (result.expected?.code) return t("codeInvalid");
    if (result.expected?.number) return t("notLinkable");
    return errorText(result);
  };

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const result = await requestNumberLinkAction(accountId, page.pageId, number);
    setBusy(false);
    if (isAdsError(result)) {
      setError(failureText(result));
      return;
    }
    setCode("");
    setStep("code");
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await confirmNumberLinkAction(accountId, page.pageId, number, code);
    setBusy(false);
    if (isAdsError(result)) {
      setError(failureText(result));
      return;
    }
    setStep("linked");
    onLinked();
  };

  if (linkable.length === 0) {
    return (
      <div className="space-y-1 rounded-[--radius] border border-border bg-muted px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("noneLinkable")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[--radius] border border-border bg-muted px-4 py-3">
      <div className="flex items-start gap-2">
        <WhatsappLogo className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("description", { page: page.name })}</p>
        </div>
      </div>

      {step === "choose" ? (
        <div className="space-y-2">
          {linkable.length > 1 ? (
            <ElevatedSelect label={t("number")} value={number} onValueChange={setNumber} disabled={busy}>
              {linkable.map((option) => (
                <ElevatedSelectItem key={option.number} value={option.number}>
                  {option.label} · {option.number}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          ) : (
            <p className="text-sm text-foreground">
              {linkable[0].label} · {linkable[0].number}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t("publicNumber")}</p>
          <Button variant="primary" size="sm" title={busy ? t("sending") : t("sendCode")} disabled={busy || !number} onClick={() => void sendCode()} />
        </div>
      ) : null}

      {step === "code" ? (
        <div className="space-y-2">
          <ElevatedInput
            label={t("code")}
            value={code}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_MAX_DIGITS}
            disabled={busy}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
          />
          <p className="text-xs text-muted-foreground">{t("codeHint", { number })}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="sm" title={busy ? t("confirming") : t("confirm")} disabled={busy || code.length === 0} onClick={() => void confirm()} />
            <Button variant="ghost" size="sm" title={t("resend")} disabled={busy} onClick={() => void sendCode()} />
          </div>
        </div>
      ) : null}

      {step === "linked" ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-healthy-ink">
            <CheckCircle className="h-4 w-4" weight="fill" aria-hidden />
            {t("linked")}
          </p>
          <p className="text-xs text-muted-foreground">{t("linkedHint")}</p>
          <Button variant="secondary" size="sm" title={t("recheck")} onClick={onLinked} />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-destructive-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
