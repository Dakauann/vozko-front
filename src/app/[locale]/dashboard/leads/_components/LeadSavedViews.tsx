"use client";

import { useCallback, useState } from "react";
import { Bookmark, CaretDown, Check, Plus, Trash, X } from "@/components/icons";
import { useTranslations } from "next-intl";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  createSavedViewAction,
  deleteSavedViewAction,
  listSavedViewsAction,
} from "@/app/actions/saved-views";
import type { SavedView } from "@/lib/crm/saved-views";
import { isEmptyLeadFilter, type LeadFilter } from "@/lib/leads/filters";
import type { LeadSort } from "@/lib/leads/types";
import { cn } from "@/lib/utils";

export interface LeadSavedViewsProps {
  filter: LeadFilter;
  sorts: LeadSort[];
  onApply: (view: SavedView) => void;
}

/**
 * Named segments over the leads list.
 *
 * Reuses the workspace's existing saved-view resource (the same one the CRM
 * board saves its presets into) with objectType `lead`. A lead view has no
 * board axis, so it is exactly a filter plus a sort — which is what an operator
 * means by "my follow-up list".
 */
export default function LeadSavedViews({
  filter,
  sorts,
  onApply,
}: LeadSavedViewsProps) {
  const t = useTranslations("leadsPage");
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await listSavedViewsAction("lead");
    if (!result.error) setViews(result.views);
  }, []);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    setSaving(true);
    setError(null);
    const result = await createSavedViewAction({
      name: trimmed,
      objectType: "lead",
      filter,
      // A lead list has no columns axis; `none` is the list-only board.
      groupBy: "none",
      sortField: sorts[0]?.key,
      sortDir: sorts[0]?.direction,
      visibility: "private",
    });
    setSaving(false);

    if (result.error || !result.view) {
      setError(result.error ?? t("views.saveError"));
      return;
    }

    setName("");
    setViews((current) => [...current, result.view!]);
  }, [name, saving, filter, sorts, t]);

  const remove = useCallback(async (id: string) => {
    setViews((current) => current.filter((view) => view.id !== id));
    await deleteSavedViewAction(id);
  }, []);

  // Loading on open, not in an effect: the fetch reacts to an event, and an
  // effect that setStates on every open is a cascading render.
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-[--radius] border border-border bg-card px-3",
            "text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-muted",
          )}
        >
          <Bookmark weight="bold" className="h-4 w-4" />
          <span>{t("views.label")}</span>
          <CaretDown
            weight="bold"
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-72 rounded-[--radius] border border-border bg-card p-0 shadow-2xl"
      >
        <div className="max-h-64 overflow-y-auto py-1">
          {views.length === 0 ? (
            <p className="px-3 py-4 text-center text-2xs text-muted-foreground">
              {t("views.empty")}
            </p>
          ) : (
            views.map((view) => (
              <div
                key={view.id}
                className="group flex items-center gap-2 px-2 py-1.5 transition-colors hover:bg-muted"
              >
                <button
                  type="button"
                  onClick={() => {
                    onApply(view);
                    setOpen(false);
                  }}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <Check
                    weight="bold"
                    className="h-3 w-3 shrink-0 text-primary-ink opacity-0"
                  />
                  <span className="flex-1 truncate text-xs font-medium text-foreground">
                    {view.name}
                  </span>
                  {view.visibility === "shared" ? (
                    <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                      {t("views.shared")}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(view.id)}
                  title={t("views.delete")}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive-ink group-hover:opacity-100"
                >
                  <Trash weight="bold" className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border p-2">
          {/* Saving an empty filter would create a view that means "everything",
              which is what the unfiltered list already is. */}
          <div className="flex items-center gap-1.5">
            <ElevatedInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void save();
              }}
              placeholder={t("views.namePlaceholder")}
              controlSize="sm"
              disabled={isEmptyLeadFilter(filter)}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => void save()}
              disabled={!name.trim() || saving || isEmptyLeadFilter(filter)}
              title={t("views.save")}
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius]",
                "bg-primary text-primary-foreground transition-opacity",
                "disabled:cursor-not-allowed disabled:opacity-40",
              )}
            >
              <Plus weight="bold" className="h-3.5 w-3.5" />
            </button>
          </div>

          {error ? (
            <p className="mt-1.5 flex items-center gap-1 text-2xs text-destructive-ink">
              <X weight="bold" className="h-3 w-3" />
              {error}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
