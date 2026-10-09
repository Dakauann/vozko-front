"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { SectionError } from "@/components/dashboard/attendance/primitives";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { PhoneOutgoing, UsersThree } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useAuth } from "@/contexts/auth-context";
import { useAccess } from "@/hooks/use-access";
import { useCallList } from "@/hooks/use-call-lists";
import { useRouter } from "@/i18n/routing";
import { isBusySectionError, SectionError as SectionFailure } from "@/lib/analytics/section-query";
import type { CallList } from "@/lib/call-lists/types";
import { pathForScreen } from "@/lib/navigation/routes";

import { CallListActionsMenu } from "./CallListActionsMenu";
import { CallListAssigneesDialog } from "./CallListAssigneesDialog";
import { useMemberNames } from "./CallListAssigneePicker";
import { CallListStats, CallListStatusChip, useCallListFailure } from "./CallListBits";
import { CallListQueue } from "./CallListQueue";
import { CallListWorkArea } from "./CallListWorkPanel";

const SHOWN_ASSIGNEES = 3;

function PageNotice({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: string }) {
  return (
    <Notice tone={tone} className="text-sm">
      <p className="text-foreground">{children}</p>
    </Notice>
  );
}

type WorkAccess = "checking" | "denied" | "notAssignee" | "granted";

function useWorkAccess(list: CallList | undefined, userId: string): WorkAccess {
  const { decideCapabilities } = useAccess();
  const decision = decideCapabilities(["call_lists.work"]);
  if (decision === "loading" || !list || !userId) return "checking";
  if (decision === "denied") return "denied";
  return list.assigneeIds.includes(userId) ? "granted" : "notAssignee";
}

export function CallListWorkerPage({ listId }: { listId: string }) {
  const t = useTranslations("callLists");
  const format = useFormatter();
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { decideCapabilities } = useAccess();
  const manages = decideCapabilities(["call_lists.manage"]) === "granted";
  const members = useMemberNames();
  const failureText = useCallListFailure();
  const query = useCallList(listId);
  const list = query.data;
  const access = useWorkAccess(list, userId);
  const [editingAssignees, setEditingAssignees] = useState(false);

  const back = { label: t("worker.back"), onClick: () => router.push(pathForScreen("call_lists") ?? "/dashboard/call-lists") };

  if (!list) {
    const missing = query.error instanceof SectionFailure && (query.error.status === 404 || query.error.status === 403);
    return (
      <div className="w-full space-y-6">
        <DashboardPageHeader badge={t("page.title")} description={t("page.description")} icon={<PhoneOutgoing className="h-6 w-6" />} back={back} />
        {query.isError ? (
          missing ? (
            <PageNotice tone="warning">{t("worker.notFound")}</PageNotice>
          ) : (
            <SectionError busy={isBusySectionError(query.error)} retrying={query.isFetching} onRetry={() => void query.refetch()} message={t("worker.loadFailed")} />
          )
        ) : (
          <ScreenLoader fit="inline" />
        )}
      </div>
    );
  }

  const shown = list.assigneeIds.slice(0, SHOWN_ASSIGNEES).map(members.name);
  const rest = list.assigneeIds.length - shown.length;
  const people = shown.join(", ") + (rest > 0 ? ` +${rest}` : "");
  const description = [t("worker.description", { count: list.itemCount, date: format.dateTime(new Date(list.createdAt), { dateStyle: "short" }) }), people]
    .filter(Boolean)
    .join(" · ");
  const workable = list.acceptsOutcomes;
  const working = access === "granted" && workable;

  return (
    <div className="w-full space-y-4">
      <DashboardPageHeader
        badge={list.name}
        description={description}
        icon={<PhoneOutgoing className="h-6 w-6" />}
        back={back}
        meta={<CallListStatusChip status={list.status} />}
        actions={
          manages ? (
            <>
              {workable ? (
                <Button
                  variant="secondary"
                  size="sm"
                  title={t("assignees.button", { count: list.assigneeIds.length })}
                  icon={<UsersThree className="h-4 w-4" />}
                  iconVisible
                  iconSide="left"
                  onClick={() => setEditingAssignees(true)}
                />
              ) : null}
              <CallListActionsMenu
                list={list}
                showAssignees={false}
                onDeleted={() => router.push(pathForScreen("call_lists") ?? "/dashboard/call-lists")}
              />
            </>
          ) : undefined
        }
      />

      <CallListStats list={list} />

      {list.status === "building" ? <PageNotice>{t("worker.building", { selected: list.selected })}</PageNotice> : null}
      {list.status === "failed" ? <PageNotice tone="warning">{failureText(list.failureCode)}</PageNotice> : null}
      {list.status === "paused" ? <PageNotice>{t("worker.paused")}</PageNotice> : null}
      {list.status === "archived" ? <PageNotice>{t("worker.archived")}</PageNotice> : null}
      {list.status === "active" && access === "checking" ? <p className="text-sm text-muted-foreground">{t("worker.checking")}</p> : null}
      {list.status === "active" && access === "denied" ? <PageNotice>{t("worker.cannotWork")}</PageNotice> : null}
      {list.status === "active" && access === "notAssignee" ? <PageNotice>{t("worker.notAssignee")}</PageNotice> : null}

      {working ? (
        <CallListWorkArea list={list} userId={userId} />
      ) : list.status !== "building" && list.status !== "failed" ? (
        <CallListQueue listId={list.id} userId={userId} />
      ) : null}

      {editingAssignees ? <CallListAssigneesDialog list={list} onClose={() => setEditingAssignees(false)} /> : null}
    </div>
  );
}
