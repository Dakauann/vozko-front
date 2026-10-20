import { RUN_WORKFLOW_TOOL, boundKeyOf } from "@/lib/agents/tool-bindings";
import { conversationHref, isEntryId, isEntryType } from "@/lib/conversations/deep-link";

import type { RuntimeAlert } from "./types";

export type RuntimeAlertFix =
  | { kind: "publish" }
  | { kind: "open_run"; runId: string }
  | { kind: "open_node"; nodeId: string }
  | { kind: "view_deliveries" }
  | { kind: "link"; href: string };

export interface RuntimeAlertView {
  title: string;
  description: string;
  actionLabel: string | null;
  fix: RuntimeAlertFix | null;
}

export interface RuntimeAlertDescribers {
  webhookReason: (reason: string) => string | null;
  nodeLabel: (nodeId: string) => string | undefined;
}

const HTTP_REQUEST_TOOL = "http_request";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

function toolLabel(subject: string | undefined): string {
  if (!subject) return "do agente";
  if (boundKeyOf(subject, RUN_WORKFLOW_TOOL) !== null) return "Executar fluxo";
  if (subject.trim().toLowerCase() === HTTP_REQUEST_TOOL) return "Requisição HTTP";
  return subject;
}

function nodeName(alert: RuntimeAlert, describers: RuntimeAlertDescribers): string {
  if (!alert.nodeId) return "do fluxo";
  return describers.nodeLabel(alert.nodeId) ?? alert.nodeId;
}

function copyOf(alert: RuntimeAlert, describers: RuntimeAlertDescribers): Pick<RuntimeAlertView, "title" | "description"> {
  switch (alert.kind) {
    case "workflow_called_inactive":
      return {
        title: "Fluxo chamado mas inativo",
        description: `Recusou ${plural(alert.count, "chamada", "chamadas")} de um webhook ou agente de IA porque não está publicado e ativo. Publique para que as próximas chamadas sejam executadas.`,
      };
    case "node_failing":
      return {
        title: "Nó falhando",
        description: `O nó ${nodeName(alert, describers)} falhou em ${plural(alert.count, "execução recente", "execuções recentes")}. Abra a execução para ver o erro e os parâmetros usados.`,
      };
    case "webhook_rejecting": {
      const reason = alert.subject ? (describers.webhookReason(alert.subject) ?? alert.subject) : "motivo não informado";
      return {
        title: "Webhook recusando chamadas",
        description: `Recusou ${plural(alert.count, "chamada", "chamadas")} na última hora pelo mesmo motivo: ${reason}.`,
      };
    }
    case "run_stuck":
      return {
        title: "Execução presa",
        description:
          alert.count > 1
            ? `${alert.count} execuções ficaram sem avançar e foram encerradas com erro.`
            : "Uma execução ficou sem avançar e foi encerrada com erro.",
      };
    case "agent_tool_failing":
      return {
        title: "Ferramenta de agente falhando",
        description: `A ferramenta ${toolLabel(alert.subject)} falhou ${plural(alert.count, "vez", "vezes")} na última hora. Revise a configuração da ferramenta no agente.`,
      };
    case "inbound_lookup_failed":
      return {
        title: "Mensagens sem resposta automática",
        description: `Não foi possível verificar se algum fluxo aguardava ${plural(alert.count, "mensagem recebida", "mensagens recebidas")}, então nem o agente nem os fluxos responderam.`,
      };
    default:
      return { title: "Alerta de execução", description: alert.sample ?? "" };
  }
}

function fixOf(alert: RuntimeAlert): Pick<RuntimeAlertView, "actionLabel" | "fix"> | null {
  switch (alert.fixAction) {
    case "publish":
      return { actionLabel: "Publicar", fix: { kind: "publish" } };
    case "open_run":
      return alert.runId ? { actionLabel: "Abrir execução", fix: { kind: "open_run", runId: alert.runId } } : null;
    case "open_node":
      return alert.nodeId ? { actionLabel: "Ver no fluxo", fix: { kind: "open_node", nodeId: alert.nodeId } } : null;
    case "view_deliveries":
      return { actionLabel: "Ver chamadas", fix: { kind: "view_deliveries" } };
    case "open_agent":
      return alert.agentId
        ? { actionLabel: "Abrir agente", fix: { kind: "link", href: `/dashboard/agents/${encodeURIComponent(alert.agentId)}` } }
        : null;
    case "open_conversation":
      return alert.entryId && alert.entryType && isEntryId(alert.entryId) && isEntryType(alert.entryType)
        ? { actionLabel: "Abrir conversa", fix: { kind: "link", href: conversationHref(alert.entryId, alert.entryType) } }
        : null;
    default:
      return null;
  }
}

export function runtimeAlertView(alert: RuntimeAlert, describers: RuntimeAlertDescribers): RuntimeAlertView {
  return { ...copyOf(alert, describers), ...(fixOf(alert) ?? { actionLabel: null, fix: null }) };
}

function timeOf(iso: string | undefined): number {
  const at = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(at) ? 0 : at;
}

export function sortedRuntimeAlerts(alerts: readonly RuntimeAlert[]): { open: RuntimeAlert[]; resolved: RuntimeAlert[] } {
  const open = alerts
    .filter((alert) => alert.status !== "resolved")
    .sort(
      (a, z) =>
        Number(z.severity === "high") - Number(a.severity === "high") || timeOf(z.lastSeen) - timeOf(a.lastSeen),
    );
  const resolved = alerts
    .filter((alert) => alert.status === "resolved")
    .sort((a, z) => timeOf(z.resolvedAt) - timeOf(a.resolvedAt));
  return { open, resolved };
}

export function openRuntimeAlertCount(alerts: readonly RuntimeAlert[]): number {
  return alerts.filter((alert) => alert.status !== "resolved").length;
}
