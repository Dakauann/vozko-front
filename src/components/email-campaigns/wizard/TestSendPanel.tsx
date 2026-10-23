"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { isEmailActionError, testSendEmailCampaignAction } from "@/app/actions/email-campaigns";
import Button from "@/components/elevated-design/button";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { PaperPlaneTilt } from "@/components/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEmailPricing } from "@/hooks/use-email-marketing";
import { MAX_TEST_RECIPIENTS, parseTestAddresses } from "@/lib/email-campaigns/draft";
import type { TestOutcome, TestResult } from "@/lib/email-campaigns/types";

import { useEmailErrorMessage, useEmailFormat } from "../shared";

const OUTCOME_TONE: Record<TestOutcome, StatusChipTone> = {
  sent: "healthy",
  suppressed: "warning",
  daily_cap: "warning",
  failed: "fault",
};

export function TestSendPanel({ campaignId, prepare, disabled }: { campaignId: string | null; prepare: () => Promise<boolean>; disabled?: boolean }) {
  const t = useTranslations("emailCampaigns.test");
  const errorMessage = useEmailErrorMessage();
  const { unitBrl } = useEmailFormat();
  const [open, setOpen] = useState(false);
  const pricing = useEmailPricing(open);
  const price = pricing.data ? unitBrl(pricing.data.send.unitBRL) : null;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const addresses = parseTestAddresses(text);
  const tooMany = addresses.length > MAX_TEST_RECIPIENTS;

  const send = async () => {
    setError(null);
    setSending(true);
    const ready = await prepare();
    if (!ready || !campaignId) {
      setSending(false);
      setError(t("notSaved"));
      return;
    }
    const result = await testSendEmailCampaignAction(campaignId, addresses);
    setSending(false);
    if (isEmailActionError(result)) {
      setError(errorMessage(result));
      return;
    }
    setResults(result.data.results);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" title={t("trigger")} icon={<PaperPlaneTilt className="h-4 w-4" />} iconVisible iconSide="left" disabled={disabled} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{t("title")}</p>
            <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">{t("hint", { max: MAX_TEST_RECIPIENTS })}</p>
          </div>
          <ElevatedTextarea
            label={t("addresses")}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            controlSize="sm"
            error={tooMany ? t("tooMany", { max: MAX_TEST_RECIPIENTS }) : undefined}
          />
          {error ? <p className="text-2xs text-destructive-ink" role="alert">{error}</p> : null}
          {price ? <p className="readout text-2xs leading-relaxed text-muted-foreground">{t("cost", { price })}</p> : null}
          <div className="flex items-center justify-between gap-2">
            <span className="readout text-2xs text-muted-foreground">{t("count", { count: addresses.length, max: MAX_TEST_RECIPIENTS })}</span>
            <Button
              variant="primary"
              size="sm"
              title={sending ? t("sending") : t("send")}
              disabled={sending || addresses.length === 0 || tooMany}
              onClick={() => void send()}
            />
          </div>
        </div>
        {results.length > 0 ? (
          <ul className="divide-y divide-border border-t border-border" aria-label={t("results")}>
            {results.map((result) => (
              <li key={result.address} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="truncate text-xs text-foreground">{result.address}</span>
                <StatusChip tone={OUTCOME_TONE[result.outcome]} label={t(`outcome.${result.outcome}`)} />
              </li>
            ))}
          </ul>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
