"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { MagnifyingGlass, PencilSimple } from "@/components/icons";
import { LeadSheet } from "@/components/leads/sheet/LeadSheet";
import { Notice } from "@/components/ui/notice";
import { codedQueryError } from "@/lib/api/coded-query-error";
import { withExcludedLeads, withPickedLeads } from "@/lib/campaign-audience/draft";
import type { AudienceLead, AudienceLeadQuery, AudienceLeadStatus } from "@/lib/campaign-audience/types";

import { useAudienceErrorText, useOutReasonText, useSlotLabel } from "./use-audience-copy";
import { useAudienceLeadsQuery } from "./use-audience-queries";
import type { CampaignAudience } from "./use-campaign-audience";

const PAGE_SIZE = 50;
const PICK_LIMIT = 5000;

export type AudienceLeadFocus = Pick<AudienceLeadQuery, "status" | "reason" | "variable" | "metadataKey">;

export const LEAD_STATUS_TONE: Record<AudienceLeadStatus, StatusChipTone> = { ready: "healthy", out: "neutral", undecided: "warning" };

function useFocusTitle(audience: CampaignAudience) {
  const t = useTranslations("campaignAudience.step.leads.title");
  const reasonText = useOutReasonText(audience.channel);
  const slotLabel = useSlotLabel(audience.count?.variables ?? []);
  return (focus: AudienceLeadFocus): string => {
    if (focus.reason) return t("out", { reason: reasonText(focus.reason) });
    if (focus.variable) return t("variable", { slot: slotLabel(focus.variable) });
    if (focus.metadataKey) return t("metadata", { key: focus.metadataKey });
    return focus.status === "ready" ? t("ready") : t("all");
  };
}

function LeadsTable({ audience, focus, onClose }: { audience: CampaignAudience; focus: AudienceLeadFocus; onClose: () => void }) {
  const t = useTranslations("campaignAudience.step.leads");
  const tTable = useTranslations("dashboardTable");
  const errorText = useAudienceErrorText();
  const reasonText = useOutReasonText(audience.channel);
  const slotLabel = useSlotLabel(audience.count?.variables ?? []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const query = { ...focus, search: search.trim(), page, limit: PAGE_SIZE };
  const leads = useAudienceLeadsQuery(audience.channel, audience.spec, audience.fields, query);
  const leadsSource = audience.draft.source === "leads";
  const widePick = leadsSource && audience.draft.pick !== "ids";
  const overLimit = picked.size > PICK_LIMIT;

  const columns = useMemo<DashboardTableColumn<AudienceLead>[]>(
    () => [
      { key: "name", header: t("columns.name"), render: (lead) => lead.name || (lead.line > 0 ? t("line", { line: lead.line }) : <EmptyValue />) },
      { key: "contact", header: t("columns.contact"), className: "font-mono text-sm tabular-nums", render: (lead) => lead.contact || <EmptyValue /> },
      { key: "status", header: t("columns.status"), render: (lead) => <StatusChip tone={LEAD_STATUS_TONE[lead.status]} label={t(`status.${lead.status}`)} /> },
      { key: "reason", header: t("columns.reason"), render: (lead) => (lead.reason ? reasonText(lead.reason) : <EmptyValue />) },
      {
        key: "missing",
        header: t("columns.missing"),
        render: (lead) => (lead.missing.length + lead.metadataMissing.length > 0 ? [...lead.missing.map(slotLabel), ...lead.metadataMissing].join(", ") : <EmptyValue />),
      },
      {
        key: "values",
        header: t("columns.values"),
        render: (lead) => (lead.variables.some((value) => value !== "") ? lead.variables.filter((value) => value !== "").join(" · ") : <EmptyValue />),
      },
    ],
    [t, reasonText, slotLabel],
  );

  const apply = (change: "pick" | "exclude") => {
    const ids = [...picked];
    audience.update((draft) => (change === "pick" ? withPickedLeads(draft, ids) : withExcludedLeads(draft, ids)));
    onClose();
  };

  if (leads.isError) {
    return (
      <Notice tone="fault" title={t("failed")}>
        <p>{errorText(codedQueryError(leads.error) ?? {})}</p>
      </Notice>
    );
  }

  const data = leads.data;
  return (
    <>
      <DashboardTable<AudienceLead>
        data={data?.items ?? []}
        columns={columns}
        rowKey={(lead, index) => lead.leadId || `${lead.line}-${index}`}
        toolbar={
          <ElevatedInput
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            icon={<MagnifyingGlass className="h-4 w-4" weight="bold" />}
            controlSize="sm"
            className="min-w-0 flex-1"
          />
        }
        selection={
          leadsSource
            ? {
                selectedKeys: picked,
                onSelectionChange: setPicked,
                selectAllLabel: tTable("selectAll"),
                selectRowLabel: tTable("selectRow"),
                actions: () => (
                  <span className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" title={t("pickOnly")} disabled={overLimit} onClick={() => apply("pick")} />
                    {widePick ? <Button type="button" variant="secondary" size="sm" title={t("exclude")} onClick={() => apply("exclude")} /> : null}
                    {overLimit ? <span className="text-xs text-muted-foreground">{t("pickLimit")}</span> : null}
                  </span>
                ),
              }
            : undefined
        }
        renderRowActions={(lead) =>
          lead.leadId ? (
            <button
              type="button"
              aria-label={t("edit")}
              title={t("edit")}
              onClick={() => setEditing(lead.leadId)}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <PencilSimple className="h-4 w-4" />
              {t("edit")}
            </button>
          ) : null
        }
        scrollClassName="max-h-[min(36rem,65vh)] overflow-y-auto [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-muted"
        pagination={
          data && data.totalPages > 1
            ? { currentPage: data.page, totalPages: data.totalPages, pageSize: data.pageSize, totalItems: data.totalItems, onPageChange: setPage }
            : undefined
        }
        paginationText={{ items: t("unit") }}
        emptyState={{ title: leads.isPending ? "" : t("empty") }}
      />
      {editing ? (
        <LeadSheet
          open
          leadId={editing}
          onOpenChange={(open) => (open ? undefined : setEditing(null))}
          onSaved={() => {
            setEditing(null);
            audience.recount();
          }}
        />
      ) : null}
    </>
  );
}

export function AudienceLeadsSheet({ audience, focus, onClose }: { audience: CampaignAudience; focus: AudienceLeadFocus | null; onClose: () => void }) {
  const t = useTranslations("campaignAudience.step.leads");
  const titleOf = useFocusTitle(audience);
  const total = useAudienceLeadsQuery(audience.channel, focus ? audience.spec : null, audience.fields, { ...focus, search: "", page: 1, limit: PAGE_SIZE }).data?.totalItems;
  return (
    <ElevatedSheet open={focus !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <ElevatedSheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-3xl lg:max-w-5xl">
        <ElevatedSheetHeader className="space-y-1 border-b border-border pr-16">
          <ElevatedSheetTitle className="text-xl">{focus ? titleOf(focus) : ""}</ElevatedSheetTitle>
          <ElevatedSheetDescription>{total === undefined ? "" : t("description", { count: total })}</ElevatedSheetDescription>
        </ElevatedSheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">{focus ? <LeadsTable key={JSON.stringify(focus)} audience={audience} focus={focus} onClose={onClose} /> : null}</div>
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
