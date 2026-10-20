import type { HandleDefinition, NodeDefinition, Workflow, WorkflowEdge, WorkflowNode, WorkflowNodeType } from "@/lib/workflows/types";

export const FIXTURE_SHAPE = { nodes: 141, edges: 323, code: 52, textMatch: 38, http: 25, groups: 14 } as const;

const LAYER_GAP = 340;
const ROW_GAP = 190;
const ROWS = 11;
const BACKWARD_SHARE = 0.5;

const HTTP_OUTPUTS: HandleDefinition[] = [
  { id: "sucesso", label: "Sucesso" },
  { id: "falha", label: "Falha", optional: true },
  { id: "timeout", label: "Tempo esgotado", optional: true },
];

function definition(type: WorkflowNodeType, category: NodeDefinition["category"], label: string, icon: string, extra: Partial<NodeDefinition> = {}): NodeDefinition {
  return { type, category, label, icon, description: label, scopes: ["shared"], defaultConfig: {}, configSchema: null, ...extra };
}

export const FIXTURE_DEFINITIONS: NodeDefinition[] = [
  definition("trigger_webhook", "trigger", "Webhook", "Webhooks", { testBehavior: "trigger" }),
  definition("action_code", "logic", "Código (JavaScript)", "Code", { testBehavior: "external_call" }),
  definition("condition_text_match", "condition", "Comparar texto", "GitBranch", { outputs: [{ id: "default", label: "Padrão", optional: true }], dynamicHandles: true, testBehavior: "pure" }),
  definition("action_http_request", "action", "Requisição HTTP", "Globe", { outputs: HTTP_OUTPUTS, testBehavior: "external_call" }),
  definition("action_send_text", "messaging", "Enviar texto", "ChatCircle", { testBehavior: "sends_message" }),
  definition("action_send_media", "messaging", "Enviar mídia", "Image", { testBehavior: "sends_message" }),
  definition("action_set_variable", "logic", "Definir variável", "BracketsCurly", { testBehavior: "pure" }),
  definition("wait_duration", "wait", "Aguardar", "Timer", { testBehavior: "waits" }),
  definition("end", "end", "Fim", "FlagCheckered", { testBehavior: "end" }),
];

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const WORK_TYPES: [WorkflowNodeType, number][] = [
  ["action_code", FIXTURE_SHAPE.code],
  ["condition_text_match", FIXTURE_SHAPE.textMatch],
  ["action_http_request", FIXTURE_SHAPE.http],
  ["action_send_text", 1],
  ["action_send_media", 2],
  ["action_set_variable", 4],
  ["wait_duration", 2],
  ["end", 2],
];

function configFor(type: WorkflowNodeType, index: number): Record<string, unknown> {
  switch (type) {
    case "action_code":
      return { display_name: `Passo ${index}`, code: Array.from({ length: 4 + (index % 9) }, (_, line) => `const v${line} = state.get("campo_${line}");`).join("\n"), output_variable: `saida_${index}` };
    case "condition_text_match":
      return { display_name: `Decisão ${index}`, text: `{{node.n${index}.status}}`, match_mode: index % 2 ? "contains" : "exact", cases: [{ value: `ok_${index}` }, { value: `erro_${index}` }] };
    case "action_http_request":
      return { display_name: `Chamada ${index}`, method: index % 3 ? "POST" : "GET", url: `https://api.example.test/v1/etapa/${index}?origem={{trigger.origem}}`, capture_variable: `resposta_${index}` };
    case "action_send_text":
      return { message: "Olá {{lead.nome}}, recebemos seus dados e já estamos verificando tudo para você." };
    case "action_send_media":
      return { media_id: `media-${index}`, _display_media_id: `arquivo-${index}.png`, caption: "Confira o material" };
    case "action_set_variable":
      return { variable: `etapa_${index}`, value: `{{node.n${index}.resultado}}` };
    case "wait_duration":
      return { seconds: 300 };
    default:
      return {};
  }
}

function outputsOf(type: WorkflowNodeType, config: Record<string, unknown>): string[] {
  if (type === "end") return [];
  if (type === "action_http_request") return HTTP_OUTPUTS.map((output) => output.id);
  if (type === "condition_text_match") return [...(config.cases as { value: string }[]).map((c) => c.value), "default"];
  return [""];
}

export function fixtureHandles(nodes: readonly WorkflowNode[]): Record<string, HandleDefinition[]> {
  const handles: Record<string, HandleDefinition[]> = {};
  for (const node of nodes) {
    if (node.type !== "condition_text_match") continue;
    const cases = (node.config.cases as { value: string }[]).map((c) => ({ id: c.value, label: c.value }));
    handles[node.id] = [...cases, { id: "default", label: "Padrão", optional: true }];
  }
  return handles;
}

function shuffledWorkTypes(random: () => number): WorkflowNodeType[] {
  const types = WORK_TYPES.flatMap(([type, count]) => Array<WorkflowNodeType>(count).fill(type));
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

export function fixtureWorkflow(): Workflow {
  const random = seeded(141);
  const workTypes = ["trigger_webhook" as WorkflowNodeType, ...shuffledWorkTypes(random)];
  const placed = workTypes.map((type, i) => {
    const id = `n${i + 1}`;
    const layer = Math.floor(i / ROWS);
    const row = i % ROWS;
    const config = configFor(type, i + 1);
    const node: WorkflowNode = { id, type, position: { x: layer * LAYER_GAP, y: row * ROW_GAP + (layer % 2) * 40 }, config };
    return { node, layer, row, outputs: outputsOf(type, config) };
  });
  const layers = Math.ceil(placed.length / ROWS);
  const at = (layer: number, row: number) => placed[Math.min(placed.length - 1, Math.max(0, layer * ROWS + (row % ROWS)))];
  const edges: WorkflowEdge[] = [];
  for (const { node, layer, row, outputs } of placed) {
    outputs.forEach((handle, k) => {
      const target = at(Math.min(layers - 1, layer + 1), row + k * 3);
      if (target.node.id !== node.id) edges.push({ source: node.id, target: target.node.id, label: handle || undefined });
    });
  }
  const sources = placed.filter((p) => p.outputs.length > 0);
  while (edges.length < FIXTURE_SHAPE.edges) {
    const from = sources[Math.floor(random() * sources.length)];
    const backward = random() < BACKWARD_SHARE;
    const span = 2 + Math.floor(random() * 5);
    const targetLayer = backward ? Math.max(0, from.layer - span) : Math.min(layers - 1, from.layer + span);
    const target = at(targetLayer, Math.floor(random() * ROWS));
    if (target.node.id === from.node.id || target.node.type === "trigger_webhook") continue;
    const handle = from.outputs[Math.floor(random() * from.outputs.length)];
    edges.push({ source: from.node.id, target: target.node.id, label: handle || undefined });
  }
  const groupsPerRow = Math.ceil(FIXTURE_SHAPE.groups / 2);
  const groups: WorkflowNode[] = Array.from({ length: FIXTURE_SHAPE.groups }, (_, g) => {
    const column = g % groupsPerRow;
    const band = Math.floor(g / groupsPerRow);
    const x = column * 2 * LAYER_GAP - 30;
    const y = band * (ROWS / 2) * ROW_GAP - 60;
    return { id: `g${g + 1}`, type: "decoration_background", position: { x, y }, config: { display_name: `Etapa ${g + 1}`, color: ["gray", "blue", "green", "purple"][g % 4], _width: LAYER_GAP - 60, _height: (ROWS / 2) * ROW_GAP } };
  });
  return {
    id: "perf-workflow",
    workspaceId: "perf-workspace",
    name: "Fluxo sintético de desempenho",
    status: "draft",
    type: "messages",
    graph: { nodes: [...groups, ...placed.map((p) => p.node)], edges },
    version: 1,
    createdAt: "2026-10-19T00:00:00Z",
    updatedAt: "2026-10-19T00:00:00Z",
    entryPoints: [
      {
        kind: "webhook",
        nodeId: "n1",
        readiness: "blocked",
        reason: "not_published",
        details: { webhook: { active: true, authMode: "header_token", method: "POST" } },
        lastReceivedAt: "2026-10-19T00:00:00Z",
        lastOutcome: "rejected",
        lastReason: "workflow_not_active",
      },
    ],
  };
}
