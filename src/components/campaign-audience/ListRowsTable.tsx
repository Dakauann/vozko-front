"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CampaignContactList, MissingValueMark } from "@/components/campaigns/CampaignContactList";
import type { DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { PencilSimple, Trash } from "@/components/icons";
import { CONTACT_LIST_PAGE_SIZE, type ContactListView } from "@/lib/campaigns/contact-list-view";
import type { AudienceChannel, ListContext, ListRow, MetadataColumn, VariableCount } from "@/lib/campaign-audience/types";

import { useListRowsQuery } from "./use-audience-queries";
import { useSlotLabel } from "./use-audience-copy";

const NO_SEARCH = (): string[] => [];

function metadataText(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return String(value);
}

function valueCell(value: string | undefined, missing: boolean): ReactNode {
  if (!missing) return value || undefined;
  return (
    <span className="flex items-center justify-between gap-1.5">
      <span>{value || null}</span>
      <MissingValueMark />
    </span>
  );
}

export function ListRowsTable({
  channel,
  listId,
  context,
  contact,
  total,
  slots,
  variables,
  metadata,
  checksMetadata,
  view,
  onViewChange,
  onEdit,
  onRemove,
  actions,
  readOnly,
}: {
  channel: AudienceChannel;
  listId: string;
  context: ListContext;
  contact: "phone" | "email";
  total: number;
  slots: number;
  variables: readonly VariableCount[];
  metadata: readonly MetadataColumn[];
  checksMetadata: boolean;
  view: ContactListView;
  onViewChange: (view: ContactListView) => void;
  onEdit: (row: ListRow) => void;
  onRemove: (row: ListRow) => void;
  actions?: ReactNode;
  readOnly: boolean;
}) {
  const t = useTranslations("campaignAudience.step.list.row");
  const tList = useTranslations("campaignContactList");
  const slotLabel = useSlotLabel(variables);
  const query = { search: view.query.trim(), missingOnly: view.onlyMissing, page: view.page + 1, limit: CONTACT_LIST_PAGE_SIZE };
  const rows = useListRowsQuery(channel, listId, context, query);
  const missing = useListRowsQuery(channel, listId, context, { search: "", missingOnly: true, page: 1, limit: 1 });

  const columns = useMemo<DashboardTableColumn<ListRow>[]>(
    () => [
      ...Array.from({ length: slots }, (_, index) => ({
        key: `variable-${index + 1}`,
        header: slotLabel(String(index + 1)),
        render: (row: ListRow) => valueCell(row.variables[index], row.missing.includes(index + 1)),
      })),
      ...metadata.map((column) => ({
        key: `metadata-${column.key}`,
        header: column.label,
        render: (row: ListRow) => valueCell(metadataText(row.metadata[column.key]), row.metadataMissing.includes(column.key)),
      })),
    ],
    [slots, metadata, slotLabel],
  );

  return (
    <CampaignContactList<ListRow>
      rows={rows.data?.items ?? []}
      rowKey={(row) => row.id}
      number={(row) => row.contact}
      name={(row) => row.name || undefined}
      numberHeader={contact === "email" ? t("email") : undefined}
      searchLabel={contact === "email" ? tList("searchEmail") : undefined}
      valueColumns={columns}
      searchable={NO_SEARCH}
      missing={slots > 0 || checksMetadata ? { count: missing.data?.totalItems ?? 0, isMissing: (row) => row.missing.length > 0 || row.metadataMissing.length > 0 } : undefined}
      view={view}
      onViewChange={onViewChange}
      server={{ total, totalItems: rows.data?.totalItems ?? 0, totalPages: rows.data?.totalPages ?? 0 }}
      actions={actions}
      renderRowActions={
        readOnly
          ? undefined
          : (row) => (
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label={t("edit")}
                  title={t("edit")}
                  onClick={() => onEdit(row)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <PencilSimple className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label={t("remove")}
                  title={t("remove")}
                  onClick={() => onRemove(row)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive-ink transition-colors hover:bg-muted"
                >
                  <Trash className="h-4 w-4" weight="bold" />
                </button>
              </span>
            )
      }
    />
  );
}
