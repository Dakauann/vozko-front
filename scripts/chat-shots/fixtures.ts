import type { SimStep, UseWorkflowSimulationReturn } from "@/hooks/use-workflow-simulation";
import type { TeamChatMessage, TeamChatThread } from "@/lib/team-chat/types";
import { simConversationMessage } from "@/lib/workflows/sim-message";
import { initialSimSession, type SimEvent, type SimMessageEvent, type SimStatus } from "@/lib/workflows/sim-session";
import type { NodeDefinition } from "@/lib/workflows/types";

const TODAY = new Date();
TODAY.setHours(14, 2, 0, 0);

function at(minuteOffset: number, second = 0): string {
  return new Date(TODAY.getTime() + minuteOffset * 60_000 + second * 1000).toISOString();
}

export const NODE_LABELS: Record<string, string> = {
  n1: "Mensagem recebida",
  n2: "Boas-vindas",
  n3: "Aguardar 2 s",
  n4: "Enviar folheto",
  n5: "Escolher curso",
  n6: "Etiquetar lead",
  n7: "Agente de matrícula",
  n8: "Salvar curso",
  n9: "Escolher turno",
  n10: "Consultar vagas",
};

export const NODE_DEFINITIONS: NodeDefinition[] = [
  { type: "action_http_request", category: "action", label: "HTTP", description: "", icon: "Globe", defaultConfig: {}, configSchema: null, testBehavior: "external_call" },
];

function outbound(id: string, second: number, fields: Record<string, unknown>) {
  return {
    id,
    entryId: "sim-entry",
    entryType: "whatsapp",
    channel: "whatsapp",
    messageType: "ai_response",
    direction: "OUTBOUND",
    sentBy: { kind: "workflow", id: "wf" },
    from: "sim-business-phone",
    to: "5511999990000",
    text: "",
    deliveryStatus: "sent",
    createdAt: at(0, second),
    updatedAt: at(0, second),
    ...fields,
  };
}

function inbound(id: string, second: number, fields: Record<string, unknown>) {
  return outbound(id, second, { direction: "INBOUND", messageType: "user_message", sentBy: { kind: "contact", id: "5511999990000" }, from: "5511999990000", to: "sim-business-phone", ...fields });
}

function message(wire: Record<string, unknown>, nodeId?: string): SimMessageEvent {
  const converted = simConversationMessage(wire)!;
  return {
    type: "message",
    direction: converted.direction === "INBOUND" ? "inbound" : "outbound",
    text: converted.text,
    msgType: converted.message_type,
    messageId: converted.id,
    message: converted,
    nodeId,
  };
}

let stepCounter = 0;

function step(nodeId: string, nodeType: string, durationMs: number, overrides: Partial<SimStep> = {}): SimEvent {
  stepCounter += 1;
  return {
    type: "step",
    step: {
      id: `s${stepCounter}`,
      runId: "sim",
      nodeId,
      nodeType,
      status: "executed",
      executedAt: at(0, stepCounter),
      attempt: 1,
      durationMs,
      stepIndex: stepCounter,
      input: {},
      output: {},
      ...overrides,
    },
  };
}

function waitingEvents(): SimEvent[] {
  stepCounter = 0;
  return [
    message(inbound("in-1", 0, { text: "Oi, quero fazer minha matrícula" })),
    step("n1", "trigger_message_received", 2),
    message(outbound("out-1", 2, { text: "Olá, Ana! Sou a assistente da secretaria." }), "n2"),
    message(outbound("out-2", 3, { text: "Vou te ajudar com a matrícula em poucos passos." }), "n2"),
    step("n2", "action_send_message", 41),
    step("n3", "action_wait", 2004),
    message(
      outbound("out-3", 6, {
        messageType: "media",
        mediaType: "image",
        text: "Folheto do semestre 2027.1",
        media: { url: "/fixtures/folheto.png", mimeType: "image/png", layout: { width: 677, height: 369 } },
      }),
      "n4",
    ),
    step("n4", "action_send_media", 88),
    message(
      outbound("out-4", 7, {
        text: "Qual curso te interessa?",
        metadata: { buttons: { body_text: "Qual curso te interessa?", buttons: [{ id: "adm", title: "Administração" }, { id: "dir", title: "Direito" }, { id: "enf", title: "Enfermagem" }] } },
      }),
      "n5",
    ),
    step("n5", "action_send_buttons", 37),
    message(inbound("in-2", 20, { text: "Direito", metadata: { interactive_reply: { id: "dir", title: "Direito" } } })),
    step("n6", "action_add_label", 3, { simulated: true, output: { would_do: [{ kind: "label", action: "add", description: "Adicionaria a etiqueta Direito" }] } }),
    step("n8", "action_update_lead", 6),
    message(outbound("out-5", 23, { sentBy: { kind: "ai", id: "agent-1" }, senderName: "Bia", text: "Ótima escolha! Direito tem aulas presenciais e estágio a partir do 3º semestre." }), "n7"),
    step("n7", "action_ai_agent", 1830),
    message(
      outbound("out-6", 25, {
        text: "Em qual turno você prefere estudar?",
        metadata: { list: { body_text: "Em qual turno você prefere estudar?", button_text: "Ver turnos", sections: [{ title: "Turnos", rows: [{ id: "m", title: "Manhã", description: "08h às 12h" }, { id: "t", title: "Tarde" }, { id: "n", title: "Noite", description: "19h às 22h30" }] }] } },
      }),
      "n9",
    ),
    step("n9", "action_send_list", 0, { status: "waiting" }),
    { type: "waiting_reply", nodeId: "n9", timeoutSeconds: 300 },
  ];
}

function errorEvents(): SimEvent[] {
  const events = waitingEvents();
  return [
    ...events,
    message(inbound("in-3", 40, { text: "Noite", metadata: { interactive_reply: { id: "n", title: "Noite" } } })),
    step("n10", "action_http_request", 512, { status: "failed", error: "HTTP 503", errorKind: "http_status" }),
    { type: "error", message: "O nó Consultar vagas falhou: serviço indisponível (503)" },
  ];
}

function simulation(status: SimStatus, events: SimEvent[]): UseWorkflowSimulationReturn {
  const ignore = () => undefined;
  return {
    ...initialSimSession(),
    status,
    events,
    steps: events.flatMap((event) => (event.type === "step" ? [event.step] : [])),
    pendingRealCalls: [],
    connect: ignore,
    start: ignore,
    sendReply: ignore,
    sendKey: ignore,
    cancel: ignore,
    step: ignore,
    resume: ignore,
    runUntil: ignore,
    setBreakpoints: ignore,
    confirmRealCalls: ignore,
    skipRealCalls: ignore,
    dismissRealCalls: ignore,
    retryWithRealCalls: ignore,
    reset: ignore,
  };
}

export const SIMULATIONS = {
  waiting: () => simulation("waiting_reply", waitingEvents()),
  error: () => simulation("error", errorEvents()),
};

export const ME = "u-me";

const MEMBERS = [
  { user_id: ME, name: "Ana Souza", picture: "", role: "admin" as const, last_read_seq: 9 },
  { user_id: "u-bia", name: "Bia Lima", picture: "", role: "member" as const, last_read_seq: 9 },
  { user_id: "u-caio", name: "Caio Mendes", picture: "", role: "member" as const, last_read_seq: 7 },
];

export const THREAD: TeamChatThread = {
  id: "t-1",
  kind: "group",
  title: "Secretaria",
  created_by: ME,
  last_seq: 9,
  last_message_at: at(12),
  created_at: at(-60),
  me: { role: "admin", last_read_seq: 9, muted: false },
  members: MEMBERS,
  unread: 0,
  unread_mentions: 0,
};

function teamMessage(seq: number, minute: number, author: string, body: string, overrides: Partial<TeamChatMessage> = {}): TeamChatMessage {
  const member = MEMBERS.find((m) => m.user_id === author)!;
  return { id: `m-${seq}`, thread_id: "t-1", seq, author_id: author, author_name: member.name, kind: "text", body, subject_ids: [], mentions: [], created_at: at(minute), ...overrides };
}

export const TEAM_MESSAGES: TeamChatMessage[] = [
  teamMessage(1, -60, ME, "Secretaria", { kind: "system", event: "created" }),
  teamMessage(2, 0, "u-bia", "Gente, a Ana Paula pediu o folheto do semestre 2027.1"),
  teamMessage(3, 1, "u-bia", "Alguém tem a versão nova?"),
  teamMessage(4, 3, ME, "Tenho sim, já mando pelo fluxo de matrícula."),
  teamMessage(5, 3, ME, "Ela quer Direito, à noite."),
  teamMessage(6, 5, "u-caio", "Turma da noite está quase cheia, confirma as vagas antes de prometer."),
  teamMessage(7, 6, "u-caio", "Caio Mendes", { kind: "system", event: "members_added", subject_ids: ["u-caio"] }),
  teamMessage(8, 10, ME, "Boa, vou consultar agora.", { reply_to_id: "m-6" }),
  teamMessage(9, 12, "u-bia", "Obrigada! 🙌"),
];
