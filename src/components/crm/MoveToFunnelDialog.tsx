"use client";

import { useMemo, useState } from "react";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowsLeftRight, ArrowRight, Warning } from "@/components/icons";
import type { FunnelStages } from "@/app/actions/stages";

/**
 * Move a conversation to a stage of ANOTHER funnel.
 *
 * Separate from the ordinary "Mover para" menu on purpose, and that separation
 * is the safety rule rather than decoration. The server refuses a cross-funnel
 * move unless the client says it meant it, because a stage list showing the
 * wrong funnel used to let a single click strand a lead on a board nobody
 * looks at. So a funnel change is its own deliberate act: pick the funnel,
 * then the stage inside it, then confirm.
 *
 * The destination stage is never assumed. A funnel's first column is a fine
 * guess for a new conversation and a bad one for a lead already halfway
 * through: dropping a qualified lead back onto "novo lead" silently undoes
 * work the operator can see but the CRM cannot.
 *
 * Shaped after CreateTemplateDialog, which is the house dialog: a `.tile-*`
 * plate carrying the glyph beside the title, sectioned body with `text-sm
 * font-semibold` heads, quiet `bg-muted border-border` panels, and a footer
 * divided by a rule. Colour appears only as a mark on a neutral ground, never
 * as a tint under ink of its own hue.
 */
export function MoveToFunnelDialog({
  open,
  onOpenChange,
  funnels,
  currentStageId,
  currentStageName,
  contactName,
  bulkCount,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every conversation funnel in the workspace, with its stages. */
  funnels: FunnelStages[];
  currentStageId: string | null;
  currentStageName?: string | null;
  /** Who the conversation is with, so the confirmation names a person. */
  contactName?: string | null;
  /**
   * How many conversations this will move, when it is a bulk action.
   *
   * Undefined for the single-conversation case, which is the default. Set, the
   * dialog drops the "De" line (the sources differ per row, so naming one would
   * be a lie), counts the conversations in every sentence, and says outright
   * that there is no undo. Same dialog rather than a near-identical second one:
   * the decision being made is the same, only its blast radius differs.
   */
  bulkCount?: number;
  /** Applies the move. Resolves to an error message, or null on success. */
  onConfirm: (stageId: string) => Promise<string | null>;
}) {
  const [selectedFunnelId, setSelectedFunnelId] = useState("");
  const [selectedStageId, setSelectedStageId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBulk = typeof bulkCount === "number" && bulkCount > 0;
  const plural = isBulk && bulkCount !== 1;

  /** The funnel the conversation is on now, found from the stage it holds. */
  const currentFunnel = useMemo(
    () => funnels.find((f) => f.stages.some((s) => s.id === currentStageId)) ?? null,
    [funnels, currentStageId],
  );

  /**
   * Only OTHER funnels are offered. Moving to the funnel it is already on is
   * the ordinary stage menu's job, and listing it here would make this dialog
   * look like the way to do both.
   */
  const targets = useMemo(
    () =>
      funnels.filter(
        (f) =>
          f.stages.length > 0 &&
          // In bulk there is no single current funnel to exclude: the selection
          // spans several, and hiding one of them would make it unreachable for
          // the rows that are not on it.
          (isBulk || f.pipelineId !== currentFunnel?.pipelineId),
      ),
    [funnels, currentFunnel, isBulk],
  );

  const selectedFunnel = targets.find((f) => f.pipelineId === selectedFunnelId);
  const selectedStage = selectedFunnel?.stages.find((s) => s.id === selectedStageId);

  const reset = () => {
    setSelectedFunnelId("");
    setSelectedStageId("");
    setError(null);
    setSaving(false);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const confirm = async () => {
    if (!selectedStageId) return;
    setSaving(true);
    setError(null);
    const failure = await onConfirm(selectedStageId);
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    close(false);
  };

  const subject = isBulk
    ? `${bulkCount} ${plural ? "conversas" : "conversa"}`
    : (contactName ?? "a conversa");

  const origin = isBulk
    ? plural
      ? "Funis variados"
      : "Funil atual"
    : (currentFunnel?.pipelineName ?? "Sem funil");

  return (
    <ElevatedDialog open={open} onOpenChange={close}>
      <ElevatedDialogContent className="max-w-lg">
        {/* The house header: a plate carrying the glyph, title and one line of
            prose beside it. The plate is the `.tile-*` recipe, so the hue lives
            in the glyph on a known ground rather than as a wash. */}
        <ElevatedDialogHeader className="flex-row items-start gap-3 space-y-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[--radius] tile-info">
            <ArrowsLeftRight className="h-6 w-6" weight="bold" />
          </div>
          <div className="min-w-0 flex-1">
            <ElevatedDialogTitle className="text-lg">
              Mover para outro funil
            </ElevatedDialogTitle>
            <ElevatedDialogDescription>
              {isBulk
                ? `${subject} ${plural ? "passam" : "passa"} a ser acompanhada${plural ? "s" : ""} em outro funil.`
                : contactName
                  ? `A conversa com ${contactName} passa a ser acompanhada em outro funil.`
                  : "A conversa passa a ser acompanhada em outro funil."}
            </ElevatedDialogDescription>
          </div>
        </ElevatedDialogHeader>

        {targets.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Este workspace tem apenas um funil com etapas. Crie outro funil para
            poder mover conversas entre eles.
          </p>
        ) : (
          <div className="space-y-5">
            {/* ── Destino ─────────────────────────────────────────────── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Destino</h3>

              <ElevatedSelect
                label="Funil"
                value={selectedFunnelId}
                onValueChange={(v) => {
                  setSelectedFunnelId(v);
                  // The stage never carries over between funnels: it belongs to
                  // the old one and does not exist in the new one.
                  setSelectedStageId("");
                  setError(null);
                }}
              >
                {targets.map((funnel) => (
                  <ElevatedSelectItem
                    key={funnel.pipelineId}
                    value={funnel.pipelineId}
                    meta={`${funnel.stages.length} ${funnel.stages.length === 1 ? "etapa" : "etapas"}`}
                    description={funnel.isDefault ? "Funil padrão" : undefined}
                  >
                    {funnel.pipelineName || "Sem funil"}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>

              {/* Revealed only once a funnel is chosen, so the two decisions
                  read in order instead of as one compound choice. */}
              {selectedFunnel ? (
                <ElevatedSelect
                  label="Etapa"
                  value={selectedStageId}
                  onValueChange={(v) => {
                    setSelectedStageId(v);
                    setError(null);
                  }}
                >
                  {selectedFunnel.stages.map((stage) => (
                    <ElevatedSelectItem
                      key={stage.id}
                      value={stage.id}
                      // iconStyled={false} or the dot is mounted on a solid
                      // brand plate, which puts the stage's own colour on top of
                      // green and reads as a broken swatch rather than a mark.
                      iconStyled={false}
                      icon={
                        <span
                          className="block h-2.5 w-2.5 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: stage.color }}
                        />
                      }
                    >
                      {stage.name}
                    </ElevatedSelectItem>
                  ))}
                </ElevatedSelect>
              ) : null}
            </div>

            {/* ── O que muda ──────────────────────────────────────────── */}
            {selectedStage ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  O que muda
                </h3>

                {/* The whole move on one quiet panel, the same
                    bg-muted/border-border the template dialog uses for its
                    previews. The only colour is the destination stage's own
                    dot: a mark on a neutral ground. */}
                <div className="flex items-center gap-3 rounded-[--radius] border border-border bg-muted px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                      De
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {origin}
                      {!isBulk && currentStageName ? ` · ${currentStageName}` : ""}
                    </p>
                  </div>
                  <ArrowRight
                    weight="bold"
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
                      Para
                    </p>
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: selectedStage.color }}
                      />
                      <span className="truncate">
                        {selectedFunnel?.pipelineName} · {selectedStage.name}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Said outright: the consequence is invisible from here, and
                    the conversation simply stops appearing on the board the
                    operator was looking at. */}
                <Alert variant="warning">
                  <Warning className="h-4 w-4" weight="fill" />
                  <AlertTitle>
                    {isBulk && plural
                      ? "As conversas mudam de quadro"
                      : "A conversa muda de quadro"}
                  </AlertTitle>
                  <AlertDescription>
                    {isBulk && plural
                      ? "Elas deixam de aparecer nos quadros em que estão hoje e passam a aparecer no quadro do funil escolhido. O histórico e as mensagens não mudam, mas esta ação não tem desfazer."
                      : "Ela deixa de aparecer no quadro do funil atual e passa a aparecer no quadro do funil escolhido. O histórico e as mensagens não mudam."}
                  </AlertDescription>
                </Alert>
              </div>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <Warning className="h-4 w-4" weight="fill" />
                <AlertTitle>Não foi possível mover</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        {/* Footer on its own rule, as the template dialog does, so the commit
            is separated from the choices rather than floating under them. */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button
            variant="ghost"
            title="Cancelar"
            onClick={() => close(false)}
            disabled={saving}
          />
          <Button
            variant="primary"
            title={
              saving
                ? "Movendo..."
                : isBulk
                  ? `Mover ${subject}`
                  : "Mover conversa"
            }
            onClick={confirm}
            disabled={!selectedStageId || saving}
          />
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

export default MoveToFunnelDialog;
