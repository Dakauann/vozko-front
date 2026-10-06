"use client";

import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CaretRight, Copy, Eye, EyeSlash, Image, Link, Lock, Square, Stack, Star, TextT, Trash } from "@/components/icons";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { BLEND_MODES, STUDIO_LIMITS, type BlendMode, type Layer, type LayerType } from "@/lib/studio/document";
import { dropPlacement, groupLayerIds, type DropPosition, type TreeItem } from "@/lib/studio/groups";
import { layerCaption, layerRows, rangeBetween, toggleIn, type GroupRow, type LayerRowEntry } from "@/lib/studio/layer-list";
import { clampTo, LAYER_RANGES } from "@/lib/studio/layer-ranges";
import { cn } from "@/lib/utils";

import { FIELD_CLASS, IconButton, NumberField, ToggleButton } from "../controls";
import { useEditorUi, useImageDoc, useImageEditor } from "../editor-state";
import { useSelectionActions, type MenuAction } from "../selection-actions";
import { LayerThumb } from "./layer-thumb";

const TYPE_ICONS: Record<LayerType, typeof Image> = { image: Image, text: TextT, shape: Square, icon: Star };
const DRAG_TYPE = "application/x-vozko-studio-item";
const INDENT_PX = 12;
const ROW_CLASS = "group relative flex h-8 items-center gap-1.5 pr-1 text-xs transition-colors";

function rowState(selected: boolean, dropping: DropPosition | null) {
  return cn(
    selected ? "bg-muted" : "hover:bg-muted",
    dropping === "above" && "shadow-[inset_0_2px_0_hsl(var(--primary))]",
    dropping === "below" && "shadow-[inset_0_-2px_0_hsl(var(--primary))]",
    dropping === "into" && "shadow-[inset_0_0_0_2px_hsl(var(--primary))]",
  );
}

function Lamp({ on }: { on: boolean }) {
  return <span aria-hidden className={cn("absolute left-0 top-1/2 -translate-y-1/2", on ? "lamp" : "w-[3px]")} />;
}

function readItem(event: DragEvent): TreeItem | null {
  try {
    const parsed = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as TreeItem;
    return parsed && (parsed.kind === "layer" || parsed.kind === "group") && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function dropZone(event: DragEvent<HTMLElement>, group: boolean): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / rect.height;
  if (!group) return ratio < 0.5 ? "above" : "below";
  return ratio < 0.25 ? "above" : ratio > 0.75 ? "below" : "into";
}

function useDropTarget(target: TreeItem, group: boolean) {
  const { commands, store } = useImageEditor();
  const [dropping, setDropping] = useState<DropPosition | null>(null);
  return {
    dropping,
    handlers: {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        setDropping(dropZone(event, group));
      },
      onDragLeave: () => setDropping(null),
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        const where = dropZone(event, group);
        setDropping(null);
        const item = readItem(event);
        if (!item) return;
        const placement = dropPlacement(store.getState().document, item, target, where);
        if (placement) commands.moveItem(item, placement.toIndex, placement.parent);
      },
    },
  };
}

function RowMenu({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  const actions = useSelectionActions();
  const items: MenuAction[] = [...actions.edit.filter((a) => a.id !== "paste" && a.id !== "copy"), ...actions.order];
  return (
    <ContextMenu onOpenChange={(open) => open && onOpen()}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        {items.map((action) => (
          <ContextMenuItem key={action.id} disabled={action.disabled} onSelect={action.run} className={cn(action.destructive && "text-destructive-ink")}>
            {action.label}
            {action.shortcut ? <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut> : null}
          </ContextMenuItem>
        ))}
        <ContextMenuSeparator />
        {actions.style.map((action) => (
          <ContextMenuItem key={action.id} disabled={action.disabled} onSelect={action.run}>
            {action.label}
            {action.shortcut ? <ContextMenuShortcut>{action.shortcut}</ContextMenuShortcut> : null}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface RowSelect {
  (id: string, event: MouseEvent | KeyboardEvent): void;
}

function LayerRow({ row, layer, selected, onSelect }: { row: LayerRowEntry; layer: Layer; selected: boolean; onSelect: RowSelect }) {
  const t = useTranslations("studio.image.panels.layers");
  const tl = useTranslations("studio.image.layerKinds");
  const { commands, ui, store } = useImageEditor();
  const [renaming, setRenaming] = useState(false);
  const { dropping, handlers } = useDropTarget({ kind: "layer", id: layer.id }, false);
  const caption = layerCaption(layer);
  const label = "name" in caption ? caption.name : tl(caption.kind);
  const TypeIcon = TYPE_ICONS[layer.type];
  const total = store.getState().document.layers.length;

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      commands.move(layer.id, row.index + (event.key === "ArrowUp" ? 1 : -1));
    }
    if (event.key === "F2") {
      event.preventDefault();
      setRenaming(true);
    }
  };

  return (
    <RowMenu onOpen={() => !selected && commands.select([layer.id])}>
      <li
        draggable={!renaming}
        onDragStart={(event) => {
          event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: "layer", id: layer.id }));
          event.dataTransfer.effectAllowed = "move";
        }}
        onMouseEnter={() => ui.setState({ hoverLayerId: layer.id })}
        onMouseLeave={() => ui.setState({ hoverLayerId: null })}
        {...handlers}
        className={cn(ROW_CLASS, rowState(selected, dropping))}
        style={{ paddingLeft: 4 + row.depth * INDENT_PX }}
      >
        <Lamp on={selected} />
        <IconButton label={layer.hidden ? t("show") : t("hide")} onClick={() => commands.setHidden([layer.id], !layer.hidden)} className="h-6 min-w-6 px-0.5 text-muted-foreground">
          {layer.hidden ? <EyeSlash className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
        </IconButton>
        {layer.clip ? <Link className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={t("clipped")} /> : null}
        <LayerThumb layer={layer} />
        {renaming ? (
          <input
            autoFocus
            defaultValue={layer.name ?? ""}
            placeholder={label}
            maxLength={STUDIO_LIMITS.maxLayerNameRunes}
            aria-label={t("rename")}
            onBlur={(event) => {
              commands.rename(layer.id, event.target.value);
              setRenaming(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setRenaming(false);
            }}
            className={cn(FIELD_CLASS, "h-6")}
          />
        ) : (
          <button
            type="button"
            aria-pressed={selected}
            aria-label={t("rowLabel", { name: label, position: total - row.index, total })}
            onClick={(event) => onSelect(layer.id, event)}
            onDoubleClick={() => setRenaming(true)}
            onKeyDown={onKey}
            className={cn(
              "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-[--radius] px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              layer.hidden && "opacity-50",
            )}
          >
            <TypeIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-foreground">{label}</span>
          </button>
        )}
        <IconButton
          label={layer.locked ? t("unlock") : t("lock")}
          onClick={() => commands.setLocked([layer.id], !layer.locked)}
          className={cn("h-6 min-w-6 px-0.5 text-muted-foreground", !layer.locked && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100")}
        >
          <Lock className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </li>
    </RowMenu>
  );
}

function GroupHeader({ row, collapsed, selected, members }: { row: GroupRow; collapsed: boolean; selected: boolean; members: Layer[] }) {
  const t = useTranslations("studio.image.panels.layers");
  const { commands, ui, store } = useImageEditor();
  const [renaming, setRenaming] = useState(false);
  const { dropping, handlers } = useDropTarget({ kind: "group", id: row.groupId }, true);
  const label = row.name ?? t("groupName");
  const hidden = members.length > 0 && members.every((l) => l.hidden);
  const locked = members.length > 0 && members.every((l) => l.locked);

  return (
    <RowMenu onOpen={() => !selected && commands.select(row.ids)}>
      <li
        draggable={!renaming}
        onDragStart={(event) => {
          event.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind: "group", id: row.groupId }));
          event.dataTransfer.effectAllowed = "move";
        }}
        {...handlers}
        className={cn(ROW_CLASS, rowState(selected, dropping))}
        style={{ paddingLeft: 4 + row.depth * INDENT_PX }}
      >
        <Lamp on={selected} />
        <IconButton label={hidden ? t("show") : t("hide")} onClick={() => commands.setHidden(row.ids, !hidden)} className="h-6 min-w-6 px-0.5 text-muted-foreground">
          {hidden ? <EyeSlash className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
        </IconButton>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("expand", { name: label }) : t("collapse", { name: label })}
          onClick={() => ui.setState((s) => ({ collapsedGroups: toggleIn(s.collapsedGroups, [row.groupId]) }))}
          className="flex h-6 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? <CaretRight className="h-3 w-3" aria-hidden /> : <CaretDown className="h-3 w-3" aria-hidden />}
        </button>
        <Stack className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {renaming ? (
          <input
            autoFocus
            defaultValue={row.name ?? ""}
            placeholder={label}
            maxLength={STUDIO_LIMITS.maxLayerNameRunes}
            aria-label={t("renameGroup")}
            onBlur={(event) => {
              commands.renameGroup(row.groupId, event.target.value);
              setRenaming(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setRenaming(false);
            }}
            className={cn(FIELD_CLASS, "h-6")}
          />
        ) : (
          <button
            type="button"
            aria-pressed={selected}
            onClick={(event) => (event.ctrlKey || event.metaKey ? commands.select(toggleIn(store.getState().selection, row.ids)) : commands.select(row.ids))}
            onDoubleClick={() => setRenaming(true)}
            onKeyDown={(event) => {
              if (event.key === "F2") setRenaming(true);
            }}
            className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-[--radius] px-1 text-left font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate text-foreground">{label}</span>
            <span className="readout text-2xs font-normal text-muted-foreground">{row.ids.length}</span>
          </button>
        )}
        <IconButton
          label={locked ? t("unlock") : t("lock")}
          onClick={() => commands.setLocked(row.ids, !locked)}
          className={cn("h-6 min-w-6 px-0.5 text-muted-foreground", !locked && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100")}
        >
          <Lock className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      </li>
    </RowMenu>
  );
}

function SelectionBar() {
  const t = useTranslations("studio.image.panels.layers");
  const tb = useTranslations("studio.image.blend");
  const { commands } = useImageEditor();
  const layers = useImageDoc((s) => s.document.layers);
  const selection = useImageDoc((s) => s.selection);
  const picked = useMemo(() => layers.filter((l) => selection.includes(l.id)), [layers, selection]);
  const first = picked[0];
  const disabled = !first || picked.every((l) => l.locked);
  const blend: BlendMode = first?.blendMode ?? "normal";
  const clipped = picked.length > 0 && picked.every((l) => l.clip);
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
      <select
        aria-label={t("blendMode")}
        value={blend}
        disabled={disabled}
        onChange={(event) => commands.patchLayers(selection, { blendMode: event.target.value === "normal" ? undefined : (event.target.value as BlendMode) })}
        className={cn(FIELD_CLASS, "min-w-0 flex-1")}
      >
        {BLEND_MODES.map((mode) => (
          <option key={mode} value={mode}>
            {tb(mode)}
          </option>
        ))}
      </select>
      <div className="w-[68px] shrink-0">
        <NumberField
          label={t("opacity")}
          bare
          value={Math.round((first?.transform.opacity ?? 1) * 100)}
          min={0}
          max={100}
          suffix="%"
          disabled={disabled}
          onCommit={(value) => commands.patchLayers(selection, (layer) => ({ transform: { ...layer.transform, opacity: clampTo(value / 100, LAYER_RANGES.opacity) } }))}
        />
      </div>
      <ToggleButton label={clipped ? t("unclip") : t("clip")} pressed={clipped} disabled={disabled} onClick={() => commands.patchLayers(selection, { clip: clipped ? undefined : true })}>
        <Link className="h-3.5 w-3.5" aria-hidden />
      </ToggleButton>
    </div>
  );
}

function FooterBar() {
  const actions = useSelectionActions();
  const find = (id: string) => actions.edit.find((a) => a.id === id);
  const group = find("group") ?? find("ungroup");
  const duplicate = find("duplicate");
  const remove = find("delete");
  return (
    <div className="flex shrink-0 items-center justify-end gap-0.5 border-t border-border px-1.5 py-1">
      {group ? (
        <IconButton label={group.label} onClick={group.run} disabled={group.disabled}>
          <Stack className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      ) : null}
      {duplicate ? (
        <IconButton label={duplicate.label} onClick={duplicate.run} disabled={duplicate.disabled}>
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      ) : null}
      {remove ? (
        <IconButton label={remove.label} onClick={remove.run} disabled={remove.disabled}>
          <Trash className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
      ) : null}
    </div>
  );
}

export function LayersPanel() {
  const t = useTranslations("studio.image.panels.layers");
  const { commands, store } = useImageEditor();
  const document = useImageDoc((s) => s.document);
  const selection = useImageDoc((s) => s.selection);
  const collapsedGroups = useEditorUi((s) => s.collapsedGroups);
  const anchor = useRef<string | null>(null);

  const collapsed = useMemo(() => new Set(collapsedGroups), [collapsedGroups]);
  const rows = useMemo(() => layerRows(document, collapsed), [document, collapsed]);
  const order = useMemo(() => rows.filter((r): r is LayerRowEntry => r.kind === "layer").map((r) => r.id), [rows]);
  const byId = useMemo(() => new Map(document.layers.map((l) => [l.id, l])), [document.layers]);
  const chosen = new Set(selection);

  const onSelect: RowSelect = (id, event) => {
    const current = store.getState().selection;
    if (event.shiftKey) commands.select(rangeBetween(order, anchor.current, id));
    else if (event.ctrlKey || event.metaKey) commands.select(toggleIn(current, [id]));
    else commands.select([id]);
    if (!event.shiftKey) anchor.current = id;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SelectionBar />
      <div className="min-h-0 flex-1 overflow-y-auto py-0.5">
        {rows.length === 0 ? <p className="px-3 py-2 text-xs text-muted-foreground">{t("empty")}</p> : null}
        <ul aria-label={t("title")}>
          {rows.map((row) => {
            if (row.kind === "group") {
              const members = groupLayerIds(document, row.groupId)
                .map((id) => byId.get(id))
                .filter((l): l is Layer => Boolean(l));
              return (
                <GroupHeader
                  key={`g-${row.groupId}-${row.ids[0]}`}
                  row={row}
                  members={members}
                  collapsed={collapsed.has(row.groupId)}
                  selected={row.ids.length > 0 && row.ids.every((id) => chosen.has(id))}
                />
              );
            }
            const layer = byId.get(row.id);
            return layer ? <LayerRow key={row.id} row={row} layer={layer} selected={chosen.has(row.id)} onSelect={onSelect} /> : null;
          })}
        </ul>
      </div>
      <FooterBar />
    </div>
  );
}
