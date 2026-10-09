"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { createPixelAction } from "@/app/actions/advertising-conversions";
import { isAdsError } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { Code, Copy, Plus } from "@/components/icons";
import { toast } from "sonner";
import type { Pixel } from "@/lib/advertising/conversions";
import { issuesAt, type ExpectedIssues } from "@/lib/advertising/issues";
import type { AdAccount } from "@/lib/advertising/types";
import { formatWhen } from "@/lib/advertising/when";

import { useLoadErrorState } from "../load-error-state";
import { IssueList } from "../field-issue";
import { IconAction } from "../icon-action";
import { StatusDot } from "../status-dot";
import { useAdsFormat } from "../use-ads-format";
import type { ConversionPermissions } from "./conversions-page";

export function PixelsCard({
  account,
  pixels,
  loading,
  error,
  permissions,
  onReload,
}: {
  account: AdAccount;
  pixels: Pixel[];
  loading: boolean;
  error: string | null;
  permissions: ConversionPermissions;
  onReload: () => void;
}) {
  const t = useTranslations("adsConversions.pixels");
  const fmt = useAdsFormat();
  const loadError = useLoadErrorState();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expected, setExpected] = useState<ExpectedIssues>({});

  const copy = async (pixel: Pixel) => {
    try {
      await navigator.clipboard.writeText(pixel.metaId);
      toast(t("copied"));
    } catch {
      toast.error(t("copyFailed"), { description: pixel.metaId });
    }
  };

  const create = async () => {
    setCreating(true);
    const outcome = await createPixelAction(account.id, name.trim());
    setCreating(false);
    if (isAdsError(outcome)) {
      setExpected(outcome.expected ?? {});
      if (!outcome.expected) toast.error(t("createFailed"), { description: outcome.error });
      return;
    }
    setExpected({});
    setName("");
    toast(t("created", { name: outcome.data.name }));
    onReload();
  };

  const columns: DashboardTableColumn<Pixel>[] = [
    {
      key: "name",
      header: t("columns.name"),
      render: (pixel) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{pixel.name}</p>
          <p className="font-mono text-2xs text-muted-foreground">{pixel.metaId}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      render: (pixel) =>
        pixel.unavailable ? (
          <StatusDot tone="warning">{t("unavailable")}</StatusDot>
        ) : pixel.lastFiredTime ? (
          <StatusDot tone="healthy">{t("receiving")}</StatusDot>
        ) : (
          <StatusDot tone="neutral">{t("noActivity")}</StatusDot>
        ),
    },
    {
      key: "last",
      header: t("columns.lastActivity"),
      render: (pixel) => <span className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">{formatWhen(pixel.lastFiredTime, fmt.tag)}</span>,
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <DashboardTable
        data={pixels}
        columns={columns}
        rowKey={(pixel) => pixel.metaId}
        loading={loading}
        toolbar={
          permissions.canCreate ? (
            <div className="flex flex-wrap items-start gap-2">
              <div className="w-full max-w-xs space-y-1">
                <ElevatedInput
                  placeholder={t("newName")}
                  aria-label={t("newName")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  controlSize="sm"
                />
                <IssueList namespace="adsConversions" issues={issuesAt(expected, "name")} />
              </div>
              <Button
                variant="secondary"
                title={creating ? t("creating") : t("create")}
                icon={<Plus className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                disabled={creating || !name.trim()}
                onClick={create}
              />
            </div>
          ) : undefined
        }
        renderRowActions={(pixel) => (
          <IconAction label={t("copy")} onClick={() => void copy(pixel)}>
            <Copy className="h-4 w-4" />
          </IconAction>
        )}
        emptyState={error ? loadError(error, onReload) : {
          icon: <Code className="h-7 w-7 text-muted-foreground" />,
          title: t("emptyTitle"),
          description: t("emptyBody"),
        }}
      />
    </section>
  );
}
