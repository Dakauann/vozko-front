"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { CallOutcomeBadge } from "@/components/call-history/call-outcome-badge";
import { SectionState } from "@/components/dashboard/attendance/section-state";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { PagedListFooter, pagedSectionState } from "@/components/leads/detail/PagedListFooter";
import { useCallListItems } from "@/hooks/use-call-lists";
import { useCallOutcomeLabel } from "@/hooks/use-call-outcome-label";
import { CALL_LIST_ITEM_STATES, CALL_LIST_SKIP_REASONS, REFUSED_DISPOSITION, type CallListItem, type CallListItemState } from "@/lib/call-lists/types";
import { formatPhoneForDisplay } from "@/lib/phone/display";

import { useMemberNames } from "./CallListAssigneePicker";

const KNOWN_SKIPS: readonly string[] = CALL_LIST_SKIP_REASONS;

function QueueRow({
  item,
  userId,
  outcomeLabel,
  memberName,
}: {
  item: CallListItem;
  userId: string;
  outcomeLabel: (code: string) => string | null;
  memberName: (userId: string) => string;
}) {
  const t = useTranslations("callLists");
  const format = useFormatter();
  const when = (value: string) => format.dateTime(new Date(value), { dateStyle: "short", timeStyle: "short" });
  const reason = (code: string) => t(`skipped.${KNOWN_SKIPS.includes(code) ? code : "other"}`);

  const details: string[] = [];
  if (item.state === "reserved" && item.reservedBy) {
    details.push(item.reservedBy === userId ? t("queue.reservedByYou") : t("queue.reservedBy", { name: memberName(item.reservedBy) }));
  }
  if (item.state === "pending" && item.callbackAt) {
    details.push(item.refusal ? t("queue.recheck", { date: when(item.callbackAt) }) : t("queue.callbackAt", { date: when(item.callbackAt) }));
  }
  if (item.state === "closed" && item.disposition) {
    const label = item.disposition === REFUSED_DISPOSITION ? t("queue.refusedDisposition", { reason: reason(item.refusal ?? "") }) : outcomeLabel(item.disposition);
    if (label) details.push(label);
  }
  if (item.attempts) details.push(t("queue.attempts", { count: item.attempts }));
  const place = item.leadDistrict ?? item.leadCity;
  if (place) details.push(place);

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-border py-2.5 last:border-0">
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{item.leadName || formatPhoneForDisplay(item.phone)}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.leadName ? formatPhoneForDisplay(item.phone) : t("next.noName")}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-right text-xs text-muted-foreground">
        {item.outcome ? <CallOutcomeBadge outcome={item.outcome} /> : null}
        {details.map((detail) => (
          <span key={detail}>{detail}</span>
        ))}
      </span>
    </li>
  );
}

export function CallListQueue({ listId, userId }: { listId: string; userId: string }) {
  const t = useTranslations("callLists.queue");
  const tLists = useTranslations("callLists");
  const outcomeLabel = useCallOutcomeLabel();
  const members = useMemberNames();
  const [state, setState] = useState<CallListItemState>("pending");
  const query = useCallListItems(listId, state, true);
  const pages = query.data?.pages;
  const items = useMemo(() => pages?.flatMap((page) => page.items) ?? [], [pages]);
  const empty = query.isSuccess && items.length === 0 && !query.hasNextPage;

  return (
    <section aria-labelledby="call-list-queue-title" className="overflow-hidden rounded-[--radius] border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 id="call-list-queue-title" className="font-display text-base font-semibold text-foreground">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
        <ElevatedPillToggle<CallListItemState>
          aria-label={t("title")}
          value={state}
          onChange={setState}
          options={CALL_LIST_ITEM_STATES.map((value) => ({ value, label: t(`tabs.${value}`) }))}
        />
      </header>
      <div className="px-4 py-2">
        <SectionState query={pagedSectionState(query)}>
          {query.isPending ? (
            <ScreenLoader fit="inline" />
          ) : empty ? (
            <p className="py-3 text-sm text-muted-foreground">{t(`empty.${state}`)}</p>
          ) : (
            <>
              <ul aria-label={tLists(`queue.tabs.${state}`)}>
                {items.map((item) => (
                  <QueueRow key={item.id} item={item} userId={userId} outcomeLabel={outcomeLabel} memberName={members.name} />
                ))}
              </ul>
              <PagedListFooter
                query={query}
                pageSizes={pages?.map((page) => page.items.length) ?? []}
                loadMore={t("loadMore")}
                loadingMore={t("loadingMore")}
              />
            </>
          )}
        </SectionState>
      </div>
    </section>
  );
}
