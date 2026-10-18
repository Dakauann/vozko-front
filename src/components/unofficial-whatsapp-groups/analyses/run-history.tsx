"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listGroupAnalysisRunsAction, listGroupRunMessagesAction } from "@/app/actions/unofficial-whatsapp-groups";
import { Chip, SentimentChip } from "@/components/audience/shared";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { CalendarBlank, CaretDown, ChatCircle, CircleNotch, ClockCounterClockwise } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { ALERT_COLOR, AlertChip, RUN_SENTIMENT_COLOR, RunSentimentChip } from "@/components/unofficial-whatsapp-groups/marks";
import type { AnalysisResult, AnalysisRun, GroupAnalysis, GroupRef, PageMeta, TrackedField, TranscriptLine } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { useTableEmpty } from "../kit/empty";
import { TriggerSummary } from "../kit/figures";
import { displayPhone, jidLocal, personName } from "../kit/format";
import { HAIRLINE_CELL, HAIRLINE_GRID } from "../kit/hairline";
import { GroupLinks, PersonIdentity } from "../kit/identity";
import { GroupsChapter } from "../kit/panel";
import { groupsRoutes } from "../kit/routes";
import { useGroupsFormat, type GroupsFormat } from "../kit/use-groups-format";
import { Fact, RowAction } from "./analysis-parts";
import { mergeParticipantGroups } from "./analysis-series";

const PAGE_SIZE = 20;
const MESSAGES_PAGE = 100;
const INVOLVED_SHOWN = 6;

interface LoadedRuns {
  key: string;
  runs: AnalysisRun[];
  meta: PageMeta;
  participantGroups: Record<string, GroupRef[]>;
  error: string | null;
}

export interface RunHistoryProps {
  analysis: GroupAnalysis;
  participantGroups: Record<string, GroupRef[]>;
  timezone: string;
  version: number;
  focusRunId?: string;
  onFirstPage?: (runs: AnalysisRun[]) => void;
}

export function RunHistoryChapter({ analysis, participantGroups, timezone, version, focusRunId, onFirstPage }: RunHistoryProps) {
  const t = useTranslations("unofficialGroups.analyses.history");
  const tr = useTranslations("unofficialGroups.analyses.runs");
  const tp = useTranslations("unofficialGroups.analyses.period");
  const fmt = useGroupsFormat(timezone);
  const tableEmpty = useTableEmpty();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loaded, setLoaded] = useState<LoadedRuns | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const chosen = useRef(false);
  const seeking = useRef(focusRunId);
  const loadedRef = useRef<LoadedRuns | null>(null);
  const firstPageRef = useRef(onFirstPage);
  const requestKey = `${analysis.id}:${page}:${version}:${retry}`;
  const loading = loaded?.key !== requestKey;

  useEffect(() => {
    firstPageRef.current = onFirstPage;
  }, [onFirstPage]);

  useEffect(() => {
    let cancelled = false;
    void listGroupAnalysisRunsAction(analysis.id, { page, pageSize: PAGE_SIZE }).then((result) => {
      if (cancelled) return;
      const previous = loadedRef.current;
      let next: LoadedRuns;
      if (result.error && previous && !previous.error && previous.key.startsWith(`${analysis.id}:${page}:`)) {
        toast.error(t("reloadFailed"), { description: result.error });
        next = { ...previous, key: requestKey };
      } else {
        next = { key: requestKey, runs: result.items, meta: result.meta, participantGroups: result.participantGroups, error: result.error ?? null };
      }
      loadedRef.current = next;
      setLoaded(next);
      if (result.error) return;
      if (page === 1) firstPageRef.current?.(result.items);
      if (chosen.current || result.items.length === 0) return;
      const target = seeking.current;
      const found = target ? result.items.find((run) => run.id === target) : undefined;
      if (target && !found && page < result.meta.totalPages) {
        setPage(page + 1);
        return;
      }
      seeking.current = undefined;
      if (target && !found && page !== 1) {
        setPage(1);
        return;
      }
      chosen.current = true;
      setExpanded((found ?? result.items[0]).id);
    });
    return () => {
      cancelled = true;
    };
  }, [analysis.id, page, requestKey, t]);

  const runs = useMemo(() => loaded?.runs ?? [], [loaded]);
  const meta = loaded?.meta;

  useEffect(() => {
    if (!expanded || !focusRunId || expanded !== focusRunId) return;
    const node = document.getElementById(`run-${expanded}`);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [expanded, focusRunId]);

  const groups = useMemo(() => mergeParticipantGroups(participantGroups, loaded?.participantGroups ?? {}), [participantGroups, loaded]);
  const toggle = useCallback((run: AnalysisRun) => {
    chosen.current = true;
    setExpanded((current) => (current === run.id ? null : run.id));
  }, []);

  const columns = useMemo<DashboardTableColumn<AnalysisRun>[]>(
    () => [
      {
        key: "cycle",
        header: t("columns.cycle"),
        render: (run) =>
          run.kind === "daily" ? (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-foreground">
              <CalendarBlank className="h-3.5 w-3.5 text-muted-foreground" weight="bold" />
              {tr("kinds.daily")}
            </span>
          ) : (
            <span className="readout text-xs font-semibold tabular-nums text-foreground">{tp("cycleShort", { cycle: run.cycle })}</span>
          ),
      },
      {
        key: "when",
        header: t("columns.when"),
        render: (run) => (
          <span className="flex flex-col leading-tight">
            <span className="readout whitespace-nowrap text-xs tabular-nums text-foreground">{fmt.dateTime(run.startedAt)}</span>
            <span className="readout text-[11px] tabular-nums text-muted-foreground">{fmt.duration(run.startedAt, run.completedAt)}</span>
          </span>
        ),
      },
      {
        key: "status",
        header: t("columns.status"),
        render: (run) => <StatusChip tone={run.status === "completed" ? "healthy" : "fault"} label={tr(`statuses.${run.status}`)} />,
      },
      { key: "sentiment", header: t("columns.sentiment"), render: (run) => (run.result ? <RunSentimentChip sentiment={run.result.sentiment} /> : <EmptyValue className="text-xs" />) },
      { key: "alert", header: t("columns.alert"), render: (run) => (run.result ? <AlertChip level={run.result.alertLevel} /> : <EmptyValue className="text-xs" />) },
      {
        key: "involved",
        header: t("columns.involved"),
        render: (run) => <Involved run={run} groups={groups} fmt={fmt} />,
      },
      {
        key: "messages",
        header: t("columns.messages"),
        className: "text-right",
        render: (run) => <span className="readout text-xs tabular-nums text-foreground">{fmt.num(run.messagesAnalyzed)}</span>,
      },
      {
        key: "tokens",
        header: t("columns.tokens"),
        className: "text-right",
        render: (run) => (
          <TooltipWrapper
            content={
              run.model
                ? t("tokensTip", { prompt: fmt.num(run.promptTokens), completion: fmt.num(run.completionTokens), model: run.model })
                : tr("tokensSplit", { prompt: fmt.num(run.promptTokens), completion: fmt.num(run.completionTokens) })
            }
          >
            <span className="readout text-xs tabular-nums text-foreground">{fmt.num(run.promptTokens + run.completionTokens)}</span>
          </TooltipWrapper>
        ),
      },
      {
        key: "failure",
        header: t("columns.failure"),
        render: (run) =>
          run.failureReason ? (
            <span className="block max-w-[14rem] truncate text-xs text-foreground" title={run.failureReason}>
              {run.failureReason}
            </span>
          ) : (
            <EmptyValue className="text-xs" />
          ),
      },
    ],
    [fmt, groups, t, tp, tr],
  );

  const title = meta && !loaded?.error ? t("titleCount", { count: meta.totalItems }) : t("title");

  return (
    <GroupsChapter id="analysis-history" icon={<ClockCounterClockwise />} title={title} subtitle={tr("description")}>
      <DashboardTable<AnalysisRun>
        data={runs}
        columns={columns}
        rowKey={(run) => run.id}
        loading={loading && (!loaded || Boolean(loaded.error) || !loaded.key.startsWith(`${analysis.id}:${page}:`))}
        onRowClick={toggle}
        isRowExpanded={(run) => run.id === expanded}
        renderExpandedRow={(run) => <RunDetail run={run} trackedFields={analysis.trackedFields} groups={groups} fmt={fmt} />}
        renderRowActions={(run) => (
          <RowAction
            label={run.id === expanded ? tr("hide") : tr("show")}
            icon={<CaretDown className={cn("h-3.5 w-3.5 transition-transform", run.id === expanded && "rotate-180")} weight="bold" />}
            iconSide="right"
            expanded={run.id === expanded}
            onClick={() => toggle(run)}
          />
        )}
        pagination={
          meta && meta.totalPages > 1
            ? {
                currentPage: page,
                totalPages: meta.totalPages,
                pageSize: PAGE_SIZE,
                totalItems: meta.totalItems,
                onPageChange: (next) => {
                  chosen.current = true;
                  setPage(next);
                },
              }
            : undefined
        }
        emptyState={
          loaded?.error
            ? tableEmpty.error(tr("errorTitle"), () => setRetry((value) => value + 1))
            : {
                icon: <ClockCounterClockwise className="h-7 w-7 text-muted-foreground" />,
                title: t("emptyTitle"),
                description: undefined,
                action: (
                  <span className="text-xs text-muted-foreground">
                    <TriggerSummary analysis={analysis} timezone={timezone} withBatch />
                  </span>
                ),
              }
        }
      />
    </GroupsChapter>
  );
}

function Involved({ run, groups, fmt }: { run: AnalysisRun; groups: Record<string, GroupRef[]>; fmt: GroupsFormat }) {
  const t = useTranslations("unofficialGroups.analyses.history");
  const tk = useTranslations("unofficialGroups.kit");
  const people = run.result?.participantSentiments ?? [];
  if (people.length === 0) return <EmptyValue className="text-xs" />;
  const shown = people.slice(0, INVOLVED_SHOWN);
  const hidden = people.length - shown.length;
  return (
    <ul className="flex max-w-[22rem] flex-wrap items-center gap-x-2.5 gap-y-1">
      {shown.map((person, index) => {
        const name = personName({ name: person.name, jid: person.jid }).label || tk("unnamedPerson");
        return (
          <li key={`${person.jid || person.name}-${index}`} className="inline-flex min-w-0 items-center gap-1 text-[11px]">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: RUN_SENTIMENT_COLOR[person.sentiment] }} />
            <span className="max-w-[8rem] truncate font-medium text-foreground" title={name}>
              {name}
            </span>
            <span className="readout shrink-0 tabular-nums text-muted-foreground">{t("involvedMsgs", { count: person.messages, value: fmt.num(person.messages) })}</span>
            {person.jid && (groups[person.jid]?.length ?? 0) >= 2 ? <GroupLinks groups={groups[person.jid]} variant="badge" /> : null}
          </li>
        );
      })}
      {hidden > 0 ? <li className="readout text-[11px] text-muted-foreground">{t("more", { count: hidden })}</li> : null}
    </ul>
  );
}

function Block({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="space-y-2">
      <h4 className="text-2xs font-semibold text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function RunDetail({
  run,
  trackedFields,
  groups,
  fmt,
}: {
  run: AnalysisRun;
  trackedFields: TrackedField[];
  groups: Record<string, GroupRef[]>;
  fmt: GroupsFormat;
}) {
  const t = useTranslations("unofficialGroups.analyses.history.detail");
  const tr = useTranslations("unofficialGroups.analyses.result");
  const trn = useTranslations("unofficialGroups.analyses.runs");
  const period =
    run.periodFrom && run.periodTo ? trn("periodRange", { from: fmt.dateTime(run.periodFrom), to: fmt.dateTime(run.periodTo) }) : null;
  return (
    <div id={`run-${run.id}`} className="scroll-mt-24 space-y-4 border-t border-border bg-card px-4 py-4 sm:px-5">
      <dl className="grid gap-px overflow-hidden rounded-[--radius] border border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
        <Fact label={t("started")}>
          <span className="readout tabular-nums">{fmt.dateTime(run.startedAt)}</span>
        </Fact>
        <Fact label={t("ended")}>
          <span className="readout tabular-nums">{fmt.dateTime(run.completedAt)}</span>
        </Fact>
        <Fact label={t("duration")}>
          <span className="readout tabular-nums">{fmt.duration(run.startedAt, run.completedAt)}</span>
        </Fact>
        <Fact label={t("model")}>{run.model ? <span className="font-mono">{run.model}</span> : <EmptyValue />}</Fact>
        <Fact label={t("period")} className="sm:col-span-2">{period ? <span className="readout tabular-nums">{period}</span> : <EmptyValue />}</Fact>
      </dl>
      {run.result ? (
        <RunResult result={run.result} trackedFields={trackedFields} groups={groups} fmt={fmt} />
      ) : run.status === "failed" ? (
        <Notice tone="fault" title={tr("failedTitle")}>
          {run.failureReason ?? tr("failedNoReason")}
        </Notice>
      ) : (
        <p className="text-xs text-muted-foreground">{tr("noResult")}</p>
      )}
      <TranscriptList analysisId={run.analysisId} runId={run.id} hasPeriod={Boolean(run.periodFrom && run.periodTo)} fmt={fmt} />
    </div>
  );
}

function RunResult({
  result,
  trackedFields,
  groups,
  fmt,
}: {
  result: AnalysisResult;
  trackedFields: TrackedField[];
  groups: Record<string, GroupRef[]>;
  fmt: GroupsFormat;
}) {
  const t = useTranslations("unofficialGroups.analyses.history.detail");
  const tr = useTranslations("unofficialGroups.analyses.result");
  const ts = useTranslations("unofficialGroups.common.sentiment");
  const ta = useTranslations("unofficialGroups.common.alert");
  const customKeys = useMemo(() => {
    const values = result.customFields ?? {};
    const known = trackedFields.map((field) => field.key);
    return [...known.filter((key) => key in values), ...Object.keys(values).filter((key) => !known.includes(key))];
  }, [result.customFields, trackedFields]);
  const typeOf = (key: string) => trackedFields.find((field) => field.key === key)?.type;

  return (
    <div className="space-y-4">
      <Block title={t("summary")}>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{result.summary || <EmptyValue />}</p>
      </Block>
      <div className="flex flex-wrap items-center gap-2">
        <Chip dot={RUN_SENTIMENT_COLOR[result.sentiment]}>{t("sentimentChip", { value: ts(result.sentiment) })}</Chip>
        <Chip dot={ALERT_COLOR[result.alertLevel]}>{t("alertChip", { value: ta(result.alertLevel) })}</Chip>
      </div>

      {result.participantSentiments.length > 0 ? (
        <Block title={t("participants")}>
          <ul className={cn(HAIRLINE_GRID, "md:grid-cols-2")}>
            {result.participantSentiments.map((participant, index) => (
              <li key={`${participant.jid || participant.name}-${index}`} className={cn(HAIRLINE_CELL, "space-y-1.5 px-3 py-2.5")}>
                <div className="flex items-center justify-between gap-2">
                  <PersonIdentity
                    person={{ name: participant.name, jid: participant.jid }}
                    compact
                    href={participant.jid ? groupsRoutes.people({ search: jidLocal(participant.jid) }) : undefined}
                    trailing={participant.jid ? <GroupLinks groups={groups[participant.jid] ?? []} variant="badge" /> : null}
                  />
                  <span className="flex shrink-0 items-center gap-2">
                    <RunSentimentChip sentiment={participant.sentiment} />
                    <span className="readout text-2xs tabular-nums text-muted-foreground">{tr("participantMessages", { count: participant.messages })}</span>
                  </span>
                </div>
                {participant.summary ? <p className="text-xs text-muted-foreground">{participant.summary}</p> : null}
                {participant.keyQuote ? (
                  <blockquote className="border-l-2 border-border-strong pl-2 text-xs italic text-foreground">{tr("quote", { quote: participant.keyQuote })}</blockquote>
                ) : null}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {result.keyThemes.length > 0 ? (
        <Block title={t("themes")}>
          <div className="flex flex-wrap gap-1.5">
            {result.keyThemes.map((theme, index) => (
              <Chip key={`${theme}-${index}`}>{theme}</Chip>
            ))}
          </div>
        </Block>
      ) : null}

      {result.insights.length > 0 ? (
        <Block title={t("insights")}>
          <ul className="list-disc space-y-1 pl-5 text-xs text-foreground">
            {result.insights.map((insight, index) => (
              <li key={index}>{insight}</li>
            ))}
          </ul>
        </Block>
      ) : null}

      {result.relevantMentions.length > 0 ? (
        <Block title={t("mentions")}>
          <div className="overflow-hidden rounded-[--radius] border border-border">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_7rem_6rem_minmax(0,2fr)] gap-3 border-b border-border bg-muted px-3 py-1.5 text-2xs font-semibold text-muted-foreground sm:grid">
              <span>{t("mentionEntity")}</span>
              <span>{t("mentionSentiment")}</span>
              <span className="text-right">{t("mentionFrequency")}</span>
              <span>{t("mentionContext")}</span>
            </div>
            <ul className="divide-y divide-border">
              {result.relevantMentions.map((mention, index) => (
                <li
                  key={`${mention.entity}-${index}`}
                  className="grid grid-cols-1 items-start gap-1.5 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1.2fr)_7rem_6rem_minmax(0,2fr)] sm:gap-3"
                >
                  <span className="min-w-0 space-y-1">
                    <span className="block break-words font-medium text-foreground sm:truncate" title={mention.entity}>
                      {mention.entity}
                    </span>
                    <span className="flex items-center gap-2 sm:hidden">
                      <SentimentChip sentiment={mention.sentiment} />
                      <span className="readout tabular-nums text-muted-foreground">{tr("mentionTimes", { count: mention.frequency })}</span>
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <SentimentChip sentiment={mention.sentiment} />
                  </span>
                  <span className="readout hidden text-right tabular-nums text-foreground sm:block">{tr("mentionTimes", { count: mention.frequency })}</span>
                  <span className="text-muted-foreground">{mention.context || <EmptyValue />}</span>
                </li>
              ))}
            </ul>
          </div>
        </Block>
      ) : null}

      {result.suggestedActions.length > 0 ? (
        <Block title={t("strategies")}>
          <ul className={cn(HAIRLINE_GRID, "md:grid-cols-2")}>
            {result.suggestedActions.map((action, index) => (
              <li key={index} className={cn(HAIRLINE_CELL, "space-y-1 px-3 py-2")}>
                <p className="text-2xs font-semibold text-muted-foreground">{t("situation")}</p>
                <p className="text-xs text-foreground">{action.situation}</p>
                <p className="pt-1 text-2xs font-semibold text-muted-foreground">{t("strategy")}</p>
                <p className="text-xs text-foreground">{action.strategy}</p>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {customKeys.length > 0 ? (
        <Block title={t("customFields")}>
          <dl className={cn(HAIRLINE_GRID, "sm:grid-cols-2 lg:grid-cols-4")}>
            {customKeys.map((key) => (
              <div key={key} className={cn(HAIRLINE_CELL, "px-3 py-2")}>
                <dt className="truncate font-mono text-2xs text-muted-foreground">{key}</dt>
                <dd className="mt-0.5 break-words text-xs text-foreground">
                  <CustomValue value={result.customFields[key]} percent={typeOf(key) === "percentage"} fmt={fmt} />
                </dd>
              </div>
            ))}
          </dl>
        </Block>
      ) : null}
    </div>
  );
}

function CustomValue({ value, percent, fmt }: { value: AnalysisResult["customFields"][string] | undefined; percent: boolean; fmt: GroupsFormat }) {
  const t = useTranslations("unofficialGroups.analyses.result");
  if (value === null || value === undefined || value === "") return <EmptyValue />;
  if (typeof value === "boolean") return <span>{value ? t("yes") : t("no")}</span>;
  if (typeof value === "number") return <span className="readout tabular-nums">{percent ? fmt.pct(value) : fmt.num(Math.round(value * 100) / 100)}</span>;
  return <span>{value}</span>;
}

function TranscriptList({ analysisId, runId, hasPeriod, fmt }: { analysisId: string; runId: string; hasPeriod: boolean; fmt: GroupsFormat }) {
  const t = useTranslations("unofficialGroups.analyses.history.transcript");
  const tm = useTranslations("unofficialGroups.analyses.messages");
  const tk = useTranslations("unofficialGroups.kit.identity");
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      setLoading(true);
      const result = await listGroupRunMessagesAction(analysisId, runId, offset);
      setLoading(false);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setLines((current) => (offset === 0 ? result.lines : [...current, ...result.lines]));
      setExhausted(result.lines.length < MESSAGES_PAGE);
    },
    [analysisId, runId],
  );

  if (!hasPeriod) return null;

  return (
    <Block title={t("title")} id="messages">
      {!open ? (
        <Button
          variant="outline"
          size="sm"
          title={t("show")}
          icon={<ChatCircle className="h-4 w-4" weight="bold" />}
          iconVisible
          iconSide="left"
          onClick={() => {
            setOpen(true);
            void load(0);
          }}
        />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="readout text-2xs text-muted-foreground">{tm("title", { count: lines.length })}</p>
            <Button variant="ghost" size="sm" title={tm("hide")} onClick={() => setOpen(false)} />
          </div>
          {error ? (
            <Notice tone="fault">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p>{error}</p>
                <Button variant="secondary" size="sm" title={t("retry")} onClick={() => void load(lines.length)} />
              </div>
            </Notice>
          ) : null}
          {!loading && !error && lines.length === 0 ? <p className="text-xs text-muted-foreground">{tm("empty")}</p> : null}
          {lines.length > 0 ? (
            <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-[--radius] border border-border">
              {lines.map((line) => {
                const phone = line.outbound ? null : displayPhone(undefined, line.author);
                const name = line.outbound ? tm("ours") : line.authorName?.trim() || phone || tm("unknownAuthor");
                return (
                  <li key={line.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2 px-3 py-1.5">
                    <time className="readout pt-px text-2xs tabular-nums text-muted-foreground" dateTime={line.at} title={fmt.dateTime(line.at)}>
                      {fmt.time(line.at)}
                    </time>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="truncate text-xs font-semibold text-foreground">{name}</span>
                        {phone && phone !== name ? (
                          <span className="readout font-mono text-[11px] text-muted-foreground">{phone}</span>
                        ) : !phone && !line.outbound ? (
                          <span className="text-[11px] text-muted-foreground">{tk("hiddenNumber")}</span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-foreground">{line.text || <EmptyValue />}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" />
              {tm("loading")}
            </p>
          ) : null}
          {!loading && !exhausted && !error && lines.length > 0 ? <Button variant="ghost" size="sm" title={t("more")} onClick={() => void load(lines.length)} /> : null}
        </div>
      )}
    </Block>
  );
}

