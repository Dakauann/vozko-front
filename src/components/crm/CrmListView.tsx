"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { toast } from "sonner";

import { assigneeKind } from "@/lib/conversations/assignee";

import {
  ArrowsClockwise,
  ArrowsLeftRight,
  ChatCircleDots,
  Headset,
  Stack,
  Tag,
  UsersThree,
  WhatsappLogo,
  X,
} from "@/components/icons";

import {
  DashboardTable,
  type DashboardTableColumn,
} from "@/components/elevated-design/table/dashboard-table";
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
import ElevatedButton from "@/components/elevated-design/button";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import AssignMemberPicker from "@/components/crm/AssignMemberPicker";
import MoveToFunnelDialog from "@/components/crm/MoveToFunnelDialog";
import type { FunnelStages } from "@/app/actions/stages";

import { getCrmEntriesAction, crmBulkAction } from "@/app/actions/crm-board";
import { getBatchEntryStagesAction } from "@/app/actions/stages";
import { listAssignableMembersAction, type AssignableMember } from "@/app/actions/workspace";
import { encodeFilterParam, type CrmBoardEntry, type CrmBulkActionType, type CrmFilter } from "@/lib/crm/board";
import type { EntryStage, EntryType, Label, Stage } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

interface ChannelMeta {
  label: string;
  icon: React.ReactNode;
  tile: string;
}

function channelMeta(entryType: string): ChannelMeta {
  switch (entryType) {
    case "whatsapp":
      return {
        label: "WhatsApp",
        icon: <WhatsappLogo weight="fill" className="h-3.5 w-3.5 text-white" />,
        tile: "bg-[#25d366] text-white",
      };
    case "support":
      return {
        label: "Suporte",
        icon: <Headset weight="fill" className="h-3.5 w-3.5 text-white" />,
        tile: "bg-foreground/80 text-background",
      };
    default:
      return {
        label: entryType || "—",
        icon: <ChatCircleDots weight="fill" className="h-3.5 w-3.5 text-white" />,
        tile: "bg-foreground/80 text-background",
      };
  }
}

function OwnerCell({ name }: { name: string | null }) {
  if (!name) return <span className="text-sm text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold uppercase text-foreground">
        {name.charAt(0)}
      </span>
      <span className="max-w-[10rem] truncate text-sm text-foreground">{name}</span>
    </span>
  );
}

function formatDate(value: string | undefined | null, locale: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

interface BulkMenuProps {
  triggerLabel: string;
  icon: React.ReactNode;
  heading: string;
  searchPlaceholder: string;
  emptyMessage: string;
  options: { value: string; label: string; color?: string }[];
  onSelect: (value: string) => void;
  disabled?: boolean;
  tone?: "default" | "ghost";
}

function BulkMenu({
  triggerLabel,
  icon,
  heading,
  searchPlaceholder,
  emptyMessage,
  options,
  onSelect,
  disabled,
  tone = "default",
}: BulkMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-[--radius] px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            tone === "ghost"
              ? "text-muted-foreground hover:bg-black/5"
              : "border border-border bg-card text-foreground hover:border-foreground/20 hover:bg-muted",
          )}
        >
          <span className="text-muted-foreground">{icon}</span>
          <span>{triggerLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 rounded-[--radius] border border-border bg-card p-0 shadow-2xl"
      >
        <div className="border-b border-border px-3 py-2">
          <span className="text-2xs font-semibold text-muted-foreground">
            {heading}
          </span>
        </div>
        <Command shouldFilter className="rounded-none bg-transparent text-foreground">
          <CommandInput placeholder={searchPlaceholder} className="text-sm" />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.value} ${option.label}`.toLowerCase()}
                  onSelect={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs text-foreground data-[selected=true]:bg-muted"
                >
                  {option.color ? (
                    <span
                      className="h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-black/5"
                      style={{ backgroundColor: option.color }}
                    />
                  ) : null}
                  <span className="flex-1 truncate font-medium">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type BulkOption = { value: string; label: string; color?: string };

interface BulkActionsBarProps {
  canAssignStage: boolean;
  canAssignOwner: boolean;
  canAssignLabel: boolean;
  workspaceId?: string;
  stageOptions: BulkOption[];
  labelOptions: BulkOption[];
  bulkBusy: boolean;
  onBulk: (action: CrmBulkActionType, value: string) => void;
  onRequestBulkMoveToFunnel?: () => void;
  onClear: () => void;
}

function BulkActionsBar({
  canAssignStage,
  canAssignOwner,
  canAssignLabel,
  workspaceId,
  stageOptions,
  labelOptions,
  bulkBusy,
  onBulk,
  onRequestBulkMoveToFunnel,
  onClear,
}: BulkActionsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAssignStage ? (
        <BulkMenu
          triggerLabel="Mover etapa"
          icon={<Stack weight="bold" className="h-3.5 w-3.5" />}
          heading="Mover para etapa"
          searchPlaceholder="Buscar etapa..."
          emptyMessage="Nenhuma etapa"
          options={stageOptions}
          onSelect={(v) => onBulk("move_stage", v)}
          disabled={bulkBusy}
        />
      ) : null}

      {
}
      {canAssignStage && onRequestBulkMoveToFunnel ? (
        <button
          type="button"
          disabled={bulkBusy}
          onClick={onRequestBulkMoveToFunnel}
          className="inline-flex h-9 items-center gap-1.5 rounded-[--radius] border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-foreground/20 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowsLeftRight
            weight="bold"
            className="h-3.5 w-3.5 text-muted-foreground"
          />
          <span>Mover para outro funil…</span>
        </button>
      ) : null}

      {canAssignOwner && workspaceId ? (
        <AssignMemberPicker
          workspaceId={workspaceId}
          onAssign={(userId) => onBulk("assign", userId)}
        />
      ) : null}

      {canAssignLabel ? (
        <BulkMenu
          triggerLabel="Etiquetar"
          icon={<Tag weight="bold" className="h-3.5 w-3.5" />}
          heading="Adicionar etiqueta"
          searchPlaceholder="Buscar etiqueta..."
          emptyMessage="Nenhuma etiqueta"
          options={labelOptions}
          onSelect={(v) => onBulk("add_label", v)}
          disabled={bulkBusy}
        />
      ) : null}

      {canAssignLabel ? (
        <BulkMenu
          triggerLabel="Remover etiqueta"
          icon={<X weight="bold" className="h-3.5 w-3.5" />}
          heading="Remover etiqueta"
          searchPlaceholder="Buscar etiqueta..."
          emptyMessage="Nenhuma etiqueta"
          options={labelOptions}
          onSelect={(v) => onBulk("remove_label", v)}
          disabled={bulkBusy}
          tone="ghost"
        />
      ) : null}

      <button
        type="button"
        onClick={onClear}
        className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <X weight="bold" className="h-3.5 w-3.5" />
        Limpar
      </button>
    </div>
  );
}

function SelectionCount({
  count,
  total,
  pageSize,
  allMatching,
  onSelectAllMatching,
  onClear,
}: {
  count: number;
  total: number;
  pageSize: number;
  allMatching: boolean;
  onSelectAllMatching: () => void;
  onClear: () => void;
}) {
  if (allMatching) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">
          Todas as {total} conversas do filtro selecionadas
        </span>
        <button
          type="button"
          onClick={onClear}
          className="font-medium text-primary-ink underline-offset-2 hover:underline"
        >
          Limpar seleção
        </button>
      </span>
    );
  }

  const canOfferAll = count > 0 && count >= Math.min(pageSize, total) && total > count;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{count} selecionada(s)</span>
      {canOfferAll ? (
        <button
          type="button"
          onClick={onSelectAllMatching}
          className="font-medium text-primary-ink underline-offset-2 hover:underline"
        >
          Selecionar todas as {total} do filtro
        </button>
      ) : null}
    </span>
  );
}

export interface CrmListViewProps {
  filter: CrmFilter;
  stages: Stage[];
  labels: Label[];
  workspaceId?: string;
  canAssignStage?: boolean;
  funnelStages?: FunnelStages[];
  canMoveToFunnel?: boolean;
  canAssignOwner?: boolean;
  canAssignLabel?: boolean;
}

export default function CrmListView({
  filter,
  stages,
  labels,
  workspaceId,
  canAssignStage = false,
  funnelStages = [],
  canMoveToFunnel = false,
  canAssignOwner = false,
  canAssignLabel = false,
}: CrmListViewProps) {
  const locale = useLocale();

  const [entries, setEntries] = useState<CrmBoardEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [stageByEntry, setStageByEntry] = useState<Record<string, EntryStage | null>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [allMatching, setAllMatching] = useState(false);

  const reqRef = useRef(0);

  useEffect(() => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    void listAssignableMembersAction(workspaceId, { pageSize: 200 }).then((res) => {
      if (!cancelled) setMembers(res.members ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const membersById = useMemo(() => {
    const map = new Map<string, AssignableMember>();
    for (const m of members) map.set(m.userId, m);
    return map;
  }, [members]);

  const [scope, setScope] = useState(
    () => `${encodeFilterParam(filter)}|${sortOrder}`,
  );
  const currentScope = `${encodeFilterParam(filter)}|${sortOrder}`;
  if (scope !== currentScope) {
    setScope(currentScope);
    setPage(1);
    if (selectedKeys.size > 0) setSelectedKeys(new Set());
    if (allMatching) setAllMatching(false);
  }

  const enrichStages = useCallback(
    async (list: CrmBoardEntry[], reqId: number) => {
      const idsByType = new Map<EntryType, string[]>();
      for (const e of list) {
        const t = e.EntryType as EntryType;
        const bucket = idsByType.get(t);
        if (bucket) bucket.push(e.EntryID);
        else idsByType.set(t, [e.EntryID]);
      }
      const merged: Record<string, EntryStage | null> = {};
      await Promise.all(
        [...idsByType.entries()].map(async ([t, ids]) => {
          const { entryStages } = await getBatchEntryStagesAction(ids, t);
          for (const [id, es] of Object.entries(entryStages)) merged[id] = es;
        }),
      );
      if (reqId !== reqRef.current) return;
      setStageByEntry(merged);
    },
    [],
  );

  const load = useCallback(async () => {
    const reqId = ++reqRef.current;
    setLoading(true);
    const { result, error: err } = await getCrmEntriesAction({
      filter,
      page,
      pageSize: PAGE_SIZE,
      sortOrder,
    });
    if (reqId !== reqRef.current) return;
    if (err) {
      setError(err);
      setEntries([]);
      setTotal(0);
      setStageByEntry({});
      setLoading(false);
      return;
    }
    const list = result?.entries ?? [];
    setEntries(list);
    setTotal(result?.total ?? 0);
    setError(null);
    setLoading(false);
    setStageByEntry({});
    if (list.length > 0) void enrichStages(list, reqId);
  }, [filter, page, sortOrder, enrichStages]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const selectedEntries = useMemo(
    () => entries.filter((e) => selectedKeys.has(e.EntryID)),
    [entries, selectedKeys],
  );

  const changeSelection = useCallback((keys: Set<string>) => {
    setSelectedKeys(keys);
    setAllMatching(false);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    setAllMatching(false);
  }, []);

  const [movingSelection, setMovingSelection] = useState(false);

  const canMoveAcrossFunnels =
    canAssignStage &&
    canMoveToFunnel &&
    funnelStages.filter((f) => f.stages.length > 0).length > 1;

  const runBulk = useCallback(
    async (
      action: CrmBulkActionType,
      value: string,
    ): Promise<string | null> => {
      if (!value) return null;

      const targets = allMatching
        ? []
        : selectedEntries.map((e) => ({
            entryId: e.EntryID,
            entryType: e.EntryType,
          }));
      if (!allMatching && targets.length === 0) return null;

      if (
        allMatching &&
        !window.confirm(
          `Aplicar esta ação a todas as ${total} conversas do filtro atual?`,
        )
      ) {
        return null;
      }

      setBulkBusy(true);
      const { result, error: err } = await crmBulkAction({
        action,
        targets,
        value,
        ...(allMatching ? { filter } : {}),
      });
      setBulkBusy(false);
      if (err) {
        toast.error(err);
        return err;
      }
      const ok = result?.succeeded ?? 0;
      const failed = result?.failed?.length ?? 0;
      if (result?.truncated) {
        toast.warning(
          `${ok} de ${result.matched ?? ok} atualizada(s) — limite por operação. Repita para continuar.`,
        );
      } else if (failed > 0) {
        toast.warning(`${ok} atualizada(s), ${failed} falhou(aram)`);
      } else {
        toast.success(`${ok} conversa(s) atualizada(s)`);
      }
      clearSelection();
      await load();
      return null;
    },
    [allMatching, selectedEntries, filter, total, clearSelection, load],
  );

  const stageOptions = useMemo(
    () =>
      [...stages]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ value: s.id, label: s.name, color: s.color })),
    [stages],
  );
  const labelOptions = useMemo(
    () =>
      [...labels]
        .sort((a, b) => a.position - b.position)
        .map((l) => ({ value: l.id, label: l.name, color: l.color })),
    [labels],
  );

  const columns = useMemo<DashboardTableColumn<CrmBoardEntry>[]>(
    () => [
      {
        key: "contato",
        header: "Contato",
        render: (row) => {
          const name = row.LeadName?.trim();
          const number = row.LeadNumber?.trim();
          return (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {name || number || "—"}
              </span>
              {name && number ? (
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {number}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "canal",
        header: "Canal",
        render: (row) => {
          const meta = channelMeta(row.EntryType);
          return (
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md",
                  meta.tile,
                )}
              >
                {meta.icon}
              </span>
              <span className="text-sm text-foreground">{meta.label}</span>
            </span>
          );
        },
      },
      {
        key: "mensagem",
        header: "Última mensagem",
        className: "max-w-[280px]",
        render: (row) => {
          const preview = row.LastMessageText?.trim();
          const unread = row.UnreadCount ?? 0;
          return (
            <div className="flex items-center gap-2">
              <span className="max-w-[240px] truncate text-sm text-muted-foreground">
                {preview || "—"}
              </span>
              {unread > 0 ? (
                <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-[--radius] bg-primary px-1.5 text-2xs font-semibold text-primary-foreground">
                  {unread}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        key: "etapa",
        header: "Etapa",
        render: (row) => {
          const es = stageByEntry[row.EntryID];
          if (!es) return <span className="text-sm text-muted-foreground">—</span>;
          return (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full ring-1 ring-black/5"
                style={{ backgroundColor: es.stageColor || "#94a3b8" }}
              />
              <span className="truncate text-sm text-foreground">{es.stageName}</span>
            </span>
          );
        },
      },
      {
        key: "responsavel",
        header: "Responsável",
        render: (row) => {
          const uid = row.AssignedUserID?.trim();
          if (!uid) return <OwnerCell name={null} />;
          const holder = assigneeKind(uid);
          if (holder === "ai") return <OwnerCell name="IA" />;
          if (holder === "workflow") return <OwnerCell name="Fluxo" />;
          const m = membersById.get(uid);
          const name = m ? m.username?.trim() || m.email?.trim() || uid : "Atribuído";
          return <OwnerCell name={name} />;
        },
      },
      {
        key: "atualizado",
        header: "Atualizado",
        render: (row) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(row.LastMessageAt, locale)}
          </span>
        ),
      },
    ],
    [stageByEntry, locale, membersById],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const renderBulkActions = useCallback(
    () => (
      <BulkActionsBar
        canAssignStage={canAssignStage}
        canAssignOwner={canAssignOwner}
        canAssignLabel={canAssignLabel}
        workspaceId={workspaceId}
        stageOptions={stageOptions}
        labelOptions={labelOptions}
        bulkBusy={bulkBusy}
        onBulk={runBulk}
        onRequestBulkMoveToFunnel={
          canMoveAcrossFunnels ? () => setMovingSelection(true) : undefined
        }
        onClear={clearSelection}
      />
    ),
    [
      canAssignStage,
      canAssignOwner,
      canAssignLabel,
      workspaceId,
      stageOptions,
      labelOptions,
      bulkBusy,
      runBulk,
      canMoveAcrossFunnels,
      clearSelection,
    ],
  );

  const renderSelectionCount = useCallback(
    (count: number) => (
      <SelectionCount
        count={count}
        total={total}
        pageSize={PAGE_SIZE}
        allMatching={allMatching}
        onSelectAllMatching={() => setAllMatching(true)}
        onClear={clearSelection}
      />
    ),
    [total, allMatching, clearSelection],
  );

  return (
    <div className="h-full w-full overflow-auto p-4">
      <DashboardTable<CrmBoardEntry>
        data={entries}
        columns={columns}
        rowKey={(row) => row.EntryID}
        loading={loading}
        stats={[
          {
            label: "Conversas",
            value: loading ? "..." : String(total),
            icon: <UsersThree className="h-4 w-4 text-primary-ink" weight="fill" />,
          },
        ]}
        headerRight={
          <ElevatedSelect
            value={sortOrder}
            onValueChange={(v) => setSortOrder(v as "desc" | "asc")}
            className="w-auto min-w-[170px]"
          >
            <ElevatedSelectItem value="desc">Mais recentes</ElevatedSelectItem>
            <ElevatedSelectItem value="asc">Mais antigas</ElevatedSelectItem>
          </ElevatedSelect>
        }
        selection={{
          selectedKeys,
          onSelectionChange: changeSelection,
          actions: renderBulkActions,
          label: renderSelectionCount,
          selectAllLabel: "Selecionar todas as conversas desta página",
          selectRowLabel: "Selecionar conversa",
        }}
        pagination={
          totalPages > 1
            ? {
                currentPage: page,
                totalPages,
                pageSize: PAGE_SIZE,
                totalItems: total,
                onPageChange: setPage,
              }
            : undefined
        }
        paginationText={{ showing: "Mostrando", of: "de", items: "conversas" }}
        emptyState={
          error
            ? {
                icon: <ArrowsClockwise className="h-7 w-7 text-destructive-ink" weight="bold" />,
                title: "Não foi possível carregar",
                description: error,
                action: (
                  <ElevatedButton
                    variant="outline-subtle"
                    size="sm"
                    title="Tentar novamente"
                    onClick={() => void load()}
                  />
                ),
              }
            : {
                icon: <ChatCircleDots className="h-7 w-7 text-muted-foreground" weight="fill" />,
                title: "Nenhuma conversa",
                description: "Ajuste os filtros para ver outras conversas.",
              }
        }
      />

      {
}
      {canMoveAcrossFunnels && movingSelection ? (
        <MoveToFunnelDialog
          open
          onOpenChange={(next) => {
            if (!next) setMovingSelection(false);
          }}
          funnels={funnelStages}
          currentStageId={null}
          bulkCount={allMatching ? total : selectedEntries.length}
          onConfirm={(stageId) => runBulk("move_funnel", stageId)}
        />
      ) : null}
    </div>
  );
}
