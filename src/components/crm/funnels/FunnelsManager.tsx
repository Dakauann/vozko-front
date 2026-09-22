"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  CopySimple,
  Funnel as FunnelGlyph,
  Kanban,
  Plus,
  Star,
  Trash,
} from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import { PanelSection } from "@/components/dashboard/PanelSection";
import {
  createPipelineAction,
  deletePipelineAction,
  listPipelinesAction,
  updatePipelineAction,
} from "@/app/actions/crm-board";
import {
  createStageAction,
  deleteStageAction,
  listStagesAction,
  reorderStagesAction,
  setInitialStageAction,
  updateStageAction,
} from "@/app/actions/stages";
import type { Pipeline, StageSeed } from "@/lib/crm/pipelines";
import { STAGE_COLORS } from "@/lib/crm/stage-colors";
import type { Stage } from "@/lib/conversations/types";
import { useWorkspace } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";

import { DeleteFunnelDialog } from "./DeleteFunnelDialog";
import { EditableFunnelName } from "./EditableFunnelName";
import { FunnelComposer, MAX_FUNNEL_NAME, type FunnelDraft } from "./FunnelComposer";
import { isDraftStage, newDraftStage } from "./FunnelStageComposer";

type Selection = { kind: "funnel"; id: string } | { kind: "new" } | null;

const EMPTY_DRAFT: FunnelDraft = { name: "", stages: [] };

export function FunnelsManager() {
  const t = useTranslations("funnels");
  const { currentWorkspace, can } = useWorkspace();

  const canCreate = can("stages", "create");
  const canUpdate = can("stages", "update");
  const canDelete = can("stages", "delete");

  const [funnels, setFunnels] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);
  const [pendingDelete, setPendingDelete] = useState<Pipeline | null>(null);

  const loadFunnels = useCallback(async () => {
    const [conversation, opportunity] = await Promise.all([
      listPipelinesAction("conversation"),
      listPipelinesAction("opportunity"),
    ]);
    const all = [...conversation.pipelines, ...opportunity.pipelines];
    setFunnels(all);
    setLoading(false);
    return all;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const all = await loadFunnels();
      if (cancelled) return;
      setSelection((current) =>
        current ?? (all[0] ? { kind: "funnel", id: all[0].id } : null),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFunnels, currentWorkspace?.id]);

  const conversationFunnels = useMemo(
    () => funnels.filter((f) => f.objectType === "conversation"),
    [funnels],
  );
  const opportunityFunnels = useMemo(
    () => funnels.filter((f) => f.objectType === "opportunity"),
    [funnels],
  );

  const selected = useMemo(
    () =>
      selection?.kind === "funnel"
        ? (funnels.find((f) => f.id === selection.id) ?? null)
        : null,
    [selection, funnels],
  );

  const setDefault = useCallback(
    async (funnel: Pipeline) => {
      const { error } = await updatePipelineAction(funnel.id, { isDefault: true });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(t("toast.defaultSet", { name: funnel.name }));
      void loadFunnels();
    },
    [loadFunnels, t],
  );

  const duplicate = useCallback(
    async (funnel: Pipeline) => {
      const { pipeline, error } = await createPipelineAction({
        name: t("copyName", { name: funnel.name }).slice(0, MAX_FUNNEL_NAME),
        objectType: funnel.objectType,
        copyStagesFromPipelineId: funnel.id,
      });
      if (error || !pipeline) {
        toast.error(error ?? t("toast.duplicateFailed"));
        return;
      }
      toast.success(t("toast.duplicated", { name: pipeline.name }));
      await loadFunnels();
      setSelection({ kind: "funnel", id: pipeline.id });
    },
    [loadFunnels, t],
  );

  const confirmDelete = useCallback(
    async (moveEntriesTo?: string) => {
      if (!pendingDelete) return;
      const { success, error } = await deletePipelineAction(
        pendingDelete.id,
        moveEntriesTo,
      );
      if (!success) {
        toast.error(error ?? t("toast.deleteFailed"));
        return;
      }
      toast.success(t("toast.deleted", { name: pendingDelete.name }));
      setPendingDelete(null);
      const remaining = await loadFunnels();
      setSelection(
        remaining[0] ? { kind: "funnel", id: remaining[0].id } : null,
      );
    },
    [pendingDelete, loadFunnels, t],
  );

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-8">
        <aside className="min-w-0">
          <PanelSection
            title={t("list.title")}
            actions={
              canCreate ? (
                <ElevatedButton
                  variant="command"
                  size="sm"
                  onClick={() => setSelection({ kind: "new" })}
                  icon={<Plus className="h-3.5 w-3.5" weight="bold" />}
                  iconVisible
                  title={t("list.new")}
                />
              ) : null
            }
          >
            {loading ? (
              <FunnelListSkeleton />
            ) : (
              <div className="flex flex-col gap-5">
                <FunnelGroup
                  label={t("list.conversation")}
                  funnels={conversationFunnels}
                  selection={selection}
                  onSelect={(id) => setSelection({ kind: "funnel", id })}
                  emptyText={t("list.emptyConversation")}
                />
                {opportunityFunnels.length > 0 ? (
                  <FunnelGroup
                    label={t("list.opportunity")}
                    funnels={opportunityFunnels}
                    selection={selection}
                    onSelect={(id) => setSelection({ kind: "funnel", id })}
                    emptyText={t("list.emptyOpportunity")}
                  />
                ) : null}
              </div>
            )}
          </PanelSection>
        </aside>

        <section className="min-w-0">
          {selection?.kind === "new" ? (
            <NewFunnelPane
              sources={conversationFunnels}
              onCancel={() =>
                setSelection(
                  funnels[0] ? { kind: "funnel", id: funnels[0].id } : null,
                )
              }
              onCreated={async (created) => {
                await loadFunnels();
                setSelection({ kind: "funnel", id: created.id });
              }}
            />
          ) : selected ? (
            <FunnelDetailPane
              key={selected.id}
              funnel={selected}
              canUpdate={canUpdate}
              canDelete={canDelete}
              siblings={funnels.filter(
                (f) => f.objectType === selected.objectType && f.id !== selected.id,
              )}
              onRenamed={loadFunnels}
              onSetDefault={() => setDefault(selected)}
              onDuplicate={() => duplicate(selected)}
              onDelete={() => setPendingDelete(selected)}
            />
          ) : loading ? null : (
            <NoFunnels onCreate={canCreate ? () => setSelection({ kind: "new" }) : undefined} />
          )}
        </section>
      </div>

      <DeleteFunnelDialog
        key={pendingDelete?.id ?? "none"}
        funnel={pendingDelete}
        destinations={
          pendingDelete
            ? funnels.filter(
                (f) =>
                  f.objectType === pendingDelete.objectType &&
                  f.id !== pendingDelete.id,
              )
            : []
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}


function FunnelGroup({
  label,
  funnels,
  selection,
  onSelect,
  emptyText,
}: {
  label: string;
  funnels: Pipeline[];
  selection: Selection;
  onSelect: (id: string) => void;
  emptyText: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="legend px-1">{label}</p>
      {funnels.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {funnels.map((funnel) => {
            const active =
              selection?.kind === "funnel" && selection.id === funnel.id;
            return (
              <li key={funnel.id}>
                {
}
                <button
                  type="button"
                  onClick={() => onSelect(funnel.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[--radius] px-2 py-2 text-left text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-foreground hover:bg-[hsl(var(--accent-hover))]",
                  )}
                >
                  <span
                    className={cn("lamp", !active && "opacity-0")}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{funnel.name}</span>
                  {funnel.isDefault ? (
                    <Star
                      className="h-3.5 w-3.5 flex-none text-primary-ink"
                      weight="fill"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FunnelListSkeleton() {
  return (
    <div className="flex flex-col gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-9 animate-pulse rounded-[--radius] bg-muted" />
      ))}
    </div>
  );
}


function NewFunnelPane({
  sources,
  onCancel,
  onCreated,
}: {
  sources: Pipeline[];
  onCancel: () => void;
  onCreated: (created: Pipeline) => Promise<void>;
}) {
  const t = useTranslations("funnels");
  const [draft, setDraft] = useState<FunnelDraft>(() => ({
    name: "",
    stages: [newDraftStage([])],
  }));
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  const namedStages = draft.stages.filter((s) => s.name.trim().length > 0);
  const ready = draft.name.trim().length >= 2 && namedStages.length > 0;

  const create = useCallback(async () => {
    if (draft.name.trim().length < 2) {
      setNameError(t("composer.nameTooShort"));
      return;
    }
    setNameError(undefined);
    setBusy(true);
    const { pipeline, error } = await createPipelineAction({
      name: draft.name.trim(),
      objectType: "conversation",
      stages: namedStages.map<StageSeed>((s) => ({
        name: s.name.trim(),
        description: s.description.trim(),
        color: s.color,
      })),
    });
    setBusy(false);
    if (error || !pipeline) {
      toast.error(error ?? t("toast.createFailed"));
      return;
    }
    toast.success(t("toast.created", { name: pipeline.name }));
    await onCreated(pipeline);
  }, [draft, namedStages, onCreated, t]);

  return (
    <PanelSection
      title={t("create.title")}
      description={t("create.description")}
      actions={
        <>
          <ElevatedButton
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={busy}
            title={t("create.cancel")}
          />
          <ElevatedButton
            variant="primary"
            size="sm"
            onClick={create}
            disabled={!ready || busy}
            title={busy ? t("create.creating") : t("create.confirm")}
          />
        </>
      }
    >
      <FunnelComposer
        draft={draft}
        onChange={setDraft}
        sources={sources}
        busy={busy}
        nameError={nameError}
      />
      {!ready && draft.name.trim().length >= 2 ? (
        <p className="mt-3 text-2xs text-muted-foreground">
          {t("create.needsOneStage")}
        </p>
      ) : null}
    </PanelSection>
  );
}


function FunnelDetailPane({
  funnel,
  canUpdate,
  canDelete,
  siblings,
  onRenamed,
  onSetDefault,
  onDuplicate,
  onDelete,
}: {
  funnel: Pipeline;
  canUpdate: boolean;
  canDelete: boolean;
  siblings: Pipeline[];
  onRenamed: () => Promise<unknown>;
  onSetDefault: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("funnels");
  const { currentWorkspace } = useWorkspace();

  const [serverStages, setServerStages] = useState<Stage[] | null>(null);
  const [draft, setDraft] = useState<FunnelDraft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [baseline, setBaseline] = useState("");

  const loadStages = useCallback(async () => {
    const { stages } = await listStagesAction(
      currentWorkspace?.id,
      undefined,
      undefined,
      funnel.id,
    );
    const ordered = [...stages].sort((a, b) => a.position - b.position);
    setServerStages(ordered);
    const next: FunnelDraft = {
      name: funnel.name,
      stages: ordered.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? "",
        color: s.color || STAGE_COLORS[0],
      })),
    };
    setDraft(next);
    setBaseline(signature(next));
  }, [currentWorkspace?.id, funnel.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadStages();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStages]);

  const dirty = signature(draft) !== baseline;
  const namedStages = draft.stages.filter((s) => s.name.trim().length > 0);
  const canSave = canUpdate && dirty && namedStages.length > 0;

  const rename = useCallback(
    async (name: string) => {
      const { error } = await updatePipelineAction(funnel.id, { name });
      if (error) {
        toast.error(error);
        return;
      }
      toast.success(t("toast.renamed", { name }));
      await onRenamed();
    },
    [funnel.id, onRenamed, t],
  );

  const save = useCallback(async () => {
    if (!serverStages) return;
    setBusy(true);
    const error = await commitFunnel(funnel, draft, serverStages);
    setBusy(false);
    if (error) {
      toast.error(error);
      await loadStages();
      return;
    }
    toast.success(t("toast.saved"));
    await onRenamed();
    await loadStages();
  }, [funnel, draft, serverStages, loadStages, onRenamed, t]);

  const revert = useCallback(() => void loadStages(), [loadStages]);

  return (
    <PanelSection
      title={
        <EditableFunnelName
          name={funnel.name}
          canEdit={canUpdate}
          busy={busy}
          onRename={rename}
        />
      }
      description={
        funnel.objectType === "conversation"
          ? t("detail.conversationHint")
          : t("detail.opportunityHint")
      }
      legend={funnel.isDefault ? t("detail.isDefault") : undefined}
      actions={
        <>
          {canUpdate && !funnel.isDefault ? (
            <ElevatedButton
              variant="command"
              size="sm"
              onClick={onSetDefault}
              icon={<Star className="h-3.5 w-3.5" weight="bold" />}
              iconVisible
              title={t("detail.makeDefault")}
            />
          ) : null}
          {canUpdate ? (
            <ElevatedButton
              variant="command"
              size="sm"
              onClick={onDuplicate}
              icon={<CopySimple className="h-3.5 w-3.5" weight="bold" />}
              iconVisible
              title={t("detail.duplicate")}
            />
          ) : null}
          {canDelete && !funnel.isDefault ? (
            <ElevatedButton
              variant="command"
              size="sm"
              onClick={onDelete}
              icon={<Trash className="h-3.5 w-3.5" weight="bold" />}
              iconVisible
              title={t("detail.remove")}
            />
          ) : null}
        </>
      }
    >
      {serverStages === null ? (
        <div className="h-40 animate-pulse rounded-[--radius] bg-muted" aria-hidden="true" />
      ) : (
        <div className="flex flex-col gap-5">
          <FunnelComposer
            draft={draft}
            onChange={setDraft}
            sources={siblings}
            busy={busy || !canUpdate}
            showTemplates={false}
            showName={false}
          />

          {
}
          {dirty ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[--radius] bg-muted px-3 py-2.5">
              <p className="text-sm text-muted-foreground">{t("detail.unsaved")}</p>
              <div className="flex items-center gap-1.5">
                <ElevatedButton
                  variant="secondary"
                  size="sm"
                  onClick={revert}
                  disabled={busy}
                  title={t("detail.revert")}
                />
                <ElevatedButton
                  variant="primary"
                  size="sm"
                  onClick={save}
                  disabled={!canSave || busy}
                  title={busy ? t("detail.saving") : t("detail.save")}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </PanelSection>
  );
}

function NoFunnels({ onCreate }: { onCreate?: () => void }) {
  const t = useTranslations("funnels");
  return (
    <div className="flex flex-col items-start gap-3 rounded-[--radius] border border-dashed border-border-strong px-5 py-8">
      <Kanban className="h-5 w-5 text-primary-ink" weight="bold" aria-hidden="true" />
      <h2 className="font-display text-base font-semibold tracking-[-0.01em] text-foreground">
        {t("none.title")}
      </h2>
      <p className="max-w-[62ch] text-sm leading-snug text-muted-foreground">
        {t("none.body")}
      </p>
      {onCreate ? (
        <ElevatedButton
          variant="primary"
          size="sm"
          onClick={onCreate}
          icon={<FunnelGlyph className="h-3.5 w-3.5" weight="bold" />}
          iconVisible
          title={t("none.cta")}
        />
      ) : null}
    </div>
  );
}


function signature(draft: FunnelDraft): string {
  return JSON.stringify(
    draft.stages.map((s) => [s.id, s.name.trim(), s.description.trim(), s.color]),
  );
}

async function commitFunnel(
  funnel: Pipeline,
  draft: FunnelDraft,
  serverStages: Stage[],
): Promise<string | null> {
  const rows = draft.stages.filter((s) => s.name.trim().length > 0);
  const byId = new Map(serverStages.map((s) => [s.id, s]));
  const resolvedIds: string[] = [];

  for (const row of rows) {
    if (isDraftStage(row)) {
      const { stage, error } = await createStageAction(
        row.name.trim(),
        row.color,
        row.description.trim(),
        undefined,
        undefined,
        funnel.id,
      );
      if (error || !stage) return error ?? "";
      resolvedIds.push(stage.id);
      continue;
    }

    resolvedIds.push(row.id);
    const current = byId.get(row.id);
    if (!current) continue;
    const changed =
      current.name !== row.name.trim() ||
      (current.description ?? "") !== row.description.trim() ||
      current.color !== row.color;
    if (!changed) continue;
    const { error } = await updateStageAction(row.id, {
      name: row.name.trim(),
      color: row.color,
      description: row.description.trim(),
    });
    if (error) return error;
  }

  const kept = new Set(resolvedIds);
  for (const stage of serverStages) {
    if (kept.has(stage.id)) continue;
    const { error } = await deleteStageAction(stage.id);
    if (error) return error;
  }

  const orderChanged =
    resolvedIds.length !== serverStages.length ||
    resolvedIds.some((id, i) => serverStages[i]?.id !== id);
  if (orderChanged) {
    const { error } = await reorderStagesAction(resolvedIds);
    if (error) return error;
  }

  const entry = resolvedIds[0];
  const currentEntry = serverStages.find((s) => s.isInitial)?.id;
  if (entry && entry !== currentEntry) {
    const { error } = await setInitialStageAction(entry);
    if (error) return error;
  }

  return null;
}
