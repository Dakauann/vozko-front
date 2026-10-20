"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";

import { CalendarBlank, CheckCircle } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { withHostContainer } from "@/contexts/host-document-context";
import { screenPaths } from "@/lib/navigation/routes";
import { wholeUnitAmount, type PeriodAmount, type PeriodLimitReport, type PeriodUnit } from "@/lib/period-limit/period-limit";
import { cn } from "@/lib/utils";

import { PeriodLimitScene } from "./period-limit-scene";

const DialogPortal = withHostContainer(DialogPrimitive.Portal);

type Choice = { key: string; title: string; text: string; primary: boolean; busy: boolean; onSelect: () => void };

export function PeriodLimitDialog({
  open,
  limit,
  unit = "days",
  share,
  report,
  onUseWindow,
  onClose,
}: {
  open: boolean;
  limit: number;
  unit?: PeriodUnit;
  share: number;
  report?: PeriodLimitReport;
  onUseWindow: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("periodLimit");
  const amount = wholeUnitAmount(limit, unit);
  const tagline = t("tagline", amount);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/30 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:duration-150" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[201] max-h-[calc(100dvh-2rem)] w-[min(23rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-xl border border-border-strong bg-popover text-popover-foreground shadow-xl focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:duration-150">
          <div className="border-b border-border bg-muted/50">
            <PeriodLimitScene
              share={share}
              chosenLabel={t("scene.chosen")}
              windowLabel={t("scene.window", amount)}
              label={tagline}
            />
          </div>
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-control-edge bg-card text-foreground">
                <CalendarBlank className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <DialogPrimitive.Title className="font-display text-base font-semibold leading-tight text-foreground">
                  {t("name")}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">{tagline}</DialogPrimitive.Description>
              </div>
            </div>
            {report?.state === "queued" ? (
              <QueuedReport onClose={onClose} />
            ) : (
              <PeriodChoices amount={amount} report={report} onUseWindow={onUseWindow} onClose={onClose} />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}

function PeriodChoices({
  amount,
  report,
  onUseWindow,
  onClose,
}: {
  amount: PeriodAmount;
  report?: PeriodLimitReport;
  onUseWindow: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("periodLimit");
  const reportChoice: Choice[] = report
    ? [
        {
          key: "report",
          title: report.state === "requesting" ? t("requesting") : t("report.title"),
          text: t("report.text"),
          primary: true,
          busy: report.state === "requesting",
          onSelect: report.onRequest,
        },
      ]
    : [];
  const choices: Choice[] = [
    ...reportChoice,
    {
      key: "window",
      title: t("window.title", amount),
      text: t("window.text"),
      primary: !report,
      busy: false,
      onSelect: onUseWindow,
    },
  ];

  return (
    <>
      <ol className="space-y-2">
        {choices.map((choice, index) => (
          <li key={choice.key}>
            <button
              type="button"
              onClick={choice.onSelect}
              disabled={choice.busy}
              aria-busy={choice.busy || undefined}
              className="grid w-full grid-cols-[1.5rem_minmax(0,1fr)] gap-2 rounded-lg border border-border bg-card p-2.5 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-progress"
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border font-mono text-2xs font-semibold tabular-nums",
                  choice.primary ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-foreground",
                )}
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground">{choice.title}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{choice.text}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" title={t("cancel")} onClick={onClose} />
      </div>
    </>
  );
}

function QueuedReport({ onClose }: { onClose: () => void }) {
  const t = useTranslations("periodLimit");
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 rounded-lg border border-border bg-card p-2.5">
        <CheckCircle aria-hidden className="h-5 w-5 text-healthy" weight="fill" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{t("queued.title")}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("queued.text")}</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" size="sm" title={t("queued.close")} onClick={onClose} />
        <Button variant="primary" size="sm" title={t("queued.open")} link={screenPaths.reports} newTab={false} />
      </div>
    </div>
  );
}
