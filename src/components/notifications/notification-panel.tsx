"use client";

import { useState } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { toast } from "sonner";

import type { ActionError } from "@/app/actions/action-result";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { SectionError } from "@/components/dashboard/attendance/primitives";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { Bell, Checks, Gear } from "@/components/icons";
import { PagedListFooter } from "@/components/leads/detail/PagedListFooter";
import { useNotificationActions, useNotificationList } from "@/hooks/use-notifications";
import { isBusySectionError, sectionErrorCode } from "@/lib/analytics/section-query";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { NotificationCategoryFilter, NotificationFilter } from "@/lib/notifications/inbox";
import { NOTIFICATION_CATEGORIES, type NotificationItem, type NotificationSummary } from "@/lib/notifications/types";

import { NotificationItemView } from "./notification-item";
import { NotificationPreferencesView } from "./notification-preferences";

const RELATIVE_TIME_REFRESH_MS = 60_000;

const ICON_BUTTON =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-accent-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function useActionFailure() {
  const t = useTranslations("notifications");
  return (error: ActionError | null) => {
    if (error) toast.error(codedErrorMessage(t, error, t("panel.actionFailed")));
  };
}

function CategoryPills({
  filter,
  summary,
  onChange,
}: {
  filter: NotificationFilter;
  summary: NotificationSummary | undefined;
  onChange: (category: NotificationCategoryFilter) => void;
}) {
  const t = useTranslations("notifications");
  const format = useFormatter();
  const options = [
    { value: "all" as NotificationCategoryFilter, label: t("panel.all"), title: t("panel.all") },
    ...NOTIFICATION_CATEGORIES.map((category) => {
      const count = summary?.byCategory[category] ?? 0;
      const name = t(`categories.${category}`);
      return {
        value: category as NotificationCategoryFilter,
        title: count > 0 ? t("panel.categoryUnread", { category: name, count }) : name,
        label: (
          <>
            {name}
            {count > 0 ? <span className="ml-1 tabular-nums text-muted-foreground">{format.number(count)}</span> : null}
          </>
        ),
      };
    }),
  ];
  return (
    <ElevatedPillToggle
      aria-label={t("panel.filterLabel")}
      value={filter.category}
      onChange={onChange}
      options={options}
      className="flex w-full flex-wrap gap-y-0.5"
    />
  );
}

function EmptyInbox({ filter }: { filter: NotificationFilter }) {
  const t = useTranslations("notifications");
  const [title, text] =
    filter.category !== "all"
      ? [t("panel.emptyCategoryTitle", { category: t(`categories.${filter.category}`) }), t("panel.emptyCategoryText")]
      : filter.unreadOnly
        ? [t("panel.emptyUnreadTitle"), t("panel.emptyUnreadText")]
        : [t("panel.emptyTitle"), t("panel.emptyText")];
  return (
    <div className="flex flex-col items-center px-8 py-10 text-center">
      <span aria-hidden className="tile-neutral flex h-10 w-10 items-center justify-center">
        <Bell className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function InboxList({ filter, onClose }: { filter: NotificationFilter; onClose: () => void }) {
  const t = useTranslations("notifications");
  const now = useNow({ updateInterval: RELATIVE_TIME_REFRESH_MS });
  const list = useNotificationList(filter, true);
  const { markRead, markUnread } = useNotificationActions();
  const reportFailure = useActionFailure();

  if (list.isPending) return <ScreenLoader fit="fill" className="min-h-48" />;

  if (list.isError && !list.data) {
    return (
      <div className="p-4">
        <SectionError
          busy={isBusySectionError(list.error)}
          retrying={list.isFetching}
          onRetry={() => void list.refetch()}
          message={codedErrorMessage(t, { code: sectionErrorCode(list.error) }, t("panel.loadFailed"))}
        />
      </div>
    );
  }

  const pages = list.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  if (items.length === 0) return <EmptyInbox filter={filter} />;

  const open = (item: NotificationItem) => {
    void markRead([item]).then(reportFailure);
  };
  const toggle = (item: NotificationItem) => {
    void (item.readAt ? markUnread([item]) : markRead([item])).then(reportFailure);
  };

  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id}>
            <NotificationItemView item={item} now={now} onOpen={open} onToggleRead={toggle} onNavigate={onClose} />
          </li>
        ))}
      </ul>
      <div className="px-4 pb-3">
        <PagedListFooter
          query={list}
          pageSizes={pages.map((page) => page.items.length)}
          loadMore={t("panel.loadMore")}
          loadingMore={t("panel.loadingMore")}
        />
      </div>
    </>
  );
}

function InboxView({
  summary,
  filter,
  onFilter,
  onPreferences,
  onClose,
}: {
  summary: NotificationSummary | undefined;
  filter: NotificationFilter;
  onFilter: (filter: NotificationFilter) => void;
  onPreferences: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("notifications");
  const { markAllRead } = useNotificationActions();
  const reportFailure = useActionFailure();

  const unread = summary?.unread ?? 0;
  const scopedUnread = filter.category === "all" ? unread : (summary?.byCategory[filter.category] ?? 0);
  const markAllLabel = filter.category === "all" ? t("panel.markAllRead") : t("panel.markCategoryRead", { category: t(`categories.${filter.category}`) });

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border py-2.5 pl-4 pr-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-5 text-foreground">{t("panel.title")}</h2>
          <p className="text-2xs tabular-nums text-muted-foreground">
            {summary?.capped ? t("panel.unreadSummaryCapped", { count: unread }) : t("panel.unreadSummary", { count: unread })}
          </p>
        </div>
        <button type="button" onClick={onPreferences} aria-label={t("panel.preferences")} title={t("panel.preferences")} className={ICON_BUTTON}>
          <Gear className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2 border-b border-border px-3 py-2.5">
        <CategoryPills filter={filter} summary={summary} onChange={(category) => onFilter({ ...filter, category })} />
        <div className="flex items-center justify-between gap-3 pl-1">
          <ElevatedSwitch
            label={t("panel.unreadOnly")}
            checked={filter.unreadOnly}
            onCheckedChange={(unreadOnly) => onFilter({ ...filter, unreadOnly })}
          />
          <button
            type="button"
            disabled={scopedUnread === 0}
            onClick={() => void markAllRead(filter.category === "all" ? null : filter.category).then(reportFailure)}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-[--radius] px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-muted-foreground disabled:opacity-60"
          >
            <Checks aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{markAllLabel}</span>
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <InboxList filter={filter} onClose={onClose} />
      </div>
    </>
  );
}

export function NotificationPanel({ summary, onClose }: { summary: NotificationSummary | undefined; onClose: () => void }) {
  const [view, setView] = useState<"inbox" | "preferences">("inbox");
  const [filter, setFilter] = useState<NotificationFilter>({ category: "all", unreadOnly: false });
  if (view === "preferences") return <NotificationPreferencesView onBack={() => setView("inbox")} />;
  return <InboxView summary={summary} filter={filter} onFilter={setFilter} onPreferences={() => setView("preferences")} onClose={onClose} />;
}
