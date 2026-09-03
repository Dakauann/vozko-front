"use client";

import { Reorder, useDragControls } from "framer-motion";
import { useCallback, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  Check,
  DotsSixVertical,
  Kanban,
  ListNumbers,
  Plus,
  Target,
  Trash,
} from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { STAGE_COLORS, nextStageColor } from "@/lib/crm/stage-colors";
import { cn, readableInkFor } from "@/lib/utils";

import { InlineEdit } from "./InlineEdit";

/**
 * A column being drawn.
 *
 * `id` is the row's identity for React and for drag, never the server's opinion.
 * A row the operator just added carries a `draft:` id; a row loaded from an
 * existing funnel carries the stage id, and that is exactly how the save diff
 * later tells "create" from "update".
 */
export interface DraftStage {
  id: string;
  name: string;
  description: string;
  color: string;
}

export const DRAFT_PREFIX = "draft:";

let draftCounter = 0;

export function newDraftStage(existing: DraftStage[]): DraftStage {
  draftCounter += 1;
  return {
    id: `${DRAFT_PREFIX}${draftCounter}`,
    name: "",
    description: "",
    color: nextStageColor(existing.map((s) => s.color)),
  };
}

export function isDraftStage(stage: DraftStage): boolean {
  return stage.id.startsWith(DRAFT_PREFIX);
}

/** Turns a list of names into draft rows, for the composer's template row. */
export function suggestedStages(labels: string[]): DraftStage[] {
  return labels.map((name, i) => {
    draftCounter += 1;
    return {
      id: `${DRAFT_PREFIX}${draftCounter}`,
      name,
      description: "",
      color: STAGE_COLORS[i % STAGE_COLORS.length],
    };
  });
}

type ComposerView = "board" | "list";

interface FunnelStageComposerProps {
  stages: DraftStage[];
  onChange: (stages: DraftStage[]) => void;
  /** Rows that may not be removed — a stage still holding conversations. */
  lockedIds?: ReadonlySet<string>;
  disabled?: boolean;
  /** Columns beyond this are refused; the board stops being scannable long before. */
  max?: number;
}

const DEFAULT_MAX = 24;

/**
 * The funnel's columns, drawn rather than inherited.
 *
 * This is the component the whole surface exists for. A funnel used to arrive
 * seeded from a template with no way to say what its stages should be, so every
 * workspace ran the same four columns whatever their process was. Here the list
 * IS the process.
 *
 * It shows as a BOARD by default, on the CRM's own column furniture — same tray
 * width, same scribble-strip head, same colour lamp, same dashed tray for the
 * empty slot. Designing a board on a vertical form and then discovering what it
 * looks like is a round trip nobody should have to make: at 288px per column the
 * strip also tells the truth about how many stages fit on a screen, which is the
 * single most useful thing to know while adding the ninth one.
 *
 * The list view stays for the jobs the board is worse at — reordering ten columns,
 * or reading every description at once — and because a horizontal scroll region
 * is a poor keyboard target. Both edit the same draft.
 *
 * The FIRST column is the entry stage, and that is shown rather than configured.
 * A separate "which column receives arrivals" control would let the flag and the
 * order disagree — an entry stage sitting third on a board read left to right —
 * and the operator would have to hold both facts. Order is the only truth here.
 */
export function FunnelStageComposer({
  stages,
  onChange,
  lockedIds,
  disabled = false,
  max = DEFAULT_MAX,
}: FunnelStageComposerProps) {
  const t = useTranslations("funnels.stages");
  const [view, setView] = useState<ComposerView>("board");
  // The column just added, so it opens straight into its name instead of
  // waiting for a second click on a tray that says "Nome da etapa".
  const [autoEditId, setAutoEditId] = useState<string | null>(null);
  const order = useMemo(() => stages.map((s) => s.id), [stages]);

  const reorder = useCallback(
    (ids: string[]) => {
      const byId = new Map(stages.map((s) => [s.id, s]));
      onChange(ids.map((id) => byId.get(id)).filter(Boolean) as DraftStage[]);
    },
    [stages, onChange],
  );

  const patch = useCallback(
    (id: string, fields: Partial<DraftStage>) => {
      onChange(stages.map((s) => (s.id === id ? { ...s, ...fields } : s)));
    },
    [stages, onChange],
  );

  const remove = useCallback(
    (id: string) => onChange(stages.filter((s) => s.id !== id)),
    [stages, onChange],
  );

  const add = useCallback(() => {
    if (stages.length >= max) return;
    const created = newDraftStage(stages);
    setAutoEditId(created.id);
    onChange([...stages, created]);
  }, [stages, onChange, max]);

  const atCap = stages.length >= max;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="legend !normal-case">
          {atCap ? t("capReached", { max }) : t("count", { count: stages.length })}
        </p>
        <ElevatedPillToggle
          options={[
            {
              value: "board" as ComposerView,
              label: t("viewBoard"),
              icon: <Kanban className="h-3.5 w-3.5" weight="bold" />,
            },
            {
              value: "list" as ComposerView,
              label: t("viewList"),
              icon: <ListNumbers className="h-3.5 w-3.5" weight="bold" />,
            },
          ]}
          value={view}
          onChange={setView}
          aria-label={t("viewLabel")}
        />
      </div>

      {stages.length === 0 ? (
        <EmptyStages onAdd={add} disabled={disabled} />
      ) : view === "board" ? (
        <BoardView
          stages={stages}
          order={order}
          onReorder={reorder}
          onPatch={patch}
          onRemove={remove}
          onAdd={add}
          lockedIds={lockedIds}
          disabled={disabled}
          atCap={atCap}
          autoEditId={autoEditId}
        />
      ) : (
        <ListView
          stages={stages}
          order={order}
          onReorder={reorder}
          onPatch={patch}
          onRemove={remove}
          onAdd={add}
          lockedIds={lockedIds}
          disabled={disabled}
          atCap={atCap}
          autoEditId={autoEditId}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- BOARD */

interface ViewProps {
  stages: DraftStage[];
  order: string[];
  onReorder: (ids: string[]) => void;
  onPatch: (id: string, fields: Partial<DraftStage>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  lockedIds?: ReadonlySet<string>;
  disabled: boolean;
  atCap: boolean;
  /** The column the operator just added, opened straight into its name field. */
  autoEditId: string | null;
}

/**
 * The board as it will be, minus the cards.
 *
 * Trays, widths and the scribble-strip head are the CRM's own
 * (`KanbanColumnShell`), deliberately not a lookalike: the point of drawing here
 * instead of in a form is that this IS the thing being made. The one departure
 * is the body, which holds the two fields that define a column rather than the
 * conversations that will sit in it.
 */
function BoardView({
  stages,
  order,
  onReorder,
  onPatch,
  onRemove,
  onAdd,
  lockedIds,
  disabled,
  atCap,
  autoEditId,
}: ViewProps) {
  const t = useTranslations("funnels.stages");
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <Reorder.Group
        axis="x"
        values={order}
        onReorder={onReorder}
        className="flex min-w-max items-stretch gap-3"
      >
        {stages.map((stage, index) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            isEntry={index === 0}
            autoEdit={stage.id === autoEditId}
            locked={lockedIds?.has(stage.id) ?? false}
            disabled={disabled}
            onPatch={onPatch}
            onRemove={onRemove}
          />
        ))}

        {/* The empty slot, as the board's own dashed tray. A button floating
            beside the strip would sit outside the thing it adds to. */}
        {!atCap ? (
          <button
            type="button"
            onClick={onAdd}
            disabled={disabled}
            className={cn(
              "flex w-72 min-w-[288px] flex-shrink-0 flex-col items-center justify-center gap-2 rounded-lg",
              "border border-dashed border-border bg-muted px-3 py-8 text-sm text-muted-foreground",
              "transition-colors hover:border-border-strong hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <Plus className="h-4 w-4" weight="bold" aria-hidden="true" />
            {t("add")}
          </button>
        ) : null}
      </Reorder.Group>
    </div>
  );
}

function StageColumn({
  stage,
  isEntry,
  locked,
  disabled,
  autoEdit,
  onPatch,
  onRemove,
}: {
  stage: DraftStage;
  isEntry: boolean;
  locked: boolean;
  disabled: boolean;
  autoEdit: boolean;
  onPatch: (id: string, fields: Partial<DraftStage>) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("funnels.stages");
  const controls = useDragControls();
  const named = stage.name || t("untitled");

  return (
    <Reorder.Item
      value={stage.id}
      dragListener={false}
      dragControls={controls}
      transition={{ type: "spring", damping: 26, stiffness: 320 }}
      whileDrag={{ cursor: "grabbing", zIndex: 2 }}
      className="flex w-72 min-w-[288px] flex-shrink-0 flex-col rounded-lg border border-border bg-muted"
    >
      {/* The scribble strip, exactly as the board draws it: handle, colour lamp,
          name. The name is the TITLE here rather than a field in the body — a
          column head with an input in it is not what the operator will see when
          the board renders, and the whole point of composing on the board is
          that the resting state is the final look. */}
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <button
          type="button"
          aria-label={t("dragHandle", { name: named })}
          disabled={disabled}
          onPointerDown={(e) => {
            if (disabled) return;
            controls.start(e);
          }}
          className={cn(
            "flex h-5 w-4 flex-shrink-0 cursor-grab touch-none items-center justify-center rounded-[--radius]",
            "text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <DotsSixVertical className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
        </button>

        <ColorPicker
          value={stage.color}
          disabled={disabled}
          onChange={(color) => onPatch(stage.id, { color })}
          name={named}
          shape="lamp"
        />

        <InlineEdit
          value={stage.name}
          placeholder={t("namePlaceholder")}
          label={t("nameLabel")}
          maxLength={100}
          disabled={disabled}
          autoEdit={autoEdit}
          onCommit={(name) => onPatch(stage.id, { name })}
          className="legend !text-foreground"
          displayClassName="min-w-0 flex-1"
        />

        <button
          type="button"
          disabled={disabled || locked}
          onClick={() => onRemove(stage.id)}
          title={locked ? t("lockedHint") : t("remove")}
          aria-label={locked ? t("lockedHint") : t("removeNamed", { name: named })}
          className={cn(
            "ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-[--radius] text-muted-foreground",
            "transition-colors hover:bg-destructive hover:text-destructive-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-30",
          )}
        >
          <Trash className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
        </button>
      </div>

      {/* The body carries what the board's own body cannot show: what the column
          MEANS. It reads as a note on the tray and opens as a field on click,
          the same gesture as the title above it. */}
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {isEntry ? <EntryChip /> : null}
        <InlineEdit
          value={stage.description}
          placeholder={t("descriptionPlaceholder")}
          label={t("descriptionLabel")}
          maxLength={500}
          disabled={disabled}
          onCommit={(description) => onPatch(stage.id, { description })}
          className="w-full text-2xs leading-snug"
          displayClassName="items-start text-left"
          pencil={false}
        />
      </div>
    </Reorder.Item>
  );
}

/* -------------------------------------------------------------------- LIST */

/** The same draft, stacked. Better for long funnels and for the keyboard. */
function ListView({
  stages,
  order,
  onReorder,
  onPatch,
  onRemove,
  onAdd,
  lockedIds,
  disabled,
  atCap,
  autoEditId,
}: ViewProps) {
  const t = useTranslations("funnels.stages");
  return (
    <div className="flex flex-col gap-3">
      <Reorder.Group
        axis="y"
        values={order}
        onReorder={onReorder}
        className="flex flex-col divide-y divide-border border-y border-border"
      >
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            isEntry={index === 0}
            locked={lockedIds?.has(stage.id) ?? false}
            disabled={disabled}
            autoFocusName={stage.id === autoEditId}
            onPatch={onPatch}
            onRemove={onRemove}
          />
        ))}
      </Reorder.Group>

      <ElevatedButton
        variant="outline-subtle"
        size="sm"
        onClick={onAdd}
        disabled={disabled || atCap}
        icon={<Plus className="h-3.5 w-3.5" weight="bold" />}
        iconVisible
        title={t("add")}
        className="self-start"
      />
    </div>
  );
}

function StageRow({
  stage,
  index,
  isEntry,
  locked,
  disabled,
  autoFocusName,
  onPatch,
  onRemove,
}: {
  stage: DraftStage;
  index: number;
  isEntry: boolean;
  locked: boolean;
  disabled: boolean;
  autoFocusName: boolean;
  onPatch: (id: string, fields: Partial<DraftStage>) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("funnels.stages");
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={stage.id}
      dragListener={false}
      dragControls={controls}
      transition={{ type: "spring", damping: 26, stiffness: 320 }}
      whileDrag={{ cursor: "grabbing" }}
      className="bg-card"
    >
      <div className="flex items-start gap-2 px-1 py-2.5 sm:gap-3">
        {/* The handle is the only grab target: dragging from anywhere on the row
            would fight text selection in the two fields it contains. */}
        <button
          type="button"
          aria-label={t("dragHandle", { name: stage.name || t("untitled") })}
          disabled={disabled}
          onPointerDown={(e) => {
            if (disabled) return;
            controls.start(e);
          }}
          className={cn(
            "mt-1.5 flex h-7 w-6 flex-none cursor-grab touch-none items-center justify-center rounded-[--radius] text-muted-foreground",
            "transition-colors hover:bg-[hsl(var(--accent-hover))] hover:text-foreground active:cursor-grabbing",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          <DotsSixVertical className="h-4 w-4" weight="bold" aria-hidden="true" />
        </button>

        <span className="readout mt-2 w-4 flex-none text-2xs text-muted-foreground">
          {index + 1}
        </span>

        <ColorPicker
          value={stage.color}
          disabled={disabled}
          onChange={(color) => onPatch(stage.id, { color })}
          name={stage.name || t("untitled")}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ElevatedInput
              value={stage.name}
              disabled={disabled}
              maxLength={100}
              placeholder={t("namePlaceholder")}
              controlSize="sm"
              aria-label={t("nameLabel")}
              autoFocus={autoFocusName}
              onChange={(e) => onPatch(stage.id, { name: e.target.value })}
              className="min-w-[10rem] flex-1"
            />
            {isEntry ? <EntryChip /> : null}
          </div>
          <ElevatedInput
            value={stage.description}
            disabled={disabled}
            maxLength={500}
            placeholder={t("descriptionPlaceholder")}
            controlSize="sm"
            aria-label={t("descriptionLabel")}
            onChange={(e) => onPatch(stage.id, { description: e.target.value })}
          />
        </div>

        <button
          type="button"
          disabled={disabled || locked}
          onClick={() => onRemove(stage.id)}
          title={locked ? t("lockedHint") : t("remove")}
          aria-label={
            locked
              ? t("lockedHint")
              : t("removeNamed", { name: stage.name || t("untitled") })
          }
          className={cn(
            "mt-1.5 flex h-7 w-7 flex-none items-center justify-center rounded-[--radius] text-muted-foreground",
            "transition-colors hover:bg-destructive hover:text-destructive-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-30",
          )}
        >
          <Trash className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />
        </button>
      </div>
    </Reorder.Item>
  );
}

/* ------------------------------------------------------------------ PIECES */

/**
 * The empty state teaches the mechanism instead of reporting absence: what a
 * column is for, and that the first one is where conversations arrive.
 */
function EmptyStages({
  onAdd,
  disabled,
}: {
  onAdd: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("funnels.stages");
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-strong px-4 py-6">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary-ink" weight="bold" aria-hidden="true" />
        <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-foreground">
          {t("emptyTitle")}
        </h3>
      </div>
      <p className="max-w-[62ch] text-sm leading-snug text-muted-foreground">
        {t("emptyBody")}
      </p>
      <ElevatedButton
        variant="primary"
        size="sm"
        onClick={onAdd}
        disabled={disabled}
        icon={<Plus className="h-3.5 w-3.5" weight="bold" />}
        iconVisible
        title={t("addFirst")}
      />
    </div>
  );
}

/**
 * The entry marker states a consequence, not a status: this is where a new
 * conversation lands. Neutral ground with the accent in the glyph, the system's
 * rule for a mark that is not a selection.
 */
function EntryChip() {
  const t = useTranslations("funnels.stages");
  return (
    <span className="inline-flex flex-none items-center gap-1 rounded-[--radius] bg-card px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">
      <Target className="h-3 w-3 text-primary-ink" weight="bold" aria-hidden="true" />
      {t("entry")}
    </span>
  );
}

function ColorPicker({
  value,
  onChange,
  disabled,
  name,
  shape = "swatch",
}: {
  value: string;
  onChange: (color: string) => void;
  disabled: boolean;
  name: string;
  /** The board head carries the colour as the CRM's 3px lamp, not as a chip. */
  shape?: "swatch" | "lamp";
}) {
  const t = useTranslations("funnels.stages");
  const labelId = useId();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={t("colorFor", { name })}
          className={cn(
            "flex-none transition-shadow",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            shape === "lamp"
              ? "h-3 w-[3px] rounded-[1px]"
              : "mt-1.5 h-7 w-7 rounded-[--radius] border border-control-edge",
          )}
          style={{ backgroundColor: value }}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <p id={labelId} className="legend mb-2 px-0.5">
          {t("colorLabel")}
        </p>
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="grid grid-cols-6 gap-1.5"
        >
          {STAGE_COLORS.map((color) => {
            const active = color.toUpperCase() === value.trim().toUpperCase();
            return (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={color}
                onClick={() => onChange(color)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-[--radius] border border-control-edge",
                  "transition-transform hover:scale-105",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                style={{ backgroundColor: color }}
              >
                {/* The tick is drawn in the ink this swatch can actually carry.
                    A fixed foreground disappears on half the palette: near-black
                    on indigo, white on lime. */}
                {active ? (
                  <Check
                    className="h-3.5 w-3.5"
                    style={{ color: readableInkFor(color) }}
                    weight="bold"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
