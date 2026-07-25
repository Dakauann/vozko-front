"use client";

import { Browser, Phone } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  initials,
  type PresenceStatus,
  type RosterMember,
} from "@/lib/dialer/presence-roster";
import { cn } from "@/lib/utils";

// Presentational atoms shared by the presence panel and the transfer picker so
// a member looks identical wherever they appear. Consumers must sit inside a
// TooltipProvider (the endpoint badges use tooltips).

export function StatusDot({
  status,
  className,
}: {
  status: PresenceStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "h-3 w-3 rounded-full ring-2 ring-card transition-colors duration-200",
        status === "available" && "bg-emerald-500",
        status === "busy" && "bg-amber-500",
        status === "offline" && "bg-slate-300 dark:bg-slate-600",
        className,
      )}
    />
  );
}

export function RosterAvatar({ member }: { member: RosterMember }) {
  return (
    <div className="relative shrink-0">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-muted text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          {initials(member.name)}
        </AvatarFallback>
      </Avatar>
      <StatusDot
        status={member.status}
        className="absolute -bottom-0.5 -right-0.5"
      />
    </div>
  );
}

function EndpointIcon({ icon: IconCmp, label }: { icon: Icon; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground">
          <IconCmp weight="bold" className="h-3.5 w-3.5" aria-label={label} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

export function EndpointBadges({
  member,
  browserLabel,
  branchLabel,
}: {
  member: RosterMember;
  browserLabel: string;
  branchLabel: string;
}) {
  if (member.status === "offline" || (!member.hasBrowser && !member.hasBranch)) {
    return null;
  }
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {member.hasBrowser ? (
        <EndpointIcon icon={Browser} label={browserLabel} />
      ) : null}
      {member.hasBranch ? <EndpointIcon icon={Phone} label={branchLabel} /> : null}
    </div>
  );
}
