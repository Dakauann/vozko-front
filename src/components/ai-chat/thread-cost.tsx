"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { getChatThreadCostAction } from "@/app/actions/aichat";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatThreadCost, formatTokenCount, LATE_DEBIT_MS, LIVE_COST_REFRESH_MS, threadCostKey, threadUsage, type ShownUsage, type ThreadCost } from "@/lib/aichat/thread-cost";
import { emptyValue } from "@/lib/format/empty-value";
import { cn } from "@/lib/utils";

interface LoadedCost {
  threadId: string;
  cost: ThreadCost | null;
}

function useCostRefreshes(streaming: boolean): number {
  const [refreshes, setRefreshes] = useState(0);
  const wasStreaming = useRef(streaming);

  useEffect(() => {
    const ended = wasStreaming.current && !streaming;
    wasStreaming.current = streaming;
    const bump = () => setRefreshes((n) => n + 1);
    if (streaming) {
      const live = setInterval(bump, LIVE_COST_REFRESH_MS);
      return () => clearInterval(live);
    }
    if (!ended) return;
    bump();
    const late = setTimeout(bump, LATE_DEBIT_MS);
    return () => clearTimeout(late);
  }, [streaming]);

  return refreshes;
}

export function useThreadCost(threadId: string | null, streaming: boolean) {
  const refreshes = useCostRefreshes(streaming);
  const key = threadCostKey(threadId, refreshes);
  const [loaded, setLoaded] = useState<LoadedCost | null>(null);

  useEffect(() => {
    if (!key || !threadId) return;
    let active = true;
    void getChatThreadCostAction(threadId).then(({ data }) => {
      if (active) setLoaded({ threadId, cost: data });
    });
    return () => {
      active = false;
    };
  }, [key, threadId]);

  const current = loaded && loaded.threadId === threadId ? loaded : null;
  return { loaded: current !== null, cost: current?.cost ?? null };
}

function UsageBreakdown({ usage, locale }: { usage: ShownUsage; locale: string }) {
  const t = useTranslations("aiChatPage.cost.usage");
  const number = new Intl.NumberFormat(locale);
  const rows = [
    { key: "calls", value: usage.calls, always: true },
    { key: "input", value: usage.inputTokens, always: true },
    { key: "cacheRead", value: usage.cacheReadTokens, always: false },
    { key: "cacheWrite", value: usage.cacheWriteTokens, always: false },
    { key: "output", value: usage.outputTokens, always: true },
    { key: "reasoning", value: usage.reasoningTokens, always: false },
  ] as const;
  return (
    <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
      {rows
        .filter((row) => row.always || row.value > 0)
        .map((row) => (
          <div key={row.key} className="contents">
            <dt className="text-muted-foreground">{t(row.key)}</dt>
            <dd className="text-right">{number.format(row.value)}</dd>
          </div>
        ))}
    </dl>
  );
}

export function ThreadCostBadge({ threadId, streaming, className }: { threadId: string | null; streaming: boolean; className?: string }) {
  const t = useTranslations("aiChatPage.cost");
  const locale = useLocale();
  const { loaded, cost } = useThreadCost(threadId, streaming);
  if (!threadId || !loaded) return null;
  const text = formatThreadCost(cost, locale);
  const usage = threadUsage(cost);
  const tokens = usage ? t("tokens", { count: formatTokenCount(usage.totalTokens, locale) }) : null;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${t("label")}: ${text ?? emptyValue(locale)}${tokens ? `, ${tokens}` : ""}`}
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 text-2xs font-medium tabular-nums text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            {text ?? <EmptyValue />}
            {tokens ? (
              <>
                <span aria-hidden className="mx-1 opacity-60">
                  ·
                </span>
                {tokens}
              </>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p>{text ? t("tooltip") : t("unavailable")}</p>
          {usage ? <UsageBreakdown usage={usage} locale={locale} /> : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
