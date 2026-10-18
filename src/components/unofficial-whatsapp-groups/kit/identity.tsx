"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Chip } from "@/components/audience/shared";
import { EyeSlash, Lock, User, UsersThree } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { GroupAvatar } from "@/components/unofficial-whatsapp-groups/marks";
import { Link } from "@/i18n/routing";
import type { GroupOrigin, GroupRef, WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";
import { cn } from "@/lib/utils";

import { displayPhone, initialsOf, personName, type PersonNameSource } from "./format";
import { groupsRoutes } from "./routes";
import { useGroupName } from "./use-groups-format";

export type PersonAvatarSize = "xs" | "sm" | "md";

const AVATAR_BOX: Record<PersonAvatarSize, string> = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-2xs",
  md: "h-9 w-9 text-xs",
};

const GLYPH_BOX: Record<PersonAvatarSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
};

export function PersonAvatar({ pictureUrl, name, size = "sm" }: { pictureUrl?: string; name: string; size?: PersonAvatarSize }) {
  const initials = initialsOf(name);
  return (
    <Avatar aria-hidden className={cn("border border-border", AVATAR_BOX[size])}>
      {pictureUrl ? <AvatarImage src={pictureUrl} alt="" className="object-cover" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback delayMs={pictureUrl ? 400 : 0} className="font-semibold text-muted-foreground">
        {initials || <User className={GLYPH_BOX[size]} weight="bold" />}
      </AvatarFallback>
    </Avatar>
  );
}

export interface PersonIdentitySource extends PersonNameSource {
  pictureUrl?: string;
}

export function PersonIdentity({
  person,
  ourNumber,
  showJid,
  compact,
  href,
  trailing,
}: {
  person: PersonIdentitySource;
  ourNumber?: boolean;
  showJid?: boolean;
  compact?: boolean;
  href?: string;
  trailing?: ReactNode;
}) {
  const t = useTranslations("unofficialGroups.kit.identity");
  const tk = useTranslations("unofficialGroups.kit");
  const name = personName(person);
  const phone = displayPhone(person.phone, person.jid);
  const label = name.label || tk("unnamedPerson");
  const nameNode = (
    <span className={cn("truncate font-semibold", name.label ? "text-foreground" : "text-muted-foreground")}>{label}</span>
  );
  const secondLine = name.isFallback && phone === name.label ? null : phone ? (
    <span className="readout truncate font-mono text-2xs text-muted-foreground">{phone}</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground">
      <EyeSlash className="h-3 w-3 shrink-0" aria-hidden />
      {t("hiddenNumber")}
    </span>
  );

  return (
    <div className="flex min-w-0 items-center gap-2" title={person.jid}>
      <PersonAvatar pictureUrl={person.pictureUrl} name={name.isFallback ? "" : name.label} size={compact ? "xs" : "sm"} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5 text-xs">
          {href ? (
            <Link
              href={href}
              onClick={(event) => event.stopPropagation()}
              className="min-w-0 truncate rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {nameNode}
            </Link>
          ) : (
            nameNode
          )}
          {ourNumber ? <Chip className="shrink-0 text-muted-foreground">{t("ourNumber")}</Chip> : null}
          {trailing}
        </div>
        {!compact && secondLine ? <div className="mt-0.5 flex min-w-0">{secondLine}</div> : null}
        {showJid && person.jid ? <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{person.jid}</p> : null}
      </div>
    </div>
  );
}

export type GroupIdentitySource = Pick<WorkspaceGroup, "id" | "subject" | "pictureUrl"> &
  Partial<Pick<WorkspaceGroup, "category" | "origin" | "seriesSequence" | "followedAt" | "announce" | "locked">>;

export function GroupIdentity({
  group,
  href,
  size = "sm",
  sub = "none",
  trailing,
}: {
  group: GroupIdentitySource;
  href?: string;
  size?: "sm" | "md";
  sub?: "none" | "category" | "full";
  trailing?: ReactNode;
}) {
  const t = useTranslations("unofficialGroups.kit.identity");
  const groupName = useGroupName();
  const title = groupName(group.subject);
  const category = group.category?.trim();

  const parts: ReactNode[] = [];
  if (sub === "full") {
    parts.push(
      group.followedAt ? (
        <span key="followed" role="img" aria-label={t("followed")} title={t("followed")} className="inline-block h-1.5 w-1.5 rounded-full bg-healthy" />
      ) : (
        <span key="followed">{t("notFollowed")}</span>
      ),
    );
    if (category) parts.push(<span key="category">{category}</span>);
    if (group.origin === "external") parts.push(<span key="origin">{t("external")}</span>);
    if (group.seriesSequence) parts.push(<span key="series">{t("seriesNumber", { sequence: group.seriesSequence })}</span>);
    if (group.announce) parts.push(<span key="announce">{t("adminsOnly")}</span>);
    if (group.locked) {
      parts.push(
        <span key="locked" role="img" aria-label={t("locked")} title={t("locked")} className="inline-flex">
          <Lock className="h-3 w-3" weight="bold" />
        </span>,
      );
    }
  } else if (sub === "category" && category) {
    parts.push(<span key="category">{category}</span>);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <GroupAvatar group={{ subject: title, pictureUrl: group.pictureUrl }} size={size} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {href ? (
            <Link
              href={href}
              onClick={(event) => event.stopPropagation()}
              className="min-w-0 truncate rounded-sm text-xs font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={title}
            >
              {title}
            </Link>
          ) : (
            <span className="min-w-0 truncate text-xs font-semibold text-foreground" title={title}>
              {title}
            </span>
          )}
          {trailing}
        </div>
        {parts.length > 0 ? (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-2xs text-muted-foreground">
            {parts.map((part, index) => (
              <span key={index} className="inline-flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden>·</span> : null}
                {part}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GroupList({ groups, title }: { groups: GroupRef[]; title: string }) {
  const groupName = useGroupName();
  return (
    <>
      <p className="px-2 pb-1 text-2xs font-semibold text-muted-foreground">{title}</p>
      <ul className="max-h-60 space-y-0.5 overflow-y-auto">
        {groups.map((group) => (
          <li key={group.groupId}>
            <Link
              href={groupsRoutes.group(group.groupId)}
              className="block truncate rounded-[--radius] px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {groupName(group.subject)}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

const CHIP_TRIGGER =
  "inline-flex shrink-0 items-center gap-1 rounded-[--radius] border border-border bg-card px-1.5 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function GroupLinks({
  groups,
  limit = 3,
  excludeId,
  variant = "chips",
}: {
  groups: GroupRef[];
  limit?: number;
  excludeId?: string;
  variant?: "chips" | "badge";
}) {
  const t = useTranslations("unofficialGroups.kit.identity");
  const groupName = useGroupName();
  const visible = excludeId ? groups.filter((group) => group.groupId !== excludeId) : groups;
  if (visible.length === 0) return null;

  const popover = (trigger: ReactNode) => (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2" onClick={(event) => event.stopPropagation()}>
        <GroupList groups={visible} title={t("groupsTitle", { count: visible.length })} />
      </PopoverContent>
    </Popover>
  );

  if (variant === "badge") {
    return popover(
      <button type="button" onClick={(event) => event.stopPropagation()} className={CHIP_TRIGGER}>
        <UsersThree className="h-3 w-3" weight="bold" />
        {t("inGroups", { count: visible.length })}
      </button>,
    );
  }

  const shown = visible.slice(0, Math.max(0, limit));
  const hidden = visible.length - shown.length;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((group) => (
        <Link
          key={group.groupId}
          href={groupsRoutes.group(group.groupId)}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex max-w-[12rem] items-center rounded-[--radius] border border-border bg-muted px-2 py-0.5 text-2xs font-medium text-foreground transition-colors hover:bg-[hsl(var(--accent-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="truncate">{groupName(group.subject)}</span>
        </Link>
      ))}
      {hidden > 0
        ? popover(
            <button type="button" onClick={(event) => event.stopPropagation()} className={CHIP_TRIGGER} aria-label={t("moreGroupsLabel", { count: hidden })}>
              {t("moreGroups", { count: hidden })}
            </button>,
          )
        : null}
    </div>
  );
}

const ORIGIN_DOT: Record<GroupOrigin, string> = {
  managed: "hsl(var(--healthy))",
  external: "hsl(var(--warning))",
};

export function OriginChip({ origin, numbers }: { origin: GroupOrigin; numbers?: number }) {
  const t = useTranslations("unofficialGroups.kit.origin");
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <TooltipWrapper content={t(origin === "external" ? "externalHint" : "managedHint")}>
        <Chip dot={ORIGIN_DOT[origin]}>{t(origin)}</Chip>
      </TooltipWrapper>
      {numbers !== undefined ? <span className="readout text-2xs text-muted-foreground">{t("numbers", { count: numbers })}</span> : null}
    </span>
  );
}

export function MemberCountLabel({ count, className }: { count: number; className?: string }) {
  const t = useTranslations("unofficialGroups.kit.identity");
  return <span className={cn("readout", className)}>{t("memberCount", { count })}</span>;
}
