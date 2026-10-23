"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import { ArrowClockwise, ArrowCounterClockwise, Desktop, DeviceMobile, Eye, Gear, Moon, PencilSimple } from "@/components/icons";
import {
  canAddBlocks,
  canMoveBy,
  collectIds,
  createBlock,
  duplicateBlock,
  findBlock,
  footerIndex,
  insertBlock,
  isChildKind,
  moveBlock,
  moveBlockBy,
  removeBlock,
  setColumnsRatio,
  updateBlock,
  updateSettings,
  type BlockCopy,
  type Position,
} from "@/lib/email-design/document";
import { canRedo, canUndo, historyReducer, initHistory, type History, type HistoryAction } from "@/lib/email-design/history";
import { hintTarget, issueTarget, isSettingsField, TEXT_CONTENT_FIELD, type IssueTarget } from "@/lib/email-design/issue-target";
import { DARK_CLIENT_BACKGROUND, emailLook, MOBILE_VIEWPORT, type Device } from "@/lib/email-design/look";
import type { CustomField } from "@/lib/email-design/merge-tags";
import type { BlockKind, ColumnRatio, Document, Hint, Issue, Settings } from "@/lib/email-design/types";
import { matchesChord, platformOf } from "@/lib/keyboard/chord";
import { isEditableTarget, isInsideOverlay } from "@/lib/keyboard/stroke";
import { cn } from "@/lib/utils";

import { AgentCursor } from "@/components/studio/agent/agent-cursor";

import { EMAIL_CANVAS_ANCHOR, useEmailEditorAgent, type EmailAgentBinding } from "./agent/use-email-agent";
import { KIND_ICONS } from "./block-meta";
import { Canvas, type CanvasActions } from "./canvas";
import { useEmailViewLabels } from "./email-view";
import { Inspector } from "./inspector";
import { IssuesRail, type RailEntry } from "./issues-rail";
import { KeyboardHelp } from "./keyboard-help";
import { Palette } from "./palette";
import { PreviewPane } from "./preview-pane";

export interface EmailEditorProps {
  value: Document;
  onChange: (document: Document) => void;
  issues?: readonly Issue[];
  hints?: readonly Hint[];
  customFields?: readonly CustomField[];
  onRequestPreview?: () => void;
  previewHtml?: string;
  previewLoading?: boolean;
  readOnly?: boolean;
  className?: string;
  agent?: EmailAgentBinding;
}

type Mode = "edit" | "preview";

interface DragState {
  kind: BlockKind;
  blockId: string | null;
}

const NO_FIELDS: readonly CustomField[] = [];
const FRAME_GUTTER = 40;

const smallestHit: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length <= 1) return hits;
  const area = (id: string | number) => {
    const rect = args.droppableRects.get(id);
    return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY;
  };
  return [...hits].sort((a, b) => area(a.id) - area(b.id)).slice(0, 1);
};

function quoted(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function samePosition(a: Position | null, b: Position | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function focusTarget(scope: HTMLElement | null, selector: string): boolean {
  const element = scope?.querySelector<HTMLElement>(selector);
  if (!element) return false;
  const focusable = element.matches("input, textarea, button, [contenteditable='true'], [tabindex]")
    ? element
    : element.querySelector<HTMLElement>("input, textarea, button, [contenteditable='true']");
  (focusable ?? element).scrollIntoView?.({ block: "nearest" });
  (focusable ?? element).focus();
  return true;
}

const NO_TASKS: readonly never[] = [];

export function EmailEditor({ value, onChange, issues, hints, customFields = NO_FIELDS, onRequestPreview, previewHtml, previewLoading = false, readOnly = false, className, agent }: EmailEditorProps) {
  const t = useTranslations("emailEditor");
  const [history, setHistory] = useState<History<Document>>(() => initHistory(value));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("edit");
  const [device, setDevice] = useState<Device>("desktop");
  const [dark, setDark] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<Position | null>(null);

  if (value !== history.present) setHistory(historyReducer(history, { type: "adopt", value }));

  const live = useRef({ history, value, onChange, readOnly, dragging: false, selectedId });
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const pendingFocus = useRef<IssueTarget | null>(null);
  const pendingScroll = useRef<string | null>(null);

  useLayoutEffect(() => {
    live.current = { history, value, onChange, readOnly, dragging: drag !== null, selectedId };
  });

  useEffect(() => {
    const target = pendingFocus.current;
    if (target) {
      pendingFocus.current = null;
      if (target.field === TEXT_CONTENT_FIELD && target.blockId) {
        focusTarget(canvasRef.current, `[data-block-id="${quoted(target.blockId)}"] [data-email-field="${TEXT_CONTENT_FIELD}"]`);
      } else if (target.field) {
        if (!focusTarget(inspectorRef.current, `[data-email-field="${quoted(target.field)}"]`) && target.blockId) {
          focusTarget(canvasRef.current, `[data-block-id="${quoted(target.blockId)}"]`);
        }
      } else if (target.blockId) {
        focusTarget(canvasRef.current, `[data-block-id="${quoted(target.blockId)}"]`);
      }
    }
    const scroll = pendingScroll.current;
    if (scroll) {
      pendingScroll.current = null;
      canvasRef.current?.querySelector<HTMLElement>(`[data-block-id="${quoted(scroll)}"]`)?.scrollIntoView?.({ block: "nearest" });
    }
  });

  const copy: BlockCopy = useMemo(
    () => ({ heading: t("defaults.heading"), text: t("defaults.text"), button: t("defaults.button"), footerCompany: t("defaults.footerCompany"), footerAddress: t("defaults.footerAddress") }),
    [t],
  );

  const labels = useEmailViewLabels();

  const actions = useMemo(() => {
    const record = (action: HistoryAction<Document>) => {
      const current = live.current;
      const next = historyReducer(current.history, action);
      if (next === current.history) return;
      current.history = next;
      current.value = next.present;
      setHistory(next);
      current.onChange(next.present);
    };
    const apply = (operation: (document: Document) => Document, group?: string) => {
      if (live.current.readOnly) return;
      const before = live.current.value;
      const next = operation(before);
      if (next === before) return;
      record({ type: "commit", value: next, group, at: Date.now() });
    };
    const select = (id: string | null) => setSelectedId(id);
    const insertKind = (kind: BlockKind, position: Position) => {
      const before = live.current.value;
      if (!canAddBlocks(before)) return;
      const block = createBlock(kind, copy, collectIds(before));
      const next = insertBlock(before, block, position);
      if (next === before) return;
      apply(() => next);
      setSelectedId(block.id);
      pendingScroll.current = block.id;
    };
    const canvas: CanvasActions = {
      select,
      patch: (id, update, group) => apply((document) => updateBlock(document, id, update), group),
      moveBy: (id, delta) => apply((document) => moveBlockBy(document, id, delta)),
      canMove: (id, delta) => !live.current.readOnly && canMoveBy(live.current.value, id, delta),
      duplicate: (id) => {
        const before = live.current.value;
        if (!canAddBlocks(before)) return;
        const result = duplicateBlock(before, id);
        if (!result.id) return;
        apply(() => result.document);
        setSelectedId(result.id);
        pendingScroll.current = result.id;
      },
      remove: (id) => {
        const before = live.current.value;
        const found = findBlock(before, id);
        if (!found || found.block.kind === "footer") return;
        apply((document) => removeBlock(document, id));
        setSelectedId(null);
      },
      insertKind,
    };
    const join = (group: string, next: Document) => {
      if (live.current.readOnly || next === live.current.value) return;
      record({ type: "commit", value: next, group, at: Date.now(), join: true });
    };
    return {
      canvas,
      apply,
      join,
      undo: () => record({ type: "undo" }),
      redo: () => record({ type: "redo" }),
      settings: (patch: Partial<Settings>, group: string) => apply((document) => updateSettings(document, patch), group),
      ratio: (id: string, ratio: ColumnRatio) => apply((document) => setColumnsRatio(document, id, ratio)),
    };
  }, [copy]);

  const presence = useEmailEditorAgent(agent, live, actions.join);

  const selectedFound = selectedId ? findBlock(value, selectedId) : null;
  const selected = selectedFound?.block ?? null;
  const activeId = selected ? selected.id : null;
  const look = useMemo(() => emailLook(value.settings, device), [value.settings, device]);
  const frameWidth = device === "mobile" ? MOBILE_VIEWPORT : look.width + 2 * FRAME_GUTTER;

  const addFromPalette = (kind: BlockKind) => {
    const doc = value;
    let position: Position = { container: { kind: "root" }, index: Math.max(0, footerIndex(doc)) };
    if (selectedFound) {
      const at = selectedFound.position;
      if (at.container.kind === "column" && isChildKind(kind)) position = { container: at.container, index: at.index + 1 };
      else if (at.container.kind === "column") {
        const parent = doc.blocks.findIndex((block) => at.container.kind === "column" && block.id === at.container.columnsId);
        position = { container: { kind: "root" }, index: parent + 1 };
      } else if (selectedFound.block.kind !== "footer") position = { container: { kind: "root" }, index: at.index + 1 };
    }
    if (footerIndex(doc) < 0 && position.container.kind === "root" && !selectedFound) position = { container: { kind: "root" }, index: doc.blocks.length };
    actions.canvas.insertKind(kind, position);
  };

  const jump = (entry: RailEntry) => {
    const target = entry.kind === "issue" ? issueTarget(entry.item) : hintTarget(entry.item);
    setMode("edit");
    if (target.blockId && findBlock(value, target.blockId)) setSelectedId(target.blockId);
    else if (!target.blockId || isSettingsField(target.field)) setSelectedId(null);
    pendingFocus.current = target;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isInsideOverlay(event.target)) return;
    const platform = platformOf(typeof navigator === "undefined" ? undefined : navigator);
    const stroke = event.nativeEvent;
    const editable = isEditableTarget(event.target);
    if (matchesChord(stroke, "Mod+z", platform)) {
      event.preventDefault();
      actions.undo();
      return;
    }
    if (matchesChord(stroke, "Mod+Shift+z", platform) || matchesChord(stroke, "Mod+y", platform)) {
      event.preventDefault();
      actions.redo();
      return;
    }
    if (matchesChord(stroke, "Mod+d", platform)) {
      event.preventDefault();
      if (activeId) actions.canvas.duplicate(activeId);
      return;
    }
    if (mode !== "edit") return;
    if (event.key === "Escape") {
      if (editable && activeId) {
        event.preventDefault();
        canvasRef.current?.querySelector<HTMLElement>(`[data-block-id="${quoted(activeId)}"]`)?.focus();
        return;
      }
      if (activeId) {
        event.preventDefault();
        setSelectedId(null);
      }
      return;
    }
    if (editable || !activeId) return;
    if ((event.key === "Delete" || event.key === "Backspace") && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      actions.canvas.remove(activeId);
      return;
    }
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      actions.canvas.moveBy(activeId, event.key === "ArrowUp" ? -1 : 1);
      pendingFocus.current = { blockId: activeId, field: null };
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as { kind?: BlockKind; blockId?: string } | undefined;
    if (data?.kind) setDrag({ kind: data.kind, blockId: null });
    else if (data?.blockId) {
      const found = findBlock(value, data.blockId);
      if (found) setDrag({ kind: found.block.kind, blockId: data.blockId });
    }
  };

  const targetFor = (event: DragMoveEvent, state: DragState): Position | null => {
    const over = event.over;
    if (!over) return null;
    const data = over.data.current as { container?: Position["container"]; blockId?: string } | undefined;
    if (data?.container) {
      if (!isChildKind(state.kind) || data.container.kind !== "column") return null;
      const columnsId = data.container.columnsId;
      const parent = value.blocks.find((block) => block.id === columnsId);
      const count = parent && parent.kind === "columns" ? (parent.columns.columns[data.container.column]?.blocks.length ?? 0) : 0;
      return { container: data.container, index: count };
    }
    if (!data?.blockId) return null;
    const found = findBlock(value, data.blockId);
    if (!found) return null;
    if (found.block.kind === "footer") return { container: { kind: "root" }, index: found.position.index };
    if (found.position.container.kind === "column" && !isChildKind(state.kind)) return null;
    const pointer = event.activatorEvent as PointerEvent | undefined;
    const y = (pointer?.clientY ?? 0) + event.delta.y;
    const after = y > over.rect.top + over.rect.height / 2;
    return { container: found.position.container, index: found.position.index + (after ? 1 : 0) };
  };

  const onDragMove = (event: DragMoveEvent) => {
    if (!drag) return;
    const next = targetFor(event, drag);
    setDropTarget((previous) => (samePosition(previous, next) ? previous : next));
  };

  const finishDrag = (event: DragEndEvent | null) => {
    const state = drag;
    const target = event && state ? targetFor(event, state) : null;
    setDrag(null);
    setDropTarget(null);
    if (!state || !target) return;
    if (state.blockId) {
      const blockId = state.blockId;
      actions.apply((document) => moveBlock(document, blockId, target));
      setSelectedId(blockId);
    } else {
      actions.canvas.insertKind(state.kind, target);
    }
  };

  const atLimit = !canAddBlocks(value);
  const DragGlyph = drag ? KIND_ICONS[drag.kind] : null;

  return (
    <DndContext sensors={sensors} collisionDetection={smallestHit} onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={finishDrag} onDragCancel={() => finishDrag(null)}>
      <div
        role="region"
        aria-label={t("label")}
        onKeyDown={onKeyDown}
        className={cn("flex h-full min-h-[640px] flex-col overflow-hidden rounded-lg border border-border bg-card", className)}
      >
        <div role="toolbar" aria-label={t("toolbar.editor")} className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
          <ElevatedPillToggle<Mode>
            aria-label={t("toolbar.mode")}
            size="md"
            value={mode}
            onChange={(next) => {
              setMode(next);
              if (next === "preview") onRequestPreview?.();
            }}
            options={[
              { value: "edit", label: t("toolbar.edit"), icon: <PencilSimple className="h-4 w-4" /> },
              { value: "preview", label: t("toolbar.preview"), icon: <Eye className="h-4 w-4" /> },
            ]}
          />
          <ElevatedPillToggle<Device>
            aria-label={t("toolbar.device")}
            size="md"
            collapseLabels="md"
            value={device}
            onChange={setDevice}
            options={[
              { value: "desktop", label: t("toolbar.desktop"), icon: <Desktop className="h-4 w-4" /> },
              { value: "mobile", label: t("toolbar.mobile"), icon: <DeviceMobile className="h-4 w-4" /> },
            ]}
          />
          {mode === "preview" ? (
            <button
              type="button"
              aria-pressed={dark}
              onClick={() => setDark((current) => !current)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[--radius] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                dark ? "bg-primary text-primary-foreground shadow-button-primary [--icon-accent:currentColor]" : "text-foreground hover:bg-muted",
              )}
            >
              <Moon className="h-4 w-4" />
              {t("toolbar.darkBackdrop")}
            </button>
          ) : null}
          <div className="ml-auto flex items-center gap-0.5">
            {!readOnly ? (
              <>
                <IconButton label={t("toolbar.undo")} disabled={!canUndo(history)} onClick={actions.undo}>
                  <ArrowCounterClockwise className="h-4 w-4" />
                </IconButton>
                <IconButton label={t("toolbar.redo")} disabled={!canRedo(history)} onClick={actions.redo}>
                  <ArrowClockwise className="h-4 w-4" />
                </IconButton>
                <span aria-hidden className="mx-1 h-5 w-px bg-border" />
              </>
            ) : null}
            <KeyboardHelp />
            <IconButton
              label={t("toolbar.documentSettings")}
              pressed={mode === "edit" && activeId === null}
              onClick={() => {
                setMode("edit");
                setSelectedId(null);
              }}
            >
              <Gear className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside aria-label={t("regions.palette")} className="flex shrink-0 flex-col border-b border-border bg-card lg:w-56 lg:border-b-0 lg:border-r 2xl:w-64">
            <div className="min-h-0 overflow-y-auto lg:flex-none">
              <Palette disabled={readOnly || atLimit || mode !== "edit"} onAdd={addFromPalette} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col border-t border-border">
              <IssuesRail document={value} issues={issues} hints={hints} onJump={jump} />
            </div>
          </aside>

          <div
            ref={canvasRef}
            data-email-canvas
            className="relative min-h-[480px] min-w-0 flex-1 overflow-auto bg-muted px-6 pb-16 pt-14"
            style={mode === "preview" && dark ? { backgroundColor: DARK_CLIENT_BACKGROUND } : undefined}
            onClick={() => {
              if (mode === "edit" && activeId) setSelectedId(null);
            }}
          >
            {mode === "edit" ? (
              <Canvas
                document={value}
                look={look}
                selectedId={activeId}
                readOnly={readOnly}
                dropTarget={dropTarget}
                actions={actions.canvas}
                labels={labels}
                customFields={customFields}
                frameWidth={frameWidth}
              />
            ) : (
              <PreviewPane html={previewHtml} loading={previewLoading} dark={dark} frameWidth={frameWidth} onRequest={onRequestPreview} />
            )}
          </div>

          <aside ref={inspectorRef} aria-label={t("regions.inspector")} className="shrink-0 overflow-y-auto border-t border-border bg-card lg:w-80 lg:border-l lg:border-t-0">
            <Inspector
              document={value}
              selected={selected}
              insideColumns={selectedFound?.position.container.kind === "column"}
              customFields={customFields}
              readOnly={readOnly}
              onSettings={actions.settings}
              onBlock={(id, update, group) => actions.apply((document) => updateBlock(document, id, update), group)}
              onColumnsRatio={actions.ratio}
              onShowDocument={() => setSelectedId(null)}
            />
          </aside>
        </div>
      </div>
      {presence ? <AgentCursor presence={presence} tasks={NO_TASKS} anchor={EMAIL_CANVAS_ANCHOR} /> : null}
      <DragOverlay dropAnimation={null}>
        {drag && DragGlyph ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-border-strong bg-popover px-3 py-2 text-sm font-medium text-foreground shadow-lg">
            <DragGlyph className="h-4 w-4" />
            {t(`palette.kinds.${drag.kind}.label`)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function IconButton({ label, onClick, disabled, pressed, children }: { label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-[--radius] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35",
        pressed && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}
