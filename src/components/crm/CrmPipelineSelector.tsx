"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CaretUpDown, ChatCircle, Check, Plus, Stack, TrendUp } from "@/components/icons";

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
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  createPipelineAction,
  listPipelinesAction,
} from "@/app/actions/crm-board";
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

// Sentinel for "seed the product's default stages" in the new-funnel dialog. The
// server reads an absent copy-from as exactly this, so the sentinel never leaves
// the client.
const DEFAULT_STAGES_ID = "__defaults__";

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
    async (name: string, copyFromId: string) => {
      setCreating(true);
      const { pipeline, error } = await createPipelineAction({
        name,
        objectType: "conversation",
        copyStagesFromPipelineId:
          copyFromId === DEFAULT_STAGES_ID ? undefined : copyFromId,
      });
      setCreating(false);
      if (error || !pipeline) {
        toast.error(error ?? "Não foi possível criar o funil");
        return;
      }
      setCreateOpen(false);
      setReloadKey((k) => k + 1);
      onChange({
        id: pipeline.id,
        objectType: "conversation",
        name: pipeline.name,
      });
      toast.success(`Funil "${pipeline.name}" criado`);
    },
    [onChange],
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
        {canCreate ? (
          <>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              disabled={creating}
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus weight="bold" className="h-3.5 w-3.5 flex-shrink-0 text-primary-ink" />
              <span className="flex-1 truncate">Novo funil</span>
            </button>
          </>
        ) : null}
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
 * Name it, and choose what it starts with.
 *
 * The seed choice is the whole reason this is a dialog rather than an inline
 * "add": a funnel with no columns renders an empty board and offers no way to add
 * the first one, so every funnel has to arrive seeded. Duplicating an existing
 * funnel is the common case once a workspace has one it likes.
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
  onCreate: (name: string, copyFromId: string) => void;
}) {
  // Fresh state per open, so a cancelled attempt does not prefill the next one.
  // The caller keys this component on `open`, which remounts it — cheaper and
  // more honest than resetting from an effect, which fires a second render just
  // to undo the first.
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState(DEFAULT_STAGES_ID);

  const trimmed = name.trim();

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>Novo funil</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            Um funil é um conjunto ordenado de etapas. As conversas dele vivem
            nessas etapas.
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          <ElevatedInput
            label="Nome do funil"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && trimmed && !busy) {
                onCreate(trimmed, copyFrom);
              }
            }}
          />

          <ElevatedSelect
            label="Etapas iniciais"
            value={copyFrom}
            onValueChange={setCopyFrom}
          >
            <ElevatedSelectItem value={DEFAULT_STAGES_ID}>
              Etapas padrão
            </ElevatedSelectItem>
            {sources.map((p) => (
              <ElevatedSelectItem key={p.id} value={p.id}>
                Copiar de: {p.name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>

          <div className="flex items-center justify-end gap-2 pt-1">
            <ElevatedButton
              title="Cancelar"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            />
            <ElevatedButton
              title={busy ? "Criando..." : "Criar funil"}
              variant="primary"
              size="sm"
              disabled={!trimmed || busy}
              onClick={() => onCreate(trimmed, copyFrom)}
            />
          </div>
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
