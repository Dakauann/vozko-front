"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  CaretUpDown,
  ChatCircle,
  Check,
  Kanban,
  Plus,
  Stack,
  TrendUp,
} from "@/components/icons";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ElevatedButton from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  createPipelineAction,
  listPipelinesAction,
} from "@/app/actions/crm-board";
import {
  FunnelComposer,
  type FunnelDraft,
} from "@/components/crm/funnels/FunnelComposer";
import { newDraftStage } from "@/components/crm/funnels/FunnelStageComposer";
import { Link } from "@/i18n/routing";
import type { Pipeline, PipelineObjectType } from "@/lib/crm/pipelines";
import { cn } from "@/lib/utils";

export interface SelectedPipeline {
  id: string;
  objectType: PipelineObjectType;
  name: string;
}

// Sentinel funnel id for the workspace-wide "Todos os funis" scope: responsável /
// etiqueta are global attributes, so the board can group by them across EVERY pipeline
// (HubSpot's "All Pipelines"). The backend reads an empty pipelineId as this scope.
export const ALL_FUNNELS_ID = "__all__";

interface CrmPipelineSelectorProps {
  value: SelectedPipeline | null;
  onChange: (pipeline: SelectedPipeline) => void;
  className?: string;
  // Stage columns are pipeline-specific, so "Todos os funis" can't render them, the
  // board axis being "etapa" disables the option (mirrors HubSpot greying it in board
  // mode). Owner/label axes leave it enabled.
  disableAllFunnels?: boolean;
  // Whether the caller may create funnels (stages:create). Off by default so a
  // read-only surface never shows a door it cannot open.
  canCreate?: boolean;
}

// The unified Funil selector: one control listing BOTH atendimento (conversation)
// funnels and vendas (opportunity) funnels. Selecting one drives which object the
// board renders, the single most important piece of the "one Funil surface" UX.
export default function CrmPipelineSelector({
  value,
  onChange,
  className,
  disableAllFunnels = false,
  canCreate = false,
}: CrmPipelineSelectorProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const tFunnels = useTranslations("funnels");
  const [creating, setCreating] = useState(false);
  const [conversation, setConversation] = useState<Pipeline[]>([]);
  const [opportunity, setOpportunity] = useState<Pipeline[]>([]);
  // Bumped after a create so the lists reload and the new funnel appears without
  // a page refresh.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [conv, opp] = await Promise.all([
        listPipelinesAction("conversation"),
        listPipelinesAction("opportunity"),
      ]);
      if (cancelled) return;
      setConversation([...conv.pipelines].sort((a, b) => a.position - b.position));
      setOpportunity([...opp.pipelines].sort((a, b) => a.position - b.position));
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // Creating a funnel selects it. Anything else would leave the operator looking
  // at the funnel they were already on, wondering whether it worked.
  const handleCreate = useCallback(
    async (draft: FunnelDraft) => {
      setCreating(true);
      const { pipeline, error } = await createPipelineAction({
        name: draft.name.trim(),
        objectType: "conversation",
        stages: draft.stages
          .filter((s) => s.name.trim().length > 0)
          .map((s) => ({
            name: s.name.trim(),
            description: s.description.trim(),
            color: s.color,
          })),
      });
      setCreating(false);
      if (error || !pipeline) {
        toast.error(error ?? tFunnels("toast.createFailed"));
        return;
      }
      setCreateOpen(false);
      setReloadKey((k) => k + 1);
      onChange({
        id: pipeline.id,
        objectType: "conversation",
        name: pipeline.name,
      });
      toast.success(tFunnels("toast.created", { name: pipeline.name }));
    },
    [onChange, tFunnels],
  );

  const groups = useMemo(
    () => [
      {
        key: "conversation" as PipelineObjectType,
        label: "Atendimento",
        icon: <ChatCircle weight="fill" className="h-3.5 w-3.5 text-background" />,
        tile: "bg-foreground/80 text-background",
        pipelines: conversation,
      },
      {
        key: "opportunity" as PipelineObjectType,
        label: "Vendas",
        icon: <TrendUp weight="bold" className="h-3.5 w-3.5 text-primary-foreground" />,
        tile: "tile-brand",
        pipelines: opportunity,
      },
    ],
    [conversation, opportunity],
  );

  const isAll = value?.id === ALL_FUNNELS_ID;
  const activeGroup = groups.find((g) => g.key === value?.objectType);
  // Prefer the name from the loaded lists (resolves a URL-hydrated placeholder);
  // fall back to the passed name, then a generic label.
  const activeName = isAll
    ? "Todos os funis"
    : (activeGroup?.pipelines.find((p) => p.id === value?.id)?.name ??
      value?.name ??
      "Selecionar funil");

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 min-w-[190px] items-center gap-2 rounded-[--radius] border border-border bg-card px-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/20 hover:bg-muted",
            className,
          )}
        >
          <span
            className={cn(
              "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md",
              isAll ? "bg-foreground/80" : (activeGroup?.tile ?? "bg-foreground/80"),
            )}
          >
            {isAll ? (
              <Stack weight="fill" className="h-3.5 w-3.5 text-background" />
            ) : (
              activeGroup?.icon ?? <ChatCircle weight="fill" className="h-3.5 w-3.5 text-background" />
            )}
          </span>
          <span className="flex min-w-0 flex-col items-start leading-tight">
            <span className="text-2xs font-semibold text-muted-foreground">
              {isAll ? "Escopo" : (activeGroup?.label ?? "Funil")}
            </span>
            <span className="max-w-[9rem] truncate">{activeName}</span>
          </span>
          <CaretUpDown weight="bold" className="ml-auto h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 rounded-[--radius] border border-border bg-card p-1.5 shadow-2xl"
      >
        {/* Workspace-wide scope: group responsável / etiqueta across every funnel. */}
        <button
          type="button"
          disabled={disableAllFunnels}
          onClick={() => {
            if (disableAllFunnels) return;
            onChange({ id: ALL_FUNNELS_ID, objectType: "conversation", name: "Todos os funis" });
            setOpen(false);
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
            disableAllFunnels
              ? "cursor-not-allowed opacity-40"
              : isAll
                ? "bg-muted font-medium text-foreground"
                : "text-foreground hover:bg-muted",
          )}
        >
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-foreground">
            <Stack weight="fill" className="h-3 w-3 text-background" />
          </span>
          <span className="flex-1 truncate">Todos os funis</span>
          {isAll && !disableAllFunnels ? (
            <Check weight="bold" className="h-3.5 w-3.5 flex-shrink-0" />
          ) : null}
        </button>
        {disableAllFunnels ? (
          <p className="mb-1 mt-0.5 px-2.5 text-2xs leading-tight text-muted-foreground">
            Escolha um funil para agrupar por etapa.
          </p>
        ) : (
          <div className="my-1 h-px bg-border" />
        )}
        {groups.map((group) =>
          group.pipelines.length > 0 ? (
            <div key={group.key} className="mb-1 last:mb-0">
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded",
                    group.tile,
                  )}
                >
                  {group.icon}
                </span>
                <span className="text-2xs font-semibold text-muted-foreground">
                  {group.label}
                </span>
              </div>
              {group.pipelines.map((p) => {
                const isActive = value?.id === p.id && value?.objectType === group.key;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange({ id: p.id, objectType: group.key, name: p.name });
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                      // Neutral opaque ground; the check carries the green.
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <span className="flex-1 truncate">{p.name}</span>
                    {isActive ? <Check weight="bold" className="h-3.5 w-3.5 flex-shrink-0 text-primary-ink" /> : null}
                  </button>
                );
              })}
            </div>
          ) : null,
        )}
        {conversation.length === 0 && opportunity.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            Nenhum funil disponível
          </div>
        ) : null}

        {/*
          Creating a funnel used to be impossible from here: the only door was
          creating a campaign, which stamped one as a side effect. POST /pipelines
          existed all along with nothing wired to it.
        */}
        <div className="my-1 h-px bg-border" />
        {canCreate ? (
          <button
            type="button"
            disabled={creating}
            onClick={() => {
              setOpen(false);
              setCreateOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-[hsl(var(--accent-hover))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus weight="bold" className="h-3.5 w-3.5 flex-shrink-0 text-primary-ink" />
            <span className="flex-1 truncate">{tFunnels("list.new")}</span>
          </button>
        ) : null}
        {/* The way out to the full surface. Creating from the board is the quick
            path; renaming, reordering, the default and deletion live on the page,
            and without this row the only route there is the nav. */}
        <Link
          href="/dashboard/funnels"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-[hsl(var(--accent-hover))]"
        >
          <Kanban weight="bold" className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{tFunnels("list.manage")}</span>
        </Link>
      </PopoverContent>
    </Popover>

    {canCreate ? (
      <NewFunnelDialog
        key={createOpen ? "open" : "closed"}
        open={createOpen}
        onOpenChange={setCreateOpen}
        busy={creating}
        sources={conversation}
        onCreate={handleCreate}
      />
    ) : null}
    </>
  );
}

/**
 * Name it, then draw it — the same composer the Funis page uses, in a dialog.
 *
 * It used to be a name and a "which funnel do you want a copy of" select, which
 * meant a funnel could only ever be somebody else's process with a new label on
 * it. The columns are now written here, and the templates that were the whole
 * flow are one row inside the composer that fills the editor.
 *
 * Sharing the component with the page is the point: the board's shortcut and the
 * management surface cannot drift into two different ideas of what a funnel is.
 */
function NewFunnelDialog({
  open,
  onOpenChange,
  busy,
  sources,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  sources: Pipeline[];
  onCreate: (draft: FunnelDraft) => void;
}) {
  const t = useTranslations("funnels");
  // Fresh state per open, so a cancelled attempt does not prefill the next one.
  // The caller keys this component on `open`, which remounts it — cheaper and
  // more honest than resetting from an effect, which fires a second render just
  // to undo the first.
  const [draft, setDraft] = useState<FunnelDraft>(() => ({
    name: "",
    stages: [newDraftStage([])],
  }));

  const ready =
    draft.name.trim().length >= 2 &&
    draft.stages.some((s) => s.name.trim().length > 0);

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the selector's other overlays and scrollable, because it
          holds a real editor rather than two fields. The board stays visible
          behind it, which is the reason this is a dialog here at all instead of
          a trip to the Funis page mid-conversation. */}
      <ElevatedDialogContent className="max-h-[86vh] max-w-2xl overflow-y-auto">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("create.title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {t("create.description")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="flex flex-col gap-5 pt-1">
          <FunnelComposer
            draft={draft}
            onChange={setDraft}
            sources={sources}
            busy={busy}
          />

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <ElevatedButton
              title={t("create.cancel")}
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            />
            <ElevatedButton
              title={busy ? t("create.creating") : t("create.confirm")}
              variant="primary"
              size="sm"
              disabled={!ready || busy}
              onClick={() => onCreate(draft)}
            />
          </div>
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
