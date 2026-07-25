"use client";

import { CaretRight, UsersThree } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { DialerPresenceEntry } from "@/hooks/use-dialer-ws";
import type { WorkspaceMember } from "@/lib/workspace/types";
import {
  buildDialerRoster,
  sortWithinGroup,
  type PresenceStatus,
  type RosterMember,
} from "@/lib/dialer/presence-roster";
import { EndpointBadges, RosterAvatar } from "./presence-bits";
import { cn } from "@/lib/utils";

interface DialerPresencePanelProps {
  presence: DialerPresenceEntry[];
  members: WorkspaceMember[];
  selfUserId: string;
  connected: boolean;
  membersLoaded: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;

function MemberRow({
  member,
  youLabel,
  browserLabel,
  branchLabel,
  reduce,
}: {
  member: RosterMember;
  youLabel: string;
  browserLabel: string;
  branchLabel: string;
  reduce: boolean;
}) {
  const offline = member.status === "offline";
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
      transition={{ duration: 0.16, ease: EASE }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2 py-1.5",
        !offline && "transition-colors hover:bg-muted/60",
      )}
    >
      <RosterAvatar member={member} />

      <p
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] font-medium",
          offline ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {member.name}
        {member.isSelf ? (
          <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-foreground/80">
            {youLabel}
          </span>
        ) : null}
      </p>

      <EndpointBadges
        member={member}
        browserLabel={browserLabel}
        branchLabel={branchLabel}
      />
    </motion.li>
  );
}

function GroupLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-1 pt-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function DialerPresencePanel({
  presence,
  members,
  selfUserId,
  connected,
  membersLoaded,
}: DialerPresencePanelProps) {
  const t = useTranslations("persistentDialer.presence");
  const reduce = useReducedMotion() ?? false;
  const [expanded, setExpanded] = useState(true);

  const roster = useMemo(
    () => buildDialerRoster(presence, members, selfUserId),
    [presence, members, selfUserId],
  );

  const available = sortWithinGroup(
    roster.filter((r) => r.status === "available"),
  );
  const busy = sortWithinGroup(roster.filter((r) => r.status === "busy"));
  const offline = sortWithinGroup(roster.filter((r) => r.status === "offline"));
  const onlineCount = available.length + busy.length;

  const loading = !membersLoaded && presence.length === 0;
  const isEmpty = !loading && roster.length === 0;

  const groups: { key: PresenceStatus; label: string; rows: RosterMember[] }[] =
    [
      { key: "available", label: t("group.available"), rows: available },
      { key: "busy", label: t("group.busy"), rows: busy },
      { key: "offline", label: t("group.offline"), rows: offline },
    ];

  return (
    <TooltipProvider delayDuration={300}>
      <section
        className="overflow-hidden rounded-lg border border-border/70 bg-card"
        aria-label={t("title")}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        >
          <UsersThree
            weight="fill"
            className="h-4 w-4 shrink-0 text-muted-foreground"
          />
          <span className="text-[13px] font-semibold text-foreground">
            {t("title")}
          </span>
          <span className="ml-auto flex items-center gap-2">
            {connected ? (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {t("online", { count: onlineCount })}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                {t("reconnecting")}
              </span>
            )}
            <CaretRight
              className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                expanded && "rotate-90",
              )}
            />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="body"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="overflow-hidden border-t border-border/60"
            >
              <div
                className={cn(
                  "max-h-56 overflow-y-auto px-1 pb-2 transition-opacity",
                  !connected && "opacity-60",
                )}
              >
                {loading ? (
                  <div className="pt-1">
                    <RowSkeleton />
                    <RowSkeleton />
                    <RowSkeleton />
                  </div>
                ) : isEmpty ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    {t("empty")}
                  </p>
                ) : (
                  groups
                    .filter((g) => g.rows.length > 0)
                    .map((g) => (
                      <div key={g.key}>
                        <GroupLabel label={g.label} count={g.rows.length} />
                        <ul>
                          <AnimatePresence initial={false}>
                            {g.rows.map((m) => (
                              <MemberRow
                                key={m.userId}
                                member={m}
                                youLabel={t("you")}
                                browserLabel={t("endpoint.browser")}
                                branchLabel={t("endpoint.branch")}
                                reduce={reduce}
                              />
                            ))}
                          </AnimatePresence>
                        </ul>
                      </div>
                    ))
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>
    </TooltipProvider>
  );
}
