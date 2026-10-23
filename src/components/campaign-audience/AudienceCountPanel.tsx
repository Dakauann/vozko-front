"use client";

import { useLocale, useTranslations } from "next-intl";

import { InstrumentStrip } from "@/components/console/page-shapes";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { CaretRight, Warning } from "@/components/icons";
import { SkipRowList } from "@/components/leads/sends/SendReviewPanel";
import { useMissingSlotText } from "@/components/leads/sends/send-copy";
import { Notice } from "@/components/ui/notice";
import type { AudienceCreateState } from "@/lib/campaign-audience/draft";
import type { AudienceChannel, AudienceCount, AudienceSource, BindableField, VariableCount } from "@/lib/campaign-audience/types";

import { OUT_REASON_ICONS, outRowsOf, useOutRowLabel, useSlotLabel } from "./use-audience-copy";
import type { AudienceLeadFocus } from "./AudienceLeadsSheet";
import type { CampaignAudience } from "./use-campaign-audience";

const OPENER = "text-left underline decoration-dotted decoration-1 underline-offset-4 transition-colors hover:text-foreground hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const FIGURE_OPENER = `inline-flex items-center gap-1 rounded-sm ${OPENER}`;

const SIDE_STRIP = "sm:grid-cols-3 xl:grid-cols-1";

const NO_VARIABLES: readonly VariableCount[] = [];

function contactLabelKey(channel: AudienceChannel): "withEmail" | "withPhone" | "withWhatsApp" {
  if (channel === "email") return "withEmail";
  return channel === "carrier" ? "withPhone" : "withWhatsApp";
}

function PendingRows({ count, fields, onOpen }: { count: AudienceCount; fields: readonly BindableField[]; onOpen?: (focus: AudienceLeadFocus) => void }) {
  const slotText = useMissingSlotText();
  const pending = count.variables.filter((variable) => variable.choiceRequired && /^\d+$/.test(variable.key));
  return (
    <>
      {pending.map((variable) => {
        const text = slotText({ slot: Number(variable.key), name: variable.name, ...(variable.source ? { source: variable.source } : {}) }, fields.find((field) => field.source === variable.source)?.label);
        return (
          <div key={variable.key} className="contents">
            <span className="text-muted-foreground">
              <Warning className="size-3.5" aria-hidden />
            </span>
            <span className="text-muted-foreground">
              {onOpen ? (
                <button type="button" className={OPENER} onClick={() => onOpen({ variable: variable.key })}>
                  {text}
                </button>
              ) : (
                text
              )}
            </span>
            <EmptyValue className="readout text-right" />
          </div>
        );
      })}
    </>
  );
}

export function AudienceCountFigures({
  channel,
  source,
  count,
  lines,
  loading,
  createState,
  fields,
  side = false,
  onOpen,
}: {
  channel: AudienceChannel;
  source: AudienceSource;
  count: AudienceCount | null;
  lines: number | null;
  loading: boolean;
  createState: AudienceCreateState;
  fields: readonly BindableField[];
  side?: boolean;
  onOpen?: (focus: AudienceLeadFocus) => void;
}) {
  const t = useTranslations("campaignAudience.step.count");
  const tSends = useTranslations("leadSends.review");
  const locale = useLocale();
  const label = useOutRowLabel(channel);
  const rows = count ? outRowsOf(channel, count) : [];
  const overlapping = rows.filter((row) => row.nested).length > 1;
  const slotLabel = useSlotLabel(count?.variables ?? NO_VARIABLES);
  const pendingSlot = !createState.ready && createState.reason === "variable_choice_required" ? createState.slot : undefined;
  const contactKey = contactLabelKey(channel);
  const show = (value: number | null | undefined) => (value === null || value === undefined ? <EmptyValue /> : value.toLocaleString(locale));
  const opener = (value: number | null | undefined, name: string, focus: AudienceLeadFocus) =>
    onOpen && count && value !== null && value !== undefined ? (
      <button type="button" aria-label={`${name}: ${value.toLocaleString(locale)}`} title={t("openList")} className={FIGURE_OPENER} onClick={() => onOpen(focus)}>
        {value.toLocaleString(locale)}
        <CaretRight className="size-3.5 text-muted-foreground" aria-hidden />
      </button>
    ) : (
      show(value)
    );

  return (
    <div className="space-y-3.5">
      <InstrumentStrip
        compact
        columns={3}
        className={side ? SIDE_STRIP : undefined}
        loading={loading && !count}
        instruments={[
          { label: t(`matched.${source}`), value: source === "list" && lines !== null ? show(lines) : opener(count?.matched, t(`matched.${source}`), {}), detail: t(`matchedDetail.${source}`) },
          { label: t(contactKey), value: show(count?.withContact), detail: t(`${contactKey}Detail.${source}`) },
          {
            label: t("ready"),
            value: opener(count?.sendable, t("ready"), { status: "ready" }),
            detail: pendingSlot ? t("readyPending", { slot: slotLabel(pendingSlot) }) : t("readyDetail"),
            tone: count?.sendable ? "healthy" : "default",
          },
        ]}
      />
      {count ? (
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="legend">{t("out")}</span>
            <span className="legend readout">{count.outTotal.toLocaleString(locale)}</span>
          </div>
          {rows.length > 0 || count.variables.some((variable) => variable.choiceRequired) ? (
            <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm">
              <SkipRowList
                rows={rows}
                label={label}
                icons={OUT_REASON_ICONS}
                onOpen={onOpen ? (row) => onOpen(row.slot ? { variable: String(row.slot.slot) } : { status: "out", reason: row.reason }) : undefined}
              />
              <PendingRows count={count} fields={fields} onOpen={onOpen} />
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">{t("noneOut")}</p>
          )}
          {overlapping || count.variables.filter((variable) => variable.missing > 0).length > 1 ? (
            <p className="text-xs text-muted-foreground">{tSends("missingOverlap")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function statusKey(audience: CampaignAudience): string {
  if (!audience.fieldsReady) return `waiting.${audience.channel}`;
  if (!audience.spec) return "noAudience";
  if (audience.counting) return "counting";
  return audience.count ? "countedByServer" : "failedShort";
}

export function AudienceCountPanel({
  audience,
  fields,
  errorText,
  onOpen,
}: {
  audience: CampaignAudience;
  fields: readonly BindableField[];
  errorText: string | null;
  onOpen?: (focus: AudienceLeadFocus) => void;
}) {
  const t = useTranslations("campaignAudience.step.count");
  return (
    <PanelSection boxed title={t("title")} legend={t(statusKey(audience))}>
      <div aria-live="polite" aria-busy={audience.counting} className="space-y-3">
        {errorText && !audience.counting ? (
          <Notice tone="fault" title={t("failed")}>
            <p>{errorText}</p>
            <Button type="button" variant="secondary" size="sm" title={t("retry")} onClick={audience.recount} />
          </Notice>
        ) : (
          <AudienceCountFigures
            channel={audience.channel}
            source={audience.draft.source}
            count={audience.count}
            lines={audience.preview?.lines ?? null}
            loading={audience.counting}
            createState={audience.createState}
            fields={fields}
            side
            onOpen={onOpen}
          />
        )}
      </div>
    </PanelSection>
  );
}
