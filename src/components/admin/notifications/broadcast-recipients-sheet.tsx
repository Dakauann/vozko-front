"use client";

import { useState } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { SectionError } from "@/components/dashboard/attendance/primitives";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { Buildings, UsersThree } from "@/components/icons";
import { PagedListFooter } from "@/components/leads/detail/PagedListFooter";
import { useBroadcastRecipients } from "@/hooks/use-notifications";
import { isBusySectionError, sectionErrorCode } from "@/lib/analytics/section-query";
import { codedErrorMessage } from "@/lib/api/coded-error";
import {
  BROADCAST_RECIPIENT_STATUSES,
  type Broadcast,
  type BroadcastRecipient,
  type BroadcastRecipientStatus,
} from "@/lib/notifications/broadcast";

import { useReadShareLabel } from "./use-read-share-label";

const RELATIVE_TIME_REFRESH_MS = 60_000;

const EMPTY_COPY: Record<BroadcastRecipientStatus, { title: string; text: string }> = {
  all: { title: "recipients.emptyAllTitle", text: "recipients.emptyAllText" },
  read: { title: "recipients.emptyReadTitle", text: "recipients.emptyReadText" },
  unread: { title: "recipients.emptyUnreadTitle", text: "recipients.emptyUnreadText" },
};

function RecipientRow({ recipient, now }: { recipient: BroadcastRecipient; now: Date }) {
  const t = useTranslations("adminNotifications");
  const format = useFormatter();
  const readAt = recipient.readAt ? new Date(recipient.readAt) : null;

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium text-foreground">{recipient.name || recipient.email}</p>
        {recipient.name ? <p className="truncate text-xs text-muted-foreground">{recipient.email}</p> : null}
        <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Buildings aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {recipient.workspaceName ? <span className="truncate">{recipient.workspaceName}</span> : <EmptyValue />}
        </p>
      </div>
      {readAt ? (
        <time
          dateTime={recipient.readAt ?? undefined}
          title={format.dateTime(readAt, { dateStyle: "short", timeStyle: "short" })}
          className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground"
        >
          {t("recipients.readAt", { when: format.relativeTime(readAt, now) })}
        </time>
      ) : (
        <StatusChip tone="muted" label={t("recipients.unreadMark")} className="shrink-0 px-1.5 py-0 text-2xs" />
      )}
    </li>
  );
}

function RecipientList({ broadcastId, status }: { broadcastId: string; status: BroadcastRecipientStatus }) {
  const t = useTranslations("adminNotifications");
  const tNotifications = useTranslations("notifications");
  const now = useNow({ updateInterval: RELATIVE_TIME_REFRESH_MS });
  const list = useBroadcastRecipients(broadcastId, status);

  if (list.isPending) return <ScreenLoader fit="fill" className="min-h-40" />;

  if (list.isError && !list.data) {
    return (
      <SectionError
        busy={isBusySectionError(list.error)}
        retrying={list.isFetching}
        onRetry={() => void list.refetch()}
        message={codedErrorMessage(tNotifications, { code: sectionErrorCode(list.error) }, t("recipients.loadFailed"))}
      />
    );
  }

  const pages = list.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <span aria-hidden className="tile-neutral flex h-10 w-10 items-center justify-center">
          <UsersThree className="h-5 w-5" />
        </span>
        <p className="mt-3 text-sm font-semibold text-foreground">{t(EMPTY_COPY[status].title)}</p>
        <p className="mt-1 max-w-[32ch] text-xs leading-relaxed text-muted-foreground">{t(EMPTY_COPY[status].text)}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {items.map((recipient) => (
          <RecipientRow key={`${recipient.workspaceId}:${recipient.userId}`} recipient={recipient} now={now} />
        ))}
      </ul>
      <PagedListFooter
        query={list}
        pageSizes={pages.map((page) => page.items.length)}
        loadMore={t("actions.loadMore")}
        loadingMore={t("actions.loadingMore")}
      />
    </>
  );
}

function RecipientsBody({ broadcast }: { broadcast: Broadcast }) {
  const t = useTranslations("adminNotifications");
  const readShare = useReadShareLabel()(broadcast);
  const [status, setStatus] = useState<BroadcastRecipientStatus>("all");

  return (
    <>
      <ElevatedSheetHeader className="space-y-1 border-b border-border pr-16">
        <ElevatedSheetTitle className="text-xl">{t("recipients.title")}</ElevatedSheetTitle>
        <ElevatedSheetDescription className="truncate">{broadcast.title}</ElevatedSheetDescription>
        {broadcast.recipients !== undefined ? (
          <p className="flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <span>{t("recipients.summary", { read: broadcast.read ?? 0, recipients: broadcast.recipients })}</span>
            {readShare ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-medium text-foreground">{readShare}</span>
              </>
            ) : null}
          </p>
        ) : null}
        <ElevatedPillToggle<BroadcastRecipientStatus>
          size="md"
          aria-label={t("recipients.filter")}
          value={status}
          onChange={setStatus}
          options={BROADCAST_RECIPIENT_STATUSES.map((value) => ({ value, label: t(`recipients.${value}`) }))}
          className="mt-2 w-fit"
        />
      </ElevatedSheetHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-2">
        <RecipientList broadcastId={broadcast.id} status={status} />
      </div>
    </>
  );
}

export function BroadcastRecipientsSheet({ broadcast, onClose }: { broadcast: Broadcast | null; onClose: () => void }) {
  return (
    <ElevatedSheet open={broadcast !== null} onOpenChange={(open) => !open && onClose()}>
      <ElevatedSheetContent side="right" className="w-full gap-0 sm:max-w-lg">
        {broadcast ? <RecipientsBody key={broadcast.id} broadcast={broadcast} /> : null}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}
