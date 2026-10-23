"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Play, Stop, Robot, CircleNotch, ArrowsClockwise, CaretDown, PushPin, Target, Globe } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useStickToBottom } from "@/components/ai-chat/use-stick-to-bottom";
import { ChatScrollDownButton } from "@/components/chat/chat-parts";
import {
  CHAT_CANVAS,
  CHAT_CANVAS_BODY,
  CHAT_EMPTY,
  CHAT_HEADER,
  CHAT_HEADER_TITLE,
  CHAT_ICON_BUTTON,
  CHAT_LOAD_OLDER,
  CHAT_SYSTEM_LINE,
  CHAT_SYSTEM_ROW,
} from "@/components/chat/chat-styles";
import ElevatedButton from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import type { SimStatus, SimStep, UseWorkflowSimulationReturn } from "@/hooks/use-workflow-simulation";
import { isPinnableStep } from "@/lib/workflows/node-pin";
import { isPinnableBehavior } from "@/lib/workflows/node-test-behavior";
import type { InteractiveChoice } from "@/lib/conversations/interactive-message";
import type { ConversationMessage } from "@/lib/conversations/types";
import { isRealCallRefusal } from "@/lib/workflows/real-calls";
import { SIM_EVENT_WINDOW, simEventWindowStart, simMessageSenders } from "@/lib/workflows/sim-session";
import { simGroupMember } from "@/lib/workflows/sim-message";
import { simTimeline, simTimelineGroups } from "@/lib/workflows/sim-timeline";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { TriggerTestInput } from "@/lib/workflows/test-inputs";
import { triggerDisplayLabel, type TriggerInputIssue } from "@/lib/workflows/trigger-input";

import { JsonBlock } from "./run-bits";
import { TriggerStartScreen, useTriggerStart } from "./trigger-start-screen";
import { useTestBehaviorOf } from "./node-previews/node-definitions";
import { EventItem, Keypad, PauseToolbar, RealCallsDialog, ReproducingBanner, SimStepGroup, SimStepLine, StatusBadge } from "./test-panel-parts";
import { SimComposer } from "./sim-composer";
import { SimFormReply } from "./sim-form-reply";
import { SimMessageRow, SimThreadProvider, useSimSenderLabel } from "./sim-thread";
import { SandboxEffectLines, StepDetail, useSandboxEffects } from "./step-detail";

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
  workflowId?: string;
  scenariosOf?: (nodeId: string) => TriggerTestInput[] | undefined;
  onScenariosChange?: (nodeId: string, scenarios: TriggerTestInput[]) => void;
}

const NO_ISSUES: readonly TriggerInputIssue[] = [];

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
    <li className={CHAT_SYSTEM_ROW}>
      <div className={CHAT_SYSTEM_LINE}>
        <SandboxEffectLines effects={effects} />
      </div>
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
  workflowId,
  scenariosOf,
  onScenariosChange,
}: WorkflowTestPanelProps) {
  const t = useTranslations("workflowDebug");
  const tTrigger = useTranslations("workflowDebug.triggerInput");
  const tWorkflows = useTranslations("workflowsPage");
  const tRuns = useTranslations("workflowRuns");
  const tThread = useTranslations("crmConversation.thread");
  const behaviorOf = useTestBehaviorOf();
  const { status, events, currentNodeId, stateVars, pause, reproducing, refusal, cancelReason, waitingForm, start, sendReply, sendKey, cancel } = simulation;

  const [windowSize, setWindowSize] = useState(SIM_EVENT_WINDOW);
  const [showState, setShowState] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(() => new Set());

  if (events.length === 0 && windowSize !== SIM_EVENT_WINDOW) setWindowSize(SIM_EVENT_WINDOW);
  const windowStart = simEventWindowStart(events.length, windowSize);
  const messages = useMemo(
    () => events.flatMap((event): ConversationMessage[] => (event.type === "message" && event.message ? [event.message] : [])),
    [events],
  );
  const messageSenders = useMemo(() => simMessageSenders(events, nodeLabel), [events, nodeLabel]);
  const hasHistory = events.length > 0;
  const showStartScreen = status === "ready" && !hasHistory && (simulation.triggers.length > 0 || simulation.unreadableTriggers > 0);
  const { scrollRef, onScroll, showScrollDown, scrollToBottom } = useStickToBottom(`${events.length}:${status}`, simulation.runId ?? "sim", showStartScreen ? "top" : "bottom");
  const timeline = useMemo(() => simTimeline(events.slice(windowStart), windowStart, pause), [events, windowStart, pause]);
  const senderLabel = useSimSenderLabel(messageSenders);
  const stacks = useMemo(() => simTimelineGroups(timeline, (message) => simGroupMember(message, senderLabel(message))), [timeline, senderLabel]);
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

  const triggerStart = useTriggerStart(simulation.triggers, simulation.defaultTriggerNodeId);
  const [sentTriggerId, setSentTriggerId] = useState<string | null>(null);
  const startRefusal = refusal?.command === "start" ? refusal : null;
  const startIssues = startRefusal?.issues && triggerStart.spec?.nodeId === sentTriggerId ? startRefusal.issues : NO_ISSUES;
  const refusalText = startRefusal
    ? codedErrorMessage(tWorkflows, { code: startRefusal.code }, t("session.refused", { error: startRefusal.error }))
    : refusal
      ? t("session.refused", { error: refusal.error })
      : "";
  const startedTrigger = simulation.startedTrigger;
  const startedSpec = startedTrigger ? simulation.triggers.find((spec) => spec.nodeId === startedTrigger.nodeId) : undefined;
  const startedTriggerLabel =
    startedTrigger && simulation.triggers.length > 1
      ? startedSpec
        ? triggerDisplayLabel(startedSpec, nodeLabel(startedTrigger.nodeId))
        : (nodeLabel(startedTrigger.nodeId) ?? startedTrigger.nodeId)
      : null;

  const beginTest = () => {
    const built = triggerStart.build();
    if (!built) {
      start();
      return;
    }
    if (!built.ok) return;
    setSentTriggerId(built.start.triggerNodeId);
    start({ trigger: built.start });
  };

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

  const renderStep = (step: SimStep, lone = false) => {
    const exists = nodeExists(step.nodeId);
    const pinnable = Boolean(onPinStep) && exists && !step.pinned && isPinnableBehavior(behaviorOf(step.nodeType)) && isPinnableStep(step);
    const refused = isRealCallRefusal(step);
    return (
      <Fragment key={`${step.stepIndex}:${step.id}`}>
        <SimStepLine
          step={step}
          label={nodeLabel(step.nodeId)}
          expanded={expandedStep === step.id}
          lone={lone}
          onToggle={() => {
            setExpandedStep((current) => (current === step.id ? null : step.id));
            if (exists) onFocusNode?.(step.nodeId);
          }}
        >
          <StepDetail
            step={step}
            nodeName={nodeLabel(step.nodeId)}
            messageSenders={messageSenders}
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
        </SimStepLine>
        <StepEffects step={step} />
      </Fragment>
    );
  };

  return (
    <aside aria-label="Simulação" className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-card">
      <header className={cn(CHAT_HEADER, "flex-shrink-0")}>
        <span aria-hidden className="tile-neutral ml-1 flex h-7 w-7 shrink-0 items-center justify-center">
          <Robot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 pl-1">
          <h2 className={CHAT_HEADER_TITLE}>Simulação</h2>
        </div>
        <StatusBadge status={status} />
        <button type="button" onClick={onClose} aria-label="Fechar simulação" title="Fechar simulação" className={CHAT_ICON_BUTTON}>
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="max-h-[25%] shrink-0 overflow-y-auto space-y-2 px-3 empty:hidden [&:not(:empty)]:py-2">
        {unsaved && <Notice tone="info">{t("session.unsaved")}</Notice>}
        {reproducing && (
          <ReproducingBanner reproducing={reproducing} nodeLabel={nodeLabel} versionDiffers={versionDiffers} onViewVersion={onViewVersion} />
        )}
        {refusal && (
          <Notice tone="fault">
            <span className="block">{refusalText}</span>
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

      <div className="relative min-h-32 flex-1">
        <div ref={scrollRef} onScroll={onScroll} className={CHAT_CANVAS}>
          <div className={CHAT_CANVAS_BODY}>
            {status === "waiting_trigger" && !hasHistory && <p className={CHAT_EMPTY}>Envie uma mensagem para iniciar o workflow.</p>}

            {showStartScreen ? (
              <div className="pt-2">
                <TriggerStartScreen
                  state={triggerStart}
                  unreadable={simulation.unreadableTriggers}
                  issues={startIssues}
                  workflowId={workflowId}
                  scenariosOf={scenariosOf}
                  onScenariosChange={onScenariosChange}
                  nodeLabel={nodeLabel}
                  onFocusNode={onFocusNode}
                />
              </div>
            ) : (
              !hasHistory && (status === "idle" || status === "ready") && <p className={CHAT_EMPTY}>Clique em Iniciar para simular o workflow.</p>
            )}

            {startedTriggerLabel && hasHistory && (
              <div className={CHAT_SYSTEM_ROW}>
                <div className={CHAT_SYSTEM_LINE}>{tTrigger("startedBy", { trigger: startedTriggerLabel })}</div>
              </div>
            )}

            {windowStart > 0 && (
              <div className="flex justify-center py-1">
                <button type="button" onClick={() => setWindowSize((current) => current + SIM_EVENT_WINDOW)} className={CHAT_LOAD_OLDER}>
                  {t("chat.showEarlier", { count: Math.min(windowStart, SIM_EVENT_WINDOW) })}
                </button>
              </div>
            )}

            <SimThreadProvider messages={messages} onChooseOption={status === "waiting_reply" ? chooseOption : undefined} senderLabel={senderLabel}>
              <ol>
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
                        <SimMessageRow message={evt.message} position={stacks.get(item.key)} />
                      </li>
                    );
                  }
                  return <EventItem key={item.key} event={evt} nodeLabel={nodeLabel} />;
                })}
              </ol>
            </SimThreadProvider>

            {status === "connecting" && (
              <p className="flex items-center gap-1.5 px-1 py-2 text-2xs text-muted-foreground">
                <CircleNotch size={12} className="animate-spin motion-reduce:animate-none" />
                Conectando...
              </p>
            )}

            {currentNodeId && status === "running" && (
              <p className="flex items-center gap-1.5 px-1 py-2 text-2xs text-muted-foreground">
                <CircleNotch size={12} className="animate-spin motion-reduce:animate-none" />
                Executando nó: {nodeLabel(currentNodeId) ?? currentNodeId}
              </p>
            )}
          </div>
        </div>
        {showScrollDown ? <ChatScrollDownButton label={tThread("scrollToLatest")} onClick={scrollToBottom} /> : null}
      </div>

      {pause && status === "paused" && (
        <PauseToolbar pause={pause} pausedLabel={pausedLabel} onStep={simulation.step} onResume={simulation.resume} onStop={cancel} />
      )}

      {(stateCount > 0 || pause) && (
        <div className="shrink-0 border-t border-border">
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
              <JsonBlock value={stateVars} className="max-h-[min(24vh,12rem)] whitespace-pre-wrap break-words" />
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

      <div className={cn("flex items-center gap-2 px-3 py-2.5 border-t border-border flex-shrink-0", status === "paused" && "hidden")}>
        {showStartScreen ? (
          <ElevatedButton
            variant="primary"
            size="sm"
            title={tTrigger("start")}
            icon={<Play size={14} weight="fill" />}
            iconVisible
            onClick={beginTest}
            className="flex-1"
          />
        ) : status === "ready" || !isActive ? (
          <>
            <ElevatedButton
              variant="primary"
              size="sm"
              title={hasHistory ? "Reiniciar" : "Iniciar"}
              icon={hasHistory ? <ArrowsClockwise size={14} /> : <Play size={14} weight="fill" />}
              iconVisible
              onClick={() => start()}
              className="flex-1"
            />
            {hasHistory && simulation.triggers.length > 0 && (
              <ElevatedButton variant="ghost" size="sm" title={tTrigger("changeInput")} onClick={simulation.connect} />
            )}
          </>
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
