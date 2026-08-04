"use client";

import { useRef, useState, useEffect, type KeyboardEvent } from "react";
import {
  X,
  PaperPlaneRight,
  Play,
  Stop,
  Robot,
  User,
  CircleNotch,
  CheckCircle,
  XCircle,
  Warning,
  ArrowsClockwise,
  CaretDown,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import ElevatedButton from "@/components/elevated-design/button";
import {
  type SimEvent,
  type SimStatus,
  type UseWorkflowSimulationReturn,
} from "@/hooks/use-workflow-simulation";

interface WorkflowTestPanelProps {
  simulation: UseWorkflowSimulationReturn;
  onClose: () => void;
}

export function WorkflowTestPanel({
  simulation,
  onClose,
}: WorkflowTestPanelProps) {
  const { status, events, currentNodeId, start, sendReply, cancel } =
    simulation;

  const [replyText, setReplyText] = useState("");
  const [showState, setShowState] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  useEffect(() => {
    if (status === "waiting_reply" || status === "waiting_trigger") {
      inputRef.current?.focus();
    }
  }, [status]);

  const handleSendReply = () => {
    const text = replyText.trim();
    if (!text) return;
    sendReply(text);
    setReplyText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const isActive =
    status === "running" ||
    status === "waiting_reply" ||
    status === "connecting" ||
    status === "waiting_trigger";

  const latestState = [...events]
    .reverse()
    .find((e): e is Extract<SimEvent, { type: "state" }> => e.type === "state");

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col h-full flex-shrink-0">
      {/* ─── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Robot size={16} weight="duotone" className="text-lamp-ink" />
          <span className="text-sm font-medium">Simulação</span>
          <StatusBadge status={status} />
        </div>
        <ElevatedButton
          variant="ghost"
          size="icon"
          icon={<X size={14} />}
          iconVisible
          onClick={onClose}
          className="h-6 w-6"
        />
      </div>

      {/* ─── Event Stream ────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2"
      >
        {status === "waiting_trigger" && events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
            <PaperPlaneRight
              size={28}
              weight="duotone"
              className="opacity-50"
            />
            <p className="text-xs">
              Envie uma mensagem para iniciar o workflow.
            </p>
          </div>
        )}

        {events.length === 0 && status === "idle" && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground">
            <Play size={32} weight="duotone" className="opacity-50" />
            <p className="text-xs">
              Clique em Iniciar para simular o workflow.
            </p>
          </div>
        )}

        {events.map((evt, i) => (
          <EventItem key={i} event={evt} />
        ))}

        {status === "connecting" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <CircleNotch size={14} className="animate-spin" />
            Conectando...
          </div>
        )}

        {currentNodeId && isActive && status !== "connecting" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <CircleNotch size={14} className="animate-spin" />
            Executando nó: {currentNodeId}
          </div>
        )}
      </div>

      {/* ─── State Variables (collapsible) ────────────────── */}
      {latestState && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowState(!showState)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <CaretDown
              size={12}
              className={cn("transition-transform", showState && "rotate-180")}
            />
            Variáveis ({Object.keys(latestState.vars).length})
          </button>
          {showState && (
            <div className="px-3 pb-2 max-h-32 overflow-y-auto">
              <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(latestState.vars, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ─── Reply / Trigger Input ────────────────────── */}
      {(status === "waiting_reply" || status === "waiting_trigger") && (
        <div className="border-t border-border px-3 py-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                status === "waiting_trigger"
                  ? "Envie a mensagem inicial..."
                  : "Escreva uma resposta..."
              }
              className="flex-1 text-sm bg-muted border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleSendReply}
              disabled={!replyText.trim()}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              <PaperPlaneRight size={14} weight="fill" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Action Bar ──────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-border flex-shrink-0">
        {!isActive ? (
          <ElevatedButton
            variant="primary"
            size="sm"
            title={events.length > 0 ? "Reiniciar" : "Iniciar"}
            icon={
              events.length > 0 ? (
                <ArrowsClockwise size={14} />
              ) : (
                <Play size={14} weight="fill" />
              )
            }
            iconVisible
            onClick={start}
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
            className="flex-1 text-destructive border-rose-300 hover:bg-destructive/10"
          />
        )}
      </div>
    </div>
  );
}


function StatusBadge({ status }: { status: SimStatus }) {
  const config: Record<SimStatus, { label: string; className: string }> = {
    idle: { label: "", className: "" },
    connecting: {
      label: "Conectando",
      className: "bg-yellow-500 text-white",
    },
    waiting_trigger: {
      label: "Aguardando mensagem",
      className: "bg-muted text-white",
    },
    running: {
      label: "Executando",
      className: "bg-muted text-white",
    },
    waiting_reply: {
      label: "Aguardando",
      className: "bg-warning text-white",
    },
    completed: {
      label: "Concluído",
      className: "bg-healthy text-white",
    },
    error: {
      label: "Erro",
      className: "bg-destructive text-white",
    },
    cancelled: {
      label: "Cancelado",
      className: "bg-gray-500 text-white",
    },
  };

  const c = config[status];
  if (!c.label) return null;

  return (
    <span
      className={cn(
        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}


function EventItem({ event }: { event: SimEvent }) {
  switch (event.type) {
    case "message":
      return <MessageBubble event={event} />;
    case "node_event":
      return <NodeEventItem event={event} />;
    case "waiting_reply":
      return (
        <div className="flex items-center gap-1.5 text-xs text-warning dark:text-amber-400 py-1">
          <Warning size={12} weight="fill" />
          Aguardando resposta... ({event.timeoutSeconds}s)
        </div>
      );
    case "state":
      return null; 
    case "error":
      return (
        <div className="flex items-center gap-1.5 text-xs text-destructive dark:text-red-400 py-1">
          <XCircle size={12} weight="fill" />
          {event.message}
        </div>
      );
  }
}

function MessageBubble({
  event,
}: {
  event: Extract<SimEvent, { type: "message" }>;
}) {
  const isOutbound = event.direction === "outbound";

  return (
    <div
      className={cn("flex gap-2", isOutbound ? "justify-start" : "justify-end")}
    >
      {isOutbound && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <Robot size={12} className="text-lamp-ink" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-[--radius] px-3 py-1.5 text-xs leading-relaxed",
          isOutbound
            ? "bg-muted text-foreground rounded-tl-sm"
            : "bg-primary text-primary-foreground rounded-tr-sm",
        )}
      >
        {event.audioBase64 ? (
          <audio
            controls
            preload="metadata"
            src={`data:${event.audioMime || "audio/ogg"};base64,${event.audioBase64}`}
            className="max-w-full h-8"
          />
        ) : (
          event.text
        )}
        {event.msgType !== "text" && !event.audioBase64 && (
          <span className="block text-[10px] opacity-60 mt-0.5">
            [{event.msgType}]
          </span>
        )}
      </div>
      {!isOutbound && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <User size={12} className="text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function NodeEventItem({
  event,
}: {
  event: Extract<SimEvent, { type: "node_event" }>;
}) {
  const hasError = !!event.error;

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-0.5">
      {hasError ? (
        <XCircle size={11} className="text-red-500 flex-shrink-0" />
      ) : (
        <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
      )}
      <span className="truncate">
        {event.nodeType}
        {event.nodeId && <span className="opacity-50"> ({event.nodeId})</span>}
      </span>
      {hasError && (
        <span className="text-red-500 truncate">, {event.error}</span>
      )}
    </div>
  );
}
