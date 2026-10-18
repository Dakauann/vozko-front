"use client";

import { useCallback, useState } from "react";

import { getWhatsAppCampaignLaunchCheckAction, startWhatsAppCampaignAction } from "@/app/actions/whatsapp-campaigns";
import { hasFindings, LAUNCH_REFUSAL_CODES, type LaunchReport } from "@/lib/whatsapp-campaigns/launch-check";

export type LaunchPhase = "idle" | "checking" | "review" | "starting";

export interface LaunchRefusal {
  code?: string;
  message: string;
  expected?: Record<string, string>;
}

export function useLaunchCheck({
  campaignId,
  onStarted,
  onRefused,
}: {
  campaignId: string;
  onStarted: () => void;
  onRefused: (refusal: LaunchRefusal) => void;
}) {
  const [report, setReport] = useState<LaunchReport | null>(null);
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [confirmed, setConfirmed] = useState(false);
  const [changed, setChanged] = useState(false);

  const settle = useCallback(() => {
    setPhase("idle");
    setReport(null);
    setConfirmed(false);
  }, []);

  const load = useCallback(async () => {
    const fresh = await getWhatsAppCampaignLaunchCheckAction(campaignId);
    if (!fresh.report) {
      settle();
      onRefused({ code: fresh.errorCode, message: fresh.error ?? "" });
    }
    return fresh.report;
  }, [campaignId, onRefused, settle]);

  const review = useCallback((current: LaunchReport) => {
    setReport(current);
    setConfirmed(false);
    setPhase("review");
  }, []);

  const start = useCallback(
    async (current: LaunchReport) => {
      setPhase("starting");
      const result = await startWhatsAppCampaignAction(campaignId, current.needsConfirmation ? current.fingerprint : undefined);
      if (result.errorCode && LAUNCH_REFUSAL_CODES.has(result.errorCode)) {
        setChanged(true);
        const fresh = await load();
        if (fresh) review(fresh);
        return;
      }
      settle();
      if (result.error) {
        onRefused({ code: result.errorCode, message: result.error, expected: result.errorExpected });
        return;
      }
      onStarted();
    },
    [campaignId, load, onRefused, onStarted, review, settle],
  );

  const request = useCallback(async () => {
    setChanged(false);
    setPhase("checking");
    const current = await load();
    if (!current) return;
    if (hasFindings(current)) {
      review(current);
      return;
    }
    await start(current);
  }, [load, review, start]);

  const confirmStart = useCallback(() => {
    if (report) void start(report);
  }, [report, start]);

  const close = useCallback(() => {
    if (phase !== "starting") settle();
  }, [phase, settle]);

  return { report, phase, confirmed, setConfirmed, changed, request, confirmStart, close };
}

export type LaunchCheck = ReturnType<typeof useLaunchCheck>;
