"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useWorkspace } from "@/contexts/workspace-context";
import type { WorkflowGraph, WorkflowType } from "@/lib/workflows/types";
import {
  createReconnectController,
  type ReconnectController,
} from "@/lib/ws/reconnect";

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";

export type BuilderStatus =
  | "idle"
  | "connecting"
  | "ready"
  | "building"
  | "done"
  | "error";

export interface BuilderLintIssue {
  code: string;
  severity: "blocking" | "advisory";
  nodeId?: string;
  field?: string;
  message: string;
  hint?: string;
}

export interface BuilderResourceMatch {
  id: string;
  name: string;
}

export interface BuilderChatEntry {
  role: "user" | "assistant" | "system" | "tool" | "thinking";
  text: string;
  ok?: boolean;
  streaming?: boolean;
}

interface UseWorkflowAIBuilderOptions {
  workflowId: string;
  workflowType: WorkflowType;
  model?: string;
  onGraph?: (graph: WorkflowGraph) => void;
  onMeta?: (meta: { name?: string; description?: string; workflowType?: WorkflowType }) => void;
  getGraph?: () => WorkflowGraph | null | undefined;
}

export type BuilderConnection =
  | "connecting"
  | "online"
  | "reconnecting"
  | "offline";

export interface UseWorkflowAIBuilderReturn {
  status: BuilderStatus;
  connection: BuilderConnection;
  reconnectNow: () => void;
  chat: BuilderChatEntry[];
  issues: BuilderLintIssue[];
  valid: boolean;
  iteration: number;
  maxIterations: number;
  tokensUsed: number;
  tokenBudget: number;
  lastResources: { kind: string; query: string; matches: BuilderResourceMatch[] } | null;
  sendPrompt: (text: string) => void;
  cancel: () => void;
  newSession: () => void;
}

export function useWorkflowAIBuilder({
  workflowId,
  workflowType,
  model,
  onGraph,
  onMeta,
  getGraph,
}: UseWorkflowAIBuilderOptions): UseWorkflowAIBuilderReturn {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";

  const [status, setStatus] = useState<BuilderStatus>("connecting");
  const [chat, setChat] = useState<BuilderChatEntry[]>([]);
  const [issues, setIssues] = useState<BuilderLintIssue[]>([]);
  const [valid, setValid] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [maxIterations, setMaxIterations] = useState(0);
  const [tokensUsed, setTokensUsed] = useState(0);
  const [tokenBudget, setTokenBudget] = useState(0);
  const [lastResources, setLastResources] = useState<
    { kind: string; query: string; matches: BuilderResourceMatch[] } | null
  >(null);
  const [connection, setConnection] = useState<BuilderConnection>("connecting");

  const wsRef = useRef<WebSocket | null>(null);
  const intentionalRef = useRef(false);
  const mountedRef = useRef(true);
  const reconnectRef = useRef<ReconnectController | null>(null);
  const buildActiveRef = useRef(false);
  const onGraphRef = useRef(onGraph);
  const onMetaRef = useRef(onMeta);
  const getGraphRef = useRef(getGraph);
  const workflowTypeRef = useRef(workflowType);
  const modelRef = useRef(model);
  useEffect(() => {
    onGraphRef.current = onGraph;
    onMetaRef.current = onMeta;
    getGraphRef.current = getGraph;
    workflowTypeRef.current = workflowType;
    modelRef.current = model;
  }, [onGraph, onMeta, getGraph, workflowType, model]);

  const cleanup = useCallback(() => {
    intentionalRef.current = true;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    intentionalRef.current = false;

    const params = new URLSearchParams();
    if (workspaceId) params.set("workspace_id", workspaceId);

    const path = workflowId
      ? `/ws/workflows/${encodeURIComponent(workflowId)}/ai-builder`
      : `/ws/workflows/ai-builder`;
    const ws = new WebSocket(`${WS_BASE_URL}${path}?${params.toString()}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (ws !== wsRef.current) return;
      setConnection("online");
      reconnectRef.current?.resetBackoff();
    };

    ws.onmessage = (evt) => {
      let msg: { type: string; payload?: unknown };
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }
      switch (msg.type) {
        case "builder_ready": {
          setStatus("ready");
          ws.send(
            JSON.stringify({
              type: "set_workflow_type",
              data: { type: workflowTypeRef.current },
            }),
          );
          if (modelRef.current) {
            ws.send(
              JSON.stringify({ type: "set_model", data: { model: modelRef.current } }),
            );
          }
          const current = getGraphRef.current?.();
          if (
            current &&
            ((current.nodes?.length ?? 0) > 0 || (current.edges?.length ?? 0) > 0)
          ) {
            ws.send(
              JSON.stringify({ type: "hydrate_graph", data: { graph: current } }),
            );
          }
          break;
        }
        case "meta": {
          const p = msg.payload as {
            name?: string;
            description?: string;
            workflowType?: string;
          };
          onMetaRef.current?.({
            name: p?.name,
            description: p?.description,
            workflowType: p?.workflowType as WorkflowType | undefined,
          });
          break;
        }
        case "tool": {
          const p = msg.payload as { name?: string; summary?: string; ok?: boolean };
          if (p?.name) {
            setChat((prev) => [
              ...prev,
              { role: "tool", text: `${p.name}: ${p.summary ?? ""}`, ok: p.ok !== false },
            ]);
          }
          break;
        }
        case "assistant_message": {
          const p = msg.payload as { text?: string };
          if (p?.text) setChat((prev) => [...prev, { role: "assistant", text: p.text! }]);
          break;
        }
        case "reasoning_delta": {
          const p = msg.payload as { text?: string };
          if (!p?.text) break;
          setChat((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "thinking" && last.streaming) {
              return [...prev.slice(0, -1), { ...last, text: last.text + p.text }];
            }
            return [...prev, { role: "thinking", text: p.text!, streaming: true }];
          });
          break;
        }
        case "reasoning_done": {
          setChat((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "thinking" && last.streaming) {
              return [...prev.slice(0, -1), { ...last, streaming: false }];
            }
            return prev;
          });
          break;
        }
        case "assistant_delta": {
          const p = msg.payload as { text?: string };
          if (!p?.text) break;
          setChat((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.streaming) {
              return [...prev.slice(0, -1), { ...last, text: last.text + p.text }];
            }
            return [...prev, { role: "assistant", text: p.text!, streaming: true }];
          });
          break;
        }
        case "assistant_done": {
          setChat((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.streaming) {
              return [...prev.slice(0, -1), { ...last, streaming: false }];
            }
            return prev;
          });
          break;
        }
        case "graph_snapshot": {
          if (!buildActiveRef.current) break;
          const p = msg.payload as {
            graph: WorkflowGraph;
            issues?: BuilderLintIssue[];
            valid?: boolean;
          };
          if (p?.graph) onGraphRef.current?.(p.graph);
          setIssues(p?.issues ?? []);
          setValid(Boolean(p?.valid));
          break;
        }
        case "iteration": {
          const p = msg.payload as {
            n: number;
            max: number;
            tokensUsed: number;
            tokenBudget: number;
          };
          setStatus("building");
          setIteration(p?.n ?? 0);
          setMaxIterations(p?.max ?? 0);
          setTokensUsed(p?.tokensUsed ?? 0);
          setTokenBudget(p?.tokenBudget ?? 0);
          break;
        }
        case "resource_resolved": {
          const p = msg.payload as {
            kind: string;
            query: string;
            matches: BuilderResourceMatch[];
          };
          setLastResources(p ?? null);
          break;
        }
        case "idle": {
          const p = msg.payload as { valid?: boolean };
          buildActiveRef.current = false;
          setStatus("ready");
          setValid(Boolean(p?.valid));
          break;
        }
        case "done": {
          const p = msg.payload as {
            valid: boolean;
            summary?: string;
            residualIssues?: BuilderLintIssue[];
          };
          buildActiveRef.current = false;
          setStatus("done");
          setValid(Boolean(p?.valid));
          if (p?.residualIssues) setIssues(p.residualIssues);
          setChat((prev) => [
            ...prev,
            {
              role: "system",
              text: p?.summary
                ? `${p.valid ? "✓" : "⚠"} ${p.summary}`
                : p?.valid
                  ? "✓ concluído"
                  : "⚠ não finalizado",
            },
          ]);
          break;
        }
        case "error": {
          const p = msg.payload as { error?: string };
          buildActiveRef.current = false;
          setStatus("error");
          setChat((prev) => [
            ...prev,
            { role: "system", text: p?.error ?? "Erro desconhecido" },
          ]);
          break;
        }
      }
    };

    ws.onclose = () => {
      if (ws !== wsRef.current) return;
      buildActiveRef.current = false;
      if (intentionalRef.current) {
        setConnection("offline");
        return;
      }
      setConnection("reconnecting");
      reconnectRef.current?.scheduleReconnect();
    };
    ws.onerror = () => {
      if (ws !== wsRef.current) return;
      setConnection("reconnecting");
    };
  }, [workflowId, workspaceId]);

  useEffect(() => {
    mountedRef.current = true;
    const controller = createReconnectController({
      connect: () => {
        void connect();
      },
      shouldReconnect: () => mountedRef.current,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
    });
    reconnectRef.current = controller;
    controller.start();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void connect();
    return () => {
      mountedRef.current = false;
      controller.stop();
      cleanup();
      reconnectRef.current = null;
    };
  }, [connect, cleanup]);

  useEffect(() => {
    if (model && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "set_model", data: { model } }));
    }
  }, [model]);

  const sendPrompt = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || wsRef.current?.readyState !== WebSocket.OPEN) return;
    buildActiveRef.current = true;
    setChat((prev) => [...prev, { role: "user", text: trimmed }]);
    setStatus("building");
    const current = getGraphRef.current?.();
    const hasGraph =
      !!current &&
      ((current.nodes?.length ?? 0) > 0 || (current.edges?.length ?? 0) > 0);
    wsRef.current.send(
      JSON.stringify({
        type: "user_prompt",
        data: hasGraph ? { text: trimmed, graph: current } : { text: trimmed },
      }),
    );
  }, []);

  const cancel = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "cancel" }));
    }
  }, []);

  const newSession = useCallback(() => {
    setChat([]);
    setIssues([]);
    setValid(false);
    setIteration(0);
    setMaxIterations(0);
    setTokensUsed(0);
    setTokenBudget(0);
    setLastResources(null);
    setStatus("connecting");
    setConnection("connecting");
    cleanup();
    const ctrl = reconnectRef.current;
    if (ctrl) ctrl.reconnectNow();
    else void connect();
  }, [cleanup, connect]);

  const reconnectNow = useCallback(() => {
    const ctrl = reconnectRef.current;
    if (ctrl) ctrl.reconnectNow();
    else void connect();
  }, [connect]);

  return {
    status,
    connection,
    reconnectNow,
    chat,
    issues,
    valid,
    iteration,
    maxIterations,
    tokensUsed,
    tokenBudget,
    lastResources,
    sendPrompt,
    cancel,
    newSession,
  };
}
