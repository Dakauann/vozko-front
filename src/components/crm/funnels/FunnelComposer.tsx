"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CopySimple, Sparkle } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listStagesAction } from "@/app/actions/stages";
import type { Pipeline } from "@/lib/crm/pipelines";
import { useWorkspace } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";

import {
  FunnelStageComposer,
  suggestedStages,
  type DraftStage,
} from "./FunnelStageComposer";

export const MAX_FUNNEL_NAME = 120;

export interface FunnelDraft {
  name: string;
  stages: DraftStage[];
}

interface FunnelComposerProps {
  draft: FunnelDraft;
  onChange: (draft: FunnelDraft) => void;
  /** Existing funnels whose columns can be copied in as a starting point. */
  sources: Pipeline[];
  busy?: boolean;
  /** Rows that cannot be removed, keyed by stage id (editing an existing funnel). */
  lockedIds?: ReadonlySet<string>;
  /** Hidden while editing: the columns are already there, nothing to prefill. */
  showTemplates?: boolean;
  /**
   * Hidden when the host already shows the name as its own heading.
   *
   * The detail pane does: the funnel's name IS the panel title, and repeating it
   * in a field directly underneath printed the same word twice, one of them
   * sitting on the field's floating label. The name is edited by clicking the
   * title there, the way a lead is renamed in the CRM.
   */
  showName?: boolean;
  nameError?: string;
}

/**
 * Name it, then draw it.
 *
 * The templates are deliberately DEMOTED. They used to be the whole creation
 * flow — pick a source, press create, receive a funnel someone else designed —
 * and the operator never saw the columns until the board rendered them. Here they
 * are one quiet row that FILLS the editor below, which is then edited like any
 * other draft. The product's own defaults are offered the same way, as a
 * suggestion, not as the path of least resistance.
 *
 * That inversion is the point of the surface: what gets built is what is on
 * screen when the button is pressed.
 */
export function FunnelComposer({
  draft,
  onChange,
  sources,
  busy = false,
  lockedIds,
  showTemplates = true,
  showName = true,
  nameError,
}: FunnelComposerProps) {
  const t = useTranslations("funnels.composer");
  const tDefaults = useTranslations("funnels.defaults");
  const { currentWorkspace } = useWorkspace();
  const [loadingSource, setLoadingSource] = useState<string | null>(null);

  const setStages = useCallback(
    (stages: DraftStage[]) => onChange({ ...draft, stages }),
    [draft, onChange],
  );

  // The product's canonical four, read from the message catalogue so they arrive
  // in the operator's language rather than as the server's lowercase keys.
  const productDefaults = useMemo(
    () => [
      tDefaults("received"),
      tDefaults("inProgress"),
      tDefaults("scheduling"),
      tDefaults("finished"),
    ],
    [tDefaults],
  );

  const fillWithDefaults = useCallback(() => {
    onChange({ ...draft, stages: suggestedStages(productDefaults) });
  }, [draft, onChange, productDefaults]);

  const fillFromFunnel = useCallback(
    async (source: Pipeline) => {
      setLoadingSource(source.id);
      const { stages } = await listStagesAction(
        currentWorkspace?.id,
        undefined,
        undefined,
        source.id,
      );
      setLoadingSource(null);
      // An empty source would silently clear the editor, which reads as the copy
      // having failed. Leaving the draft alone and saying nothing changed is the
      // honest outcome, and the operator still has their work.
      if (stages.length === 0) return;
      onChange({
        ...draft,
        stages: suggestedStages(stages.map((s) => s.name)).map((row, i) => ({
          ...row,
          description: stages[i]?.description ?? "",
          color: stages[i]?.color || row.color,
        })),
      });
    },
    [currentWorkspace?.id, draft, onChange],
  );

  return (
    <div className="flex flex-col gap-6">
      {showName ? (
        <div className="flex flex-col gap-1.5">
          <ElevatedInput
            label={t("nameLabel")}
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            maxLength={MAX_FUNNEL_NAME}
            disabled={busy}
            controlSize="default"
            error={nameError}
            // Only where the field is the first thing on a blank form. In the
            // detail pane the name is not shown at all, and stealing focus on
            // every funnel the operator clicks would scroll the pane and swallow
            // the next keystroke.
            autoFocus
          />
          <p className="text-2xs leading-snug text-muted-foreground">
            {t("nameHint")}
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-foreground">
              {t("stagesTitle")}
            </h3>
            <p className="mt-1 max-w-[68ch] text-sm leading-snug text-muted-foreground">
              {t("stagesHint")}
            </p>
          </div>

          {showTemplates ? (
            <TemplateRow
              busy={busy}
              loadingSource={loadingSource}
              sources={sources}
              onDefaults={fillWithDefaults}
              onCopy={fillFromFunnel}
              hasStages={draft.stages.length > 0}
            />
          ) : null}
        </div>

        <FunnelStageComposer
          stages={draft.stages}
          onChange={setStages}
          lockedIds={lockedIds}
          disabled={busy}
        />
      </section>
    </div>
  );
}

/**
 * "Start from" rather than "create from": both controls write into the editor and
 * then get out of the way. The replace warning appears only once there is work to
 * lose, so the common first-run case stays a single click.
 */
function TemplateRow({
  busy,
  loadingSource,
  sources,
  onDefaults,
  onCopy,
  hasStages,
}: {
  busy: boolean;
  loadingSource: string | null;
  sources: Pipeline[];
  onDefaults: () => void;
  onCopy: (source: Pipeline) => void;
  hasStages: boolean;
}) {
  const t = useTranslations("funnels.composer");

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <p className="legend">{t("startFrom")}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <ElevatedButton
          variant="outline-subtle"
          size="sm"
          onClick={onDefaults}
          disabled={busy}
          icon={<Sparkle className="h-3.5 w-3.5" weight="bold" />}
          iconVisible
          title={t("useDefaults")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ElevatedButton
              variant="outline-subtle"
              size="sm"
              disabled={busy || sources.length === 0}
              icon={<CopySimple className="h-3.5 w-3.5" weight="bold" />}
              iconVisible
              title={
                loadingSource ? t("copying") : t("copyFrom")
              }
              iconSide="left"
              className={cn(sources.length === 0 && "hidden")}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
            {sources.map((source) => (
              <DropdownMenuItem
                key={source.id}
                onSelect={() => onCopy(source)}
                className="gap-2"
              >
                <CaretDown
                  className="h-3 w-3 flex-none -rotate-90 text-muted-foreground"
                  weight="bold"
                  aria-hidden="true"
                />
                <span className="truncate">{source.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {hasStages ? (
        <p className="text-2xs leading-snug text-muted-foreground sm:text-right">
          {t("replaceWarning")}
        </p>
      ) : null}
    </div>
  );
}
