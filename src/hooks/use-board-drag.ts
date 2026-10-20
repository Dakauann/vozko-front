"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MouseEventHandler,
  type TouchEventHandler,
  type TouchEvent as ReactTouchEvent,
} from "react";
import {
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DndContextProps,
  type DragEndEvent,
  type DragStartEvent,
  type DroppableContainer,
  type KeyboardCoordinateGetter,
  type MouseSensorOptions,
  type TouchSensorOptions,
  type Over,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { usePortalContainer } from "@/contexts/host-document-context";
import { cssCubicBezier, durationMs, easing } from "@/lib/motion/tokens";
import {
  adjacentColumn,
  boardAnnouncement,
  boardDragId,
  resolveBoardDrop,
  shiftToCenter,
  type BoardDragPhase,
  type BoardDragSubject,
  type BoardStepDirection,
  type ColumnSlot,
} from "@/lib/crm/board-drag";

const DRAG_ACTIVATION_DISTANCE_PX = 5;
const TOUCH_HOLD_MS = 250;
const NO_DRAG_SELECTOR =
  "button, a, input, textarea, select, [contenteditable='true'], [role='menu'], [data-board-no-drag]";

interface CardDragData {
  kind: "card";
  id: string;
  columnId: string;
}

interface ColumnDragData {
  kind: "column";
  columnId: string;
  reorderable: boolean;
}

type BoardDragData = CardDragData | ColumnDragData;

function dragData(source: Active | Over | DroppableContainer | null): BoardDragData | null {
  const data = source?.data.current as BoardDragData | undefined;
  return data?.kind === "card" || data?.kind === "column" ? data : null;
}

function subjectOf(active: Active | null): BoardDragSubject | null {
  const data = dragData(active);
  if (!data) return null;
  return data.kind === "card"
    ? { kind: "card", id: data.id, columnId: data.columnId }
    : { kind: "column", id: data.columnId, columnId: data.columnId };
}

function columnOf(over: Over | DroppableContainer | null): string | null {
  const data = dragData(over);
  return data?.kind === "column" ? data.columnId : null;
}

function acceptsDrop(subject: BoardDragSubject | null, container: DroppableContainer): boolean {
  const data = dragData(container);
  if (!subject || data?.kind !== "column") return false;
  return subject.kind === "card" || data.reorderable;
}

function startsOnOwnSurface(event: ReactMouseEvent | ReactTouchEvent): boolean {
  const target = event.target as Element | null;
  const surface = event.currentTarget as Element;
  if (!target || typeof target.closest !== "function" || !surface.contains(target)) return false;
  const interactive = target.closest(NO_DRAG_SELECTOR);
  return !interactive || interactive === surface || !surface.contains(interactive);
}

class BoardMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: "onMouseDown" as const,
      handler: (
        event: ReactMouseEvent,
        { onActivation }: MouseSensorOptions,
      ) => {
        if (event.nativeEvent.button !== 0 || !startsOnOwnSurface(event)) return false;
        onActivation?.({ event: event.nativeEvent });
        return true;
      },
    },
  ];
}

class BoardTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: (
        event: ReactTouchEvent,
        { onActivation }: TouchSensorOptions,
      ) => {
        if (event.nativeEvent.touches.length > 1 || !startsOnOwnSurface(event)) return false;
        onActivation?.({ event: event.nativeEvent });
        return true;
      },
    },
  ];
}

const ARROW_DIRECTIONS: Record<string, BoardStepDirection> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

const columnKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context },
) => {
  const direction = ARROW_DIRECTIONS[event.code];
  if (!direction) return undefined;
  event.preventDefault();
  const subject = subjectOf(context.active);
  const current = columnOf(context.over) ?? subject?.columnId;
  if (!subject || !current || !context.collisionRect) return undefined;
  const slots: ColumnSlot[] = [];
  for (const container of context.droppableContainers.getEnabled()) {
    const rect = context.droppableRects.get(container.id);
    const columnId = columnOf(container);
    if (rect && columnId && acceptsDrop(subject, container)) {
      slots.push({ id: columnId, left: rect.left, width: rect.width });
    }
  }
  const target = adjacentColumn(slots, current, direction);
  if (!target) return undefined;
  return {
    x: currentCoordinates.x + shiftToCenter(target, context.collisionRect),
    y: currentCoordinates.y,
  };
};

const boardCollisions: CollisionDetection = (args) => {
  const subject = subjectOf(args.active);
  const scoped = {
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => acceptsDrop(subject, c)),
  };
  if (subject?.kind === "column") return closestCenter(scoped);
  return args.pointerCoordinates ? pointerWithin(scoped) : rectIntersection(scoped);
};

const COLUMN_SHIFT = { duration: durationMs.state, easing: cssCubicBezier(easing.state) };

const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };

export interface BoardDragOptions {
  columnOrder: readonly string[];
  columnName: (columnId: string) => string;
  cardLabel: (cardId: string) => string;
  onCardDrop?: (drop: { itemId: string; from: string; to: string }) => void;
  onColumnReorder?: (order: string[]) => void;
}

export interface BoardDrag {
  active: BoardDragSubject | null;
  contextProps: DndContextProps;
}

function pointerDragBody(event: Event | null): HTMLElement | null {
  if (!event || !("button" in event)) return null;
  return (event.target as Node | null)?.ownerDocument?.body ?? null;
}

export function useBoardDrag({
  columnOrder,
  columnName,
  cardLabel,
  onCardDrop,
  onColumnReorder,
}: BoardDragOptions): BoardDrag {
  const t = useTranslations("crmKanban");
  const id = useId();
  const portalContainer = usePortalContainer();
  const [active, setActive] = useState<BoardDragSubject | null>(null);
  const grabbingBodyRef = useRef<HTMLElement | null>(null);
  const leftSourceRef = useRef(false);

  const sensors = useSensors(
    useSensor(BoardMouseSensor, {
      activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(BoardTouchSensor, {
      activationConstraint: { delay: TOUCH_HOLD_MS, tolerance: DRAG_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const announce = useCallback(
    (phase: BoardDragPhase, dragged: Active, over: Over | null): string | undefined => {
      const subject = subjectOf(dragged);
      if (!subject) return undefined;
      const overId = columnOf(over);
      if (phase === "lift") leftSourceRef.current = false;
      if (phase === "move" && !leftSourceRef.current && overId === subject.columnId) return undefined;
      if (phase === "move") leftSourceRef.current = true;
      const label = subject.kind === "card" ? cardLabel(subject.id) : columnName(subject.columnId);
      const { key, values } = boardAnnouncement(
        phase,
        { kind: subject.kind, label },
        {
          from: { id: subject.columnId, name: columnName(subject.columnId) },
          to: overId ? { id: overId, name: columnName(overId) } : null,
        },
      );
      return t(`announce.${key}`, values);
    },
    [cardLabel, columnName, t],
  );

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active: dragged }) => announce("lift", dragged, null),
      onDragOver: ({ active: dragged, over }) => announce("move", dragged, over),
      onDragEnd: ({ active: dragged, over }) => announce("drop", dragged, over),
      onDragCancel: ({ active: dragged }) => announce("cancel", dragged, null),
    }),
    [announce],
  );

  useEffect(
    () => () => {
      if (grabbingBodyRef.current) grabbingBodyRef.current.style.cursor = "";
    },
    [],
  );

  const finish = useCallback(() => {
    if (grabbingBodyRef.current) grabbingBodyRef.current.style.cursor = "";
    grabbingBodyRef.current = null;
    setActive(null);
  }, []);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActive(subjectOf(event.active));
    const body = pointerDragBody(event.activatorEvent);
    if (body) body.style.cursor = "grabbing";
    grabbingBodyRef.current = body;
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const drop = resolveBoardDrop(subjectOf(event.active), columnOf(event.over), columnOrder);
      finish();
      if (drop?.kind === "card") onCardDrop?.(drop);
      if (drop?.kind === "column") onColumnReorder?.(drop.order);
    },
    [columnOrder, finish, onCardDrop, onColumnReorder],
  );

  return {
    active,
    contextProps: {
      id,
      sensors,
      collisionDetection: boardCollisions,
      measuring: MEASURING,
      autoScroll: true,
      accessibility: {
        announcements,
        container: portalContainer,
        screenReaderInstructions: { draggable: t("instructions") },
      },
      onDragStart,
      onDragEnd,
      onDragCancel: finish,
    },
  };
}

export function useBoardCard({
  id,
  columnId,
  draggable,
  onOpen,
}: {
  id: string;
  columnId: string;
  draggable: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("crmKanban");
  const data = useMemo<CardDragData>(() => ({ kind: "card", id, columnId }), [id, columnId]);
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: boardDragId("card", id),
    data,
    disabled: !draggable,
    attributes: { roleDescription: t("cardRole") },
  });

  const ref = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (draggable) listeners?.onKeyDown?.(event);
      if (event.defaultPrevented || event.target !== event.currentTarget) return;
      if (event.key === "Enter" || (!draggable && event.key === " ")) {
        event.preventDefault();
        onOpen();
      }
    },
    [draggable, listeners, onOpen],
  );

  return {
    isDragging,
    cardProps: {
      ref,
      role: "button" as const,
      tabIndex: 0,
      "aria-roledescription": draggable ? attributes["aria-roledescription"] : undefined,
      "aria-describedby": draggable ? attributes["aria-describedby"] : undefined,
      onMouseDown: draggable
        ? (listeners?.onMouseDown as MouseEventHandler<HTMLElement> | undefined)
        : undefined,
      onTouchStart: draggable
        ? (listeners?.onTouchStart as TouchEventHandler<HTMLElement> | undefined)
        : undefined,
      onKeyDown,
    },
  };
}

export type ColumnDragHandle = HTMLAttributes<HTMLElement> & {
  ref: (node: HTMLElement | null) => void;
};

function translateOnly(transform: { x: number; y: number } | null): string | undefined {
  return transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined;
}

export function useBoardColumn({
  columnId,
  reorderable,
}: {
  columnId: string;
  reorderable: boolean;
}) {
  const t = useTranslations("crmKanban");
  const reducedMotion = useReducedMotion();
  const data = useMemo<ColumnDragData>(
    () => ({ kind: "column", columnId, reorderable }),
    [columnId, reorderable],
  );
  const {
    setNodeRef,
    setActivatorNodeRef,
    listeners,
    attributes,
    isDragging,
    isOver,
    active,
    transform,
    transition,
  } = useSortable({
    id: boardDragId("column", columnId),
    data,
    disabled: { draggable: !reorderable, droppable: false },
    attributes: { roleDescription: t("columnRole") },
    transition: reducedMotion ? null : COLUMN_SHIFT,
  });

  const dragHandle: ColumnDragHandle | undefined = reorderable
    ? {
        ref: setActivatorNodeRef,
        ...attributes,
        ...(listeners as HTMLAttributes<HTMLElement> | undefined),
        "aria-label": t("dragColumn"),
        title: t("dragColumn"),
      }
    : undefined;

  return {
    setNodeRef,
    isDragging,
    isCardOver: isOver && dragData(active)?.kind === "card",
    style: { transform: translateOnly(transform), transition: transition ?? undefined },
    dragHandle,
  };
}
