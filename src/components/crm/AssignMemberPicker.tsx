"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CircleNotch, UserCirclePlus } from "@/components/icons";
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
import { cn } from "@/lib/utils";
import {
  listAssignableMembersAction,
  type AssignableMember,
} from "@/app/actions/workspace";

const PAGE_SIZE = 20;
const NO_DEPARTMENT = "__none__";

// Self-contained 4-language strings (pt/en/es/de) so the picker always renders
// in the active locale without depending on the shared message tree.
const STRINGS = {
  pt: {
    tooltip: "Atribuir para",
    search: "Buscar membro...",
    empty: "Nenhum membro encontrado",
    noDepartment: "Sem departamento",
    current: "Atual",
    adminHint:
      "Administradores aparecem quando participam da distribuição automática.",
  },
  en: {
    tooltip: "Assign to",
    search: "Search member...",
    empty: "No members found",
    noDepartment: "No department",
    current: "Current",
    adminHint: "Admins appear when they take part in the automatic distribution.",
  },
  es: {
    tooltip: "Asignar a",
    search: "Buscar miembro...",
    empty: "Ningún miembro encontrado",
    noDepartment: "Sin departamento",
    current: "Actual",
    adminHint:
      "Los administradores aparecen cuando participan en la distribución automática.",
  },
  de: {
    tooltip: "Zuweisen an",
    search: "Mitglied suchen...",
    empty: "Keine Mitglieder gefunden",
    noDepartment: "Ohne Abteilung",
    current: "Aktuell",
    adminHint:
      "Administratoren erscheinen, wenn sie an der automatischen Verteilung teilnehmen.",
  },
} as const;

// Widen the literal values to `string` so every locale's object (pt/es/de carry
// different literals under `as const`) is assignable, not just the en shape.
type Strings = Record<keyof (typeof STRINGS)["en"], string>;

interface AssignMemberPickerProps {
  workspaceId: string;
  assignedUserId?: string | null;
  onlineUserIds?: Set<string>;
  onAssign: (userId: string) => void;
}

function displayName(m: AssignableMember): string {
  return m.username?.trim() || m.email?.trim() || m.userId;
}

export default function AssignMemberPicker({
  workspaceId,
  assignedUserId,
  onlineUserIds,
  onAssign,
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

  // Debounce the raw search input into the query that actually hits the server.
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
      if (reqId !== reqRef.current) return; // a newer request superseded this one
      setTotalPages(res.totalPages || 1);
      setPage(res.page || pageToLoad);
      setMembers((prev) => (replace ? res.members : [...prev, ...res.members]));
      setLoading(false);
    },
    [workspaceId],
  );

  // (Re)load the first page whenever the picker opens or the query changes.
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

  // Bucket members by department. A member in several departments appears under
  // each; when no department info is present (workspace without departments)
  // everything renders as a single flat group.
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
