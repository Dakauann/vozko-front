"use client";

import { Fragment, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Artboard as ArtboardIcon, CaretDown, CaretRight, Copy, Eye, EyeSlash, Image, Link, Lock, PencilSimple, Plus, Square, Stack, Star, TextT, Trash } from "@/components/icons";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { artboardOfItem } from "@/lib/studio/artboards";
import { BLEND_MODES, IMAGE_PRESETS, STUDIO_LIMITS, type Artboard, type BlendMode, type Layer, type LayerType } from "@/lib/studio/document";
import { groupLayerIds, type DropPosition, type TreeItem } from "@/lib/studio/groups";
import { layerCaption, layerRows, rangeBetween, toggleIn, type GroupRow, type LayerRowEntry } from "@/lib/studio/layer-list";
import { clampTo, LAYER_RANGES } from "@/lib/studio/layer-ranges";
import { cn } from "@/lib/utils";

import { FIELD_CLASS, IconButton, NumberField, ToggleButton } from "../controls";
import { useArtboardNames } from "../artboard-names";
import { useActiveArtboard, useEditorUi, useImageDoc, useImageEditor } from "../editor-state";
import { useSelectionActions, type MenuAction } from "../selection-actions";
import { LayerThumb } from "./layer-thumb";

const TYPE_ICONS: Record<LayerType, typeof Image> = { image: Image, text: TextT, shape: Square, icon: Star };
const DRAG_TYPE = "application/x-vozko-studio-item";
const INDENT_PX = 12;
const ROW_CLASS = "group relative flex h-8 select-none items-center gap-1.5 pr-1 text-xs transition-colors";

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

function RowRename({ value, placeholder, label, onCommit, onCancel }: { value: string; placeholder: string; label: string; onCommit: (name: string) => void; onCancel: () => void }) {
  return (
    <input
      autoFocus
      defaultValue={value}
      placeholder={placeholder}
      maxLength={STUDIO_LIMITS.maxLayerNameRunes}
      aria-label={label}
      onBlur={(event) => onCommit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") onCancel();
      }}
      className={cn(FIELD_CLASS, "h-6 select-text")}
    />
  );
}

function RowCaret({ collapsed, label, onToggle }: { collapsed: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={label}
      onClick={onToggle}
      className="flex h-6 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {collapsed ? <CaretRight className="h-3 w-3" aria-hidden /> : <CaretDown className="h-3 w-3" aria-hidden />}
    </button>
  );
}

function readItem(event: DragEvent): TreeItem | null {
  try {
    const parsed = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as TreeItem;
    return parsed && (parsed.kind === "layer" || parsed.kind === "group") && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function dropZone(event: DragEvent<HTMLElement>): DropPosition {
  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / rect.height;
  return ratio < 0.25 ? "above" : ratio > 0.75 ? "below" : "into";
}

function useDropTarget(target: TreeItem) {
  const { commands } = useImageEditor();
  const [dropping, setDropping] = useState<DropPosition | null>(null);
  return {
    dropping,
    handlers: {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        setDropping(dropZone(event));
      },
      onDragLeave: () => setDropping(null),
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        const where = dropZone(event);
        setDropping(null);
        const item = readItem(event);
        if (item) commands.dropItem(item, target, where);
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

interface LayerRowProps {
  row: LayerRowEntry;
  layer: Layer;
  members: Layer[];
  collapsed: boolean;
  selected: boolean;
  total: number;
  onSelect: RowSelect;
}

function LayerRow({ row, layer, members, collapsed, selected, total, onSelect }: LayerRowProps) {
  const t = useTranslations("studio.image.panels.layers");
  const tl = useTranslations("studio.image.layerKinds");
  const { commands, ui } = useImageEditor();
  const [renaming, setRenaming] = useState(false);
  const family = row.family;
  const item: TreeItem = family ? { kind: "group", id: family.scaffoldId } : { kind: "layer", id: layer.id };
  const { dropping, handlers } = useDropTarget(item);
  const caption = layerCaption(layer);
  const label = "name" in caption ? caption.name : tl(caption.kind);
  const TypeIcon = TYPE_ICONS[layer.type];
  const hidden = members.every((l) => l.hidden);
  const locked = members.every((l) => l.locked);
  const position = total - row.index;
  const children = family ? family.ids.length - 1 : 0;

  const onKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      commands.order(event.key === "ArrowUp" ? "forward" : "backward", [layer.id]);
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
          event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(item));
          event.dataTransfer.effectAllowed = "move";
        }}
        onMouseEnter={() => ui.setState({ hoverLayerId: layer.id })}
        onMouseLeave={() => ui.setState({ hoverLayerId: null })}
        {...handlers}
        className={cn(ROW_CLASS, rowState(selected, dropping))}
        style={{ paddingLeft: 4 + row.depth * INDENT_PX }}
      >
        <Lamp on={selected} />
        <IconButton label={hidden ? t("show") : t("hide")} onClick={() => commands.setHidden([layer.id], !hidden)} className="h-6 min-w-6 px-0.5 text-muted-foreground">
          {hidden ? <EyeSlash className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
        </IconButton>
        {family ? (
          <RowCaret
            collapsed={collapsed}
            label={collapsed ? t("expand", { name: label }) : t("collapse", { name: label })}
            onToggle={() => ui.setState((s) => ({ collapsedGroups: toggleIn(s.collapsedGroups, [family.scaffoldId]) }))}
          />
        ) : null}
        {layer.clip ? <Link className="h-3 w-3 shrink-0 text-muted-foreground" aria-label={t("clipped")} /> : null}
        <LayerThumb layer={layer} />
        {renaming ? (
          <RowRename
            value={layer.name ?? ""}
            placeholder={label}
            label={t("rename")}
            onCommit={(name) => {
              commands.rename(layer.id, name);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <button
            type="button"
            aria-pressed={selected}
            aria-label={family ? t("familyRowLabel", { name: label, count: children, position, total }) : t("rowLabel", { name: label, position, total })}
            onClick={(event) => onSelect(layer.id, event)}
            onDoubleClick={() => setRenaming(true)}
            onKeyDown={onKey}
            className={cn(
              "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-[--radius] px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              layer.hidden && "opacity-50",
            )}
          >
            <TypeIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className={cn("truncate text-foreground", family && "font-semibold")}>{label}</span>
            {family ? <span className="readout text-2xs font-normal text-muted-foreground">{children}</span> : null}
          </button>
        )}
        <IconButton
          label={locked ? t("unlock") : t("lock")}
          onClick={() => commands.setLocked([layer.id], !locked)}
          className={cn("h-6 min-w-6 px-0.5 text-muted-foreground", !locked && "opacity-0 focus-visible:opacity-100 group-hover:opacity-100")}
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
  const { dropping, handlers } = useDropTarget({ kind: "group", id: row.groupId });
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
        <RowCaret
          collapsed={collapsed}
          label={collapsed ? t("expand", { name: label }) : t("collapse", { name: label })}
          onToggle={() => ui.setState((s) => ({ collapsedGroups: toggleIn(s.collapsedGroups, [row.groupId]) }))}
        />
        <Stack className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {renaming ? (
          <RowRename
            value={row.name ?? ""}
            placeholder={label}
            label={t("renameGroup")}
            onCommit={(name) => {
              commands.renameGroup(row.groupId, name);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
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
  const { layers } = useActiveArtboard();
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

interface ArtboardHeaderProps {
  artboard: Artboard;
  name: string;
  active: boolean;
  selected: boolean;
  collapsed: boolean;
  removable: boolean;
}

function ArtboardHeader({ artboard, name, active, selected, collapsed, removable }: ArtboardHeaderProps) {
  const t = useTranslations("studio.image.artboards");
  const tp = useTranslations("studio.presets");
  const { commands, ui } = useImageEditor();
  const [renaming, setRenaming] = useState(false);
  const [dropping, setDropping] = useState(false);
  return (
    <ContextMenu onOpenChange={(open) => open && !selected && commands.selectArtboard(artboard.id, false)}>
      <ContextMenuTrigger asChild>
        <li
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
            event.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDropping(false);
            const item = readItem(event);
            if (item?.kind === "layer") commands.moveLayersToArtboard([item.id], artboard.id);
          }}
          className={cn(ROW_CLASS, "pl-1", selected ? "bg-muted" : "hover:bg-muted", dropping && "shadow-[inset_0_0_0_2px_hsl(var(--primary))]")}
        >
          <Lamp on={selected} />
          <RowCaret
            collapsed={collapsed}
            label={collapsed ? t("expand", { name }) : t("collapse", { name })}
            onToggle={() => ui.setState((s) => ({ collapsedGroups: toggleIn(s.collapsedGroups, [artboard.id]) }))}
          />
          <ArtboardIcon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-foreground" : "text-muted-foreground")} aria-hidden />
          {renaming ? (
            <RowRename
              value={artboard.name ?? ""}
              placeholder={name}
              label={t("rename")}
              onCommit={(value) => {
                commands.renameArtboard(artboard.id, value);
                setRenaming(false);
              }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <button
              type="button"
              aria-pressed={selected}
              aria-label={t("rowLabel", { name, width: artboard.canvas.width, height: artboard.canvas.height })}
              onClick={(event) => commands.selectArtboard(artboard.id, event.shiftKey || event.ctrlKey || event.metaKey)}
              onDoubleClick={() => setRenaming(true)}
              onKeyDown={(event) => {
                if (event.key === "F2") setRenaming(true);
              }}
              className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-[--radius] px-1 text-left font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate text-foreground">{name}</span>
              <span className="readout ml-auto shrink-0 text-2xs font-normal text-muted-foreground">
                {artboard.canvas.width} × {artboard.canvas.height}
              </span>
            </button>
          )}
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuItem onSelect={() => commands.duplicateArtboards([artboard.id])}>
          <Copy className="h-4 w-4" aria-hidden />
          {t("duplicate")}
          <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>{t("duplicateAs")}</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-64">
            {IMAGE_PRESETS.map((preset) => (
              <ContextMenuItem key={preset.id} onSelect={() => commands.duplicateArtboards([artboard.id], preset)}>
                {tp(preset.id)}
                <span className="readout ml-auto pl-3 text-2xs text-muted-foreground">
                  {preset.width} × {preset.height}
                </span>
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onSelect={() => setRenaming(true)}>
          <PencilSimple className="h-4 w-4" aria-hidden />
          {t("rename")}
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => commands.showArtboard(artboard.id)}>{t("show")}</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={!removable} className="text-destructive-ink" onSelect={() => commands.removeArtboards([artboard.id])}>
          <Trash className="h-4 w-4" aria-hidden />
          {t("delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface ArtboardLayersProps {
  artboard: Artboard;
  collapsed: ReadonlySet<string>;
  chosen: ReadonlySet<string>;
  onSelect: RowSelect;
}

function ArtboardLayers({ artboard, collapsed, chosen, onSelect }: ArtboardLayersProps) {
  const t = useTranslations("studio.image.panels.layers");
  const rows = useMemo(() => layerRows(artboard, collapsed), [artboard, collapsed]);
  const byId = useMemo(() => new Map(artboard.layers.map((l) => [l.id, l])), [artboard.layers]);
  if (rows.length === 0) return <li className="py-1.5 pl-9 text-xs text-muted-foreground">{t("empty")}</li>;
  return (
    <>
      {rows.map((row) => {
        if (row.kind === "group") {
          const members = groupLayerIds(artboard, row.groupId)
            .map((id) => byId.get(id))
            .filter((l): l is Layer => Boolean(l));
          return (
            <GroupHeader
              key={`g-${row.groupId}-${row.ids[0]}`}
              row={{ ...row, depth: row.depth + 1 }}
              members={members}
              collapsed={collapsed.has(row.groupId)}
              selected={row.ids.length > 0 && row.ids.every((id) => chosen.has(id))}
            />
          );
        }
        const layer = byId.get(row.id);
        if (!layer) return null;
        const members = row.family ? row.family.ids.map((id) => byId.get(id)).filter((l): l is Layer => Boolean(l)) : [layer];
        return (
          <LayerRow
            key={row.id}
            row={{ ...row, depth: row.depth + 1 }}
            layer={layer}
            members={members}
            collapsed={row.family ? collapsed.has(row.family.scaffoldId) : false}
            selected={chosen.has(row.id)}
            total={artboard.layers.length}
            onSelect={onSelect}
          />
        );
      })}
    </>
  );
}

export function LayersPanel() {
  const t = useTranslations("studio.image.panels.layers");
  const ta = useTranslations("studio.image.artboards");
  const { commands, store } = useImageEditor();
  const artboards = useImageDoc((s) => s.document.artboards);
  const selection = useImageDoc((s) => s.selection);
  const collapsedGroups = useEditorUi((s) => s.collapsedGroups);
  const active = useActiveArtboard();
  const names = useArtboardNames();
  const anchor = useRef<string | null>(null);

  const collapsed = useMemo(() => new Set(collapsedGroups), [collapsedGroups]);
  const chosen = new Set(selection);

  const onSelect: RowSelect = (id, event) => {
    const state = store.getState();
    const home = artboardOfItem(state.document, id);
    const order = home ? layerRows(home, collapsed).flatMap((r) => (r.kind === "layer" ? [r.id] : [])) : [id];
    if (event.shiftKey) commands.select(rangeBetween(order, anchor.current, id));
    else if (event.ctrlKey || event.metaKey) commands.select(home && artboardOfItem(state.document, state.selection[0] ?? "")?.id === home.id ? toggleIn(state.selection, [id]) : [id]);
    else commands.select([id]);
    if (!event.shiftKey) anchor.current = id;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SelectionBar />
      <div className="min-h-0 flex-1 overflow-y-auto py-0.5">
        <ul aria-label={t("title")}>
          {artboards.map((artboard) => (
            <Fragment key={artboard.id}>
              <ArtboardHeader
                artboard={artboard}
                name={names.get(artboard.id) ?? artboard.id}
                active={artboard.id === active.id}
                selected={chosen.has(artboard.id)}
                collapsed={collapsed.has(artboard.id)}
                removable={artboards.length > 1}
              />
              {collapsed.has(artboard.id) ? null : <ArtboardLayers artboard={artboard} collapsed={collapsed} chosen={chosen} onSelect={onSelect} />}
            </Fragment>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 items-center gap-0.5 border-t border-border px-1.5 py-1">
        <IconButton label={ta("add")} onClick={() => commands.addArtboard(active.canvas)}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </IconButton>
        <div className="ml-auto">
          <FooterBar />
        </div>
      </div>
    </div>
  );
}
