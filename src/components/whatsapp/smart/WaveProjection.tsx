"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { projectSmartWavesAction, type WaveProjection } from "@/app/actions/whatsapp-campaign-smart";
import type { SmartPolicy } from "@/lib/whatsapp-campaigns/smart";

const SETTLE_MS = 400;

type ProjectionState = { key: string; projection: WaveProjection | null; failed: boolean };

function useWaveProjection(policy: SmartPolicy, contacts: number, startAt?: string | null) {
  const key = JSON.stringify({ policy, contacts, startAt: startAt ?? null });
  const [state, setState] = useState<ProjectionState>({ key: "", projection: null, failed: false });

  useEffect(() => {
    if (contacts <= 0) return;
    let active = true;
    const timer = window.setTimeout(() => {
      projectSmartWavesAction(policy, contacts, startAt).then((result) => {
        if (active) setState({ key, projection: result.projection, failed: result.error !== null });
      });
    }, SETTLE_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [key, policy, contacts, startAt]);

  return state.key === key ? state : { key, projection: null, failed: false };
}

export function WaveProjectionList({ policy, contacts, startAt }: { policy: SmartPolicy; contacts: number; startAt?: string | null }) {
  const t = useTranslations("whatsappCampaignsPage.smart.projection");
  const format = useFormatter();
  const { projection, failed } = useWaveProjection(policy, contacts, startAt);
  const when = (iso: string) => format.dateTime(new Date(iso), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (failed) return <p className="text-xs text-muted-foreground">{t("failed")}</p>;
  if (!projection || projection.waves.length === 0) return null;
  const last = projection.waves[projection.waves.length - 1];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{t("summary", { waves: projection.waves.length, time: when(last.at) })}</p>
      </div>
      <ol aria-label={t("title")} className="max-h-52 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
        {projection.waves.map((wave) => (
          <li key={wave.number} className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-1.5 text-xs">
            <span className="font-medium text-foreground">{t("wave", { number: wave.number })}</span>
            <span className="tabular-nums text-muted-foreground">{t("size", { count: wave.size })}</span>
            <span className="tabular-nums text-foreground">{when(wave.at)}</span>
          </li>
        ))}
      </ol>
      {projection.truncated ? <p className="text-xs text-muted-foreground">{t("more")}</p> : null}
      <p className="text-2xs leading-relaxed text-muted-foreground">{t("caveat")}</p>
    </div>
  );
}
