"use client";

import {
  ArrowRight,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  Copy,
  Info,
  Play,
  Spinner,
  XCircle,
} from "@/components/icons";
import type {
  MockFieldSpec,
  TestMode,
  TestNodeResult,
} from "@/lib/workflows/types";
import { useCallback, useEffect, useMemo, useState } from "react";

import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { cn } from "@/lib/utils";
import { useTestNode } from "@/hooks/use-test-node";


interface TestNodeSectionProps {
  workflowId: string;
  nodeId: string;
  disabled?: boolean;
  disabledReason?: string;
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
    default:
      return source;
  }
}

function getMockTemplate(field: MockFieldSpec): string {
  return `{{${field.display_name}}}`;
}

function isMissingMockValue(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}


function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
      title="Copiar"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}


function OutputEntry({
  label,
  value,
  mono,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-border last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] text-muted-foreground shrink-0">
          {label}
        </span>
        {badge && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
              badgeColor ?? "bg-muted text-muted-foreground",
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 min-w-0">
        <span
          className={cn(
            "text-[11px] text-foreground truncate max-w-[200px]",
            mono && "font-mono",
          )}
          title={value}
        >
          {value}
        </span>
        {value.length > 30 && <CopyButton text={value} />}
      </div>
    </div>
  );
}


function TestResultDisplay({ result }: { result: TestNodeResult }) {
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [showRawConfig, setShowRawConfig] = useState(false);
  const [showStateAfter, setShowStateAfter] = useState(false);

  const outputEntries = useMemo(() => {
    if (!result.execution_output) return [];
    return Object.entries(result.execution_output).filter(
      ([key]) => !["json", "body"].includes(key),
    );
  }, [result.execution_output]);

  const httpStatusCode = result.execution_output?.status_code as
    | number
    | undefined;
  const httpSuccess = result.execution_output?.success as boolean | undefined;
  const responseBody = result.execution_output?.body as string | undefined;
  const nextEdge = result.execution_output?.next_edge as string | undefined;
  const stateEntries = result.state_after
    ? Object.entries(result.state_after).filter(
        ([key]) => !key.startsWith("_prev_node"),
      )
    : [];

  return (
    <div
      className={cn(
        "rounded-[--radius] border overflow-hidden",
        result.success
          ? "border-emerald-200 bg-healthy/10/50"
          : "border-red-200 bg-destructive/10/50",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2",
          result.success
            ? "bg-healthy/10/60 border-b border-emerald-200"
            : "bg-destructive/10/60 border-b border-red-200",
        )}
      >
        <div className="flex items-center gap-2">
          {result.success ? (
            <CheckCircle size={16} weight="fill" className="text-healthy" />
          ) : (
            <XCircle size={16} weight="fill" className="text-destructive" />
          )}
          <span
            className={cn(
              "text-xs font-semibold",
              result.success ? "text-emerald-900" : "text-red-900",
            )}
          >
            {result.success ? "Teste bem-sucedido" : "Teste falhou"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock size={11} />
          <span>{result.execution_duration_ms}ms</span>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        {/* Error message */}
        {result.error && (
          <div className="rounded-lg bg-destructive/10/80 border border-red-200 px-2.5 py-2 text-xs text-red-800">
            {result.error}
          </div>
        )}

        {/* HTTP status (for HTTP nodes) */}
        {httpStatusCode != null && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              HTTP
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                httpSuccess
                  ? "bg-emerald-200/60 text-emerald-800"
                  : "bg-red-200/60 text-red-800",
              )}
            >
              {httpStatusCode}
            </span>
            {nextEdge && (
              <>
                <ArrowRight size={10} className="text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground">
                  {nextEdge}
                </span>
              </>
            )}
          </div>
        )}

        {/* Key output entries */}
        {outputEntries.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Saída do nó
            </p>
            {outputEntries.map(([key, val]) => (
              <OutputEntry
                key={key}
                label={key}
                value={
                  typeof val === "object" ? JSON.stringify(val) : String(val)
                }
                mono
              />
            ))}
          </div>
        )}

        {/* Response body (for HTTP nodes) */}
        {responseBody && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setShowRawOutput(!showRawOutput)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showRawOutput ? (
                <CaretDown size={10} />
              ) : (
                <CaretRight size={10} />
              )}
              <span>Corpo da resposta</span>
              <CopyButton text={responseBody} />
            </button>
            {showRawOutput && (
              <pre className="text-[10px] bg-background rounded-lg border border-border p-2.5 overflow-x-auto max-h-48 overflow-y-auto font-mono text-foreground/80">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(responseBody), null, 2);
                  } catch {
                    return responseBody;
                  }
                })()}
              </pre>
            )}
          </div>
        )}

        {/* Interpolated config */}
        {result.interpolated_config && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setShowRawConfig(!showRawConfig)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showRawConfig ? (
                <CaretDown size={10} />
              ) : (
                <CaretRight size={10} />
              )}
              <span>Config interpolado</span>
            </button>
            {showRawConfig && (
              <pre className="text-[10px] bg-background rounded-lg border border-border p-2.5 overflow-x-auto max-h-48 overflow-y-auto font-mono text-foreground/80">
                {JSON.stringify(result.interpolated_config, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* State after execution */}
        {stateEntries.length > 0 && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setShowStateAfter(!showStateAfter)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {showStateAfter ? (
                <CaretDown size={10} />
              ) : (
                <CaretRight size={10} />
              )}
              <span>Estado após execução</span>
              <span className="text-[9px] bg-muted rounded-[--radius] px-1.5 py-0.5">
                {stateEntries.length}
              </span>
            </button>
            {showStateAfter && (
              <div className="rounded-lg border border-border bg-background p-2">
                {stateEntries.map(([key, val]) => (
                  <OutputEntry
                    key={key}
                    label={key}
                    value={
                      typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val)
                    }
                    mono
                  />
                ))}
              </div>
            )}
          </div>
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
}: TestNodeSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    status,
    analysis,
    result,
    error,
    mockedState,
    triggerVars,
    analyze,
    test,
    setMockedValue,
    setTriggerVar,
    reset,
  } = useTestNode();

  const missingMockFields =
    analysis?.mock_fields.filter((field) =>
      isMissingMockValue(mockedState[field.key]),
    ) ?? [];
  const hasMissingRequiredMocks = missingMockFields.length > 0;
  const missingMocksMessage = hasMissingRequiredMocks
    ? `Preencha os valores simulados obrigatórios: ${missingMockFields
        .map((field) => field.display_name)
        .join(", ")}.`
    : null;

  useEffect(() => {
    reset();
    setExpanded(false);
  }, [workflowId, nodeId, reset]);

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
    await test(workflowId, nodeId, false);
  }, [disabled, hasMissingRequiredMocks, nodeId, status, test, workflowId]);

  const handleReset = useCallback(() => {
    reset();
    setExpanded(false);
  }, [reset]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
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
          <Play size={15} weight="duotone" className="text-lamp-ink" />
          <span className="text-xs font-medium">Testar Nó</span>
        </div>
        {status === "analyzing" && (
          <Spinner size={14} className="animate-spin text-muted-foreground" />
        )}
        {status === "success" && (
          <CheckCircle size={14} weight="fill" className="text-healthy" />
        )}
        {status === "error" && (
          <XCircle size={14} weight="fill" className="text-red-500" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-3 space-y-3">
          {disabled && disabledReason && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {disabledReason}
            </div>
          )}

          {/* Loading state */}
          {status === "analyzing" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner size={14} className="animate-spin" />
              <span>Analisando dependências do nó...</span>
            </div>
          )}

          {/* Analysis result */}
          {analysis && (
            <>
              {/* Mode badge */}
              <div
                className={cn(
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                  analysis.test_mode === "direct" &&
                    "bg-healthy/10 border border-emerald-200 text-emerald-900",
                  analysis.test_mode === "mock" &&
                    "bg-amber-50 border border-amber-200 text-amber-900",
                  analysis.test_mode === "execute_until" &&
                    analysis.has_ai_deps &&
                    "bg-muted border border-blue-200 text-blue-900",
                  analysis.test_mode === "execute_until" &&
                    !analysis.has_ai_deps &&
                    "bg-healthy/10 border border-emerald-200 text-emerald-900",
                )}
              >
                <Info size={14} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">
                    {getModeLabel(analysis.test_mode, analysis.has_ai_deps)}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {analysis.message ||
                      getModeDescription(
                        analysis.test_mode,
                        analysis.has_ai_deps,
                      )}
                  </p>
                </div>
              </div>

              {/* Mock fields */}
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
                          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            Variavel esperada
                          </p>
                          <div className="mt-1 rounded-lg border border-border bg-background px-2.5 py-2 font-mono text-[11px] text-muted-foreground break-all">
                            {getMockTemplate(field)}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-[--radius] bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                          {getSourceLabel(field.source)}
                        </span>
                      </div>
                      <ElevatedInput
                        value={(mockedState[field.key] as string) ?? ""}
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

              {/* Trigger variables (optional) */}
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

              {/* Test button */}
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
                <p className="text-[11px] text-warning">
                  {missingMocksMessage}
                </p>
              )}
            </>
          )}

          {/* Test result */}
          {result && <TestResultDisplay result={result} />}

          {/* Error display */}
          {status === "error" && error && !result && (
            <div className="rounded-lg border border-red-200 bg-destructive/10 p-3">
              <div className="flex items-center gap-2">
                <XCircle size={16} weight="fill" className="text-destructive" />
                <span className="text-sm font-medium text-red-900">Erro</span>
              </div>
              <p className="text-xs text-destructive mt-1">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
