import type { NodeDefinition, Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from "@/lib/workflows/types";

import { FIXTURE_DEFINITIONS } from "./fixture";

const COLUMN_GAP = 340;
const ROW_GAP = 420;

function definition(type: WorkflowNodeType, category: NodeDefinition["category"], label: string, icon: string): NodeDefinition {
  return { type, category, label, icon, description: label, scopes: ["shared"], defaultConfig: {}, configSchema: null, testBehavior: "sends_message" };
}

export const TEXT_FIXTURE_DEFINITIONS: NodeDefinition[] = [
  ...FIXTURE_DEFINITIONS,
  definition("action_send_interactive", "messaging", "Enviar botões ou lista", "ListBullets"),
  definition("action_send_template", "messaging", "Enviar template", "FileText"),
  definition("action_send_email", "messaging", "Enviar e-mail", "EnvelopeSimple"),
  definition("action_send_form", "messaging", "Enviar formulário", "ClipboardText"),
  definition("action_ai_agent", "ai", "Agente de IA", "Robot"),
  definition("action_reply_to_agent", "ai", "Responder ao agente", "Robot"),
];

const LONG_TEXT = "Olá {{lead.nome}}! Que bom ter você por aqui.\nNossa academia funciona de segunda a sábado, das 6h às 23h, e aos domingos das 8h às 14h.\nPosso te mostrar os planos, os horários das aulas coletivas ou agendar uma aula experimental gratuita?";

const BUTTONS = JSON.stringify([
  { ID: "planos", Title: "Ver planos e preços", Type: "reply" },
  { ID: "horarios", Title: "Horários das aulas", Type: "reply" },
  { ID: "experimental", Title: "Aula experimental", Type: "reply" },
]);

const LIST = JSON.stringify([
  {
    title: "Unidades",
    rows: [
      { id: "centro", title: "Unidade Centro", description: "Rua das Palmeiras, 120, aberta até 23h" },
      { id: "norte", title: "Unidade Zona Norte", description: "Avenida Brasil, 4500, estacionamento grátis" },
      { id: "sul", title: "Unidade Zona Sul", description: "Shopping Sul, piso 2" },
      { id: "online", title: "Treino online", description: "Aulas ao vivo pelo aplicativo" },
    ],
  },
]);

const NODES: [WorkflowNodeType, Record<string, unknown>][] = [
  ["trigger_webhook", {}],
  ["action_send_text", { text: LONG_TEXT }],
  ["action_send_interactive", { interactive_type: "buttons", header_type: "text", header_text: "Academia Movimento", body: "Como posso te ajudar hoje? Escolha uma das opções abaixo para continuar o atendimento.", footer: "Responda tocando em um botão", buttons: BUTTONS }],
  ["action_send_text", { text: "Perfeito! Aqui estão os nossos planos." }],
  ["action_send_template", { _display_template_id: "boas_vindas_academia", template_id: "boas_vindas_academia", params: { nome: "{{lead.nome}}", unidade: "Centro", validade: "30 de outubro" } }],
  ["action_send_interactive", { interactive_type: "list", body: "Qual unidade fica melhor para você? Toque em Ver unidades e escolha uma opção da lista.", footer: "Atualizado em outubro", list_button: "Ver unidades", sections: LIST }],
  ["action_send_email", { subject: "Sua aula experimental está confirmada", smtp_from_name: "Equipe Movimento", to: "{{lead.email}}", body: "<p>Olá! Sua aula experimental está confirmada para amanhã às 7h. Leve uma garrafa de água e roupa confortável.</p>" }],
  ["action_send_form", { form_id: "matricula", _display_form_id: "Matrícula online", header: "Matrícula", body: "Preencha seus dados para garantir a vaga com o desconto de outubro.", cta: "Abrir formulário" }],
  ["action_ai_agent", { source: "agent", _display_agent_id: "Consultora de planos", agent_id: "agente-planos" }],
  ["action_ai_agent", { source: "prompt", model: "gpt-4o-mini", instructions: "Você é a recepcionista virtual da academia. Responda dúvidas sobre planos, horários e unidades com frases curtas e sempre ofereça a aula experimental." }],
  ["action_reply_to_agent", { fields: [{ key: "status", value: "matricula_iniciada" }, { key: "unidade", value: "{{node.lista.escolha}}" }, { key: "plano", value: "{{node.planos.resposta}}" }] }],
  ["action_send_text", { text: "Obrigado! Em instantes uma consultora vai falar com você." }],
  ["condition_text_match", { display_name: "Confirmou?", text: "{{trigger.mensagem}}", match_mode: "contains", cases: [{ value: "sim" }, { value: "nao" }] }],
  ["action_send_text", { text: "" }],
  ["wait_duration", { seconds: 600 }],
  ["end", {}],
];

const COLUMNS = 4;

export function textFixtureWorkflow(): Workflow {
  const nodes: WorkflowNode[] = NODES.map(([type, config], i) => ({ id: `t${i + 1}`, type, position: { x: (i % COLUMNS) * COLUMN_GAP, y: Math.floor(i / COLUMNS) * ROW_GAP }, config }));
  const edges: WorkflowEdge[] = [];
  nodes.forEach((node, i) => {
    const next = nodes[i + 1];
    if (!next || node.type === "end") return;
    if (node.type === "action_send_interactive") {
      const options = node.config.interactive_type === "list" ? ["centro", "norte", "sul"] : ["planos", "horarios", "experimental"];
      options.forEach((option, k) => edges.push({ source: node.id, target: nodes[Math.min(nodes.length - 1, i + 1 + k)].id, label: option }));
      return;
    }
    if (node.type === "condition_text_match") {
      edges.push({ source: node.id, target: next.id, label: "sim" }, { source: node.id, target: nodes[0 + 1].id, label: "nao" }, { source: node.id, target: nodes[nodes.length - 1].id, label: "default" });
      return;
    }
    edges.push({ source: node.id, target: next.id });
  });
  return {
    id: "perf-text-workflow",
    workspaceId: "perf-workspace",
    name: "Fluxo sintético de mensagens",
    status: "draft",
    type: "messages",
    graph: { nodes, edges },
    version: 1,
    createdAt: "2026-10-19T00:00:00Z",
    updatedAt: "2026-10-19T00:00:00Z",
    entryPoints: [],
  };
}
