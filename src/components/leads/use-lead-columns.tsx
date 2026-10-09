"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { Brain, Family, Phone, Prohibit, UserPlus, WhatsappLogo } from "@/components/icons";
import type { DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { CustomFieldValue } from "@/components/crm/CustomFieldValue";
import { OwnerChip } from "@/components/leads/OwnerChip";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { instantOf } from "@/lib/leads/detail";
import { leadNameLines } from "@/lib/leads/display";
import type { LeadListItem } from "@/lib/leads/types";
import { formatPhoneForDisplay } from "@/lib/phone/display";
import { cn } from "@/lib/utils";

export const LEAD_OPTIONAL_COLUMNS = ["referrals", "campaigns", "memories", "window"] as const;

export type LeadOptionalColumn = (typeof LEAD_OPTIONAL_COLUMNS)[number];

export function isLeadOptionalColumn(value: string): value is LeadOptionalColumn {
  return (LEAD_OPTIONAL_COLUMNS as readonly string[]).includes(value);
}

const DAY_FORMAT = { day: "2-digit", month: "short", year: "numeric" } as const;
const MOMENT_FORMAT = { ...DAY_FORMAT, hour: "2-digit", minute: "2-digit" } as const;

export interface LeadColumnsOptions {
  optional: ReadonlySet<LeadOptionalColumn>;
  classification?: CustomFieldDefinition;
  ownerName: (ownerId: string | undefined, sentName?: string) => string | null;
}

export function rowsNeedMemberDirectory(rows: readonly Pick<LeadListItem, "owner" | "ownerName">[]): boolean {
  return rows.some((row) => !!row.owner?.trim() && !row.ownerName?.trim());
}

export function useLeadColumns({ optional, classification, ownerName }: LeadColumnsOptions): DashboardTableColumn<LeadListItem>[] {
  const t = useTranslations("leadsPage");
  const format = useFormatter();

  return useMemo(() => {
    const dateText = (value: string | null | undefined, withTime: boolean) => {
      const date = instantOf(value);
      return date ? format.dateTime(date, withTime ? MOMENT_FORMAT : DAY_FORMAT) : null;
    };
    const columns: DashboardTableColumn<LeadListItem>[] = [
      {
        key: "name",
        header: t("table.name"),
        sortKey: "name",
        render: (row) => {
          const lines = leadNameLines({ realName: row.realName, number: row.number });
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/dashboard/leads/${row.id}`}
                  className={cn(
                    "truncate text-sm text-foreground hover:underline",
                    lines.titleMono ? "font-mono" : "font-medium",
                  )}
                >
                  {lines.title || <EmptyValue />}
                </Link>
                {row.blocked ? (
                  <span
                    title={t("table.blocked")}
                    aria-label={t("table.blocked")}
                    className="inline-flex items-center rounded-[--radius] bg-destructive px-1.5 py-0.5 text-2xs font-semibold text-destructive-foreground"
                  >
                    <Prohibit weight="bold" className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
              <p className={cn("truncate text-xs text-muted-foreground", lines.detail.kind === "identity" && "font-mono")}>
                {lines.detail.kind === "identity"
                  ? lines.detail.text
                  : lines.detail.kind === "noName"
                    ? t("table.noName")
                    : t("table.noWhatsApp")}
              </p>
            </div>
          );
        },
      },
      {
        key: "phones",
        header: t("table.phones"),
        render: (row) => {
          const count = row.phones?.length ?? 0;
          if (count === 0) return <EmptyValue className="text-sm" />;
          const label = t("table.contactPhones", { count });
          return (
            <span
              title={row.phones.map((phone) => formatPhoneForDisplay(phone.number)).join(", ")}
              aria-label={label}
              className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-muted-foreground"
            >
              <Phone className="h-3 w-3" aria-hidden />+{count}
            </span>
          );
        },
      },
      {
        key: "district",
        header: t("table.district"),
        render: (row) =>
          row.primaryAddress?.district ? (
            <span className="text-sm text-foreground">{row.primaryAddress.district}</span>
          ) : (
            <EmptyValue className="text-sm" />
          ),
      },
      {
        key: "city",
        header: t("table.city"),
        render: (row) =>
          row.primaryAddress?.city ? (
            <span className="text-sm text-foreground" title={row.primaryAddress.state || undefined}>
              {row.primaryAddress.city}
            </span>
          ) : (
            <EmptyValue className="text-sm" />
          ),
      },
    ];

    if (classification) {
      columns.push({
        key: `custom:${classification.key}`,
        header: classification.label,
        render: (row) => <CustomFieldValue field={classification} value={row.customFields?.[classification.key]} />,
      });
    }

    columns.push(
      {
        key: "owner",
        header: t("table.owner"),
        render: (row) => {
          const name = ownerName(row.owner, row.ownerName);
          if (!name) return <EmptyValue className="text-sm" />;
          return <OwnerChip name={name} className="text-sm text-foreground" />;
        },
      },
      {
        key: "family",
        header: t("table.family"),
        sortKey: "relativesCount",
        render: (row) =>
          row.relativesCount > 0 ? (
            <span aria-label={t("table.relatives", { count: row.relativesCount })} className="inline-flex items-center gap-1 text-sm tabular-nums text-foreground">
              <Family className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {row.relativesCount}
            </span>
          ) : (
            <EmptyValue className="text-sm" />
          ),
      },
    );

    if (optional.has("referrals")) {
      columns.push({
        key: "referrals",
        header: t("table.referrals"),
        sortKey: "referredCount",
        render: (row) =>
          row.referredCount > 0 ? (
            <span aria-label={t("table.referred", { count: row.referredCount })} className="inline-flex items-center gap-1 text-sm tabular-nums text-foreground">
              <UserPlus className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {row.referredCount}
            </span>
          ) : (
            <EmptyValue className="text-sm" />
          ),
      });
    }
    if (optional.has("campaigns")) {
      columns.push({
        key: "campaigns",
        header: t("table.campaigns"),
        sortKey: "campaigns",
        render: (row) => (
          <span className="inline-flex items-center gap-1 text-sm tabular-nums text-foreground">
            <WhatsappLogo weight="fill" className="text-healthy-ink" size={12} />
            {row.whatsappCampaigns}
          </span>
        ),
      });
    }
    if (optional.has("memories")) {
      columns.push({
        key: "memories",
        header: t("table.memories"),
        sortKey: "memories",
        render: (row) => (
          <span
            className={cn("inline-flex items-center gap-1 text-sm tabular-nums", row.memories > 0 ? "text-foreground" : "text-muted-foreground")}
            title={dateText(row.lastMemoryAt, true) ?? undefined}
          >
            <Brain weight="fill" className="h-3 w-3 text-info-ink" />
            {row.memories}
          </span>
        ),
      });
    }
    if (optional.has("window")) {
      columns.push({
        key: "window",
        header: t("table.window"),
        render: (row) => (
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-2xs font-semibold",
              row.whatsappWindowOpen ? "bg-healthy text-healthy-foreground" : "bg-muted text-muted-foreground",
            )}
            title={row.whatsappWindowOpen ? dateText(row.windowExpiresAt, true) ?? undefined : undefined}
          >
            {row.whatsappWindowOpen ? t("window.open") : t("window.closed")}
          </span>
        ),
      });
    }

    columns.push(
      {
        key: "lastActivity",
        header: t("table.lastActivity"),
        sortKey: "lastActivityAt",
        render: (row) => <span className="text-sm text-muted-foreground">{dateText(row.lastActivityAt, true) ?? <EmptyValue />}</span>,
      },
      {
        key: "createdAt",
        header: t("table.createdAt"),
        sortKey: "createdAt",
        render: (row) => <span className="text-sm text-foreground">{dateText(row.createdAt, false) ?? <EmptyValue />}</span>,
      },
    );

    return columns;
  }, [t, format, optional, classification, ownerName]);
}
