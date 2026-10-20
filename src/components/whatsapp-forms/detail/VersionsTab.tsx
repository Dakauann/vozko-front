"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { saveDraftAction } from "@/app/actions/whatsapp-forms";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ClockCounterClockwise, XCircle } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useFormAccess, useFormVersions, useRefreshForms } from "@/hooks/use-whatsapp-forms";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import type { FormDetail, Version } from "@/lib/whatsapp-forms/types";
import { cn } from "@/lib/utils";

import { PhonePreview } from "../builder/PhonePreview";
import { useFormError } from "../use-form-text";

function VersionViewer({ version, onClose }: { version: Version; onClose: () => void }) {
  const t = useTranslations("whatsappForms");
  const [screenIndex, setScreenIndex] = useState(0);
  const screens = version.document.screens;
  const screen = screens[Math.min(screenIndex, screens.length - 1)];
  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onClose()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("versions.number", { number: version.number })}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("versions.viewing")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogBody className="space-y-3">
          {screens.length > 1 ? (
            <div role="tablist" aria-label={t("builder.screens")} className="flex flex-wrap justify-center gap-1">
              {screens.map((candidate, index) => (
                <button
                  key={candidate.key}
                  type="button"
                  role="tab"
                  aria-selected={index === screenIndex}
                  onClick={() => setScreenIndex(index)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    index === screenIndex ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          ) : null}
          {screen ? <PhonePreview document={version.document} screen={screen} /> : <p className="text-sm text-muted-foreground">{t("builder.noScreens")}</p>}
        </ElevatedDialogBody>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

export function VersionsTab({ detail }: { detail: FormDetail }) {
  const t = useTranslations("whatsappForms");
  const format = useFormatter();
  const access = useFormAccess();
  const errorText = useFormError();
  const refresh = useRefreshForms();
  const query = useFormVersions(detail.form.id);
  const [viewing, setViewing] = useState<Version | null>(null);
  const [restoring, setRestoring] = useState<Version | null>(null);
  const versions = [...(query.data ?? [])].sort((a, b) => b.number - a.number);

  const restore = async () => {
    if (!restoring) return true;
    const answer = await saveDraftAction(detail.form.id, restoring.document, detail.form.draftVersionId || detail.draft.id);
    if (answer.error) {
      toast.error(errorText(answer.error));
      return false;
    }
    toast.success(t("versions.restored", { number: restoring.number }));
    setRestoring(null);
    void refresh(detail.form.id);
    return true;
  };

  const columns: DashboardTableColumn<Version>[] = [
    {
      key: "number",
      header: t("versions.table.version"),
      render: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{t("versions.number", { number: row.number })}</span>
          {row.id === detail.form.publishedVersionId ? <StatusChip tone="healthy" label={t("versions.published")} /> : null}
          {row.id === detail.form.draftVersionId ? <StatusChip tone="outline" label={t("versions.draft")} /> : null}
        </span>
      ),
    },
    { key: "createdAt", header: t("versions.table.createdAt"), render: (row) => <span className="whitespace-nowrap text-sm text-muted-foreground">{format.dateTime(new Date(row.createdAt), { dateStyle: "short", timeStyle: "short" })}</span> },
    { key: "screens", header: t("versions.table.screens"), render: (row) => <span className="text-sm tabular-nums text-foreground">{format.number(row.document.screens.length)}</span> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <span className="flex justify-end gap-1.5">
          <Button variant="ghost" size="sm" title={t("versions.view")} onClick={() => setViewing(row)} />
          {access.edit && row.id !== detail.form.draftVersionId ? <Button variant="secondary" size="sm" title={t("versions.restore")} onClick={() => setRestoring(row)} /> : null}
        </span>
      ),
    },
  ];
  const failure = query.isError && !query.data ? query.error : null;

  return (
    <>
      <DashboardTable<Version>
        data={versions}
        columns={columns}
        rowKey={(row) => row.id}
        loading={query.isFetching && !query.data}
        emptyState={
          failure
            ? {
                icon: <XCircle className="h-7 w-7 text-destructive-ink" weight="fill" />,
                title: t("common.errorTitle"),
                description: errorText({ code: sectionErrorCode(failure) }),
                action: <Button variant="secondary" title={t("common.retry")} onClick={() => void query.refetch()} />,
              }
            : { icon: <ClockCounterClockwise className="h-7 w-7 text-muted-foreground" />, title: t("versions.empty") }
        }
      />
      {viewing ? <VersionViewer version={viewing} onClose={() => setViewing(null)} /> : null}
      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={t("versions.restoreTitle", { number: restoring?.number ?? 0 })}
        description={t("versions.restoreDescription")}
        confirmLabel={t("versions.restore")}
        cancelLabel={t("common.cancel")}
        onConfirm={restore}
      />
    </>
  );
}
