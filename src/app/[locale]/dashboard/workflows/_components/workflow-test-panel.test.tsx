import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { SimStep, UseWorkflowSimulationReturn } from "@/hooks/use-workflow-simulation";
import { simConversationMessage } from "@/lib/workflows/sim-message";
import { initialSimSession, type SimEvent, type SimMessageEvent } from "@/lib/workflows/sim-session";
import type { NodeDefinition } from "@/lib/workflows/types";

import { NodeDefinitionsProvider } from "./node-previews/node-definitions";
import { WorkflowTestPanel } from "./workflow-test-panel";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => false }) }));
vi.mock("@/app/actions/conversations", () => ({ getConversationMediaAction: vi.fn() }));
const forms = vi.hoisted(() => ({ getFormAction: vi.fn() }));
vi.mock("@/app/actions/whatsapp-forms", () => forms);

const CATALOG: NodeDefinition[] = [
  { type: "action_http_request", category: "action", label: "HTTP", description: "", icon: "Globe", defaultConfig: {}, configSchema: null, testBehavior: "external_call" },
];

function simulation(overrides: Partial<UseWorkflowSimulationReturn> = {}): UseWorkflowSimulationReturn {
  return {
    ...initialSimSession(),
    status: "waiting_key",
    pendingRealCalls: [],
    connect: vi.fn(),
    start: vi.fn(),
    sendReply: vi.fn(),
    sendKey: vi.fn(),
    cancel: vi.fn(),
    step: vi.fn(),
    resume: vi.fn(),
    runUntil: vi.fn(),
    setBreakpoints: vi.fn(),
    confirmRealCalls: vi.fn(),
    skipRealCalls: vi.fn(),
    dismissRealCalls: vi.fn(),
    retryWithRealCalls: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  };
}

function renderPanel(
  props: Partial<ComponentProps<typeof WorkflowTestPanel>> & Pick<ComponentProps<typeof WorkflowTestPanel>, "simulation">,
  catalog: NodeDefinition[] = CATALOG,
) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <NodeDefinitionsProvider definitions={catalog}>
        <WorkflowTestPanel onClose={vi.fn()} {...props} />
      </NodeDefinitionsProvider>
    </NextIntlClientProvider>,
  );
}

function openStepGroups() {
  for (const group of screen.queryAllByRole("button", { name: /^\d+ etapas? / })) fireEvent.click(group);
}

function step(overrides: Partial<SimStep> = {}): SimStep {
  return {
    id: "s1",
    runId: "sim",
    nodeId: "n55",
    nodeType: "action_http_request",
    status: "executed",
    executedAt: "2026-10-20T12:00:00Z",
    attempt: 1,
    durationMs: 12,
    stepIndex: 0,
    input: { url: "https://api.test" },
    output: { status_code: 200 },
    ...overrides,
  };
}

describe("WorkflowTestPanel", () => {
  it("gives voice workflows a phone keypad instead of a text box", () => {
    const sim = simulation();
    renderPanel({ simulation: sim, voice: true });

    fireEvent.click(screen.getByRole("button", { name: "5" }));
    expect(sim.sendKey).toHaveBeenCalledWith("5");
    expect(screen.queryByPlaceholderText("Escreva uma resposta...")).toBeNull();
  });

  it("plays the workflow's audio in the conversation", () => {
    const sim = simulation({
      events: [{ type: "message", direction: "outbound", text: "Menu principal", msgType: "audio", messageId: "a1", audioUrl: "https://files/menu.mp3" }],
    });
    const { container } = renderPanel({ simulation: sim, voice: true });
    expect(container.querySelector("audio")?.getAttribute("src")).toBe("https://files/menu.mp3");
    expect(screen.getByText("Menu principal")).toBeTruthy();
  });

  it("keeps the text reply for messaging workflows", () => {
    renderPanel({ simulation: simulation({ status: "waiting_reply" }) });
    expect(screen.getByPlaceholderText("Escreva uma resposta...")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Teclado do telefone" })).toBeNull();
  });

  it("opens an executed step with the run viewer's tabs", () => {
    const executed = step();
    renderPanel({ simulation: simulation({ status: "running", steps: [executed], events: [{ type: "step", step: executed }] }), nodeLabel: () => "Login" });
    openStepGroups();
    fireEvent.click(screen.getByRole("button", { name: /Login/ }));
    const detail = screen.getByTestId("step-detail");
    expect(within(detail).getByRole("tab", { name: "Parâmetros usados" })).toBeInTheDocument();
    expect(within(detail).getByRole("tab", { name: "Saída" })).toBeInTheDocument();
  });

  it("pins the output of an executed step into the draft", () => {
    const executed = step();
    const onPinStep = vi.fn();
    renderPanel({ simulation: simulation({ status: "completed", steps: [executed], events: [{ type: "step", step: executed }] }), nodeLabel: () => "Login", onPinStep });
    openStepGroups();
    fireEvent.click(screen.getByRole("button", { name: /Login/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fixar saída" }));
    expect(onPinStep).toHaveBeenCalledWith(executed);
  });

  it("offers no pin when the catalog does not declare the node's test behaviour", () => {
    const executed = step();
    renderPanel({ simulation: simulation({ status: "completed", steps: [executed], events: [{ type: "step", step: executed }] }), nodeLabel: () => "Login", onPinStep: vi.fn() }, []);
    openStepGroups();
    fireEvent.click(screen.getByRole("button", { name: /Login/ }));
    expect(screen.queryByRole("button", { name: "Fixar saída" })).toBeNull();
  });

  it("offers no pin for a failed step or a step already served from a pin", () => {
    const failed = step({ id: "f", status: "failed", error: "500" });
    const pinned = step({ id: "p", stepIndex: 1, pinned: true });
    renderPanel({
      simulation: simulation({ status: "completed", steps: [failed, pinned], events: [{ type: "step", step: failed }, { type: "step", step: pinned }] }),
      nodeLabel: (id) => id,
      onPinStep: vi.fn(),
    });
    openStepGroups();
    for (const row of screen.getAllByRole("button", { name: /n55/ })) fireEvent.click(row);
    expect(screen.queryByRole("button", { name: "Fixar saída" })).toBeNull();
  });

  it("offers Confirmar e repetir on a step refused for an unconfirmed real call", () => {
    const refused = step({ status: "failed", errorKind: "real_call_not_confirmed", error: "chamada real", output: undefined });
    const sim = simulation({ status: "error", steps: [refused], events: [{ type: "step", step: refused }] });
    renderPanel({ simulation: sim, nodeLabel: () => "Login" });
    fireEvent.click(screen.getByRole("button", { name: /Login/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e repetir" }));
    expect(sim.retryWithRealCalls).toHaveBeenCalledWith("n55");
  });

  it("shows the pause toolbar with the paused node and its state", () => {
    const sim = simulation({
      status: "paused",
      pause: { nodeId: "n7", nodeType: "action_code", stepIndex: 2, reason: "breakpoint", state: { cpf: "••••12" } },
      stateVars: { cpf: "••••12" },
    });
    renderPanel({ simulation: sim, nodeLabel: () => "Calcular" });
    const toolbar = screen.getByRole("toolbar");
    expect(within(toolbar).getByText("Pausado antes de Calcular")).toBeInTheDocument();
    expect(within(toolbar).getByText("(ponto de parada)")).toBeInTheDocument();
    expect(screen.queryByText(/••••12/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Variáveis na pausa/ }));
    expect(screen.getByText(/••••12/)).toBeInTheDocument();

    fireEvent.click(within(toolbar).getByRole("button", { name: "Próximo passo" }));
    fireEvent.click(within(toolbar).getByRole("button", { name: "Continuar" }));
    fireEvent.click(within(toolbar).getByRole("button", { name: "Parar" }));
    expect(sim.step).toHaveBeenCalled();
    expect(sim.resume).toHaveBeenCalled();
    expect(sim.cancel).toHaveBeenCalled();
  });

  it("asks about real calls in the page and passes the answer on", () => {
    const sim = simulation({ status: "confirming", pendingRealCalls: ["n1"] });
    renderPanel({ simulation: sim, nodeLabel: () => "Matrícula" });
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/Um nó chama serviços externos de verdade: Matrícula/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Permitir chamadas reais" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Testar sem chamadas reais" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(sim.confirmRealCalls).toHaveBeenCalled();
    expect(sim.skipRealCalls).toHaveBeenCalled();
    expect(sim.dismissRealCalls).toHaveBeenCalled();
  });

  it("shows a refused command and the paused timeout", () => {
    renderPanel({ simulation: simulation({ status: "cancelled", cancelReason: "paused_timeout", refusal: { command: "step", error: "não pausado" } }) });
    expect(screen.getByText("Comando recusado: não pausado")).toBeInTheDocument();
    expect(screen.getByText(/pausado por 10 minutos/)).toBeInTheDocument();
  });

  it("lets a refused reproduction start a plain test instead", () => {
    const sim = simulation({ status: "ready", refusal: { command: "reproduce_run", error: "Esta execução é de outro fluxo." } });
    renderPanel({ simulation: sim });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sem reproduzir" }));
    expect(sim.start).toHaveBeenCalledWith();
  });

  it("shows the reproduction banner with the run, its version and the pinned nodes, and the version note", () => {
    const onViewVersion = vi.fn();
    renderPanel({
      simulation: simulation({ status: "paused", reproducing: { runId: "abcdef123456", workflowVersion: 3, pinnedNodes: ["n1", "n2"] } }),
      nodeLabel: (id) => (id === "n1" ? "Login" : "Contrato"),
      versionDiffers: () => true,
      onViewVersion,
    });
    const banner = screen.getByTestId("reproducing-banner");
    expect(within(banner).getByText(/Reproduzindo a execução abcdef12/)).toBeInTheDocument();
    expect(within(banner).getByText("v3")).toBeInTheDocument();
    expect(within(banner).getByText(/2 nós fixados com as respostas gravadas: Login, Contrato/)).toBeInTheDocument();
    fireEvent.click(within(banner).getByRole("button", { name: "Ver na versão v3" }));
    expect(onViewVersion).toHaveBeenCalledWith(3);
  });

  it("warns that the test runs the saved draft when there are unsaved edits", () => {
    renderPanel({ simulation: simulation({ status: "ready" }), unsaved: true });
    expect(screen.getByText(/O teste usa o rascunho salvo/)).toBeInTheDocument();
  });
});

const chat = ptMessages.workflowDebug.chat;

function wire(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    entryId: "sim-entry",
    entryType: "whatsapp",
    channel: "whatsapp",
    messageType: "ai_response",
    direction: "OUTBOUND",
    from: "sim-business-phone",
    to: "5511999990000",
    text: "Quer continuar?",
    createdAt: "2026-10-20T12:00:00Z",
    updatedAt: "2026-10-20T12:00:00Z",
    ...overrides,
  };
}

function messageEvent(id: string, overrides: Record<string, unknown> = {}): SimMessageEvent {
  const message = simConversationMessage(wire(id, overrides))!;
  return {
    type: "message",
    direction: message.direction === "INBOUND" ? "inbound" : "outbound",
    text: message.text,
    msgType: message.message_type,
    messageId: id,
    message,
  };
}

const BUTTONS_EVENT = messageEvent("m1", {
  metadata: { buttons: { body_text: "Quer continuar?", buttons: [{ id: "sim", title: "Sim" }, { id: "nao", title: "Não" }] } },
});

describe("WorkflowTestPanel conversation", () => {
  it("renders what the customer sees with the CRM bubble, buttons idle while the run does not wait", () => {
    renderPanel({ simulation: simulation({ status: "running", events: [BUTTONS_EVENT] }) });
    expect(screen.getByText("Quer continuar?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sim" })).toBeDisabled();
  });

  it("sends a tapped button as the customer selection while the run waits for a reply", () => {
    const sim = simulation({ status: "waiting_reply", events: [BUTTONS_EVENT] });
    renderPanel({ simulation: sim });
    fireEvent.click(screen.getByRole("button", { name: "Sim" }));
    expect(sim.sendReply).toHaveBeenCalledWith({ kind: "selection", choice: { kind: "button", id: "sim", title: "Sim" } });
  });

  it("shows the tester's reply on the right as their own graphite bubble and the workflow's message on the left, as the team chat shows me and the others", () => {
    const reply = messageEvent("in-1", { direction: "INBOUND", messageType: "user_message", text: "Sim, quero", sentBy: { kind: "contact", id: "c" }, from: "5511999990000" });
    const { container } = renderPanel({ simulation: simulation({ status: "running", events: [BUTTONS_EVENT, reply] }) });
    expect(screen.getByText("Sim, quero")).toBeInTheDocument();
    expect(container.querySelector('[data-msg-id="in-1"]')?.className).toContain("justify-end");
    expect(container.querySelector('[data-msg-id="in-1"] [data-bubble]')?.className).toContain("bg-foreground text-background");
    expect(container.querySelector('[data-msg-id="m1"]')?.className).toContain("justify-start");
    expect(container.querySelector('[data-msg-id="m1"] [data-bubble]')?.className).toContain("bg-card");
    expect(screen.queryByText(chat.customerSelf)).toBeNull();
    expect(screen.queryByText("5511999990000")).toBeNull();
  });

  it("uses the team chat header: the title, the status as a solid chip, and close", () => {
    const onClose = vi.fn();
    renderPanel({ simulation: simulation({ status: "error" }), onClose });
    expect(screen.getByRole("heading", { name: "Simulação" }).className).toContain("text-sm font-semibold");
    expect(screen.getByText("Erro").className).toContain("bg-destructive");
    fireEvent.click(screen.getByRole("button", { name: "Fechar simulação" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an ignored interactive reply as a muted line", () => {
    renderPanel({ simulation: simulation({ status: "waiting_reply", events: [{ type: "reply_ignored", nodeId: "n2" }] }) });
    expect(screen.getByText(chat.replyIgnored)).toBeInTheDocument();
  });

  it("sends typed text as a text reply", () => {
    const sim = simulation({ status: "waiting_reply" });
    renderPanel({ simulation: sim });
    const input = screen.getByPlaceholderText("Escreva uma resposta...");
    fireEvent.change(input, { target: { value: "oi" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(sim.sendReply).toHaveBeenCalledWith({ kind: "text", text: "oi" });
  });

  it("sends a location from the composer and refuses a position the channel would not deliver", () => {
    const sim = simulation({ status: "waiting_reply" });
    renderPanel({ simulation: sim });
    fireEvent.click(screen.getByRole("button", { name: chat.sendLocation }));
    fireEvent.change(screen.getByLabelText(chat.latitude), { target: { value: "95" } });
    fireEvent.change(screen.getByLabelText(chat.longitude), { target: { value: "-46.6" } });
    fireEvent.click(screen.getByRole("button", { name: chat.send }));
    expect(screen.getByText(chat.invalidLocation)).toBeInTheDocument();
    expect(sim.sendReply).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(chat.latitude), { target: { value: "-23.5" } });
    fireEvent.change(screen.getByLabelText(chat.placeName), { target: { value: "Campus" } });
    fireEvent.click(screen.getByRole("button", { name: chat.send }));
    expect(sim.sendReply).toHaveBeenCalledWith({ kind: "location", latitude: -23.5, longitude: -46.6, name: "Campus" });
  });

  it("sends a media url with its caption from the composer", () => {
    const sim = simulation({ status: "waiting_trigger" });
    renderPanel({ simulation: sim });
    fireEvent.click(screen.getByRole("button", { name: chat.sendMedia }));
    fireEvent.change(screen.getByLabelText(chat.mediaUrl), { target: { value: "http://cdn.test/rg.png" } });
    fireEvent.click(screen.getByRole("button", { name: chat.send }));
    expect(screen.getByText(chat.invalidMedia)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(chat.mediaUrl), { target: { value: "https://cdn.test/rg.png" } });
    fireEvent.change(screen.getByLabelText(chat.caption), { target: { value: "Meu RG" } });
    fireEvent.click(screen.getByRole("button", { name: chat.send }));
    expect(sim.sendReply).toHaveBeenCalledWith({ kind: "media", media: "image", url: "https://cdn.test/rg.png", caption: "Meu RG" });
  });

  it("shows what a simulated CRM node would do and its notice in the timeline, not as a failure", () => {
    const simulated = step({
      nodeType: "action_add_label",
      simulated: true,
      notice: "saída fixada indisponível para você",
      output: { would_do: [{ kind: "label", action: "add", description: "Adicionaria a etiqueta Quente" }] },
    });
    renderPanel({ simulation: simulation({ status: "completed", steps: [simulated], events: [{ type: "step", step: simulated }] }), nodeLabel: () => "Etiquetar" });
    expect(screen.getByText("Simulado: Adicionaria a etiqueta Quente")).toBeInTheDocument();
    expect(screen.getByText("saída fixada indisponível para você")).toBeInTheDocument();
  });

  it("renders the messages a send step sent with the CRM bubble in its detail", () => {
    const sent = step({ nodeType: "action_send_message", output: { sent_messages: [wire("m9", { text: "Bem-vindo à matrícula" })] } });
    renderPanel({ simulation: simulation({ status: "completed", steps: [sent], events: [{ type: "step", step: sent }] }), nodeLabel: () => "Boas-vindas" });
    openStepGroups();
    fireEvent.click(screen.getByRole("button", { name: /Boas-vindas/ }));
    const detail = screen.getByTestId("step-detail");
    expect(within(detail).getByText(chat.sentMessages)).toBeInTheDocument();
    expect(within(detail).getByText("Bem-vindo à matrícula")).toBeInTheDocument();
  });

  it("labels a step's sent message with the same node name the chat gives it, never the generic workflow sender", () => {
    const sentWire = { text: "Bem-vindo à matrícula", sentBy: { kind: "workflow", id: "wf" } };
    const sent = step({ nodeId: "n7", nodeType: "action_send_message", output: { sent_messages: [wire("m9", sentWire)] } });
    const chatMessage = { ...messageEvent("m9", sentWire), nodeId: "n7", nodeName: "Boas-vindas da matrícula" };
    renderPanel({ simulation: simulation({ status: "completed", steps: [sent], events: [chatMessage, { type: "step", step: sent }] }), nodeLabel: () => "Enviar Texto" });
    openStepGroups();
    fireEvent.click(screen.getByRole("button", { name: /Enviar Texto/ }));
    const detail = screen.getByTestId("step-detail");
    expect(within(detail).getByText("Boas-vindas da matrícula")).toBeInTheDocument();
    expect(within(detail).queryByText(ptMessages.crm.messageSender.workflow)).toBeNull();
  });

  it("windows a long timeline to the newest events and reveals older ones on demand", () => {
    const events: SimEvent[] = Array.from({ length: 100 }, (_, index) => ({ type: "error", message: `falha ${index}` }));
    renderPanel({ simulation: simulation({ status: "error", events }) });
    expect(screen.queryByText("falha 0")).toBeNull();
    expect(screen.getByText("falha 99")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar 20 eventos anteriores" }));
    expect(screen.getByText("falha 0")).toBeInTheDocument();
  });
});

const formCopy = ptMessages.workflowDebug.form;

function formDetail() {
  const version = (fields: Array<Record<string, unknown>>) => ({
    id: "v1",
    workspaceId: "ws",
    formId: "form-9",
    number: 1,
    createdAt: "2026-10-20T10:00:00Z",
    document: {
      schema: 1,
      categories: ["LEAD_GENERATION"],
      screens: [{ key: "s1", title: "Dados", submitLabel: "Enviar", route: {}, blocks: fields.map((field, index) => ({ key: `b${index}`, field })) }],
    },
  });
  return {
    form: { id: "form-9", workspaceId: "ws", name: "Matrícula", kind: "built", draftVersionId: "v2", publishedVersionId: "v1", createdAt: "", updatedAt: "" },
    draft: version([{ key: "draft_only", kind: "short_text", label: "Rascunho", required: false, sensitive: false }]),
    published: version([
      { key: "name", kind: "short_text", label: "Nome", required: true, sensitive: false },
      { key: "course", kind: "single_choice_radio", label: "Curso", required: false, sensitive: false, options: [{ id: "adm", title: "Administração" }, { id: "dir", title: "Direito" }] },
      { key: "optin", kind: "opt_in", label: "Aceito receber mensagens", required: false, sensitive: false },
    ]),
    publications: [],
  };
}

describe("WorkflowTestPanel session ends and forms", () => {
  it("explains a test that ended before it started and restarts it", () => {
    const sim = simulation({ status: "cancelled", cancelReason: "start_timeout" });
    renderPanel({ simulation: sim });
    expect(screen.getByText(ptMessages.workflowDebug.session.startTimeout)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ptMessages.workflowDebug.session.restart }));
    expect(sim.start).toHaveBeenCalledTimes(1);
  });

  it("fills the waiting form from its published version and sends what production would give the flow", async () => {
    forms.getFormAction.mockResolvedValue({ data: formDetail(), error: null });
    const sim = simulation({ status: "waiting_form", waitingForm: { nodeId: "f1", formId: "form-9" } });
    renderPanel({ simulation: sim });

    fireEvent.change(await screen.findByLabelText("Nome (obrigatório)"), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("radio", { name: "Direito" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Aceito receber mensagens" }));
    expect(screen.queryByLabelText("Rascunho")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: formCopy.submit }));

    expect(forms.getFormAction).toHaveBeenCalledWith("form-9", expect.any(AbortSignal));
    expect(sim.sendReply).toHaveBeenCalledWith({ kind: "form", answers: { name: "Ana", course: "Direito", optin: "Sim" } });
  });

  it("can leave the form unanswered to follow the no reply exit", async () => {
    forms.getFormAction.mockResolvedValue({ data: formDetail(), error: null });
    const sim = simulation({ status: "waiting_form", waitingForm: { nodeId: "f1", formId: "form-9" } });
    renderPanel({ simulation: sim });
    fireEvent.click(await screen.findByRole("button", { name: formCopy.noReply }));
    expect(sim.sendReply).toHaveBeenCalledWith({ kind: "form_unanswered" });
  });

  it("offers no answers it cannot build when the form cannot be read", async () => {
    forms.getFormAction.mockResolvedValue({ data: null, error: { message: "boom" } });
    const sim = simulation({ status: "waiting_form", waitingForm: { nodeId: "f1", formId: "form-9" } });
    renderPanel({ simulation: sim });
    expect(await screen.findByText(formCopy.loadFailed)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: formCopy.submit })).toBeNull();
    expect(screen.getByRole("button", { name: formCopy.noReply })).toBeInTheDocument();
  });
});

describe("WorkflowTestPanel timeline from the customer's perspective", () => {
  const LABELS: Record<string, string> = { n1: "Mensagem Recebida", n2: "Enviar Texto", n3: "Aguardar Duração", n4: "Enviar Mídia" };
  const nodeLabel = (id: string) => LABELS[id];
  const greeting = messageEvent("in-1", { direction: "INBOUND", messageType: "user_message", text: "Ola", sentBy: { kind: "contact", id: "c" }, from: "5511999990000" });
  const welcomeWire = { text: "Bem-vindo", sentBy: { kind: "workflow", id: "wf" }, deliveryStatus: "delivered" };
  const welcome = { ...messageEvent("out-1", welcomeWire), nodeId: "n2" };
  const received = step({ id: "s1", nodeId: "n1", nodeType: "trigger_message_received", durationMs: 2 });
  const sentText = step({ id: "s2", nodeId: "n2", nodeType: "action_send_message", stepIndex: 1, durationMs: 4 });
  const waited = step({ id: "s3", nodeId: "n3", nodeType: "action_wait", stepIndex: 2, durationMs: 6 });
  const sentMedia = step({ id: "s4", nodeId: "n4", nodeType: "action_send_media", stepIndex: 3, durationMs: 2 });

  it("names the workflow message after the node that sent it and shows no business ticks or chip on it", () => {
    const { container } = renderPanel({ simulation: simulation({ status: "running", events: [greeting, welcome] }), nodeLabel });
    const bubble = container.querySelector('[data-msg-id="out-1"]')!;
    expect(bubble.className).toContain("justify-start");
    expect(within(bubble as HTMLElement).getByText("Enviar Texto")).toBeInTheDocument();
    expect(within(bubble as HTMLElement).queryByText(ptMessages.crm.messageSender.workflow)).toBeNull();
    expect(bubble.querySelectorAll("[data-bubble] svg")).toHaveLength(0);
  });

  it("names the source once for a stack of messages it sent, the way the team chat names an author once", () => {
    const second = { ...messageEvent("out-2", { ...welcomeWire, text: "Vamos começar" }), nodeId: "n2" };
    const { container } = renderPanel({ simulation: simulation({ status: "running", events: [greeting, welcome, second] }), nodeLabel });
    expect(screen.getAllByText("Enviar Texto")).toHaveLength(1);
    expect(container.querySelector('[data-msg-id="out-1"]')).toHaveAttribute("data-group-position", "first");
    expect(container.querySelector('[data-msg-id="out-2"]')).toHaveAttribute("data-group-position", "last");
  });

  it("starts a new stack after a step line, which sits between the bubbles", () => {
    const second = { ...messageEvent("out-2", { ...welcomeWire, text: "Vamos começar" }), nodeId: "n2" };
    renderPanel({ simulation: simulation({ status: "running", events: [welcome, { type: "step", step: sentText }, second] }), nodeLabel });
    expect(screen.getAllByText("Enviar Texto", { selector: "p" })).toHaveLength(2);
  });

  it("names the workflow message by the node name the backend sent with it, over the canvas label", () => {
    const named = { ...welcome, nodeId: "n1", nodeName: "Boas-vindas" };
    const { container } = renderPanel({ simulation: simulation({ status: "running", events: [greeting, named] }), nodeLabel });
    const bubble = container.querySelector('[data-msg-id="out-1"]') as HTMLElement;
    expect(within(bubble).getByText("Boas-vindas")).toBeInTheDocument();
    expect(within(bubble).queryByText("Mensagem Recebida")).toBeNull();
  });

  it("names a workflow message without a node as the workflow", () => {
    const { container } = renderPanel({ simulation: simulation({ status: "running", events: [messageEvent("out-1", welcomeWire)] }), nodeLabel });
    const bubble = container.querySelector('[data-msg-id="out-1"]') as HTMLElement;
    expect(within(bubble).getByText(ptMessages.crm.messageSender.workflow)).toBeInTheDocument();
  });

  it("folds two or more steps between two messages into one compact row and keeps the chat in order", () => {
    renderPanel({
      simulation: simulation({
        status: "completed",
        events: [greeting, { type: "step", step: received }, welcome, { type: "step", step: sentText }, { type: "step", step: waited }, { type: "step", step: sentMedia }],
      }),
      nodeLabel,
    });
    const items = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    const order = ["Ola", "Mensagem Recebida", "Bem-vindo", "3 etapas"].map((text) => items.findIndex((item) => item.includes(text)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(screen.queryByRole("button", { name: /Aguardar Duração/ })).toBeNull();

    const group = screen.getByRole("button", { name: /3 etapas/ });
    expect(group.className).toContain("border-dashed");
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(group.textContent).toMatch(/12\s?ms/);
    fireEvent.click(group);
    expect(group).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: /Aguardar Duração/ }));
    expect(screen.getByTestId("step-detail")).toBeInTheDocument();
  });

  it("shows a lone step between two messages as one compact centred row that opens its detail in one click", () => {
    renderPanel({ simulation: simulation({ status: "completed", events: [greeting, { type: "step", step: received }, welcome] }), nodeLabel });
    expect(screen.queryByRole("button", { name: /^d+ etapas? / })).toBeNull();
    const row = screen.getByRole("button", { name: /Mensagem Recebida/ });
    const item = row.closest("li")!;
    expect(item).toHaveAttribute("data-compact", "true");
    expect(item.className).toContain("items-center");
    expect(row.className).toContain("border-dashed");
    fireEvent.click(row);
    expect(within(item).getByTestId("step-detail")).toBeInTheDocument();
  });

  it("keeps a failed step in view outside the folded group, as a full row", () => {
    const failed = step({ id: "s9", nodeId: "n4", stepIndex: 4, status: "failed", error: "500" });
    renderPanel({ simulation: simulation({ status: "error", events: [{ type: "step", step: received }, { type: "step", step: sentText }, { type: "step", step: failed }] }), nodeLabel });
    expect(screen.getByRole("button", { name: /Enviar Mídia/ }).closest("li")).not.toHaveAttribute("data-compact");
    expect(screen.getByRole("button", { name: /2 etapas/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps a simulated effect line in view while its step is folded", () => {
    const simulated = step({ simulated: true, output: { would_do: [{ kind: "label", action: "add", description: "Adicionaria a etiqueta Quente" }] } });
    const before = step({ id: "s0", stepIndex: 1 });
    renderPanel({ simulation: simulation({ status: "completed", events: [{ type: "step", step: before }, { type: "step", step: simulated }] }), nodeLabel: () => "Etiquetar" });
    expect(screen.getByText("Simulado: Adicionaria a etiqueta Quente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Etiquetar/ })).toBeNull();
  });

  it("keeps the buttons of a workflow message on the left clickable while the run waits", () => {
    const sim = simulation({ status: "waiting_reply", events: [{ ...BUTTONS_EVENT, nodeId: "n2" }] });
    const { container } = renderPanel({ simulation: sim, nodeLabel });
    expect(container.querySelector('[data-msg-id="m1"]')?.className).toContain("justify-start");
    fireEvent.click(screen.getByRole("button", { name: "Não" }));
    expect(sim.sendReply).toHaveBeenCalledWith({ kind: "selection", choice: { kind: "button", id: "nao", title: "Não" } });
  });
});

describe("WorkflowTestPanel step detail warnings", () => {
  it("warns about references that had no value in the step", () => {
    const sent = step({ unresolvedRefs: ["input.telefone", "lead_name"] });
    renderPanel({ simulation: simulation({ status: "running", steps: [sent], events: [{ type: "step", step: sent }] }), nodeLabel: () => "Enviar" });
    openStepGroups();
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    const detail = screen.getByTestId("step-detail");
    expect(within(detail).getByText("Referências sem valor nesta etapa: input.telefone, lead_name")).toBeInTheDocument();
  });

  it("shows the failure text of a failed step, such as the template fix for a closed window, without opening a tab", () => {
    const failed = step({ status: "failed", error: "Janela de atendimento fechada: use um template para falar com o cliente fora da janela." });
    renderPanel({ simulation: simulation({ status: "error", steps: [failed], events: [{ type: "step", step: failed }] }), nodeLabel: () => "Enviar" });
    fireEvent.click(screen.getByRole("button", { name: /Enviar/ }));
    const detail = screen.getByTestId("step-detail");
    expect(within(detail).getAllByText("Janela de atendimento fechada: use um template para falar com o cliente fora da janela.").length).toBeGreaterThan(0);
  });
});
