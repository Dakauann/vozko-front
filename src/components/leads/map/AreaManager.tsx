"use client";

import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { deleteLeadAreaAction, updateLeadAreaAction, type DrawnAreaPatch } from "@/app/actions/lead-map";
import { Area, Lock, PencilSimple, Trash, UsersThree } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/contexts/workspace-context";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { leadMapsKey } from "@/lib/leads/map-view";
import type { DrawnArea } from "@/lib/maps/types";
import { cn } from "@/lib/utils";

export interface AreaListProps {
  areas: readonly DrawnArea[];
  activeIds: readonly string[];
  onToggle: (areaId: string) => void;
  onDeleted: (areaId: string) => void;
  className?: string;
}

const ICON_BUTTON =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

function useAreaChanges() {
  const t = useTranslations("leadMap.areas");
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: leadMapsKey(workspaceId) });

  const update = async (area: DrawnArea, patch: DrawnAreaPatch, done: string): Promise<boolean> => {
    setBusy(area.id);
    const saved = await updateLeadAreaAction(area.id, patch);
    setBusy(null);
    if (!saved.area) {
      toast.error(codedErrorMessage(t, saved.error, t("manager.updateFailed")));
      return false;
    }
    refresh();
    toast.success(done);
    return true;
  };

  const remove = async (area: DrawnArea): Promise<boolean> => {
    setBusy(area.id);
    const removed = await deleteLeadAreaAction(area.id);
    setBusy(null);
    if (removed.error) {
      toast.error(codedErrorMessage(t, removed.error, t("manager.deleteFailed")));
      return false;
    }
    refresh();
    toast.success(t("manager.deleted"));
    return true;
  };

  return { busy, update, remove };
}

function RenameForm({ area, busy, onSave, onCancel }: { area: DrawnArea; busy: boolean; onSave: (name: string) => void; onCancel: () => void }) {
  const t = useTranslations("leadMap.areas.manager");
  const [name, setName] = useState(area.name);
  const trimmed = name.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed !== "") onSave(trimmed);
  };

  return (
    <form onSubmit={submit} className="mt-1.5 flex flex-col gap-1.5">
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label={t("renameLabel", { name: area.name })}
        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex justify-end gap-1.5">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || trimmed === ""}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

function AreaRow({
  area,
  active,
  busy,
  onToggle,
  onRename,
  onShare,
  onDelete,
}: {
  area: DrawnArea;
  active: boolean;
  busy: boolean;
  onToggle: () => void;
  onRename: (name: string) => Promise<boolean>;
  onShare: () => void;
  onDelete: () => Promise<boolean>;
}) {
  const t = useTranslations("leadMap.areas.manager");
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const shared = area.visibility === "shared";

  return (
    <li className="flex flex-col border-b border-border py-2 last:border-b-0">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-pressed={active}
          aria-label={active ? t("remove", { name: area.name }) : t("apply", { name: area.name })}
          onClick={onToggle}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active && "bg-muted font-medium",
          )}
        >
          <Area size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate">{area.name}</span>
        </button>
        <span className="shrink-0 text-2xs text-muted-foreground">{shared ? t("shared") : t("private")}</span>
        {area.canEdit ? (
          <>
            <button type="button" disabled={busy} onClick={() => setRenaming(true)} title={t("rename")} aria-label={t("renameArea", { name: area.name })} className={ICON_BUTTON}>
              <PencilSimple size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onShare}
              title={shared ? t("unshare") : t("share")}
              aria-label={shared ? t("unshareArea", { name: area.name }) : t("shareArea", { name: area.name })}
              className={ICON_BUTTON}
            >
              {shared ? <Lock size={14} aria-hidden="true" /> : <UsersThree size={14} aria-hidden="true" />}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(true)} title={t("delete")} aria-label={t("deleteArea", { name: area.name })} className={ICON_BUTTON}>
              <Trash size={14} aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
      {area.canEdit ? null : <p className="px-1.5 text-2xs text-muted-foreground">{t("readOnly")}</p>}
      {renaming ? (
        <RenameForm
          area={area}
          busy={busy}
          onCancel={() => setRenaming(false)}
          onSave={(name) => {
            void onRename(name).then((saved) => {
              if (saved) setRenaming(false);
            });
          }}
        />
      ) : null}
      {area.canEdit ? (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          tone="danger"
          title={t("deleteTitle", { name: area.name })}
          description={t("deleteDescription")}
          confirmLabel={t("deleteConfirm")}
          onConfirm={onDelete}
        />
      ) : null}
    </li>
  );
}

export function AreaList({ areas, activeIds, onToggle, onDeleted, className }: AreaListProps) {
  const t = useTranslations("leadMap.areas");
  const { busy, update, remove } = useAreaChanges();

  if (areas.length === 0) return <p className={cn("text-xs text-muted-foreground", className)}>{t("manager.empty")}</p>;

  return (
    <ul aria-label={t("manager.title")} className={cn("flex flex-col", className)}>
      {areas.map((area) => (
        <AreaRow
          key={area.id}
          area={area}
          active={activeIds.includes(area.id)}
          busy={busy === area.id}
          onToggle={() => onToggle(area.id)}
          onRename={(name) => update(area, { name }, t("manager.renamed"))}
          onShare={() => {
            const shared = area.visibility === "shared";
            void update(area, { visibility: shared ? "private" : "shared" }, shared ? t("manager.privateDone") : t("manager.sharedDone"));
          }}
          onDelete={async () => {
            const removed = await remove(area);
            if (removed) onDeleted(area.id);
            return removed;
          }}
        />
      ))}
    </ul>
  );
}

export function AreaManager({ className, ...props }: AreaListProps) {
  const t = useTranslations("leadMap.areas.manager");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("triggerLabel", { count: props.areas.length })}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-foreground hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Area size={14} aria-hidden="true" />
          <span className="max-sm:sr-only">{t("trigger")}</span>
          <span className="tabular-nums text-muted-foreground">{props.areas.length}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="mb-2 flex flex-col gap-0.5">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
        <AreaList {...props} className="max-h-80 overflow-y-auto" />
      </PopoverContent>
    </Popover>
  );
}
