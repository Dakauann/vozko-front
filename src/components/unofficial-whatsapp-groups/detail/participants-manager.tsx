"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  addGroupMembersToLeadsAction,
  exportGroupMembersAction,
  listGroupMembersAction,
  manageGroupMembersAction,
} from "@/app/actions/unofficial-whatsapp-groups";
import { Chip } from "@/components/audience/shared";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { DashboardTable, type DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ArrowClockwise, Crown, DotsThree, DownloadSimple, UserMinus, UserPlus, Users, UsersThree } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { Link } from "@/i18n/routing";
import type { GroupMember, MemberAction, MemberCounts, NumberSeat, PageMeta, WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";

import { useTableEmpty } from "../kit/empty";
import { ActiveFilterChips, SearchField, WindowToggle, type ActiveFilter } from "../kit/filters";
import { jidLocal, personName } from "../kit/format";
import { PersonIdentity } from "../kit/identity";
import { NoAdminSeatNotice } from "../kit/notices";
import { groupsRoutes, type MemberStatusFilter } from "../kit/routes";
import { useGroupsFormat } from "../kit/use-groups-format";
import { AddParticipantsDialog } from "./add-participants-dialog";
import {
  DEFAULT_MEMBER_FILTERS,
  bulkTargets,
  hasAdminSeat,
  isAdminRefusal,
  isFiltered,
  memberMenu,
  memberQuery,
  type MemberFilters,
  type MemberLeadFilter,
} from "./detail-model";
import { useGroupPermissions } from "./use-group-permissions";

export const MEMBER_PAGE_SIZES = [20, 50, 100] as const;

const EMPTY_META: PageMeta = { page: 1, pageSize: MEMBER_PAGE_SIZES[0], totalPages: 0, totalItems: 0 };

type WhatsAppAction = Exclude<MemberAction, "add">;

interface LoadedPage {
  key: string;
  rows: GroupMember[];
  meta: PageMeta;
  error: string | null;
}

interface PendingRemoval {
  members: GroupMember[];
  participants: string[];
}

interface ParticipantsManagerProps {
  group: WorkspaceGroup;
  seats: NumberSeat[];
  mode: "browse" | "manage";
  pageSize: number;
  counts: MemberCounts;
  filters: MemberFilters;
  onFiltersChange: (filters: MemberFilters) => void;
  onChanged: () => void;
  hideAdminNotice?: boolean;
}

export function ParticipantsManager({
  group,
  seats,
  mode,
  pageSize: initialPageSize,
  counts,
  filters,
  onFiltersChange,
  onChanged,
  hideAdminNotice = false,
}: ParticipantsManagerProps) {
  const t = useTranslations("unofficialGroups.detail.participants");
  const tMembers = useTranslations("unofficialGroups.detail.members");
  const tRole = useTranslations("unofficialGroups.common.role");
  const tNoAdmin = useTranslations("unofficialGroups.kit.notices.noAdmin");
  const tk = useTranslations("unofficialGroups.kit");
  const fmt = useGroupsFormat();
  const tableEmpty = useTableEmpty();
  const permissions = useGroupPermissions();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<LoadedPage | null>(null);
  const [selected, setSelected] = useState<Map<string, GroupMember>>(new Map());
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removal, setRemoval] = useState<PendingRemoval | null>(null);
  const [filterSignature, setFilterSignature] = useState(() => JSON.stringify(filters));

  const signature = JSON.stringify(filters);
  if (signature !== filterSignature) {
    setFilterSignature(signature);
    setPage(1);
  }

  const followed = Boolean(group.followedAt);
  const adminReady = hasAdminSeat(seats) && !refused;
  const grants = useMemo(
    () => ({ update: permissions.update, remove: permissions.removeMembers, addLeads: permissions.addLeads }),
    [permissions.update, permissions.removeMembers, permissions.addLeads],
  );
  const canManage = permissions.update || permissions.removeMembers;
  const noAdminReason = tNoAdmin("manage");

  const query = useMemo(() => memberQuery(filters, page, pageSize), [filters, page, pageSize]);
  const queryKey = `${group.id}|${JSON.stringify(query)}|${reloadKey}`;
  const loading = loaded?.key !== queryKey;
  const rows = useMemo(() => loaded?.rows ?? [], [loaded]);
  const meta = loaded?.meta ?? EMPTY_META;
  const error = loaded?.error ?? null;

  useEffect(() => {
    let cancelled = false;
    void listGroupMembersAction(group.id, query).then((result) => {
      if (cancelled) return;
      setLoaded({ key: queryKey, rows: result.items, meta: result.meta, error: result.error ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [group.id, query, queryKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const change = useCallback((patch: Partial<MemberFilters>) => onFiltersChange({ ...filters, ...patch }), [filters, onFiltersChange]);

  const afterChange = useCallback(() => {
    setSelected(new Map());
    reload();
    onChanged();
  }, [reload, onChanged]);

  const runAction = useCallback(
    async (action: WhatsAppAction, participants: string[]) => {
      if (participants.length === 0) return false;
      setBusy(true);
      const result = await manageGroupMembersAction(group.id, action, participants);
      setBusy(false);
      if (result.error) {
        if (isAdminRefusal(result.error)) {
          setRefused(true);
          toast.error(noAdminReason);
        } else {
          toast.error(t(`manage.failed.${action}`), { description: result.error });
        }
        return false;
      }
      toast(t(`manage.done.${action}`, { count: participants.length }));
      afterChange();
      return true;
    },
    [group.id, noAdminReason, t, afterChange],
  );

  const addToLeads = useCallback(
    async (members: GroupMember[]) => {
      const keys = members.map((member) => member.personKey);
      if (keys.length === 0) return;
      setBusy(true);
      const result = await addGroupMembersToLeadsAction(group.id, keys);
      setBusy(false);
      if (result.error || !result.data) {
        toast.error(tMembers("leads.failed"), { description: result.error });
        return;
      }
      toast(tMembers("leads.done"), {
        description: tMembers("leads.result", {
          linked: result.data.linked,
          alreadyLinked: result.data.alreadyLinked,
          withoutPhone: result.data.withoutPhone,
        }),
      });
      afterChange();
    },
    [group.id, tMembers, afterChange],
  );

  const exportMembers = useCallback(async () => {
    setBusy(true);
    const result = await exportGroupMembersAction(group.id);
    setBusy(false);
    if (result.error) toast.error(tMembers("exportFailed"), { description: result.error });
  }, [group.id, tMembers]);

  const askRemoval = useCallback((members: GroupMember[]) => {
    const participants = bulkTargets(members, "remove");
    if (participants.length > 0) setRemoval({ members: members.filter((member) => participants.includes(member.jid)), participants });
  }, []);

  const nameOf = useCallback((member: GroupMember) => personName(member).label || tk("unnamedPerson"), [tk]);

  const renderMenu = useCallback(
    (member: GroupMember) => {
      const menu = memberMenu(member, grants);
      const whatsApp = menu.promote || menu.demote || menu.remove;
      if (!whatsApp && !menu.addLead) return null;
      const lock = !adminReady || busy;
      return (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              aria-label={t("menu.label", { name: nameOf(member) })}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <DotsThree className="h-4 w-4" weight="bold" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[13rem]" onClick={(event) => event.stopPropagation()}>
            {whatsApp && !adminReady ? <p className="max-w-[16rem] px-2.5 py-1.5 text-2xs text-muted-foreground">{noAdminReason}</p> : null}
            {menu.promote ? (
              <DropdownMenuItem disabled={lock} onSelect={() => void runAction("promote", [member.jid])}>
                <Crown className="mr-2 h-4 w-4" />
                {t("menu.promote")}
              </DropdownMenuItem>
            ) : null}
            {menu.demote ? (
              <DropdownMenuItem disabled={lock} onSelect={() => void runAction("demote", [member.jid])}>
                <Crown className="mr-2 h-4 w-4" />
                {t("menu.demote")}
              </DropdownMenuItem>
            ) : null}
            {menu.addLead ? (
              <DropdownMenuItem disabled={busy} onSelect={() => void addToLeads([member])}>
                <UserPlus className="mr-2 h-4 w-4" />
                {tMembers("leads.add")}
              </DropdownMenuItem>
            ) : null}
            {menu.remove ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={lock}
                  className="text-destructive-ink"
                  onSelect={() => askRemoval([member])}
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  {t("menu.remove")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    [grants, adminReady, busy, t, tMembers, nameOf, noAdminReason, runAction, addToLeads, askRemoval],
  );

  const columns = useMemo<DashboardTableColumn<GroupMember>[]>(() => {
    const identity: DashboardTableColumn<GroupMember> = {
      key: "member",
      header: t("columns.member"),
      render: (member) => <PersonIdentity person={member} ourNumber={member.ourNumber} />,
    };
    const role: DashboardTableColumn<GroupMember> = {
      key: "role",
      header: tMembers("columns.role"),
      render: (member) =>
        member.role === "member" ? (
          <span className="text-xs text-muted-foreground">{tRole("member")}</span>
        ) : (
          <Chip>
            <Crown className="h-3 w-3 text-muted-foreground" weight="bold" aria-hidden />
            {tRole(member.role)}
          </Chip>
        ),
    };
    const status: DashboardTableColumn<GroupMember> = {
      key: "status",
      header: t("columns.status"),
      render: (member) =>
        member.status === "active" ? <StatusChip tone="healthy" label={t("status.active")} /> : <StatusChip tone="muted" label={t("status.left")} />,
    };
    if (mode === "manage") return [identity, role, status];
    return [
      identity,
      role,
      status,
      {
        key: "joinedAt",
        header: tMembers("columns.joinedAt"),
        render: (member) =>
          member.joinedAt ? (
            <span className="readout whitespace-nowrap text-xs tabular-nums text-muted-foreground" title={fmt.dateTime(member.joinedAt)}>
              {fmt.date(member.joinedAt)}
            </span>
          ) : (
            <EmptyValue className="text-xs" />
          ),
      },
      {
        key: "leftAt",
        header: tMembers("columns.leftAt"),
        render: (member) =>
          member.leftAt ? (
            <span className="readout whitespace-nowrap text-xs tabular-nums text-muted-foreground" title={fmt.dateTime(member.leftAt)}>
              {fmt.date(member.leftAt)}
            </span>
          ) : (
            <EmptyValue className="text-xs" />
          ),
      },
      {
        key: "lead",
        header: tMembers("columns.lead"),
        render: (member) =>
          member.leadId ? (
            <Link
              href={groupsRoutes.lead(member.leadId)}
              onClick={(event) => event.stopPropagation()}
              className="block max-w-[12rem] truncate text-xs text-foreground underline-offset-2 hover:underline focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {member.leadName || tMembers("openLead")}
            </Link>
          ) : (
            <EmptyValue className="text-xs" />
          ),
      },
      {
        key: "otherGroups",
        header: tMembers("columns.otherGroups"),
        className: "text-right",
        render: (member) =>
          member.otherGroups > 0 ? (
            <Link
              href={groupsRoutes.people({ search: member.phone ?? jidLocal(member.jid) })}
              onClick={(event) => event.stopPropagation()}
              title={t("otherGroupsHint")}
              className="readout text-xs font-semibold tabular-nums text-foreground underline-offset-2 hover:underline focus-visible:rounded-[--radius] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {fmt.num(member.otherGroups)}
            </Link>
          ) : (
            <span className="readout text-xs tabular-nums text-muted-foreground">{fmt.num(0)}</span>
          ),
      },
    ];
  }, [mode, t, tMembers, tRole, fmt]);

  const statusOptions: { value: MemberStatusFilter; label: string }[] = [
    { value: "active", label: t("filters.active", { count: counts.active }) },
    { value: "left", label: t("filters.left", { count: counts.left30d }) },
    { value: "all", label: t("filters.all") },
  ];
  const leadOptions: { value: MemberLeadFilter; label: string }[] = [
    { value: "all", label: t("filters.anyLead") },
    { value: "with", label: tMembers("filters.withLead") },
    { value: "without", label: tMembers("filters.withoutLead") },
  ];

  const activeFilters: ActiveFilter[] = [
    ...(filters.search.trim() ? [{ key: "search", label: t("chips.search", { text: filters.search.trim() }), onClear: () => change({ search: "" }) }] : []),
    ...(filters.status !== DEFAULT_MEMBER_FILTERS.status
      ? [{ key: "status", label: statusOptions.find((option) => option.value === filters.status)?.label ?? "", onClear: () => change({ status: DEFAULT_MEMBER_FILTERS.status }) }]
      : []),
    ...(filters.lead !== "all"
      ? [{ key: "lead", label: leadOptions.find((option) => option.value === filters.lead)?.label ?? "", onClear: () => change({ lead: "all" }) }]
      : []),
    ...(filters.adminsOnly ? [{ key: "admins", label: tMembers("filters.adminsOnly"), onClear: () => change({ adminsOnly: false }) }] : []),
    ...(filters.inOtherOnly ? [{ key: "other", label: t("filters.inOther"), onClear: () => change({ inOtherOnly: false }) }] : []),
  ];

  const narrowed = isFiltered(filters);
  const picked = [...selected.values()];
  const promoteTargets = bulkTargets(picked, "promote");
  const demoteTargets = bulkTargets(picked, "demote");
  const removeTargets = bulkTargets(picked, "remove");
  const leadTargets = picked.filter((member) => memberMenu(member, grants).addLead);
  const hasBulk = permissions.addLeads || canManage;

  const bulkButton = (label: string, count: number, onClick: () => void, needsAdmin: boolean, icon: ReactNode) => {
    const blocked = needsAdmin && !adminReady;
    const button = (
      <Button variant="secondary" size="sm" title={t("bulk.withCount", { label, count })} icon={icon} iconVisible disabled={busy || count === 0 || blocked} onClick={onClick} />
    );
    return blocked ? <TooltipWrapper content={noAdminReason}>{button}</TooltipWrapper> : button;
  };

  const emptyState = error
    ? tableEmpty.error(tMembers("error"), reload)
    : !followed
      ? tableEmpty.firstUse({ icon: <Users className="h-7 w-7 opacity-40" />, title: t("empty.notFollowed") })
      : narrowed
        ? tableEmpty.noMatches(t("noun"), () => onFiltersChange(DEFAULT_MEMBER_FILTERS))
        : tableEmpty.firstUse({ icon: <Users className="h-7 w-7 opacity-40" />, title: tMembers("empty.title"), description: tMembers("empty.text") });

  return (
    <div className="space-y-3">
      {canManage && (refused || (!hasAdminSeat(seats) && !hideAdminNotice)) ? <NoAdminSeatNotice action="manage" /> : null}
      <DashboardTable<GroupMember>
        data={rows}
        columns={columns}
        rowKey={(member) => member.personKey}
        loading={loading && rows.length === 0}
        rowClassName={(member) => (member.status === "left" ? "text-muted-foreground [&_.text-foreground]:text-muted-foreground" : "")}
        stats={
          mode === "browse"
            ? [
                { label: t("stats.result"), value: loading ? "…" : fmt.num(meta.totalItems) },
                { label: t("stats.active"), value: fmt.num(counts.active) },
                { label: t("stats.left"), value: fmt.num(counts.left30d) },
                { label: t("stats.withLead"), value: fmt.num(counts.withLead) },
                { label: t("stats.hidden"), value: fmt.num(counts.hidden) },
              ]
            : [{ label: t("stats.result"), value: loading ? "…" : fmt.num(meta.totalItems) }]
        }
        headerLeft={
          <SearchField value={filters.search} onChange={(search) => change({ search })} placeholder={t("search")} ariaLabel={t("search")} />
        }
        headerRight={
          <>
            <Button
              variant="ghost"
              aria-label={tMembers("refresh")}
              icon={<ArrowClockwise className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} weight="bold" />}
              iconVisible
              onClick={reload}
              disabled={loading}
            />
            {mode === "browse" && permissions.exportMembers ? (
              <Button variant="secondary" title={t("exportCsv")} icon={<DownloadSimple className="h-4 w-4" weight="bold" />} iconVisible disabled={busy} onClick={() => void exportMembers()} />
            ) : null}
            {permissions.update ? (
              adminReady ? (
                <Button
                  variant="primary"
                  title={mode === "manage" ? t("addByPhone") : t("add")}
                  icon={<UserPlus className="h-4 w-4" weight="bold" />}
                  iconVisible
                  disabled={busy}
                  onClick={() => setAdding(true)}
                />
              ) : (
                <TooltipWrapper content={noAdminReason}>
                  <Button variant="primary" title={mode === "manage" ? t("addByPhone") : t("add")} icon={<UserPlus className="h-4 w-4" weight="bold" />} iconVisible disabled />
                </TooltipWrapper>
              )
            ) : null}
          </>
        }
        toolbar={
          <div className="flex w-full flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              {mode === "browse" ? (
                <>
                  <WindowToggle ariaLabel={tMembers("filters.status")} options={statusOptions} value={filters.status} onChange={(status) => change({ status })} />
                  <WindowToggle ariaLabel={tMembers("filters.lead")} options={leadOptions} value={filters.lead} onChange={(lead) => change({ lead })} />
                </>
              ) : null}
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-foreground">
                <Checkbox checked={filters.adminsOnly} onCheckedChange={(checked) => change({ adminsOnly: checked === true })} />
                {tMembers("filters.adminsOnly")}
              </label>
              {mode === "browse" ? (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <Checkbox checked={filters.inOtherOnly} onCheckedChange={(checked) => change({ inOtherOnly: checked === true })} />
                  {t("filters.inOther")}
                </label>
              ) : null}
            </div>
            <ActiveFilterChips
              filters={activeFilters}
              onClearAll={() => onFiltersChange(DEFAULT_MEMBER_FILTERS)}
              resultLabel={loading ? undefined : t("resultLabel", { count: meta.totalItems })}
            />
          </div>
        }
        renderRowActions={renderMenu}
        selection={
          hasBulk
            ? {
                selectedKeys: new Set(selected.keys()),
                onSelectionChange: (keys) => {
                  setSelected((current) => {
                    const next = new Map<string, GroupMember>();
                    for (const key of keys) {
                      const member = current.get(key) ?? rows.find((row) => row.personKey === key);
                      if (member) next.set(key, member);
                    }
                    return next;
                  });
                },
                label: (count) => tMembers("selected", { count }),
                actions: () => (
                  <div className="flex flex-wrap items-center gap-2">
                    {permissions.addLeads
                      ? bulkButton(tMembers("leads.add"), leadTargets.length, () => void addToLeads(leadTargets), false, <UserPlus className="h-4 w-4" />)
                      : null}
                    {permissions.update ? bulkButton(t("bulk.promote"), promoteTargets.length, () => void runAction("promote", promoteTargets), true, <Crown className="h-4 w-4" />) : null}
                    {permissions.update ? bulkButton(t("bulk.demote"), demoteTargets.length, () => void runAction("demote", demoteTargets), true, <Crown className="h-4 w-4" />) : null}
                    {permissions.removeMembers ? bulkButton(t("bulk.remove"), removeTargets.length, () => askRemoval(picked), true, <UserMinus className="h-4 w-4" />) : null}
                    <Button variant="ghost" size="sm" title={tMembers("clearSelection")} onClick={() => setSelected(new Map())} />
                  </div>
                ),
              }
            : undefined
        }
        pagination={{
          currentPage: page,
          totalPages: meta.totalPages,
          pageSize,
          totalItems: meta.totalItems,
          onPageChange: setPage,
          pageSizeOptions: MEMBER_PAGE_SIZES,
          onPageSizeChange: (size) => {
            setPageSize(size);
            setPage(1);
          },
        }}
        emptyState={emptyState}
      />

      <ConfirmDialog
        open={removal !== null}
        onOpenChange={(open) => {
          if (!open) setRemoval(null);
        }}
        icon={<UsersThree size={28} />}
        title={t("remove.title")}
        description={
          removal && removal.members.length === 1
            ? t("remove.one", { name: nameOf(removal.members[0]) })
            : t("remove.many", { count: removal?.participants.length ?? 0 })
        }
        confirmLabel={t("remove.confirm")}
        onConfirm={async () => {
          if (!removal) return;
          await runAction("remove", removal.participants);
          setRemoval(null);
        }}
      />

      {permissions.update ? (
        <AddParticipantsDialog
          groupId={group.id}
          open={adding}
          onOpenChange={setAdding}
          onDone={() => {
            setAdding(false);
            afterChange();
          }}
          onRefused={() => setRefused(true)}
        />
      ) : null}
    </div>
  );
}
