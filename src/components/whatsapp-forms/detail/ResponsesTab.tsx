"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { EmptyValue } from "@/components/elevated-design/empty-value";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ChatText, MagnifyingGlass, XCircle } from "@/components/icons";
import { PagedListFooter } from "@/components/leads/detail/PagedListFooter";
import { ExportMenu } from "@/components/reports/export-menu";
import Button from "@/components/elevated-design/button";
import { useReportJob } from "@/hooks/use-report-job";
import { useFormAccess, useFormResponses, useFormVersions, useOwnedPhones } from "@/hooks/use-whatsapp-forms";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import type { ReportFormat } from "@/lib/reports/types";
import { answerText, responseColumns } from "@/lib/whatsapp-forms/answers";
import { exportParams, responseQueryFrom, type ResponseFilterParam } from "@/lib/whatsapp-forms/filters";
import { SEND_ORIGINS, type FormDetail, type ResponseRow } from "@/lib/whatsapp-forms/types";

import { useAnswerWords, useFormError } from "../use-form-text";
import { ResponseColumnsMenu } from "./ResponseColumnsMenu";
import { ResponseSheet } from "./ResponseSheet";

const ANY = "__any__";
const PAGE_SIZES = [50] as const;
const EXPORT_FORMATS: readonly ReportFormat[] = ["csv", "xlsx"];

interface FilterState {
  param: (name: string) => string;
  setParams: (changes: Record<string, string | number | null | undefined>) => void;
}

function storageKey(formId: string): string {
  return `whatsapp-form-hidden-columns:${formId}`;
}

function readHidden(formId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(storageKey(formId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function writeHidden(formId: string, hidden: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(storageKey(formId), JSON.stringify([...hidden]));
  } catch {}
}

export function ResponsesTab({ detail, filters }: { detail: FormDetail; filters: FilterState }) {
  const t = useTranslations("whatsappForms");
  const format = useFormatter();
  const access = useFormAccess();
  const errorText = useFormError();
  const words = useAnswerWords();
  const phones = useOwnedPhones();
  const versions = useFormVersions(detail.form.id);
  const report = useReportJob();
  const formId = detail.form.id;
  const param = (name: ResponseFilterParam) => filters.param(name);
  const query = responseQueryFrom(param);
  const responses = useFormResponses(formId, query);
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(formId));
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState(param("q"));

  const version = detail.published ?? detail.draft;
  const fieldColumns = useMemo(() => responseColumns(version.document), [version.document]);
  const phoneLabel = useMemo(() => {
    const map = new Map((phones.data ?? []).map((phone) => [phone.id, formatPhoneForDisplay(phone.displayPhoneNumber)]));
    return (id: string) => map.get(id);
  }, [phones.data]);
  const rows = useMemo(() => responses.data?.pages.flatMap((page) => page.items) ?? [], [responses.data]);

  const toggleColumn = (key: string) => {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setHidden(next);
    writeHidden(formId, next);
  };

  const columns = useMemo<DashboardTableColumn<ResponseRow>[]>(() => {
    const fixed: DashboardTableColumn<ResponseRow>[] = [
      {
        key: "receivedAt",
        header: t("responses.columns.receivedAt"),
        render: (row) => <span className="whitespace-nowrap text-sm text-foreground">{format.dateTime(new Date(row.submittedAt), { dateStyle: "short", timeStyle: "short" })}</span>,
      },
      {
        key: "contact",
        header: t("responses.columns.contact"),
        render: (row) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground">{row.leadName || formatPhoneForDisplay(row.contactNumber)}</span>
            {row.leadName ? <span className="truncate text-xs text-muted-foreground">{formatPhoneForDisplay(row.contactNumber)}</span> : null}
          </span>
        ),
      },
      { key: "number", header: t("responses.columns.number"), render: (row) => <span className="whitespace-nowrap text-sm text-muted-foreground">{phoneLabel(row.businessPhoneId) ?? <EmptyValue />}</span> },
      { key: "origin", header: t("responses.columns.origin"), render: (row) => (row.origin ? <span className="text-sm text-foreground">{t(`origin.${row.origin}`)}</span> : <EmptyValue />) },
      { key: "match", header: t("responses.columns.match"), render: (row) => <span className="text-sm text-muted-foreground">{t(`match.${row.match}`)}</span> },
    ];
    const answers = fieldColumns
      .filter((column) => !hidden.has(column.key))
      .map<DashboardTableColumn<ResponseRow>>((column) => ({
        key: `field:${column.key}`,
        header: column.label,
        render: (row) => {
          const text = answerText(row.answers.values[column.key], column.field, words);
          return text ? <span className="line-clamp-2 max-w-[16rem] text-sm text-foreground">{text}</span> : <EmptyValue />;
        },
      }));
    return [...fixed, ...answers];
  }, [t, format, fieldColumns, hidden, phoneLabel, words]);

  const exportResponses = async (picked: ReportFormat) => {
    const outcome = await report.request({ kind: "whatsapp_form_responses", format: picked, params: exportParams(formId, query) });
    if (outcome.status === "failed") toast.error(t("responses.exportFailed"));
    if (outcome.status === "error" && outcome.error !== "cancelled") toast.error(t("responses.exportFailed"));
  };

  const select = (name: ResponseFilterParam, value: string) => filters.setParams({ [name]: value === ANY ? null : value });
  const failure = responses.isError && !responses.data ? responses.error : null;
  const filtered = Object.keys(query).length > 0;

  return (
    <div className="space-y-3">
      <DashboardTable<ResponseRow>
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        loading={responses.isFetching && !responses.data}
        onRowClick={(row) => setOpenId(row.id)}
        toolbar={
          <div className="flex w-full flex-wrap items-end gap-2">
            <div className="w-full sm:w-64">
              <ElevatedInput
                label={t("responses.search")}
                value={search}
                controlSize="sm"
                icon={<MagnifyingGlass className="h-4 w-4" />}
                onChange={(event) => setSearch(event.target.value)}
                onBlur={() => filters.setParams({ q: search.trim() || null })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") filters.setParams({ q: search.trim() || null });
                }}
              />
            </div>
            <div className="w-36">
              <ElevatedInput label={t("responses.filters.from")} type="date" controlSize="sm" value={param("from")} onChange={(event) => filters.setParams({ from: event.target.value || null })} />
            </div>
            <div className="w-36">
              <ElevatedInput label={t("responses.filters.to")} type="date" controlSize="sm" value={param("to")} onChange={(event) => filters.setParams({ to: event.target.value || null })} />
            </div>
            <div className="w-44">
              <ElevatedSelect label={t("responses.filters.origin")} value={param("origin") || ANY} onValueChange={(value) => select("origin", value)}>
                <ElevatedSelectItem value={ANY}>{t("responses.filters.any")}</ElevatedSelectItem>
                {SEND_ORIGINS.map((origin) => (
                  <ElevatedSelectItem key={origin} value={origin}>
                    {t(`origin.${origin}`)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
            <div className="w-44">
              <ElevatedSelect label={t("responses.filters.phone")} value={param("phoneId") || ANY} onValueChange={(value) => select("phoneId", value)}>
                <ElevatedSelectItem value={ANY}>{t("responses.filters.any")}</ElevatedSelectItem>
                {(phones.data ?? []).map((phone) => (
                  <ElevatedSelectItem key={phone.id} value={phone.id}>
                    {formatPhoneForDisplay(phone.displayPhoneNumber)}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
            <div className="w-36">
              <ElevatedSelect label={t("responses.filters.version")} value={param("versionId") || ANY} onValueChange={(value) => select("versionId", value)}>
                <ElevatedSelectItem value={ANY}>{t("responses.filters.any")}</ElevatedSelectItem>
                {(versions.data ?? []).map((item) => (
                  <ElevatedSelectItem key={item.id} value={item.id}>
                    {t("versions.number", { number: item.number })}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
            </div>
            <div className="w-40">
              <ElevatedSelect label={t("responses.filters.match")} value={param("match") || ANY} onValueChange={(value) => select("match", value)}>
                <ElevatedSelectItem value={ANY}>{t("responses.filters.any")}</ElevatedSelectItem>
                <ElevatedSelectItem value="matched">{t("responses.filters.matched")}</ElevatedSelectItem>
                <ElevatedSelectItem value="unmatched">{t("responses.filters.unmatched")}</ElevatedSelectItem>
              </ElevatedSelect>
            </div>
            {filtered ? (
              <Button
                variant="ghost"
                size="sm"
                title={t("responses.filters.clear")}
                onClick={() => {
                  setSearch("");
                  filters.setParams({ from: null, to: null, origin: null, phoneId: null, versionId: null, match: null, q: null });
                }}
              />
            ) : null}
          </div>
        }
        headerRight={
          <div className="flex items-center gap-2">
            <ResponseColumnsMenu columns={fieldColumns} hidden={hidden} onToggle={toggleColumn} />
            {access.exportResponses ? <ExportMenu formats={EXPORT_FORMATS} busy={report.running} onSelect={(picked) => void exportResponses(picked)} /> : null}
          </div>
        }
        emptyState={
          failure
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("common.errorTitle"),
                description: errorText({ code: sectionErrorCode(failure) }),
                action: <Button variant="secondary" title={t("common.retry")} onClick={() => void responses.refetch()} />,
              }
            : {
                icon: <ChatText className="h-7 w-7 text-muted-foreground" />,
                title: filtered ? t("responses.emptyFiltered") : t("responses.empty.title"),
                description: filtered ? undefined : t("responses.empty.description"),
              }
        }
        footer={
          <PagedListFooter
            query={{
              hasNextPage: responses.hasNextPage,
              isFetching: responses.isFetching,
              isFetchingNextPage: responses.isFetchingNextPage,
              isFetchNextPageError: responses.isFetchNextPageError,
              isRefetchError: responses.isRefetchError,
              error: responses.error,
              fetchNextPage: responses.fetchNextPage,
              refetch: responses.refetch,
            }}
            pageSizes={PAGE_SIZES}
            loadMore={t("responses.loadMore")}
            loadingMore={t("responses.loadingMore")}
          />
        }
      />
      {openId ? <ResponseSheet responseId={openId} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
