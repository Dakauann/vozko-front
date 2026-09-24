"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CircleNotch, FlowArrow, Robot, UserCirclePlus } from "@/components/icons";
import { useLocale } from "next-intl";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import type { HandBackTarget } from "@/lib/conversations/hand-back";
import { cn } from "@/lib/utils";
import {
  listAssignableMembersAction,
  type AssignableMember,
} from "@/app/actions/workspace";

const PAGE_SIZE = 20;
const NO_DEPARTMENT = "__none__";

const STRINGS = {
  pt: {
    tooltip: "Atribuir para",
    search: "Buscar membro...",
    empty: "Nenhum membro encontrado",
    noDepartment: "Sem departamento",
    current: "Atual",
    handBack: "Devolver para",
    adminHint:
      "Administradores aparecem quando participam da distribuição automática.",
  },
  en: {
    tooltip: "Assign to",
    search: "Search member...",
    empty: "No members found",
    noDepartment: "No department",
    current: "Current",
    handBack: "Hand back to",
    adminHint: "Admins appear when they take part in the automatic distribution.",
  },
  es: {
    tooltip: "Asignar a",
    search: "Buscar miembro...",
    empty: "Ningún miembro encontrado",
    noDepartment: "Sin departamento",
    current: "Actual",
    handBack: "Devolver a",
    adminHint:
      "Los administradores aparecen cuando participan en la distribución automática.",
  },
  de: {
    tooltip: "Zuweisen an",
    search: "Mitglied suchen...",
    empty: "Keine Mitglieder gefunden",
    noDepartment: "Ohne Abteilung",
    current: "Aktuell",
    handBack: "Zurückgeben an",
    adminHint:
      "Administratoren erscheinen, wenn sie an der automatischen Verteilung teilnehmen.",
  },
} as const;

type Strings = Record<keyof (typeof STRINGS)["en"], string>;

interface AssignMemberPickerProps {
  workspaceId: string;
  assignedUserId?: string | null;
  onlineUserIds?: Set<string>;
  onAssign: (userId: string) => void;
  /** The agent or workflow a person's conversation can go back to, if any. */
  handBack?: HandBackTarget | null;
  onHandBack?: () => void;
}

function displayName(m: AssignableMember): string {
  return m.username?.trim() || m.email?.trim() || m.userId;
}

export default function AssignMemberPicker({
  workspaceId,
  assignedUserId,
  onlineUserIds,
  onAssign,
  handBack,
  onHandBack,
}: AssignMemberPickerProps) {
  const locale = useLocale();
  const tx: Strings = STRINGS[locale as keyof typeof STRINGS] ?? STRINGS.en;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(
    async (pageToLoad: number, q: string, replace: boolean) => {
      if (!workspaceId) return;
      const reqId = ++reqRef.current;
      setLoading(true);
      const res = await listAssignableMembersAction(workspaceId, {
        search: q,
        page: pageToLoad,
        pageSize: PAGE_SIZE,
      });
      if (reqId !== reqRef.current) return;
      setTotalPages(res.totalPages || 1);
      setPage(res.page || pageToLoad);
      setMembers((prev) => (replace ? res.members : [...prev, ...res.members]));
      setLoading(false);
    },
    [workspaceId],
  );

  useEffect(() => {
    if (!open) return;
    fetchPage(1, query, true);
  }, [open, query, fetchPage]);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setSearch("");
      setQuery("");
      setMembers([]);
      setPage(1);
      setTotalPages(1);
    }
  }, []);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loading || page >= totalPages) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
      fetchPage(page + 1, query, false);
    }
  }, [loading, page, totalPages, query, fetchPage]);

  const { groups, hasDepartments } = useMemo(() => {
    const withDepts = members.some((m) => (m.departments?.length ?? 0) > 0);
    if (!withDepts) {
      return {
        groups: [{ id: NO_DEPARTMENT, name: "", members }],
        hasDepartments: false,
      };
    }
    const order: string[] = [];
    const byDept = new Map<
      string,
      { id: string; name: string; members: AssignableMember[] }
    >();
    const ensure = (id: string, name: string) => {
      let bucket = byDept.get(id);
      if (!bucket) {
        bucket = { id, name, members: [] };
        byDept.set(id, bucket);
        order.push(id);
      }
      return bucket;
    };
    for (const m of members) {
      if (m.departments && m.departments.length > 0) {
        for (const d of m.departments) ensure(d.id, d.name).members.push(m);
      } else {
        ensure(NO_DEPARTMENT, tx.noDepartment).members.push(m);
      }
    }
    return { groups: order.map((id) => byDept.get(id)!), hasDepartments: true };
  }, [members, tx.noDepartment]);

  const handleSelect = useCallback(
    (userId: string) => {
      onAssign(userId);
      setOpen(false);
    },
    [onAssign],
  );

  const handleHandBack = useCallback(() => {
    setOpen(false);
    onHandBack?.();
  }, [onHandBack]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <TooltipWrapper content={tx.tooltip}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center h-8 w-8 rounded-full transition-all duration-200",
              assignedUserId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <UserCirclePlus
              weight={assignedUserId ? "fill" : "regular"}
              className="h-4 w-4"
            />
          </button>
        </PopoverTrigger>
      </TooltipWrapper>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-64 rounded-[--radius] border border-border bg-card p-0 shadow-2xl"
      >
        <Command
          shouldFilter={false}
          className="rounded-[--radius] bg-transparent text-foreground"
        >
          <CommandInput
            placeholder={tx.search}
            value={search}
            onValueChange={setSearch}
            className="text-sm"
          />
          <CommandList ref={listRef} onScroll={handleScroll} className="max-h-64">
            {handBack && onHandBack ? (
              <CommandGroup>
                <CommandItem
                  value="__hand_back__"
                  onSelect={handleHandBack}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs text-foreground data-[selected=true]:bg-muted data-[selected=true]:font-medium"
                >
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground">
                    {handBack.kind === "workflow" ? (
                      <FlowArrow weight="fill" className="h-3.5 w-3.5" />
                    ) : (
                      <Robot weight="fill" className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="flex-1 truncate">
                    {tx.handBack} {handBack.name}
                  </span>
                </CommandItem>
              </CommandGroup>
            ) : null}
            {members.length === 0 && !loading ? (
              <CommandEmpty>{tx.empty}</CommandEmpty>
            ) : null}
            {groups.map((group) => (
              <CommandGroup key={group.id} heading={group.name || undefined}>
                {group.members.map((m) => {
                  const isOnline = onlineUserIds?.has(m.userId) ?? false;
                  const isAssigned = assignedUserId === m.userId;
                  const name = displayName(m);
                  return (
                    <CommandItem
                      key={`${group.id}-${m.userId}`}
                      value={`${group.id}-${m.userId}-${name}`}
                      onSelect={() => handleSelect(m.userId)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs",
                        "data-[selected=true]:bg-muted data-[selected=true]:font-medium data-[selected=true]:text-foreground",
                        isAssigned ? "text-primary-ink" : "text-foreground",
                      )}
                    >
                      <div className="relative flex-shrink-0">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-2xs font-semibold uppercase">
                          {name.charAt(0)}
                        </div>
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-healthy ring-1 ring-card" />
                        )}
                      </div>
                      <span className="flex-1 truncate">{name}</span>
                      {isAssigned && (
                        <span className="ml-auto flex-shrink-0 text-2xs font-semibold text-primary-ink">
                          {tx.current}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
            {loading && (
              <div className="flex items-center justify-center py-3">
                <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </CommandList>
        </Command>
        {hasDepartments && (
          <p className="border-t border-border px-3 py-2 text-2xs leading-snug text-muted-foreground">
            {tx.adminHint}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
