"use client";

import { useEffect, useState } from "react";
import {
  CaretLeft,
  ChatCircleDots,
  CheckCircle,
  CircleNotch,
  Warning,
} from "@phosphor-icons/react";

import {
  getBuilderSessionAction,
  listBuilderSessionsAction,
} from "@/app/actions/workflows";
import type { BuilderSession } from "@/lib/workflows/types";
import { CopilotMessage } from "./workflow-copilot-message";

interface WorkflowCopilotHistoryProps {
  workflowId: string;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WorkflowCopilotHistory({ workflowId }: WorkflowCopilotHistoryProps) {
  const [sessions, setSessions] = useState<BuilderSession[]>([]);
  const [loadingList, setLoadingList] = useState(() => Boolean(workflowId));
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<BuilderSession | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    void listBuilderSessionsAction(workflowId).then((res) => {
      if (cancelled) return;
      setListError(res.error ?? null);
      setSessions(res.sessions ?? []);
      setLoadingList(false);
    });
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void getBuilderSessionAction(selectedId).then((res) => {
      if (cancelled) return;
      setDetailError(res.error ?? null);
      setDetail(res.session ?? null);
      setLoadingDetail(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const openThread = (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setLoadingDetail(true);
  };

  const closeThread = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  };

  if (selectedId) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <button
          onClick={closeThread}
          className="flex items-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border-b border-border"
        >
          <CaretLeft size={13} /> Voltar às conversas
        </button>
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {loadingDetail && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <CircleNotch size={18} className="animate-spin" />
            </div>
          )}
          {detailError && (
            <p className="text-xs text-red-500">{detailError}</p>
          )}
          {!loadingDetail &&
            detail?.messages?.map((m, i) => (
              <CopilotMessage key={i} role={m.role} text={m.text} ok={m.ok} />
            ))}
          {!loadingDetail && detail && (detail.messages?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Conversa sem mensagens.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
      {loadingList && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <CircleNotch size={18} className="animate-spin" />
        </div>
      )}
      {listError && <p className="px-1 text-xs text-red-500">{listError}</p>}
      {!loadingList && sessions.length === 0 && !listError && (
        <div className="flex flex-col items-center justify-center h-full text-center gap-2 text-muted-foreground text-xs py-8">
          <ChatCircleDots size={26} weight="duotone" className="opacity-50" />
          <p>Nenhuma conversa salva ainda.</p>
        </div>
      )}
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => openThread(s.id)}
          className="w-full text-left rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-1.5">
            {s.valid ? (
              <CheckCircle size={13} weight="fill" className="shrink-0 text-emerald-500" />
            ) : (
              <Warning size={13} weight="fill" className="shrink-0 text-amber-500" />
            )}
            <span className="text-xs font-medium truncate">
              {s.title || "Conversa sem título"}
            </span>
          </div>
          <div className="flex items-center gap-2 pl-[18px] text-[11px] text-muted-foreground">
            <span>{formatWhen(s.startedAt)}</span>
            <span>·</span>
            <span>{s.messageCount} msg</span>
          </div>
        </button>
      ))}
    </div>
  );
}
