"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  X,
  PaperPlaneRight,
  Play,
  Stop,
  Robot,
  CircleNotch,
  ArrowsClockwise,
  CaretDown,
  PushPin,
  Target,
  Globe,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import ElevatedButton from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import type { SimStatus, SimStep, UseWorkflowSimulationReturn } from "@/hooks/use-workflow-simulation";
import { isPinnableStep } from "@/lib/workflows/node-pin";
import { isPinnableBehavior } from "@/lib/workflows/node-test-behavior";
import type { InteractiveChoice } from "@/lib/conversations/interactive-message";
import type { ConversationMessage } from "@/lib/conversations/types";
import { isRealCallRefusal } from "@/lib/workflows/real-calls";
import { SIM_EVENT_WINDOW, simEventWindowStart } from "@/lib/workflows/sim-session";
import { simTimeline } from "@/lib/workflows/sim-timeline";

import { JsonBlock } from "./run-bits";
import { useTestBehaviorOf } from "./node-previews/node-definitions";
import { EventItem, Keypad, PauseToolbar, RealCallsDialog, ReproducingBanner, SimStepGroup, StatusBadge } from "./test-panel-parts";
import { SimComposer } from "./sim-composer";
import { SimFormReply } from "./sim-form-reply";
import { SimMessageRow, SimThreadProvider } from "./sim-thread";
import { SandboxEffectLines, StepDetail, StepRow, useSandboxEffects } from "./step-detail";

interface WorkflowTestPanelProps {
  simulation: UseWorkflowSimulationReturn;
  voice?: boolean;
  onClose: () => void;
  unsaved?: boolean;
  nodeLabel?: (nodeId: string) => string | undefined;
  nodeExists?: (nodeId: string) => boolean;
  onFocusNode?: (nodeId: string) => void;
  onPinStep?: (step: SimStep) => void;
  versionDiffers?: (version: number | undefined) => boolean;
  onViewVersion?: (version: number) => void;
}

const ACTIVE_STATUSES: ReadonlySet<SimStatus> = new Set([
  "running",
  "paused",
  "waiting_reply",
  "waiting_form",
  "waiting_key",
  "connecting",
  "waiting_trigger",
  "confirming",
]);

function StepEffects({ step }: { step: SimStep }) {
  const effects = useSandboxEffects(step);
  if (!effects.notice && effects.wouldDo.length === 0) return null;
  return (
    <li className="flex justify-center px-6 text-center">
      <SandboxEffectLines effects={effects} />
    </li>
  );
}

const noLabel = () => undefined;
const everyNode = () => true;

export function WorkflowTestPanel({
  simulation,
  voice = false,
  onClose,
  unsaved = false,
  nodeLabel = noLabel,
  nodeExists = everyNode,
  onFocusNode,
  onPinStep,
  versionDiffers,
  onViewVersion,
}: WorkflowTestPanelProps) {
  const t = useTranslations("workflowDebug");
  const tRuns = useTranslations("workflowRuns");
  const behaviorOf = useTestBehaviorOf();
  const { status, events, currentNodeId, stateVars, pause, reproducing, refusal, cancelReason, waitingForm, start, sendReply, sendKey, cancel } = simulation;

  const [windowSize, setWindowSize] = useState(SIM_EVENT_WINDOW);
  const [showState, setShowState] = useState(Boolean(simulation.pause));
  const [shownPause, setShownPause] = useState(pause);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  if (pause !== shownPause) {
    setShownPause(pause);
    if (pause) setShowState(true);
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0 && windowSize !== SIM_EVENT_WINDOW) setWindowSize(SIM_EVENT_WINDOW);
  const windowStart = simEventWindowStart(events.length, windowSize);
  const messages = useMemo(
    () => events.flatMap((event): ConversationMessage[] => (event.type === "message" && event.message ? [event.message] : [])),
    [events],
  );
  const messageNodes = useMemo(
    () => new Map(events.flatMap((event): Array<[string, string]> => (event.type === "message" && event.message && event.nodeId ? [[event.message.id, event.nodeId]] : []))),
    [events],
  );
  const timeline = useMemo(() => simTimeline(events.slice(windowStart), windowStart, pause), [events, windowStart, pause]);
  const toggleGroup = (key: string) =>
    setOpenGroups((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const chooseOption = useCallback((choice: InteractiveChoice) => sendReply({ kind: "selection", choice }), [sendReply]);

  const isActive = ACTIVE_STATUSES.has(status);
  const stateCount = Object.keys(stateVars).length;
  const pausedLabel = pause ? (nodeLabel(pause.nodeId) ?? pause.nodeId) : "";
  const hasHistory = events.length > 0;

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          '[data-radix-popper-content-wrapper], [role="listbox"], [role="menu"], [role="dialog"], [aria-expanded="true"]',
        )
      ) {
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const renderStep = (step: SimStep, compact = false) => {
    const exists = nodeExists(step.nodeId);
    const pinnable = Boolean(onPinStep) && exists && !step.pinned && isPinnableBehavior(behaviorOf(step.nodeType)) && isPinnableStep(step);
    const refused = isRealCallRefusal(step);
    return (
      <Fragment key={`${step.stepIndex}:${step.id}`}>
        <StepRow
          step={step}
          label={nodeLabel(step.nodeId)}
          expanded={expandedStep === step.id}
          compact={compact}
          onToggle={() => {
            setExpandedStep((current) => (current === step.id ? null : step.id));
            if (exists) onFocusNode?.(step.nodeId);
          }}
        >
          <StepDetail
            step={step}
            actions={
              <>
                {exists && onFocusNode && (
                  <ElevatedButton variant="ghost" size="sm" iconVisible icon={<Target size={12} />} title={tRuns("detail.showInFlow")} onClick={() => onFocusNode(step.nodeId)} />
                )}
                {pinnable && (
                  <ElevatedButton variant="outline-subtle" size="sm" iconVisible icon={<PushPin size={12} />} title={t("step.pin")} onClick={() => onPinStep?.(step)} />
                )}
                {refused && (
                  <ElevatedButton
                    variant="primary"
                    size="sm"
                    iconVisible
                    icon={<Globe size={12} />}
                    title={t("step.confirmAndRetry")}
                    onClick={() => simulation.retryWithRealCalls(step.nodeId)}
                  />
                )}
              </>
            }
          >
            {refused && <p className="text-2xs text-muted-foreground">{t("step.realCallRefused")}</p>}
          </StepDetail>
        </StepRow>
        <StepEffects step={step} />
      </Fragment>
    );
  };

  return (
    <aside aria-label="Simulação" className="relative flex min-h-0 w-[400px] flex-1 flex-col bg-card">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Robot size={16} weight="duotone" className="text-primary-ink" />
          <span className="text-sm font-medium">Simulação</span>
          <StatusBadge status={status} />
        </div>
        <ElevatedButton
          variant="ghost"
          size="icon"
          icon={<X size={14} />}
          iconVisible
          aria-label="Fechar simulação"
          onClick={onClose}
          className="h-6 w-6"
        />
      </div>

      <div className="space-y-2 px-3 empty:hidden [&:not(:empty)]:py-2">
        {unsaved && <Notice tone="info">{t("session.unsaved")}</Notice>}
        {reproducing && (
          <ReproducingBanner reproducing={reproducing} nodeLabel={nodeLabel} versionDiffers={versionDiffers} onViewVersion={onViewVersion} />
        )}
        {refusal && (
          <Notice tone="fault">
            <span className="block">{t("session.refused", { error: refusal.error })}</span>
            {refusal.command === "reproduce_run" && status === "ready" && (
              <button
                type="button"
                onClick={() => start()}
                className="mt-1 text-xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("session.startWithoutReproducing")}
              </button>
            )}
          </Notice>
        )}
        {status === "cancelled" && cancelReason === "paused_timeout" && <Notice tone="warning">{t("session.pausedTimeout")}</Notice>}
        {status === "cancelled" && cancelReason === "start_timeout" && (
          <Notice tone="warning">
            <span className="block">{t("session.startTimeout")}</span>
            <button
              type="button"
              onClick={() => start()}
              className="mt-1 text-xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("session.restart")}
            </button>
          </Notice>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {status === "waiting_trigger" && !hasHistory && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
            <PaperPlaneRight size={28} weight="duotone" className="opacity-50" />
            <p className="text-xs">Envie uma mensagem para iniciar o workflow.</p>
          </div>
        )}

        {!hasHistory && (status === "idle" || status === "ready") && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground">
            <Play size={32} weight="duotone" className="opacity-50" />
            <p className="text-xs">Clique em Iniciar para simular o workflow.</p>
          </div>
        )}

        {windowStart > 0 && (
          <button
            type="button"
            onClick={() => setWindowSize((current) => current + SIM_EVENT_WINDOW)}
            className="block w-full rounded-[--radius] py-1 text-center text-2xs font-medium text-primary-ink hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("chat.showEarlier", { count: Math.min(windowStart, SIM_EVENT_WINDOW) })}
          </button>
        )}

        <SimThreadProvider
          messages={messages}
          onChooseOption={status === "waiting_reply" ? chooseOption : undefined}
          nodeIds={messageNodes}
          nodeLabel={nodeLabel}
        >
          <ol className="space-y-2">
            {timeline.map((item) => {
              if (item.kind === "step") return renderStep(item.step, item.compact);
              if (item.kind === "steps") {
                const open = openGroups.has(item.key);
                return (
                  <Fragment key={item.key}>
                    <SimStepGroup count={item.steps.length} durationMs={item.durationMs} expanded={open} onToggle={() => toggleGroup(item.key)} />
                    {open
                      ? item.steps.map((step) => renderStep(step))
                      : item.steps.map((step) => <StepEffects key={`effects:${step.stepIndex}:${step.id}`} step={step} />)}
                  </Fragment>
                );
              }
              const evt = item.event;
              if (evt.type === "message" && evt.message) {
                return (
                  <li key={item.key}>
                    <SimMessageRow message={evt.message} />
                  </li>
                );
              }
              return <EventItem key={item.key} event={evt} nodeLabel={nodeLabel} />;
            })}
          </ol>
        </SimThreadProvider>

        {status === "connecting" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <CircleNotch size={14} className="animate-spin" />
            Conectando...
          </div>
        )}

        {currentNodeId && status === "running" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <CircleNotch size={14} className="animate-spin" />
            Executando nó: {nodeLabel(currentNodeId) ?? currentNodeId}
          </div>
        )}
      </div>

      {pause && status === "paused" && (
        <PauseToolbar pause={pause} pausedLabel={pausedLabel} onStep={simulation.step} onResume={simulation.resume} onStop={cancel} />
      )}

      {(stateCount > 0 || pause) && (
        <div className="border-t border-border">
          <button
            type="button"
            aria-expanded={showState}
            onClick={() => setShowState(!showState)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <CaretDown size={12} className={cn("transition-transform", showState && "rotate-180")} />
            {pause ? t("toolbar.stateTitle") : "Variáveis"} ({stateCount})
          </button>
          {showState && (
            <div className="px-3 pb-2">
              <JsonBlock value={stateVars} className="max-h-48" />
            </div>
          )}
        </div>
      )}

      {voice && isActive && status !== "connecting" && status !== "confirming" && (
        <Keypad waiting={status === "waiting_key"} onKey={sendKey} />
      )}

      {!voice && (status === "waiting_reply" || status === "waiting_trigger") && (
        <SimComposer trigger={status === "waiting_trigger"} onReply={sendReply} />
      )}

      {!voice && status === "waiting_form" && waitingForm && (
        <SimFormReply key={`${waitingForm.nodeId}:${waitingForm.formId}`} formId={waitingForm.formId} onReply={sendReply} />
      )}

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border flex-shrink-0">
        {status === "ready" || !isActive ? (
          <ElevatedButton
            variant="primary"
            size="sm"
            title={hasHistory ? "Reiniciar" : "Iniciar"}
            icon={hasHistory ? <ArrowsClockwise size={14} /> : <Play size={14} weight="fill" />}
            iconVisible
            onClick={() => start()}
            className="flex-1"
          />
        ) : (
          <ElevatedButton
            variant="outline-subtle"
            size="sm"
            title="Cancelar"
            icon={<Stop size={14} weight="fill" />}
            iconVisible
            onClick={cancel}
            className="flex-1 text-destructive-ink border-border hover:bg-muted"
          />
        )}
      </div>

      {status === "confirming" && (
        <RealCallsDialog
          nodes={simulation.pendingRealCalls.map((id) => nodeLabel(id) ?? id)}
          onConfirm={simulation.confirmRealCalls}
          onSkip={simulation.skipRealCalls}
          onCancel={simulation.dismissRealCalls}
        />
      )}
    </aside>
  );
}
