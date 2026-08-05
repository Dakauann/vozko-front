"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Sparkle,
  X,
  PaperPlaneRight,
  Stop,
  CircleNotch,
  Warning,
  CheckCircle,
  Lightbulb,
  ClockCounterClockwise,
  CaretDown,
  CaretUp,
  NotePencil,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import type { WorkflowGraph, WorkflowType } from "@/lib/workflows/types";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { useWorkflowAIBuilder } from "@/hooks/use-workflow-ai-builder";
import { getAgentOptionsAction } from "@/app/actions/agents";
import { CopilotMessage, CopilotThinking } from "./workflow-copilot-message";
import { WorkflowCopilotHistory } from "./workflow-copilot-history";

const MODEL_STORAGE_KEY = "wf-copilot:model";
const WIDTH_STORAGE_KEY = "wf-copilot:width";
const MIN_WIDTH = 320;
const MAX_WIDTH = 760;
const DEFAULT_WIDTH = 384;

interface WorkflowCopilotPanelProps {
  workflowId: string;
  workflowType: WorkflowType;
  onGraph: (graph: WorkflowGraph) => void;
  onMeta?: (meta: { name?: string; description?: string; workflowType?: WorkflowType }) => void;
  /** Snapshot of the canvas graph, used to re-hydrate the session on reconnect. */
  getGraph?: () => WorkflowGraph | null | undefined;
  onClose: () => void;
  /** When false the panel stays mounted (session + chat alive) but hidden. */
  visible?: boolean;
}

export function WorkflowCopilotPanel({
  workflowId,
  workflowType,
  onGraph,
  onMeta,
  getGraph,
  onClose,
  visible = true,
}: WorkflowCopilotPanelProps) {
  const [models, setModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[]>([]);
  const [model, setModel] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(MODEL_STORAGE_KEY) ?? "";
  });

  useEffect(() => {
    let cancelled = false;
    void getAgentOptionsAction().then((res) => {
      if (cancelled || !res.options) return;
      const list = res.options.messaging ?? [];
      setModels(list);
      setModelPricing(res.options.modelPricing ?? []);
      setModel(
        (cur) => cur || res.options!.defaults?.messagingModel || list[0] || "",
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onModelChange = (m: string) => {
    setModel(m);
    if (typeof window !== "undefined") localStorage.setItem(MODEL_STORAGE_KEY, m);
  };

  const builder = useWorkflowAIBuilder({ workflowId, workflowType, model, onGraph, onMeta, getGraph });
  const {
    status,
    chat,
    issues,
    valid,
    iteration,
    maxIterations,
    tokensUsed,
    tokenBudget,
    sendPrompt,
    cancel,
    newSession,
    connection,
    reconnectNow,
  } = builder;

  const [text, setText] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [advisoryOpen, setAdvisoryOpen] = useState(false);
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const v = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
    return v >= MIN_WIDTH && v <= MAX_WIDTH ? v : DEFAULT_WIDTH;
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whether to keep the view pinned to the bottom. True while the user sits at (or
  // near) the bottom; flips to false the moment they scroll up, so we never yank
  // them back down while they read, and re-arms when they return to the bottom.
  const stickToBottomRef = useRef(true);

  const handleChatScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  // Pin to bottom BEFORE paint (no flicker) and only when the user is following
  // along, fixes both the streaming flicker and the "won't stay at the bottom".
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [chat, issues]);

  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const right = panel.getBoundingClientRect().right;
    let lastWidth = width;
    const onMove = (ev: globalThis.MouseEvent) => {
      lastWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, right - ev.clientX));
      setWidth(lastWidth);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(lastWidth));
      } catch {
        /* storage unavailable, keep the in-memory width */
      }
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const isBusy = status === "building" || status === "connecting";

  // Tick a seconds counter while the agent works, so a long thinking turn never
  // looks frozen (the model can think silently for tens of seconds).
  useEffect(() => {
    if (!isBusy) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isBusy]);

  const handleSend = () => {
    if (!text.trim() || isBusy) return;
    setElapsed(0);
    sendPrompt(text);
    setText("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const blocking = issues.filter((i) => i.severity === "blocking");
  const advisory = issues.filter((i) => i.severity === "advisory");

  // Most recent tool the agent ran (for the live "Executando: …" indicator).
  const lastTool = (() => {
    for (let i = chat.length - 1; i >= 0; i--) {
      if (chat[i].role === "tool") return chat[i].text.split(":")[0];
    }
    return "";
  })();

  return (
    <div
      ref={panelRef}
      style={{ width }}
      className={cn(
        "relative border-l border-border bg-card flex flex-col h-full flex-shrink-0",
        !visible && "hidden",
      )}
    >
      {/* Resize handle, drag the left edge to widen/narrow the panel. */}
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 z-20 h-full w-1.5 -translate-x-1/2 cursor-col-resize hover:bg-primary/40"
        title="Arraste para redimensionar"
      />
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkle size={16} weight="fill" className="text-primary-ink" />
          {showHistory ? "Conversas" : "Copiloto de Fluxos"}
          {!showHistory && (
            <button
              type="button"
              onClick={connection === "online" ? undefined : reconnectNow}
              title={
                connection === "online"
                  ? "Conectado"
                  : connection === "reconnecting"
                    ? "Reconectando… (clique para tentar agora)"
                    : connection === "offline"
                      ? "Desconectado (clique para reconectar)"
                      : "Conectando…"
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1 text-[11px] font-medium",
                connection === "online"
                  ? "cursor-default text-muted-foreground"
                  : connection === "offline"
                    ? "text-destructive dark:text-destructive"
                    : "text-warning dark:text-warning",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  connection === "online"
                    ? "bg-healthy"
                    : connection === "offline"
                      ? "bg-destructive"
                      : "animate-pulse bg-warning",
                )}
              />
              {connection !== "online" &&
                (connection === "reconnecting"
                  ? "Reconectando…"
                  : connection === "offline"
                    ? "Offline"
                    : "Conectando…")}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!showHistory && (
            <button
              onClick={() => {
                if (!isBusy) newSession();
              }}
              disabled={isBusy}
              className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Nova conversa"
              title="Nova conversa"
            >
              <NotePencil size={16} />
            </button>
          )}
          {workflowId && (
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={cn(
                "hover:text-foreground",
                showHistory ? "text-primary-ink" : "text-muted-foreground",
              )}
              aria-label={showHistory ? "Voltar ao copiloto" : "Histórico de conversas"}
              title={showHistory ? "Voltar ao copiloto" : "Histórico de conversas"}
            >
              <ClockCounterClockwise size={16} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {showHistory ? (
        <WorkflowCopilotHistory workflowId={workflowId} />
      ) : (
        <>
      {/* live copilot below */}

      {/* Model picker (searchable / paginated) */}
      {models.length > 0 && (
        <div className="px-3 py-2 border-b border-border">
          <AIModelSelector
            label="Modelo de IA"
            value={model}
            onValueChange={onModelChange}
            models={models}
            modelPricing={modelPricing}
            disabled={isBusy}
          />
        </div>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border text-muted-foreground">
        {status === "building" && (
          <CircleNotch size={13} className="animate-spin" />
        )}
        {status === "done" &&
          (valid ? (
            <CheckCircle size={13} weight="fill" className="text-healthy" />
          ) : (
            <Warning size={13} weight="fill" className="text-warning" />
          ))}
        <span>
          {status === "connecting" && "Conectando…"}
          {status === "ready" && "Pronto, descreva o fluxo que deseja."}
          {status === "building" &&
            `Construindo… iteração ${iteration}/${maxIterations}`}
          {status === "done" && (valid ? "Workflow válido." : "Não finalizado.")}
          {status === "error" && "Erro de conexão."}
          {status === "idle" && "…"}
        </span>
        {tokenBudget > 0 && (
          <span className="ml-auto tabular-nums">
            {Math.round((tokensUsed / 1000) * 10) / 10}k/
            {Math.round(tokenBudget / 1000)}k tok
          </span>
        )}
      </div>

      {/* Chat + issues log */}
      <div
        ref={scrollRef}
        onScroll={handleChatScroll}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
      >
        {chat.length === 0 && status !== "building" && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground text-xs">
            <Sparkle size={28} weight="duotone" className="opacity-50" />
            <p>
              Peça em linguagem natural: &quot;crie um fluxo que responde a
              primeira mensagem com a IA e transfere para vendas&quot;.
            </p>
          </div>
        )}
        {chat.map((m, i) =>
          m.role === "thinking" ? (
            <CopilotThinking key={i} text={m.text} streaming={m.streaming} />
          ) : (
            <CopilotMessage
              key={i}
              role={m.role}
              text={m.text}
              ok={m.ok}
              streaming={m.streaming}
            />
          ),
        )}

        {blocking.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 space-y-1">
            <div className="flex items-center gap-1 text-xs font-medium text-destructive dark:text-destructive">
              <Warning size={13} weight="fill" /> {blocking.length} problema(s)
              bloqueante(s)
            </div>
            {blocking.map((iss, i) => (
              <div key={i} className="text-[11px] text-muted-foreground">
                • {iss.message}
                {iss.nodeId ? ` (${iss.nodeId})` : ""}
              </div>
            ))}
          </div>
        )}
        {advisory.length > 0 && (
          <div className="rounded-md border border-warning/30 bg-warning/5 p-2">
            <button
              onClick={() => setAdvisoryOpen((o) => !o)}
              className="flex w-full items-center gap-1 text-xs font-medium text-warning dark:text-warning"
            >
              <Lightbulb size={13} weight="fill" /> {advisory.length} dica(s)
              {advisoryOpen ? (
                <CaretUp size={11} className="ml-auto" />
              ) : (
                <CaretDown size={11} className="ml-auto" />
              )}
            </button>
            {advisoryOpen && (
              <div className="mt-1 space-y-1">
                {advisory.map((iss, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground">
                    • {iss.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live "working" indicator, shows the agent is actively thinking/doing */}
      {isBusy && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-border text-[11px] text-muted-foreground">
          <span className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-primary animate-dot-pulse [animation-delay:-0.2s]" />
            <span className="w-1 h-1 rounded-full bg-primary animate-dot-pulse [animation-delay:-0.1s]" />
            <span className="w-1 h-1 rounded-full bg-primary animate-dot-pulse" />
          </span>
          <span>
            {status === "connecting"
              ? "Conectando…"
              : lastTool
                ? `Executando: ${lastTool}`
                : "Pensando…"}
          </span>
          {elapsed > 0 && (
            <span className="ml-auto tabular-nums">{elapsed}s</span>
          )}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border p-2">
        <ElevatedTextarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          autoResize
          maxHeight={160}
          controlSize="sm"
          variant="secondary"
          placeholder="Descreva ou edite o fluxo…"
        />
        <div className="flex items-center justify-end gap-2 mt-1.5">
          {status === "building" && (
            <ElevatedButton
              variant="outline-subtle"
              size="sm"
              title="Parar"
              icon={<Stop size={13} weight="fill" />}
              iconVisible
              onClick={cancel}
            />
          )}
          <ElevatedButton
            variant="primary"
            size="sm"
            title="Enviar"
            icon={<PaperPlaneRight size={13} weight="fill" />}
            iconVisible
            disabled={isBusy || !text.trim()}
            onClick={handleSend}
          />
        </div>
      </div>
        </>
      )}
    </div>
  );
}
