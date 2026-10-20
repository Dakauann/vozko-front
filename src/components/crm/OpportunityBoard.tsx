"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowsClockwise,
  CircleNotch,
  DotsThreeVertical,
  HourglassMedium,
  Plus,
  Sliders,
  TrendUp,
  User,
} from "@/components/icons";

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
import { ScreenLoader } from "@/components/brand/screen-loader";

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
  dealActorName,
  dealAge,
  formatValueCents,
  formatValueCompact,
  moveDealBetweenColumns,
  requiresDealEdit,
  rotSignal,
  type DealAge,
  type Opportunity,
  type OpportunityColumn,
} from "@/lib/crm/opportunities";
import {
  beginOperation,
  confirmOperation,
  emptyLedger,
  rollbackOperation,
  type OptimisticLedger,
} from "@/lib/crm/optimistic";
import { performReversible } from "@/lib/crm/undoable";
import { canUndoCardMove } from "@/lib/crm/board-drag";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

const OPP_STATUSES = ["open", "won", "lost"] as const;

interface OpportunityBoardProps {
  workspaceId?: string;
  canEdit?: boolean;
  pipelineId?: string;
  embedded?: boolean;
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
  const tActions = useTranslations("crmActions");
  const [columns, setColumns] = useState<OpportunityColumn[]>([]);
  const columnsRef = useRef<OpportunityColumn[]>([]);
  const movesLedgerRef = useRef<OptimisticLedger<string>>(emptyLedger());
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

  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  const statusOptions = useMemo(
    () => OPP_STATUSES.map((value) => ({ value, label: t(`deals.status.${value}`) })),
    [t],
  );

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pipelineIdProp) {
        await getOpportunityBoardAction({ groupBy: "stage" });
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

  const ownerLabels = useMemo(
    () => ({
      ai: t("deals.owner.ai"),
      workflow: t("deals.owner.workflow"),
      system: t("deals.owner.system"),
      unknownMember: t("deals.owner.unknownMember"),
    }),
    [t],
  );

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

  const setDealMoving = useCallback((dealId: string, moving: boolean) => {
    setMovingIds((prev) => {
      const next = new Set(prev);
      if (moving) next.add(dealId);
      else next.delete(dealId);
      return next;
    });
  }, []);

  const commitDealMove = useCallback(
    async (deal: Opportunity, fromColumnId: string, toColumnId: string): Promise<boolean> => {
      const operationId = crypto.randomUUID();
      movesLedgerRef.current = beginOperation(movesLedgerRef.current, {
        id: operationId,
        target: deal.id,
        snapshot: fromColumnId,
      });
      setColumns((prev) => moveDealBetweenColumns(prev, deal, fromColumnId, toColumnId));
      setDealMoving(deal.id, true);

      const { error: err } = await moveOpportunityAction(deal.id, {
        stageId: toColumnId,
        version: deal.version,
      });
      setDealMoving(deal.id, false);

      if (err) {
        const { ledger, snapshot } = rollbackOperation(movesLedgerRef.current, operationId);
        if (snapshot !== null) {
          movesLedgerRef.current = ledger;
          setColumns((prev) =>
            moveDealBetweenColumns(prev, { ...deal, stageId: toColumnId }, toColumnId, snapshot),
          );
        }
        toast.error(err);
        void load();
        return false;
      }
      movesLedgerRef.current = confirmOperation(movesLedgerRef.current, operationId).ledger;
      void load();
      return true;
    },
    [load, setDealMoving],
  );

  const currentDeal = useCallback(
    (dealId: string) =>
      columnsRef.current.flatMap((c) => c.entries ?? []).find((o) => o.id === dealId) ?? null,
    [],
  );

  const handleCardMove = useCallback(
    (deal: Opportunity, fromColumnId: string, toColumnId: string) => {
      const target = columns.find((c) => c.id === toColumnId);
      if (!target) return;
      if (requiresDealEdit(target, deal)) {
        if (target.isWon) toast.info(t("deals.wonNeedsValue"));
        openEdit({ ...deal, stageId: toColumnId });
        return;
      }
      const source = columns.find((c) => c.id === fromColumnId);
      const reversible =
        source !== undefined &&
        canUndoCardMove(fromColumnId, toColumnId) &&
        !requiresDealEdit(source, deal);
      if (!reversible) {
        void commitDealMove(deal, fromColumnId, toColumnId);
        return;
      }
      void performReversible(
        {
          apply: () => commitDealMove(deal, fromColumnId, toColumnId),
          inverse: () => {
            const moved = currentDeal(deal.id);
            return moved ? commitDealMove(moved, toColumnId, fromColumnId) : false;
          },
          labelKey: "cardMoved",
        },
        (key) => tActions(key, { column: target.name }),
      );
    },
    [columns, openEdit, commitDealMove, currentDeal, t, tActions],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {embedded ? (
            headerSlot ?? null
          ) : (
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TrendUp weight="bold" className="h-4 w-4" />
            </span>
          )}
          <div>
            {!embedded ? (
              <h1 className="font-display text-base font-semibold leading-tight tracking-[0.01em] text-foreground">{t("deals.title")}</h1>
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
        statusOptions={statusOptions}
      />

      {}
      <div className="relative flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <ArrowsClockwise className="h-8 w-8 text-destructive-ink" weight="bold" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <ElevatedButton variant="outline-subtle" size="sm" title={t("deals.retry")} onClick={() => void load()} />
          </div>
        ) : loading && columns.length === 0 ? (
          <ScreenLoader fit="fill" />
        ) : (
          <KanbanBoard<Opportunity>
            board="opportunities"
            columns={columns.map((c) => ({
              id: c.id,
              name: c.name,
              color: c.color,
              count: c.total,
              headerExtra:
                c.valueTotal > 0 ? (
                  <span
                    className={cn(
                      "text-2xs font-semibold tabular-nums",
                      c.isWon
                        ? "text-healthy-ink"
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
            cardLabel={(o) => o.title || t("deals.untitled")}
            onCardOpen={openEdit}
            renderCard={(deal) => (
              <DealCard
                deal={deal}
                ownerName={dealActorName(deal.ownerId, membersById, ownerLabels, deal.ownerName)}
                customFields={customFields}
                isMoving={movingIds.has(deal.id)}
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

function dealAgeLabel(
  age: DealAge | null,
  t: (key: string, values?: Record<string, number>) => string,
  locale: string,
): string {
  if (!age) return "";
  if (age.kind === "date") {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(age.date);
  }
  if (age.kind === "days") return t("deals.age.days", { days: age.days });
  return t(`deals.age.${age.kind}`);
}

const STATUS_TILE: Record<string, string | undefined> = {
  open: undefined,
  won: "hsl(var(--healthy))",
  lost: "hsl(var(--plate-neutral))",
};

function DealCard({
  deal,
  ownerName,
  customFields,
  isMoving = false,
}: {
  deal: Opportunity;
  ownerName: string | null;
  customFields: CustomFieldDefinition[];
  isMoving?: boolean;
}) {
  const t = useTranslations("crmBoard");
  const locale = useLocale();
  const status = deal.status;
  const won = status === "won";
  const lost = status === "lost";

  const rot = rotSignal(status, deal.updatedAt);
  const age = dealAgeLabel(dealAge(deal.createdAt), t, locale);

  const customChips = customFields
    .map((def) => {
      const raw = deal.customFields?.[def.key];
      if (raw === undefined || raw === null || raw === "" || raw === false) return null;
      const val = raw === true ? t("deals.yes") : String(raw);
      return { key: def.key, label: def.label, val };
    })
    .filter(Boolean)
    .slice(0, 3) as { key: string; label: string; val: string }[];

  return (
    <div
      aria-busy={isMoving}
      className={kanbanCardClass({ won, lost }, isMoving ? "opacity-70" : undefined)}
    >
      <KanbanCard
        tile={
          <CardTile color={STATUS_TILE[status]}>
            {(deal.title?.trim()?.[0] || "?").toUpperCase()}
          </CardTile>
        }
        title={deal.title || t("deals.untitled")}
        subtitle={deal.source || undefined}
        thirdLine={
          age ? <p className="truncate text-2xs text-muted-foreground">{age}</p> : undefined
        }
        rightSlot={
          isMoving ? (
            <CircleNotch
              weight="bold"
              className="h-4 w-4 flex-shrink-0 animate-spin text-primary-ink"
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
                "text-sm font-semibold tabular-nums tracking-tight",
                won
                  ? "text-healthy-ink"
                  : lost
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
              )}
            >
              {formatValueCents(deal.valueCents, deal.currency)}
            </p>
          ) : (
            <p className="text-2xs italic text-muted-foreground">{t("deals.noValue")}</p>
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
            {rot ? (
              <CardPill
                tone={rot.tone}
                icon={<HourglassMedium weight="bold" className="h-2.5 w-2.5 flex-shrink-0" />}
                title={t("deals.idleHint")}
              >
                {t("deals.idle", { days: rot.days })}
              </CardPill>
            ) : null}
          </>
        }
        chips={
          customChips.length > 0 ? (
            customChips.map((c) => (
              <span
                key={c.key}
                className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-2xs font-medium text-muted-foreground"
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
