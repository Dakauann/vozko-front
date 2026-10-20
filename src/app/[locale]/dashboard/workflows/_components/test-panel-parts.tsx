"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CaretRight, CheckCircle, Eye, Pause, Play, Robot, Stop, User, Warning, XCircle } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import type { SimEvent, SimStatus, UseWorkflowSimulationReturn } from "@/hooks/use-workflow-simulation";
import { DIAL_KEYS } from "@/lib/dialer/dial-string";
import { versionTag } from "@/lib/workflows/publication";
import { cn } from "@/lib/utils";

import { DurationText, ToneChip } from "./run-bits";

const PAUSE_REASON_KEYS: Record<string, string> = {
  breakpoint: "breakpoint",
  run_until: "runUntil",
  step: "step",
};

export function ReproducingBanner({
  reproducing,
  nodeLabel,
  versionDiffers,
  onViewVersion,
}: {
  reproducing: NonNullable<UseWorkflowSimulationReturn["reproducing"]>;
  nodeLabel: (nodeId: string) => string | undefined;
  versionDiffers?: (version: number | undefined) => boolean;
  onViewVersion?: (version: number) => void;
}) {
  const t = useTranslations("workflowDebug");
  return (
    <div data-testid="reproducing-banner" className="space-y-1 rounded-[--radius] border border-border p-2.5 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-foreground">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
        {t("reproduce.banner", { run: reproducing.runId.slice(0, 8) })}
        {reproducing.workflowVersion != null && (
          <span className="readout tabular-nums text-muted-foreground">{versionTag(reproducing.workflowVersion)}</span>
        )}
      </p>
      <p className="text-2xs text-muted-foreground">
        {t("reproduce.pinnedNodes", { count: reproducing.pinnedNodes.length })}
        {reproducing.pinnedNodes.length > 0 && `: ${reproducing.pinnedNodes.map((id) => nodeLabel(id) ?? id).join(", ")}`}
      </p>
      {versionDiffers?.(reproducing.workflowVersion) && (
        <div className="space-y-1">
          <p className="text-2xs text-muted-foreground">{t("reproduce.versionNote")}</p>
          {onViewVersion && reproducing.workflowVersion != null && (
            <button
              type="button"
              onClick={() => onViewVersion(reproducing.workflowVersion!)}
              className="inline-flex items-center gap-1 rounded-[--radius] text-2xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Eye size={11} />
              {t("reproduce.viewVersion", { version: versionTag(reproducing.workflowVersion) })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PauseToolbar({
  pause,
  pausedLabel,
  onStep,
  onResume,
  onStop,
}: {
  pause: NonNullable<UseWorkflowSimulationReturn["pause"]>;
  pausedLabel: string;
  onStep: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  const t = useTranslations("workflowDebug");
  const pauseReasonKey = PAUSE_REASON_KEYS[pause.reason];
  return (
    <div role="toolbar" aria-label={t("toolbar.pausedAt", { node: pausedLabel })} className="space-y-2 border-t border-border px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-warning" />
        <span className="min-w-0 truncate">{t("toolbar.pausedAt", { node: pausedLabel })}</span>
        {pauseReasonKey && <span className="shrink-0 text-2xs font-normal text-muted-foreground">({t(`toolbar.reasons.${pauseReasonKey}`)})</span>}
      </p>
      <div className="flex gap-1.5">
        <ElevatedButton variant="primary" size="sm" iconVisible icon={<CaretRight size={12} weight="bold" />} title={t("toolbar.next")} onClick={onStep} className="flex-1" />
        <ElevatedButton variant="outline-subtle" size="sm" iconVisible icon={<Play size={12} weight="fill" />} title={t("toolbar.continue")} onClick={onResume} className="flex-1" />
        <ElevatedButton
          variant="outline-subtle"
          size="sm"
          iconVisible
          icon={<Stop size={12} weight="fill" />}
          title={t("toolbar.stop")}
          onClick={onStop}
          className="text-destructive-ink"
        />
      </div>
    </div>
  );
}

export function RealCallsDialog({
  nodes,
  onConfirm,
  onSkip,
  onCancel,
}: {
  nodes: string[];
  onConfirm: () => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("workflowDebug");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.querySelector("button")?.focus();
  }, []);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="real-calls-title"
        aria-describedby="real-calls-description"
        className="w-full space-y-3 rounded-[--radius] border border-border bg-card p-4 shadow-lg"
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }}
      >
        <p id="real-calls-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span aria-hidden className="h-2 w-2 rounded-full bg-warning" />
          {t("realCalls.title")}
        </p>
        <p id="real-calls-description" className="text-xs leading-relaxed text-muted-foreground">
          {t("realCalls.description", { count: nodes.length, nodes: nodes.join(", ") })}
        </p>
        <div className="flex flex-col gap-1.5">
          <ElevatedButton variant="primary" size="sm" title={t("realCalls.confirm")} onClick={onConfirm} />
          <ElevatedButton variant="outline-subtle" size="sm" title={t("realCalls.skip")} onClick={onSkip} />
          <ElevatedButton variant="ghost" size="sm" title={t("realCalls.cancel")} onClick={onCancel} />
        </div>
      </div>
    </div>
  );
}

const SIM_STATUS_LABELS: Record<SimStatus, string> = {
  idle: "",
  connecting: "Conectando",
  ready: "Pronto",
  confirming: "Confirmação",
  waiting_trigger: "Aguardando mensagem",
  running: "Executando",
  paused: "Pausado",
  waiting_reply: "Aguardando",
  waiting_form: "Aguardando formulário",
  waiting_key: "Aguardando tecla",
  completed: "Concluído",
  error: "Erro",
  cancelled: "Cancelado",
};

export function StatusBadge({ status }: { status: SimStatus }) {
  const label = SIM_STATUS_LABELS[status];
  return label ? <ToneChip status={status} label={label} /> : null;
}

export function EventItem({ event, nodeLabel }: { event: Exclude<SimEvent, { type: "step" }>; nodeLabel: (nodeId: string) => string | undefined }) {
  const t = useTranslations("workflowDebug");
  switch (event.type) {
    case "message":
      return (
        <li>
          <MessageBubble event={event} />
        </li>
      );
    case "paused":
      return (
        <li className="flex items-center justify-center gap-1.5 py-0.5 text-center text-2xs text-muted-foreground">
          <Pause size={11} weight="fill" className="text-warning-ink" />
          {t("toolbar.pausedAt", { node: nodeLabel(event.pause.nodeId) ?? event.pause.nodeId })}
        </li>
      );
    case "reply_ignored":
      return (
        <li className="flex items-center justify-center gap-1.5 py-0.5 text-center text-2xs text-muted-foreground">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
          {t("chat.replyIgnored")}
        </li>
      );
    case "waiting_reply":
      return (
        <li className="flex items-center justify-center gap-1.5 py-1 text-center text-xs text-warning-ink">
          <Warning size={12} weight="fill" />
          Aguardando resposta... ({event.timeoutSeconds}s)
        </li>
      );
    case "waiting_form":
      return (
        <li className="flex items-center justify-center gap-1.5 py-1 text-center text-xs text-warning-ink">
          <Warning size={12} weight="fill" />
          {t("form.waiting", { seconds: event.timeoutSeconds })}
        </li>
      );
    case "waiting_key":
      return (
        <li className="flex items-center justify-center gap-1.5 py-1 text-center text-xs text-warning-ink">
          <Warning size={12} weight="fill" />
          Aguardando uma tecla... ({event.timeoutSeconds}s)
        </li>
      );
    case "call_transferred":
      return (
        <li className="py-1 text-xs text-healthy-ink">
          <p className="flex items-center gap-1.5 font-semibold">
            <CheckCircle size={12} weight="fill" />
            Transferida para a fila {event.queueName}. Um atendente livre atende e o fluxo termina.
          </p>
          {event.notes ? <p className="mt-0.5 pl-[18px] text-muted-foreground">Nota: {event.notes}</p> : null}
        </li>
      );
    case "error":
      return (
        <li className="flex items-center justify-center gap-1.5 py-1 text-center text-xs text-destructive-ink">
          <XCircle size={12} weight="fill" />
          {event.message}
        </li>
      );
  }
}

function MessageBubble({ event }: { event: Extract<SimEvent, { type: "message" }> }) {
  const isOutbound = event.direction === "outbound";

  return (
    <div className={cn("flex gap-2", isOutbound ? "justify-start" : "justify-end")}>
      {isOutbound && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
          <Robot size={12} className="text-primary-ink" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-[--radius] px-3 py-1.5 text-xs leading-relaxed",
          isOutbound ? "bg-muted text-foreground rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm",
        )}
      >
        {event.audioUrl ? (
          <>
            <audio controls autoPlay preload="auto" src={event.audioUrl} className="max-w-full h-8" />
            <span className="mt-1 block text-2xs opacity-70">{event.text}</span>
          </>
        ) : event.audioBase64 ? (
          <audio controls preload="metadata" src={`data:${event.audioMime || "audio/ogg"};base64,${event.audioBase64}`} className="max-w-full h-8" />
        ) : event.msgType === "key" ? (
          <span className="readout text-sm font-semibold">{event.text}</span>
        ) : (
          event.text
        )}
        {event.msgType !== "text" && event.msgType !== "key" && !event.audioBase64 && !event.audioUrl && (
          <span className="block text-2xs opacity-60 mt-0.5">[{event.msgType}]</span>
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

export function Keypad({ waiting, onKey }: { waiting: boolean; onKey: (key: string) => void }) {
  return (
    <div className="border-t border-border px-3 py-2 flex-shrink-0">
      <p className={cn("mb-1.5 text-2xs", waiting ? "text-warning-ink" : "text-muted-foreground")}>
        {waiting ? "Aperte uma tecla, como quem ligou" : "Teclas cortam o áudio, como numa ligação"}
      </p>
      <div className="grid grid-cols-6 gap-1" role="group" aria-label="Teclado do telefone">
        {DIAL_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-label={key}
            onClick={() => onKey(key)}
            className="readout h-8 rounded-[--radius] border border-control-edge bg-card text-sm font-semibold text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SimStepGroup({ count, durationMs, expanded, onToggle }: { count: number; durationMs: number; expanded: boolean; onToggle: () => void }) {
  const t = useTranslations("workflowDebug.chat");
  const Caret = expanded ? CaretDown : CaretRight;
  return (
    <li className="flex justify-center">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Caret size={10} className="shrink-0" />
        <span>{t("stepGroup", { count })}</span>{" "}
        <span aria-hidden>·</span>{" "}
        <DurationText ms={durationMs} />
      </button>
    </li>
  );
}
