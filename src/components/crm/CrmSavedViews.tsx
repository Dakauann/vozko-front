"use client";

import { useState } from "react";
import {
  ArrowsClockwise,
  DotsThreeVertical,
  FloppyDisk,
  GlobeHemisphereWest,
  Lock,
  PencilSimple,
  Plus,
  Star,
  Trash,
} from "@phosphor-icons/react";

import type { SavedView, SavedViewVisibility } from "@/lib/crm/saved-views";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedButton from "@/components/elevated-design/button";
import { cn } from "@/lib/utils";

// A view saved as "workspace" is displayed as shared; the picker offers the two
// meaningful choices (only me / whole team).
function isSharedVisibility(v?: string): boolean {
  return v === "shared" || v === "workspace";
}

interface CrmSavedViewsProps {
  views: SavedView[];
  activeViewId: string | null;
  // null selects the unsaved "Tudo" view (clears the filter, keeps groupBy).
  onSelect: (view: SavedView | null) => void;
  // POSTs the current filter + groupBy under `name` with the chosen visibility.
  onSave: (name: string, visibility: SavedViewVisibility) => Promise<void> | void;
  onRename?: (id: string, name: string) => void;
  // Overwrite the view's filter/groupBy with the board's current filter/groupBy.
  onUpdateToCurrent?: (id: string) => void;
  onSetVisibility?: (id: string, visibility: SavedViewVisibility) => void;
  onDelete?: (id: string) => void;
  onSetDefault?: (id: string) => void;
  canManage?: boolean;
}

export default function CrmSavedViews({
  views,
  activeViewId,
  onSelect,
  onSave,
  onRename,
  onUpdateToCurrent,
  onSetVisibility,
  onDelete,
  onSetDefault,
  canManage = true,
}: CrmSavedViewsProps) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<SavedViewVisibility>("private");
  const [saving, setSaving] = useState(false);

  const sorted = [...views].sort((a, b) => a.position - b.position);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSave(trimmed, visibility);
      setName("");
      setVisibility("private");
      setSaveOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 border-b border-border/80 bg-card px-4 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1 scrollbar-hide">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
            activeViewId === null
              ? "bg-card text-primary shadow-sm ring-1 ring-border"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          Tudo
        </button>

        {sorted.map((view) => {
          const isActive = view.id === activeViewId;
          return (
            <div key={view.id} className="flex flex-shrink-0 items-center">
              <button
                type="button"
                onClick={() => onSelect(view)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
                  isActive
                    ? "bg-card text-primary shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {view.isDefault ? (
                  <Star
                    weight="fill"
                    className="h-3 w-3 text-amber-400"
                    aria-hidden
                  />
                ) : null}
                {isSharedVisibility(view.visibility) ? (
                  <GlobeHemisphereWest
                    weight="bold"
                    className="h-3 w-3 opacity-60"
                    aria-label="Compartilhada"
                  />
                ) : null}
                <span className="max-w-[10rem] truncate">{view.name}</span>
              </button>

              {isActive && canManage ? (
                <ViewManageMenu
                  view={view}
                  onRename={onRename}
                  onUpdateToCurrent={onUpdateToCurrent}
                  onSetVisibility={onSetVisibility}
                  onDelete={onDelete}
                  onSetDefault={onSetDefault}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {canManage ? (
        <Popover open={saveOpen} onOpenChange={setSaveOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-xl border-2 border-border bg-transparent px-3 text-[13px] font-medium text-foreground transition-colors hover:border-foreground/20 hover:bg-muted"
            >
              <Plus weight="bold" className="h-3.5 w-3.5" />
              <span>Salvar visão</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-72 rounded-xl border border-border bg-card p-3 shadow-2xl"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Salvar visão atual
            </p>
            <ElevatedInput
              id="crm-saved-view-name"
              label="Nome da visão"
              variant="outline"
              controlSize="sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSave();
                }
              }}
            />
            <VisibilityToggle value={visibility} onChange={setVisibility} className="mt-3" />
            <div className="mt-3 flex justify-end">
              <ElevatedButton
                variant="primary"
                size="sm"
                title={saving ? "Salvando..." : "Salvar"}
                onClick={handleSave}
                disabled={saving || !name.trim()}
                icon={<FloppyDisk weight="bold" className="h-3.5 w-3.5" />}
                iconVisible
              />
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

// A two-option visibility control (only me / whole team), styled like the view
// tabs so the surface reads as one system.
function VisibilityToggle({
  value,
  onChange,
  className,
}: {
  value: SavedViewVisibility;
  onChange: (v: SavedViewVisibility) => void;
  className?: string;
}) {
  const shared = isSharedVisibility(value);
  return (
    <div className={cn("grid grid-cols-2 gap-1 rounded-lg bg-muted p-1", className)}>
      <button
        type="button"
        onClick={() => onChange("private")}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
          !shared
            ? "bg-card text-primary shadow-sm ring-1 ring-border"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Lock weight="bold" className="h-3.5 w-3.5" />
        Só eu
      </button>
      <button
        type="button"
        onClick={() => onChange("shared")}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
          shared
            ? "bg-card text-primary shadow-sm ring-1 ring-border"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <GlobeHemisphereWest weight="bold" className="h-3.5 w-3.5" />
        Equipe
      </button>
    </div>
  );
}

function ViewManageMenu({
  view,
  onRename,
  onUpdateToCurrent,
  onSetVisibility,
  onDelete,
  onSetDefault,
}: {
  view: SavedView;
  onRename?: (id: string, name: string) => void;
  onUpdateToCurrent?: (id: string) => void;
  onSetVisibility?: (id: string, visibility: SavedViewVisibility) => void;
  onDelete?: (id: string) => void;
  onSetDefault?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(view.name);
  const shared = isSharedVisibility(view.visibility);

  const close = () => {
    setOpen(false);
    setRenaming(false);
  };

  const commitRename = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== view.name) onRename?.(view.id, trimmed);
    close();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setRenaming(false);
          setDraftName(view.name);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Gerenciar visão"
          className="ml-0.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <DotsThreeVertical weight="bold" className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-56 rounded-xl border border-border bg-card p-1 shadow-2xl"
      >
        {renaming ? (
          <div className="p-1.5">
            <ElevatedInput
              id={`crm-view-rename-${view.id}`}
              label="Renomear visão"
              variant="outline"
              controlSize="sm"
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  setRenaming(false);
                }
              }}
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <ElevatedButton
                variant="ghost"
                size="sm"
                title="Cancelar"
                onClick={() => setRenaming(false)}
              />
              <ElevatedButton
                variant="primary"
                size="sm"
                title="Salvar"
                onClick={commitRename}
                disabled={!draftName.trim()}
              />
            </div>
          </div>
        ) : (
          <>
            {onUpdateToCurrent ? (
              <MenuItem
                icon={<ArrowsClockwise weight="bold" className="h-3.5 w-3.5 text-primary" />}
                label="Atualizar com filtros atuais"
                onClick={() => {
                  onUpdateToCurrent(view.id);
                  close();
                }}
              />
            ) : null}
            {onRename ? (
              <MenuItem
                icon={<PencilSimple weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />}
                label="Renomear"
                onClick={() => setRenaming(true)}
              />
            ) : null}
            {onSetVisibility ? (
              <MenuItem
                icon={
                  shared ? (
                    <Lock weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <GlobeHemisphereWest weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
                  )
                }
                label={shared ? "Tornar privada" : "Compartilhar com a equipe"}
                onClick={() => {
                  onSetVisibility(view.id, shared ? "private" : "shared");
                  close();
                }}
              />
            ) : null}
            {onSetDefault && !view.isDefault ? (
              <MenuItem
                icon={<Star weight="bold" className="h-3.5 w-3.5 text-amber-400" />}
                label="Definir como padrão"
                onClick={() => {
                  onSetDefault(view.id);
                  close();
                }}
              />
            ) : null}
            {onDelete ? (
              <MenuItem
                icon={<Trash weight="bold" className="h-3.5 w-3.5" />}
                label="Excluir visão"
                destructive
                onClick={() => {
                  onDelete(view.id);
                  close();
                }}
              />
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors",
        destructive
          ? "text-rose-600 hover:bg-rose-500 hover:text-white"
          : "text-foreground hover:bg-muted",
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
