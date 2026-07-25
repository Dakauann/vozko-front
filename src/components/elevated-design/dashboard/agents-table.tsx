"use client";

import type { Agent, AgentListMeta, ToolBinding } from "@/lib/agents/types";
import { ChatCircle, Pencil, Trash } from "@phosphor-icons/react";

import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { ModelBrandIcon } from "@/components/elevated-design/model-brand-icon";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AgentsTableProps {
  agents: Agent[];
  meta?: AgentListMeta;
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function ToolsList({
  tools,
  agentId,
}: {
  tools: ToolBinding[];
  agentId: string;
}) {
  if (!tools.length) {
    return (
      <span className="text-sm text-muted-foreground">
        Nenhuma ferramenta vinculada.
      </span>
    );
  }

  const maxVisible = 4;
  const visibleTools = tools.slice(0, maxVisible);
  const remaining = tools.length - visibleTools.length;

  return (
    <div className="flex flex-wrap gap-2">
      {visibleTools.map((tool) => (
        <span
          key={`${agentId}-${tool.name}`}
          className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"
        >
          {tool.name}
        </span>
      ))}
      {remaining > 0 ? (
        <span className="inline-flex items-center rounded-full bg-border px-3 py-1 text-xs font-semibold text-muted-foreground">
          +{remaining}
        </span>
      ) : null}
    </div>
  );
}

export function AgentsTable({ agents, meta }: AgentsTableProps) {
  const summary = meta
    ? `Mostrando ${agents.length} de ${
        meta.totalItems ?? agents.length
      } agentes`
    : null;

  if (!agents.length) {
    return (
      <ElevatedContainer className="border border-border/70 bg-card/95">
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-center">
          <p className="text-base font-semibold text-foreground">
            Nenhum agente cadastrado até o momento.
          </p>
          <p className="text-sm text-muted-foreground">
            Crie um novo agente para começar a acompanhar suas interações.
          </p>
        </div>
      </ElevatedContainer>
    );
  }

  return (
    <div className="space-y-5">
      {summary ? (
        <p className="text-sm font-medium text-muted-foreground">{summary}</p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => {
          const tools = agent.internalTools ?? [];

          return (
            <ElevatedContainer
              key={agent.id}
              className="flex h-full flex-col border border-border/70 bg-card/95 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold text-foreground">
                    {agent.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {agent.description?.trim() || "Sem descrição"}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                    agent.isActive
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {agent.isActive ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 text-sm text-muted-foreground">
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label="Provedor" value={agent.provider || "-"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem
                    label="Modelo de mensagens"
                    value={
                      agent.messagingModel ? (
                        <span className="flex items-center gap-1.5">
                          <ModelBrandIcon
                            modelId={agent.messagingModel}
                            size={16}
                          />
                          <span className="truncate">
                            {agent.messagingModel.split("/").pop()}
                          </span>
                        </span>
                      ) : (
                        "-"
                      )
                    }
                  />
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ferramentas habilitadas
                </p>
                <ToolsList tools={tools} agentId={agent.id} />
              </div>

              <div className="mt-auto space-y-4 pt-6">
                <p className="text-xs text-muted-foreground">
                  Atualizado em {formatDate(agent.updatedAt)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    title="Ajustar"
                    icon={<ChatCircle className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    link={`/dashboard/agents/${agent.id}/tune`}
                    newTab={false}
                    className="text-[11px] font-semibold uppercase"
                  />
                  <Button
                    variant="outline"
                    title="Editar"
                    icon={<Pencil className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    link={`/dashboard/agents/${agent.id}/edit`}
                    newTab={false}
                    className="text-[11px] font-semibold uppercase"
                  />
                  <Button
                    variant="ghost"
                    title="Excluir"
                    icon={<Trash className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    link={`/dashboard/agents/${agent.id}/delete`}
                    newTab={false}
                    className="text-[11px] font-semibold uppercase text-red-600 hover:bg-destructive/10"
                  />
                </div>
              </div>
            </ElevatedContainer>
          );
        })}
      </div>
    </div>
  );
}
