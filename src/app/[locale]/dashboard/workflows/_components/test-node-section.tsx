"use client";

import {
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  Play,
  Spinner,
  XCircle,
} from "@/components/icons";
import type {
  MockFieldSpec,
  TestMode,
  TestNodeResult,
  WorkflowRunLog,
} from "@/lib/workflows/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { Notice } from "@/components/ui/notice";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { cn } from "@/lib/utils";
import { useTestNode } from "@/hooks/use-test-node";
import { nodeTestSteps } from "@/lib/workflows/node-test-steps";
import {
  emptyTriggerDraft,
  hasTriggerInput,
  readTriggerInputSpec,
  triggerStartOf,
  type TriggerInputDraft,
  type TriggerInputSpec,
} from "@/lib/workflows/trigger-input";

import { DurationText, JsonBlock, useLoadFailureText } from "./run-bits";
import { StepDetail, StepRow } from "./step-detail";
import { TriggerInputEditor } from "./trigger-input-editor";


export interface TestNodeSeed {
  id: string;
  valueFor: (key: string) => unknown;
}

interface TestNodeSectionProps {
  workflowId: string;
  nodeId: string;
  disabled?: boolean;
  disabledReason?: string;
  seed?: TestNodeSeed | null;
  onShowPath?: (steps: WorkflowRunLog[]) => void;
}


function getModeLabel(mode: TestMode, hasAIDeps?: boolean): string {
  switch (mode) {
    case "direct":
      return "Teste Direto";
    case "mock":
      return "Teste com Mocks";
    case "execute_until":
      return hasAIDeps ? "Dependência de IA" : "Execução Automática";
  }
}

function getModeDescription(mode: TestMode, hasAIDeps?: boolean): string {
  switch (mode) {
    case "direct":
      return "Este nó não depende de dados de nós anteriores. Pode ser testado diretamente.";
    case "mock":
      return "Este nó requer dados de nós anteriores. Preencha os valores simulados para testar.";
    case "execute_until":
      return hasAIDeps
        ? "Este nó depende de saídas de IA. Preencha os valores simulados para testar sem executar a IA."
        : "Este nó depende de nós anteriores. Os nós upstream serão executados automaticamente.";
  }
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "previous_node":
      return "Nó anterior";
    case "specific_node":
      return "Nó específico";
    case "trigger":
      return "Gatilho";
    case "ai":
      return "Resposta IA";
    case "custom":
      return "Captura customizada";
    case "caller":
      return "Quem ligou";
    default:
      return source;
  }
}

type AnalysisTrigger = { kind: "none" } | { kind: "unreadable" } | { kind: "spec"; spec: TriggerInputSpec };

function analysisTriggerOf(value: unknown): AnalysisTrigger {
  if (value === undefined || value === null) return { kind: "none" };
  const spec = readTriggerInputSpec(value);
  return spec ? { kind: "spec", spec } : { kind: "unreadable" };
}

const NO_SYNTAX: readonly string[] = [];

function getMockTemplate(field: MockFieldSpec): string {
  return `{{${field.display_name}}}`;
}

function isMissingMockValue(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function mockValueText(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}


function NodeTestResult({
  result,
  onShowPath,
}: {
  result: TestNodeResult;
  onShowPath?: (steps: WorkflowRunLog[]) => void;
}) {
  const t = useTranslations("workflowDebug");
  const { target, upstream } = useMemo(() => nodeTestSteps(result), [result]);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const stateEntries = result.state_after
    ? Object.fromEntries(Object.entries(result.state_after).filter(([key]) => !key.startsWith("_prev_node")))
    : {};
  const path = useMemo(() => [...upstream, target], [upstream, target]);

  useEffect(() => {
    if (upstream.length > 0) onShowPath?.(path);
  }, [path, upstream.length, onShowPath]);

  return (
    <div className="rounded-[--radius] border border-border overflow-hidden" data-testid="node-test-result">
      <div className="flex items-center justify-between px-3 py-2 bg-muted border-b border-border">
        <div className="flex items-center gap-2">
          {result.success ? (
            <CheckCircle size={16} weight="fill" className="text-healthy-ink" />
          ) : (
            <XCircle size={16} weight="fill" className="text-destructive-ink" />
          )}
          <span className="text-xs font-semibold text-foreground">
            {result.success ? "Teste bem-sucedido" : "Teste falhou"}
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <Clock size={11} />
          <DurationText ms={target.durationMs} />
        </span>
      </div>

      <div className="p-2 space-y-2.5">
        {target.pinned && <p className="px-1 text-2xs text-muted-foreground">{t("step.pinnedHint")}</p>}
        <StepDetail step={target} />

        {upstream.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-2xs font-semibold text-foreground">{t("nodeTest.upstream")}</p>
              {onShowPath && (
                <ElevatedButton variant="ghost" size="sm" title={t("nodeTest.showPath")} onClick={() => onShowPath(path)} />
              )}
            </div>
            <ol className="space-y-1">
              {upstream.map((step) => (
                <StepRow
                  key={step.id}
                  step={step}
                  label={step.nodeId}
                  expanded={expandedStep === step.id}
                  onToggle={() => setExpandedStep((current) => (current === step.id ? null : step.id))}
                >
                  <StepDetail step={step} />
                </StepRow>
              ))}
            </ol>
          </div>
        )}

        {Object.keys(stateEntries).length > 0 && (
          <details className="px-1">
            <summary className="cursor-pointer text-2xs text-muted-foreground hover:text-foreground">
              Estado após execução ({Object.keys(stateEntries).length})
            </summary>
            <JsonBlock value={stateEntries} className="mt-1" />
          </details>
        )}
      </div>
    </div>
  );
}


export function TestNodeSection({
  workflowId,
  nodeId,
  disabled = false,
  disabledReason,
  seed = null,
  onShowPath,
}: TestNodeSectionProps) {
  const tDebug = useTranslations("workflowDebug.nodeTest");
  const tWorkflows = useTranslations("workflowsPage");
  const tTrigger = useTranslations("workflowDebug.triggerInput");
  const failureText = useLoadFailureText();
  const [expanded, setExpanded] = useState(false);
  const [confirmRealCalls, setConfirmRealCalls] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    status,
    analysis,
    result,
    error,
    errorStatus,
    errorCode,
    errorIssues,
    mockedState,
    triggerVars,
    analyze,
    test,
    setMockedValue,
    setTriggerVar,
    reset,
  } = useTestNode();

  const missingMockFields =
    analysis?.mock_fields.filter(
      (field) => !field.optional && isMissingMockValue(mockedState[field.key]),
    ) ?? [];
  const hasMissingRequiredMocks = missingMockFields.length > 0;
  const missingMocksMessage = hasMissingRequiredMocks
    ? `Preencha os valores simulados obrigatórios: ${missingMockFields
        .map((field) => field.display_name)
        .join(", ")}.`
    : null;

  const analysisTrigger = useMemo(() => analysisTriggerOf(analysis?.trigger), [analysis]);
  const triggerSpec = analysisTrigger.kind === "spec" && hasTriggerInput(analysisTrigger.spec) ? analysisTrigger.spec : null;
  const [triggerDraft, setTriggerDraft] = useState<TriggerInputDraft | null>(null);
  const [triggerSyntax, setTriggerSyntax] = useState<readonly string[]>(NO_SYNTAX);
  const [draftAnalysis, setDraftAnalysis] = useState(analysis);
  if (draftAnalysis !== analysis) {
    setDraftAnalysis(analysis);
    setTriggerDraft(null);
    setTriggerSyntax(NO_SYNTAX);
  }
  const shownTriggerDraft = triggerSpec ? (triggerDraft ?? emptyTriggerDraft(triggerSpec)) : null;
  const changeTriggerDraft = useCallback((next: TriggerInputDraft) => {
    setTriggerDraft(next);
    setTriggerSyntax(NO_SYNTAX);
  }, []);

  const testedNode = `${workflowId}:${nodeId}`;
  const [shownNode, setShownNode] = useState(testedNode);
  if (shownNode !== testedNode) {
    setShownNode(testedNode);
    setExpanded(false);
  }

  useEffect(() => {
    reset();
  }, [workflowId, nodeId, reset]);

  useEffect(() => {
    if (!seed) return;
    let current = true;
    void analyze(workflowId, nodeId, seed.valueFor).then(() => {
      if (!current) return;
      setExpanded(true);
      requestAnimationFrame(() => rootRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }));
    });
    return () => {
      current = false;
    };
  }, [seed, analyze, workflowId, nodeId]);

  const handleExpand = useCallback(async () => {
    if (!expanded) {
      setExpanded(true);
      if (status === "idle") {
        await analyze(workflowId, nodeId);
      }
    } else {
      setExpanded(false);
    }
  }, [expanded, status, analyze, workflowId, nodeId]);

  const handleTest = useCallback(async () => {
    if (disabled || status === "testing" || hasMissingRequiredMocks) {
      return;
    }
    if (!triggerSpec || !shownTriggerDraft) {
      await test(workflowId, nodeId, false, confirmRealCalls);
      return;
    }
    const built = triggerStartOf(triggerSpec, shownTriggerDraft);
    if (!built.ok) {
      setTriggerSyntax(built.syntax);
      return;
    }
    await test(workflowId, nodeId, false, confirmRealCalls, { nodeId: triggerSpec.nodeId, input: built.start.input ?? {} });
  }, [disabled, hasMissingRequiredMocks, nodeId, status, test, workflowId, confirmRealCalls, triggerSpec, shownTriggerDraft]);

  const handleReset = useCallback(() => {
    reset();
    setExpanded(false);
  }, [reset]);

  return (
    <div ref={rootRef} className="border border-border rounded-lg overflow-hidden">
      {}
      <button
        type="button"
        onClick={handleExpand}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 transition-colors",
          "hover:bg-muted",
          expanded && "border-b border-border bg-muted",
        )}
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <CaretDown size={14} className="text-muted-foreground" />
          ) : (
            <CaretRight size={14} className="text-muted-foreground" />
          )}
          <Play size={15} weight="duotone" className="text-primary-ink" />
          <span className="text-xs font-medium">Testar Nó</span>
        </div>
        {status === "analyzing" && (
          <Spinner size={14} className="animate-spin text-muted-foreground" />
        )}
        {status === "success" && (
          <CheckCircle size={14} weight="fill" className="text-healthy-ink" />
        )}
        {status === "error" && (
          <XCircle size={14} weight="fill" className="text-destructive-ink" />
        )}
      </button>

      {}
      {expanded && (
        <div className="p-3 space-y-3">
          {disabled && disabledReason && (
            <Notice tone="warning">{disabledReason}</Notice>
          )}

          {}
          {status === "analyzing" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner size={14} className="animate-spin" />
              <span>Analisando dependências do nó...</span>
            </div>
          )}

          {}
          {analysis && (
            <>
              {}
              <Notice
                tone={
                  analysis.test_mode === "mock"
                    ? "warning"
                    : analysis.test_mode === "execute_until" &&
                        analysis.has_ai_deps
                      ? "info"
                      : "healthy"
                }
                title={getModeLabel(analysis.test_mode, analysis.has_ai_deps)}
              >
                {analysis.message ||
                  getModeDescription(analysis.test_mode, analysis.has_ai_deps)}
              </Notice>

              {}
              {analysis.mock_fields.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Valores Simulados
                  </p>
                  {analysis.mock_fields.map((field: MockFieldSpec) => (
                    <div
                      key={field.key}
                      className="space-y-2 rounded-[--radius] border border-border bg-muted p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground break-all">
                            {field.display_name}
                          </p>
                          <p className="mt-1 text-2xs tracking-[0.18em] text-muted-foreground">
                            Variavel esperada
                          </p>
                          <div className="mt-1 rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-2xs text-muted-foreground break-all">
                            {getMockTemplate(field)}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-[--radius] bg-muted px-2 py-1 text-2xs font-medium text-muted-foreground">
                          {getSourceLabel(field.source)}
                        </span>
                      </div>
                      <ElevatedInput
                        value={mockValueText(mockedState[field.key])}
                        onChange={(e) =>
                          setMockedValue(field.key, e.target.value)
                        }
                        label="Valor simulado"
                        placeholder={`Digite o valor para ${field.display_name}`}
                        controlSize="sm"
                      />
                    </div>
                  ))}
                </div>
              )}

              {triggerSpec && shownTriggerDraft && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{tTrigger("nodeTest", { trigger: triggerSpec.label })}</p>
                  <TriggerInputEditor
                    spec={triggerSpec}
                    draft={shownTriggerDraft}
                    onDraftChange={changeTriggerDraft}
                    issues={errorIssues}
                    syntax={triggerSyntax}
                  />
                </div>
              )}
              {analysisTrigger.kind === "unreadable" && (
                <p className="text-2xs text-muted-foreground">{tTrigger("unreadable", { count: 1 })}</p>
              )}

              {analysis.can_run_direct && (
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Variáveis de gatilho (opcional)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <ElevatedInput
                      label="message"
                      value={(triggerVars.message as string) ?? ""}
                      onChange={(e) => setTriggerVar("message", e.target.value)}
                      placeholder="Mensagem do gatilho"
                      controlSize="sm"
                    />
                  </div>
                </details>
              )}

              <label className="flex items-start gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={confirmRealCalls}
                  onChange={(event) => setConfirmRealCalls(event.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-control-edge accent-primary"
                />
                <span className="space-y-0.5">
                  <span className="block font-medium">{tDebug("confirmRealCalls")}</span>
                  <span className="block text-2xs leading-relaxed text-muted-foreground">{tDebug("confirmRealCallsHint")}</span>
                </span>
              </label>

              {}
              <div className="flex items-center gap-2">
                <ElevatedButton
                  variant="primary"
                  size="sm"
                  onClick={handleTest}
                  disabled={
                    disabled || status === "testing" || hasMissingRequiredMocks
                  }
                  className="flex-1"
                  title={
                    status === "testing" ? "Testando..." : "Executar Teste"
                  }
                  icon={
                    status === "testing" ? (
                      <Spinner size={14} className="animate-spin" />
                    ) : (
                      <Play size={14} weight="fill" />
                    )
                  }
                  iconVisible
                ></ElevatedButton>
                {(result || error) && (
                  <ElevatedButton
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    title="Limpar"
                  />
                )}
              </div>

              {missingMocksMessage && (
                <p className="text-2xs text-warning-ink">
                  {missingMocksMessage}
                </p>
              )}
            </>
          )}

          {}
          {result && <NodeTestResult result={result} onShowPath={onShowPath} />}

          {}
          {status === "error" && error && !result && (
            <Notice tone="fault" title="Erro">
              {failureText(
                errorStatus,
                codedErrorMessage(tWorkflows, { code: errorCode ?? undefined }, error),
              )}
            </Notice>
          )}
        </div>
      )}
    </div>
  );
}
