"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowsClockwise,
  CalendarBlank,
  CircleNotch,
  DotsThreeVertical,
  HourglassMedium,
  Plus,
  Sliders,
  TrendUp,
  User,
} from "@phosphor-icons/react";

import CrmFilterBar from "@/components/crm/CrmFilterBar";
import OpportunityDrawer from "@/components/crm/OpportunityDrawer";
import CustomFieldManager from "@/components/crm/CustomFieldManager";
import KanbanBoard from "@/components/crm/KanbanBoard";
import {
  CardTile,
  CardPill,
  KanbanCard,
  kanbanCardClass,
} from "@/components/crm/kanban-card";
import ElevatedButton from "@/components/elevated-design/button";

import {
  getOpportunityBoardAction,
  moveOpportunityAction,
} from "@/app/actions/opportunities";
import { listPipelinesAction } from "@/app/actions/crm-board";
import { listCustomFieldsAction } from "@/app/actions/custom-fields";
import { listAssignableMembersAction, type AssignableMember } from "@/app/actions/workspace";
import {
  emptyCrmFilter,
  type CrmFilter,
} from "@/lib/crm/board";
import {
  closeDateSignal,
  formatValueCents,
  formatValueCompact,
  relativeAge,
  rotSignal,
  type Opportunity,
  type OpportunityColumn,
} from "@/lib/crm/opportunities";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const OPP_STATUS_OPTIONS = [
  { value: "open", label: "Aberta" },
  { value: "won", label: "Ganha" },
  { value: "lost", label: "Perdida" },
];

interface OpportunityBoardProps {
  workspaceId?: string;
  canEdit?: boolean;
  // When set, the board renders THIS opportunity pipeline instead of self-resolving
  // the default (used by the unified Funil selector to switch funnels).
  pipelineId?: string;
  // Embedded in the unified board: hide the standalone "Funil de Vendas" header
  // (the shared pipeline selector sits above it) but keep the totals + new-deal button.
  embedded?: boolean;
  // Optional slot rendered next to the totals in embedded mode (e.g. the selector).
  headerSlot?: React.ReactNode;
}

export default function OpportunityBoard({
  workspaceId,
  canEdit = true,
  pipelineId: pipelineIdProp,
  embedded = false,
  headerSlot,
}: OpportunityBoardProps) {
  const t = useTranslations("crmBoard");
  const [columns, setColumns] = useState<OpportunityColumn[]>([]);
  // Deals whose stage move is in flight — the card shows an in-place spinner (in
  // the slot the overflow icon already reserves, so no layout shift) instead of a
  // toast, and we clear it once the server confirms/reverts.
  const [movingIds, setMovingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CrmFilter>(emptyCrmFilter);
  const [pipelineId, setPipelineId] = useState<string>(pipelineIdProp ?? "");
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [createStageId, setCreateStageId] = useState<string | undefined>(undefined);

  const reqRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqRef.current;
    setLoading(true);
    const { board, error: err } = await getOpportunityBoardAction({
      groupBy: "stage",
      pipelineId: pipelineId || undefined,
      filter,
      pageSize: 100,
    });
    if (reqId !== reqRef.current) return;
    if (err) {
      setError(err);
      setColumns([]);
    } else {
      setColumns(board?.columns ?? []);
      setError(null);
    }
    setLoading(false);
  }, [pipelineId, filter]);

  // Resolve the pipeline (the prop override, else the default) + custom fields once.
  // The first board fetch self-heals the default pipeline when none is pinned.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pipelineIdProp) {
        await getOpportunityBoardAction({ groupBy: "stage" }); // ensure default exists
      }
      const [{ pipelines }, { fields }] = await Promise.all([
        listPipelinesAction("opportunity"),
        listCustomFieldsAction("opportunity"),
      ]);
      if (cancelled) return;
      if (pipelineIdProp) {
        setPipelineId(pipelineIdProp);
      } else {
        const def = pipelines.find((p) => p.isDefault) ?? pipelines[0];
        setPipelineId(def?.id ?? "");
      }
      setCustomFields(fields);
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineIdProp]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    void listAssignableMembersAction(workspaceId, { pageSize: 200 }).then((res) => {
      if (!cancelled) setMembers(res.members ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Debounced (re)load on filter / pipeline change.
  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const membersById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.userId, m.username?.trim() || m.email?.trim() || m.userId);
    }
    return map;
  }, [members]);

  const boardTotals = useMemo(() => {
    let count = 0;
    let value = 0;
    for (const c of columns) {
      count += c.total ?? 0;
      value += c.valueTotal ?? 0;
    }
    return { count, value };
  }, [columns]);

  const reloadCustomFields = useCallback(async () => {
    const { fields } = await listCustomFieldsAction("opportunity");
    setCustomFields(fields);
  }, []);

  const openCreate = useCallback((stageId?: string) => {
    setEditing(null);
    setCreateStageId(stageId);
    setDrawerOpen(true);
  }, []);

  const openEdit = useCallback((deal: Opportunity) => {
    setEditing(deal);
    setCreateStageId(undefined);
    setDrawerOpen(true);
  }, []);

  // Card dropped on a different stage column (the shared KanbanBoard supplies the
  // deal + from/to). Moving into a "lost" stage opens the drawer preset to that
  // stage so the user provides the required reason instead of failing validation.
  // Like the conversation funnel, the move is OPTIMISTIC: the card jumps columns
  // immediately (framer then glides it) and we reconcile with the server after,
  // reverting via a reload on error.
  const handleCardMove = useCallback(
    async (deal: Opportunity, fromColumnId: string, toColumnId: string) => {
      const column = columns.find((c) => c.id === toColumnId);
      if (!column) return;
      if (column.isLost) {
        openEdit({ ...deal, stageId: toColumnId });
        return;
      }
      const status: Opportunity["status"] = column.isWon ? "won" : "open";

      // Optimistic: relocate the card + adjust both columns' count/value totals.
      setColumns((prev) =>
        prev.map((c) => {
          if (c.id === fromColumnId) {
            return {
              ...c,
              total: Math.max(0, c.total - 1),
              valueTotal: Math.max(0, c.valueTotal - deal.valueCents),
              entries: (c.entries ?? []).filter((o) => o.id !== deal.id),
            };
          }
          if (c.id === toColumnId) {
            return {
              ...c,
              total: c.total + 1,
              valueTotal: c.valueTotal + deal.valueCents,
              entries: [{ ...deal, stageId: toColumnId, status }, ...(c.entries ?? [])],
            };
          }
          return c;
        }),
      );

      // In-place loading: mark this card busy for the round-trip (no toast).
      setMovingIds((prev) => {
        const next = new Set(prev);
        next.add(deal.id);
        return next;
      });

      const { error: err } = await moveOpportunityAction(deal.id, {
        stageId: toColumnId,
        status,
      });

      setMovingIds((prev) => {
        const next = new Set(prev);
        next.delete(deal.id);
        return next;
      });

      if (err) {
        toast.error(err);
        void load(); // revert to server truth (only surfaced state left is failures)
        return;
      }
      void load(); // reconcile (server may re-sort / recompute)
    },
    [columns, openEdit, load],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      {/* Header. In embedded (unified board) mode the shared pipeline selector sits
          above, so we drop the standalone title/icon and lead with the selector slot
          + totals, keeping the new-deal button. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {embedded ? (
            headerSlot ?? null
          ) : (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-white">
              <TrendUp weight="bold" className="h-4 w-4" />
            </span>
          )}
          <div>
            {!embedded ? (
              <h1 className="text-base font-bold leading-tight text-foreground">{t("deals.title")}</h1>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {t("deals.count", { count: boardTotals.count })} ·{" "}
              <span className="font-medium text-foreground">{formatValueCents(boardTotals.value)}</span>
            </p>
          </div>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <ElevatedButton
              variant="outline-subtle"
              size="sm"
              title={t("deals.fields")}
              icon={<Sliders weight="bold" className="h-3.5 w-3.5" />}
              iconVisible
              onClick={() => setFieldsOpen(true)}
            />
            <ElevatedButton
              variant="primary"
              size="sm"
              title={t("deals.newDeal")}
              icon={<Plus weight="bold" className="h-3.5 w-3.5" />}
              iconVisible
              onClick={() => openCreate(columns[0]?.id)}
            />
          </div>
        ) : null}
      </div>

      <CrmFilterBar
        value={filter}
        onChange={setFilter}
        labels={[]}
        workspaceId={workspaceId}
        showValue
        dateField="close_date"
        statusOptions={OPP_STATUS_OPTIONS}
      />

      {/* Board */}
      <div className="relative flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <ArrowsClockwise className="h-8 w-8 text-red-600" weight="bold" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <ElevatedButton variant="outline-subtle" size="sm" title={t("deals.retry")} onClick={() => void load()} />
          </div>
        ) : loading && columns.length === 0 ? (
          <div className="flex h-full min-w-max gap-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <ColumnSkeleton key={i} />
            ))}
          </div>
        ) : (
          // The SAME reusable kanban shell the conversation board uses; only the card
          // content differs (a deal card via renderCard).
          <KanbanBoard<Opportunity>
            columns={columns.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
              count: c.total,
              headerExtra:
                c.valueTotal > 0 ? (
                  <span
                    className={cn(
                      "text-[11px] font-semibold tabular-nums",
                      c.isWon
                        ? "text-emerald-600 dark:text-emerald-400"
                        : c.isLost
                          ? "text-muted-foreground"
                          : "text-foreground",
                    )}
                  >
                    {formatValueCompact(c.valueTotal)}
                  </span>
                ) : null,
            }))}
            itemsFor={(colId) => columns.find((c) => c.id === colId)?.entries ?? []}
            getItemId={(o) => o.id}
            columnOfItem={(o) => o.stageId}
            renderCard={(deal) => (
              <DealCard
                deal={deal}
                ownerName={deal.ownerId ? membersById.get(deal.ownerId) ?? "Atribuído" : null}
                customFields={customFields}
                isMoving={movingIds.has(deal.id)}
                onClick={() => openEdit(deal)}
              />
            )}
            onCardMove={canEdit ? handleCardMove : undefined}
            onAddCard={canEdit ? (colId) => openCreate(colId) : undefined}
            emptyLabel={t("deals.empty")}
            addLabel={t("deals.add")}
            canEdit={canEdit}
          />
        )}
      </div>

      <OpportunityDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        opportunity={editing}
        pipelineId={pipelineId}
        columns={columns}
        customFields={customFields}
        workspaceId={workspaceId}
        defaultStageId={createStageId}
        onSaved={load}
      />

      <CustomFieldManager
        open={fieldsOpen}
        onOpenChange={setFieldsOpen}
        onChanged={reloadCustomFields}
      />
    </div>
  );
}

// Status tints the tile + value so won/lost read instantly, WITHOUT a heavy
// glyph — the tile carries the deal's initial, exactly like the funnel card
// carries the lead's initial, so the two boards use one card language.
const STATUS_TILE: Record<string, string | undefined> = {
  open: undefined, // Signal Blue accent (CardTile default)
  won: "#10b981",
  lost: "#94a3b8",
};

function DealCard({
  deal,
  ownerName,
  customFields,
  isMoving = false,
  onClick,
}: {
  deal: Opportunity;
  ownerName: string | null;
  customFields: CustomFieldDefinition[];
  isMoving?: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("crmBoard");
  const status = deal.status;
  const won = status === "won";
  const lost = status === "lost";

  const closeSignal = closeDateSignal(deal.closeDate, status);
  const rot = rotSignal(status, deal.updatedAt);
  const age = relativeAge(deal.createdAt);

  // Up to three non-empty custom-field values, rendered as neutral chips.
  const customChips = customFields
    .map((def) => {
      const raw = deal.customFields?.[def.key];
      if (raw === undefined || raw === null || raw === "" || raw === false) return null;
      const val = raw === true ? "Sim" : String(raw);
      return { key: def.key, label: def.label, val };
    })
    .filter(Boolean)
    .slice(0, 3) as { key: string; label: string; val: string }[];

  return (
    <div
      onClick={onClick}
      aria-busy={isMoving}
      className={kanbanCardClass({ won, lost }, isMoving ? "opacity-70" : undefined)}
    >
      {/* THE shared card — same component the conversation funnel renders. The deal
          fills the slots with its own data: value in `body`, custom fields in `chips`. */}
      <KanbanCard
        tile={
          <CardTile color={STATUS_TILE[status]}>
            {(deal.title?.trim()?.[0] || "?").toUpperCase()}
          </CardTile>
        }
        title={deal.title || "Sem título"}
        subtitle={deal.source || undefined}
        thirdLine={
          age ? <p className="truncate text-[10px] text-muted-foreground">{age}</p> : undefined
        }
        rightSlot={
          isMoving ? (
            <CircleNotch
              weight="bold"
              className="h-4 w-4 flex-shrink-0 animate-spin text-primary"
            />
          ) : (
            <DotsThreeVertical
              weight="bold"
              className="h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
            />
          )
        }
        body={
          deal.valueCents > 0 ? (
            <p
              className={cn(
                "text-[13px] font-bold tabular-nums tracking-tight",
                won
                  ? "text-emerald-600 dark:text-emerald-400"
                  : lost
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
              )}
            >
              {formatValueCents(deal.valueCents, deal.currency)}
            </p>
          ) : (
            <p className="text-[11px] italic text-muted-foreground">{t("deals.noValue")}</p>
          )
        }
        pills={
          <>
            {ownerName ? (
              <CardPill
                tone="info"
                className="max-w-[50%]"
                icon={<User weight="bold" className="h-2.5 w-2.5 flex-shrink-0" />}
              >
                {ownerName}
              </CardPill>
            ) : null}
            {closeSignal ? (
              <CardPill
                tone={closeSignal.tone}
                icon={<CalendarBlank weight="bold" className="h-2.5 w-2.5 flex-shrink-0" />}
              >
                {closeSignal.label}
              </CardPill>
            ) : null}
            {rot ? (
              <CardPill
                tone={rot.tone}
                icon={<HourglassMedium weight="bold" className="h-2.5 w-2.5 flex-shrink-0" />}
                title="Sem movimentação recente"
              >
                {rot.label}
              </CardPill>
            ) : null}
          </>
        }
        chips={
          customChips.length > 0 ? (
            customChips.map((c) => (
              <span
                key={c.key}
                className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground"
              >
                <span className="font-semibold text-foreground/70">{c.label}:</span>
                <span className="truncate">{c.val}</span>
              </span>
            ))
          ) : undefined
        }
      />
    </div>
  );
}

function ColumnSkeleton() {
  return (
    <div className="flex h-full w-72 min-w-[288px] flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full bg-muted" />
        <span className="h-3 w-20 rounded bg-muted" />
      </div>
      <div className="flex-1 space-y-2 rounded-xl bg-muted/50 p-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-lg bg-card" />
        ))}
      </div>
    </div>
  );
}
