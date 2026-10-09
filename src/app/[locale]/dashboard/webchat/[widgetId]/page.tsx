"use client";

import { ArrowLeft, Warning } from "@/components/icons";
import { useCallback, useEffect, useState } from "react";

import {
  deleteWebchatWidgetAction,
  getWebchatWidgetAction,
  updateWebchatWidgetAction,
} from "@/app/actions/webchat";
import { webchatErrorKey, type WebchatWidget, type WebchatWidgetRequest } from "@/lib/webchat/types";

import Button from "@/components/elevated-design/button";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DepartmentAssignmentCard } from "@/components/dashboard/DepartmentAssignmentCard";
import Link from "next/link";
import { WebchatAutomationPanel } from "@/components/webchat/webchat-automation-panel";
import { WebchatLogoColor } from "@/components/icons/channel-logos";
import { WebchatStatusChip } from "@/components/webchat/webchat-status-chip";
import {
  AppearanceSection,
  AvailabilitySection,
  ConversationOptionsSection,
  DangerSection,
  IdentitySection,
  InstallSection,
  IntakeSection,
  OriginsSection,
} from "@/components/webchat/widget-sections";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useWorkspace } from "@/contexts/workspace-context";

type LoadResult = Awaited<ReturnType<typeof getWebchatWidgetAction>>;

export default function WebchatWidgetPage() {
  const t = useTranslations("webchat");
  const params = useParams();
  const widgetId = String(params?.widgetId ?? "");
  const router = useRouter();
  const { can } = useWorkspace();

  const [widget, setWidget] = useState<WebchatWidget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canUpdate = can("webchat_widgets", "update");
  const canDelete = can("webchat_widgets", "delete");

  const apply = useCallback(
    (result: LoadResult) => {
      setLoading(false);
      if ("error" in result || !result.widget) {
        const key = "error" in result ? webchatErrorKey(result.code) : null;
        setError(key ? t(key) : "error" in result ? result.error : t("detail.notFound"));
        return;
      }
      setError(null);
      setWidget(result.widget);
    },
    [t],
  );

  useEffect(() => {
    if (!widgetId) return;
    void getWebchatWidgetAction(widgetId).then(apply);
  }, [widgetId, apply]);

  const reload = useCallback(() => {
    void getWebchatWidgetAction(widgetId).then(apply);
  }, [widgetId, apply]);

  const save = useCallback(
    async (payload: WebchatWidgetRequest) => {
      const result = await updateWebchatWidgetAction(widgetId, payload);
      if ("error" in result || !result.widget) {
        const key = "error" in result ? webchatErrorKey(result.code) : null;
        toast.error(t("detail.saveFailed"), { description: key ? t(key) : "error" in result ? result.error : undefined });
        return false;
      }
      setWidget(result.widget);
      return true;
    },
    [widgetId, t],
  );

  const handleDelete = useCallback(async () => {
    const result = await deleteWebchatWidgetAction(widgetId);
    if ("error" in result) {
      toast.error(t("danger.deleteFailed"), { description: result.error });
      return;
    }
    toast(t("danger.deleted", { name: widget?.name ?? "" }));
    router.push("/dashboard/webchat");
  }, [widgetId, widget?.name, t, router]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">{t("detail.loading")}</div>;
  }

  if (error || !widget) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-destructive-ink">
        <Warning className="h-4 w-4" />
        {error ?? t("detail.notFound")}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <DashboardPageHeader
        badge={widget.name}
        description={t("detail.description")}
        icon={<WebchatLogoColor className="h-6 w-6" />}
        colorClass="text-info-ink"
        actions={
          <div className="flex items-center gap-3">
            <WebchatStatusChip status={widget.status} />
            <Link href="/dashboard/webchat">
              <Button
                variant="ghost"
                title={t("detail.back")}
                icon={<ArrowLeft weight="bold" className="h-4 w-4" />}
                iconVisible
                iconSide="left"
              />
            </Link>
          </div>
        }
      />

      <InstallSection widget={widget} />
      <OriginsSection widget={widget} canUpdate={canUpdate} onSave={save} />
      <AppearanceSection widget={widget} canUpdate={canUpdate} onSave={save} />
      <IntakeSection widget={widget} canUpdate={canUpdate} onSave={save} />
      <ConversationOptionsSection widget={widget} canUpdate={canUpdate} onSave={save} />
      <IdentitySection widget={widget} canUpdate={canUpdate} onSave={save} />
      <WebchatAutomationPanel widget={widget} onUpdated={setWidget} />
      {canUpdate && (
        <DepartmentAssignmentCard
          departmentId={widget.departmentId}
          onAssign={(departmentId) =>
            updateWebchatWidgetAction(widget.id, { departmentId }).then((result) => ({
              item: "widget" in result ? (result.widget ?? null) : null,
              error: "error" in result ? result.error : null,
            }))
          }
          onAssigned={reload}
        />
      )}
      <AvailabilitySection widget={widget} canUpdate={canUpdate} onSave={save} />
      {canDelete && <DangerSection widget={widget} onDelete={handleDelete} />}
    </div>
  );
}
