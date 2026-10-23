"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { CircleNotch, FlowArrow, Robot, UserCirclePlus } from "@/components/icons";
import { useLocale } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";

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
import { listDelegationTargetsAction } from "@/app/actions/conversations";
import { ownerOf, type DelegationTarget } from "@/lib/conversations/delegation";

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
    automations: "Automações",
    agents: "Agentes",
    operators: "Operadores",
    searchAutomation: "Buscar automação...",
    searchAgent: "Buscar agente...",
    noResults: "Nenhum resultado encontrado",
    loadFailed: "Não foi possível carregar. Tente novamente.",
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
    automations: "Automations",
    agents: "Agents",
    operators: "Operators",
    searchAutomation: "Search automation...",
    searchAgent: "Search agent...",
    noResults: "No results found",
    loadFailed: "Could not load. Please try again.",
    adminHint: "Admins appear when they take part in the automatic distribution.",
  },
  es: {
    tooltip: "Asignar a",
    search: "Buscar miembro...",
    empty: "Ningún miembro encontrado",
    noDepartment: "Sin departamento",
    current: "Actual",
    handBack: "Devolver a",
    automations: "Automatizaciones",
    agents: "Agentes",
    operators: "Operadores",
    searchAutomation: "Buscar automatización...",
    searchAgent: "Buscar agente...",
    noResults: "No se encontraron resultados",
    loadFailed: "No se pudo cargar. Inténtalo de nuevo.",
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
    automations: "Automatisierungen",
    agents: "Agenten",
    operators: "Mitarbeiter",
    searchAutomation: "Automatisierung suchen...",
    searchAgent: "Agent suchen...",
    noResults: "Keine Ergebnisse gefunden",
    loadFailed: "Laden fehlgeschlagen. Bitte erneut versuchen.",
    adminHint:
      "Administratoren erscheinen, wenn sie an der automatischen Verteilung teilnehmen.",
  },
} as const;

type Strings = Record<keyof (typeof STRINGS)["en"], string>;
type PickerTab = "workflow" | "agent" | "operators";

interface AssignMemberPickerProps {
  workspaceId: string;
  assignedUserId?: string | null;
  onlineUserIds?: Set<string>;
  onAssign: (userId: string) => void;
  handBack?: HandBackTarget | null;
  onHandBack?: () => void;
  canAssignMembers?: boolean;
  onDelegate?: (target: DelegationTarget) => void;
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
  canAssignMembers = true,
  onDelegate,
}: AssignMemberPickerProps) {
  const locale = useLocale();
  const tx: Strings = STRINGS[locale as keyof typeof STRINGS] ?? STRINGS.en;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PickerTab>(onDelegate ? "workflow" : "operators");
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), 250);
  const listRef = useRef<HTMLDivElement>(null);
  const memberQuery = useInfiniteQuery({
    queryKey: ["assignable-conversation-members", workspaceId, query],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const result = await listAssignableMembersAction(workspaceId, { search: query, page: pageParam, pageSize: PAGE_SIZE });
      if (result.error) throw new Error(result.error);
      return result;
    },
    getNextPageParam: (last) => last.page < last.totalPages ? last.page + 1 : undefined,
    enabled: open && tab === "operators" && canAssignMembers && Boolean(workspaceId),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const targetQuery = useQuery({
    queryKey: ["conversation-delegation-targets", workspaceId, query],
    queryFn: () => listDelegationTargetsAction(query),
    enabled: open && tab !== "operators" && Boolean(onDelegate) && Boolean(workspaceId),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const members = useMemo(() => memberQuery.data?.pages.flatMap((page) => page.members) ?? [], [memberQuery.data]);
  const targets = targetQuery.data ?? [];
  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) {
      setTab(onDelegate ? assignedUserId?.startsWith("ai:") ? "agent" : assignedUserId?.startsWith("workflow:") || !canAssignMembers ? "workflow" : "operators" : "operators");
      setSearch("");
    }
  }, [onDelegate, assignedUserId, canAssignMembers]);

  const handleScroll = () => {
    const el = listRef.current;
    if (tab !== "operators" || !el || memberQuery.isFetching || !memberQuery.hasNextPage) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) void memberQuery.fetchNextPage();
  };
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

  const handleDelegate = useCallback(
    (target: DelegationTarget) => {
      onDelegate?.(target);
      setOpen(false);
    },
    [onDelegate],
  );

  const handleHandBack = useCallback(() => {
    setOpen(false);
    onHandBack?.();
  }, [onHandBack]);

  const visibleTargets = targets.filter((target) => target.kind === tab);
  const busy = tab === "operators" ? memberQuery.isFetching : targetQuery.isFetching;
  const failed = tab === "operators" ? memberQuery.isError : targetQuery.isError;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <TooltipWrapper content={tx.tooltip}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={tx.tooltip}
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
        className="w-[340px] max-w-[calc(100vw-2rem)] rounded-[--radius] border border-border bg-card p-0 shadow-2xl"
      >
        <Tabs value={tab} onValueChange={(value) => setTab(value as PickerTab)}>
          <TabsList aria-label={tx.tooltip} className="grid grid-cols-3 gap-0 px-1.5 pt-1">
            <TabsTrigger value="workflow" disabled={!onDelegate} className="min-w-0 px-1.5 text-xs">{tx.automations}</TabsTrigger>
            <TabsTrigger value="agent" disabled={!onDelegate} className="min-w-0 px-1.5 text-xs">{tx.agents}</TabsTrigger>
            <TabsTrigger value="operators" disabled={!canAssignMembers} className="min-w-0 px-1.5 text-xs">{tx.operators}</TabsTrigger>
          </TabsList>
          <TabsContent key={tab} value={tab} className="mt-0">
        <Command
          shouldFilter={false}
          className="rounded-[--radius] bg-transparent text-foreground"
        >
          <CommandInput
            placeholder={tab === "workflow" ? tx.searchAutomation : tab === "agent" ? tx.searchAgent : tx.search}
            value={search}
            onValueChange={setSearch}
            className="text-sm"
          />
          <CommandList ref={listRef} onScroll={handleScroll} className="max-h-64">
            {handBack && onHandBack && handBack.kind === tab ? (
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
            {!failed && onDelegate && visibleTargets.length > 0 ? (
              <CommandGroup>
                {visibleTargets.map((target) => {
                  const isAssigned = assignedUserId === ownerOf(target);
                  return (
                    <CommandItem
                      key={`${target.kind}-${target.id}`}
                      value={`automation-${target.kind}-${target.id}-${target.name}`}
                      onSelect={() => handleDelegate(target)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs",
                        "data-[selected=true]:bg-muted data-[selected=true]:font-medium data-[selected=true]:text-foreground",
                        isAssigned ? "text-primary-ink" : "text-foreground",
                      )}
                    >
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {target.kind === "workflow" ? (
                          <FlowArrow className="h-3.5 w-3.5" />
                        ) : (
                          <Robot className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="flex-1 truncate">{target.name}</span>
                      {isAssigned && (
                        <span className="ml-auto flex-shrink-0 text-2xs font-semibold text-primary-ink">
                          {tx.current}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}
            {failed ? <p role="alert" className="px-3 py-4 text-center text-xs text-destructive-ink">{tx.loadFailed}</p> : null}
            {!failed && !busy && (tab === "operators" ? members.length === 0 : visibleTargets.length === 0) ? (
              <CommandEmpty>{tx.noResults}</CommandEmpty>
            ) : null}
            {!failed && tab === "operators" && groups.map((group) => (
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
            {busy && (
              <div className="flex items-center justify-center py-3">
                <CircleNotch className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </CommandList>
        </Command>
          </TabsContent>
        </Tabs>
        {tab === "operators" && hasDepartments && (
          <p className="border-t border-border px-3 py-2 text-2xs leading-snug text-muted-foreground">
            {tx.adminHint}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
