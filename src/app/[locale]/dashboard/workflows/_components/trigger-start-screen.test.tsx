import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { UseWorkflowSimulationReturn } from "@/hooks/use-workflow-simulation";
import { initialSimSession } from "@/lib/workflows/sim-session";
import type { TriggerTestInput } from "@/lib/workflows/test-inputs";
import type { TriggerInputSpec } from "@/lib/workflows/trigger-input";
import type { NodeDefinition } from "@/lib/workflows/types";

import { NodeDefinitionsProvider } from "./node-previews/node-definitions";
import { WorkflowTestPanel } from "./workflow-test-panel";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => false }) }));
vi.mock("@/app/actions/conversations", () => ({ getConversationMediaAction: vi.fn() }));
vi.mock("@/app/actions/whatsapp-forms", () => ({ getFormAction: vi.fn() }));
const actions = vi.hoisted(() => ({ getTriggerLastInputAction: vi.fn() }));
vi.mock("@/app/actions/workflows", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const COPY = ptMessages.workflowDebug.triggerInput;

const CATALOG: NodeDefinition[] = [
  { type: "trigger_agent_call", category: "trigger", label: "Agente", description: "", icon: "Robot", defaultConfig: {}, configSchema: null },
  { type: "trigger_webhook", category: "trigger", label: "Webhook", description: "", icon: "Globe", defaultConfig: {}, configSchema: null },
];

const AGENT: TriggerInputSpec = {
  nodeId: "t1",
  triggerType: "trigger_agent_call",
  label: "Chamado por agente IA",
  shape: "fields",
  fields: [
    { key: "cpf", type: "text", required: true, description: "CPF do candidato", example: "000.000.000-00", readBy: ["n2", "n3"] },
    { key: "agent.name", type: "text", required: false, description: "", example: "Agente de teste", readBy: ["n4"] },
    { key: "idade", type: "number", required: false, description: "", example: 18, readBy: [] },
    { key: "aceite", type: "boolean", required: false, description: "", example: true, readBy: [] },
    { key: "endereco", type: "object", required: false, description: "", example: null, readBy: [] },
  ],
  sample: null,
  readKeys: [],
  issues: [{ code: "read_not_declared", key: "telefone" }],
  window: null,
  windowEditable: false,
  acceptedEvents: [],
};

const WEBHOOK: TriggerInputSpec = {
  nodeId: "t2",
  triggerType: "trigger_webhook",
  label: "Webhook de matrícula",
  shape: "json",
  fields: [],
  sample: { event: "lead.created", body: { nome: "" } },
  readKeys: ["body.nome"],
  issues: [],
  window: null,
  windowEditable: false,
  acceptedEvents: [],
};

const MESSAGE: TriggerInputSpec = { ...WEBHOOK, nodeId: "t3", triggerType: "trigger_message_received", label: "Mensagem recebida", shape: "message", sample: null, readKeys: [] };

function simulation(overrides: Partial<UseWorkflowSimulationReturn> = {}): UseWorkflowSimulationReturn {
  return {
    ...initialSimSession(),
    status: "ready",
    triggers: [AGENT, WEBHOOK],
    defaultTriggerNodeId: "t1",
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

function renderPanel(props: Partial<ComponentProps<typeof WorkflowTestPanel>> & Pick<ComponentProps<typeof WorkflowTestPanel>, "simulation">) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <NodeDefinitionsProvider definitions={CATALOG}>
        <WorkflowTestPanel onClose={vi.fn()} workflowId="wf-1" {...props} />
      </NodeDefinitionsProvider>
    </NextIntlClientProvider>,
  );
}

function fieldBlock(key: string): HTMLElement {
  return document.querySelector(`[data-field="${key}"]`) as HTMLElement;
}

beforeEach(() => {
  actions.getTriggerLastInputAction.mockReset();
});

describe("Testar start screen", () => {
  it("asks how the test starts, offers one chip per trigger with the default first, and starts from the chosen one with its input", () => {
    const sim = simulation({ triggers: [WEBHOOK, AGENT] });
    renderPanel({ simulation: sim });

    expect(screen.getByRole("heading", { name: COPY.title })).toBeInTheDocument();
    const chips = within(screen.getByRole("group", { name: COPY.chooser })).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Chamado por agente IA", "Webhook de matrícula"]);
    expect(chips[0]).toHaveAttribute("aria-pressed", "true");

    fireEvent.change(screen.getByLabelText("cpf"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("idade"), { target: { value: "31" } });
    fireEvent.click(screen.getByRole("switch", { name: "aceite" }));
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).toHaveBeenCalledWith({ trigger: { triggerNodeId: "t1", input: { cpf: "123", idade: 31, aceite: true } } });

    fireEvent.click(chips[1]);
    expect(screen.getByLabelText(COPY.body)).toHaveValue(JSON.stringify(WEBHOOK.sample, null, 2));
    expect(screen.getByText("body.nome")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).toHaveBeenLastCalledWith({ trigger: { triggerNodeId: "t2", input: WEBHOOK.sample } });
  });

  it("shows no chooser for a single trigger", () => {
    renderPanel({ simulation: simulation({ triggers: [AGENT] }) });
    expect(screen.queryByRole("group", { name: COPY.chooser })).toBeNull();
  });

  it("shows each field's description, required mark and readers, and focuses a reader node", () => {
    const onFocusNode = vi.fn();
    renderPanel({ simulation: simulation(), onFocusNode, nodeLabel: (id) => ({ n2: "Validar CPF", n3: "Salvar lead" })[id] });

    const cpf = fieldBlock("cpf");
    expect(within(cpf).getByText("CPF do candidato")).toBeInTheDocument();
    expect(within(cpf).getByText(`(${COPY.required})`)).toBeInTheDocument();
    fireEvent.click(within(cpf).getByRole("button", { name: "usado em 2 nós" }));
    fireEvent.click(within(cpf).getByRole("button", { name: "Salvar lead" }));
    expect(onFocusNode).toHaveBeenCalledWith("n3");

    fireEvent.click(within(fieldBlock("agent.name")).getByRole("button", { name: "usado em 1 nó" }));
    expect(onFocusNode).toHaveBeenLastCalledWith("n4");

    expect(screen.getByText(/O fluxo lê telefone, mas este gatilho não declara esse campo/)).toBeInTheDocument();
  });

  it("shows the refused fields inline through coded copy and stays on the start screen", () => {
    const sim = simulation();
    const { rerender } = renderPanel({ simulation: sim });
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));

    const refused = simulation({
      refusal: {
        command: "start",
        error: "dados",
        code: "trigger_input_invalid",
        issues: [
          { code: "required", key: "cpf" },
          { code: "wrong_type", key: "idade" },
          { code: "unknown_field", key: "antigo" },
        ],
      },
    });
    rerender(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <NodeDefinitionsProvider definitions={CATALOG}>
          <WorkflowTestPanel onClose={vi.fn()} workflowId="wf-1" simulation={refused} />
        </NodeDefinitionsProvider>
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(ptMessages.workflowsPage.errors.trigger_input_invalid)).toBeInTheDocument();
    expect(within(fieldBlock("cpf")).getByText(COPY.issues.required)).toBeInTheDocument();
    expect(within(fieldBlock("idade")).getByText(COPY.issues.wrong_type)).toBeInTheDocument();
    expect(screen.getByText(`antigo: ${COPY.issues.unknown_field}`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: COPY.title })).toBeInTheDocument();
  });

  it("does not check required fields itself, leaving that to the backend", () => {
    const sim = simulation();
    renderPanel({ simulation: sim });
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).toHaveBeenCalledWith({ trigger: { triggerNodeId: "t1", input: {} } });
  });

  it("blocks only text that is not JSON and says so", () => {
    const sim = simulation();
    renderPanel({ simulation: sim });
    fireEvent.change(screen.getByLabelText("endereco"), { target: { value: "{cidade" } });
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).not.toHaveBeenCalled();
    expect(within(fieldBlock("endereco")).getByText(COPY.syntax)).toBeInTheDocument();
  });

  it("starts a message trigger without input, leaving the first message to the composer", () => {
    const sim = simulation({ triggers: [MESSAGE] });
    renderPanel({ simulation: sim });
    expect(screen.getByText(COPY.messageHint)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).toHaveBeenCalledWith({ trigger: { triggerNodeId: "t3" } });
  });

  it("starts a voice call trigger, which the backend lists without input, straight away", () => {
    const call: TriggerInputSpec = { nodeId: "call", triggerType: "trigger_call_received", label: "", shape: "none", fields: [], sample: null, readKeys: [], issues: [], window: null, windowEditable: false, acceptedEvents: [] };
    const sim = simulation({ triggers: [call], defaultTriggerNodeId: "call" });
    renderPanel({ simulation: sim });
    expect(screen.getByText(COPY.noInput)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).toHaveBeenCalledWith({ trigger: { triggerNodeId: "call" } });
  });

  it("shows the backend text for a start refused without a code, such as malformed start data", () => {
    renderPanel({ simulation: simulation({ refusal: { command: "start", error: "dados de início malformados" } }) });
    expect(screen.getByText(ptMessages.workflowDebug.session.refused.replace("{error}", "dados de início malformados"))).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: COPY.title })).toBeInTheDocument();
  });

  it.each(["trigger_not_found", "trigger_input_unavailable"] as const)("speaks the catalog for a start refused with %s", (code) => {
    renderPanel({ simulation: simulation({ refusal: { command: "start", error: "raw", code } }) });
    expect(screen.getByText(ptMessages.workflowsPage.errors[code])).toBeInTheDocument();
    expect(screen.queryByText(/raw/)).toBeNull();
  });

  it("says which trigger started the run when there are several", () => {
    renderPanel({
      simulation: simulation({
        status: "running",
        startedTrigger: { nodeId: "t2", triggerType: "trigger_webhook" },
        events: [{ type: "waiting_reply", nodeId: "n1", timeoutSeconds: 0 }],
      }),
    });
    expect(screen.getByText("Iniciado por Webhook de matrícula")).toBeInTheDocument();
  });

  it("restarts with the same input and offers to change it after a run", () => {
    const sim = simulation({ status: "completed", events: [{ type: "error", message: "x" }] });
    renderPanel({ simulation: sim });
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));
    expect(sim.start).toHaveBeenCalledWith();
    fireEvent.click(screen.getByRole("button", { name: COPY.changeInput }));
    expect(sim.connect).toHaveBeenCalled();
  });
});

describe("Testar scenarios", () => {
  const saved: TriggerTestInput = { id: "s1", name: "Candidato completo", input: { cpf: "999", idade: 40 }, savedAt: "2026-10-21T10:00:00Z" };

  it("loads a saved scenario into the form", () => {
    const sim = simulation();
    renderPanel({ simulation: sim, scenariosOf: (id) => (id === "t1" ? [saved] : undefined), onScenariosChange: vi.fn() });
    fireEvent.click(screen.getByRole("combobox", { name: COPY.scenarios.label }));
    fireEvent.click(screen.getByRole("option", { name: "Candidato completo" }));
    expect(screen.getByLabelText("cpf")).toHaveValue("999");
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).toHaveBeenCalledWith({ trigger: { triggerNodeId: "t1", input: { cpf: "999", idade: 40 } } });
  });

  it("saves the typed input as a scenario on the trigger node through the draft", () => {
    const onScenariosChange = vi.fn();
    renderPanel({ simulation: simulation(), scenariosOf: () => [saved], onScenariosChange });
    fireEvent.change(screen.getByLabelText("cpf"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: COPY.scenarios.saveAs }));
    fireEvent.change(screen.getByLabelText(COPY.scenarios.name), { target: { value: "Sem idade" } });
    fireEvent.click(screen.getByRole("button", { name: COPY.scenarios.save }));

    expect(onScenariosChange).toHaveBeenCalledTimes(1);
    const [nodeId, list] = onScenariosChange.mock.calls[0] as [string, TriggerTestInput[]];
    expect(nodeId).toBe("t1");
    expect(list.map((scenario) => [scenario.name, scenario.input])).toEqual([
      ["Candidato completo", saved.input],
      ["Sem idade", { cpf: "123" }],
    ]);
  });

  it("saves only a JSON object body as a webhook scenario, so the draft save is never refused for it", () => {
    const onScenariosChange = vi.fn();
    renderPanel({ simulation: simulation({ triggers: [WEBHOOK] }), scenariosOf: () => [], onScenariosChange });
    fireEvent.change(screen.getByLabelText(COPY.body), { target: { value: "[1]" } });
    fireEvent.click(screen.getByRole("button", { name: COPY.scenarios.saveAs }));
    fireEvent.change(screen.getByLabelText(COPY.scenarios.name), { target: { value: "Lista" } });
    fireEvent.click(screen.getByRole("button", { name: COPY.scenarios.save }));
    expect(onScenariosChange).not.toHaveBeenCalled();
    expect(screen.getByText(COPY.scenarios.notObject)).toBeInTheDocument();
  });

  it("renames and deletes the chosen scenario, refusing a name already taken", () => {
    const other: TriggerTestInput = { ...saved, id: "s2", name: "Outro" };
    const onScenariosChange = vi.fn();
    renderPanel({ simulation: simulation(), scenariosOf: () => [saved, other], onScenariosChange });
    fireEvent.click(screen.getByRole("combobox", { name: COPY.scenarios.label }));
    fireEvent.click(screen.getByRole("option", { name: "Candidato completo" }));

    fireEvent.click(screen.getByRole("button", { name: COPY.scenarios.rename }));
    fireEvent.change(screen.getByLabelText(COPY.scenarios.name), { target: { value: "Outro" } });
    expect(screen.getByText(COPY.scenarios.nameTaken)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: COPY.scenarios.save })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(COPY.scenarios.name), { target: { value: "Completo" } });
    fireEvent.click(screen.getByRole("button", { name: COPY.scenarios.save }));
    expect(onScenariosChange).toHaveBeenLastCalledWith("t1", [{ ...saved, name: "Completo" }, other]);

    fireEvent.click(screen.getByRole("button", { name: COPY.scenarios.delete }));
    expect(onScenariosChange).toHaveBeenLastCalledWith("t1", [other]);
  });

  it("loads the last real call and marks the masked values as needing one", async () => {
    actions.getTriggerLastInputAction.mockResolvedValue({
      lastInput: { input: { cpf: "•••", idade: 22 }, maskedKeys: ["cpf"], runId: "r1", startedAt: "2026-10-22T10:00:00Z" },
    });
    renderPanel({ simulation: simulation() });
    fireEvent.click(screen.getByRole("button", { name: COPY.scenarios.lastCall }));

    await waitFor(() => expect(screen.getByLabelText("idade")).toHaveValue(22));
    expect(actions.getTriggerLastInputAction).toHaveBeenCalledWith("wf-1", "t1");
    expect(screen.getByLabelText("cpf")).toHaveValue("");
    expect(within(fieldBlock("cpf")).getByText(COPY.masked)).toBeInTheDocument();
  });

  it.each([
    ["no_recent_input", 404],
    ["trigger_not_found", 404],
    ["trigger_input_unavailable", 503],
  ] as const)("speaks the catalog when the last real call answers %s", async (code, status) => {
    actions.getTriggerLastInputAction.mockResolvedValue({ lastInput: null, error: "x", code, status });
    renderPanel({ simulation: simulation() });
    fireEvent.click(screen.getByRole("button", { name: COPY.scenarios.lastCall }));
    expect(await screen.findByText(ptMessages.workflowsPage.errors[code])).toBeInTheDocument();
  });
});

describe("Testar start screen, examples, dates and the service window", () => {
  const BIRTHDAY: TriggerInputSpec = {
    nodeId: "t4",
    triggerType: "trigger_birthday",
    label: "",
    shape: "fields",
    fields: [{ key: "birthday", type: "text", required: false, description: "", example: "2026-10-22", readBy: [] }],
    sample: null,
    readKeys: [],
    issues: [],
    window: "closed",
    windowEditable: true,
    acceptedEvents: [],
  };

  it("names a chip without a display name by its node label, next to its icon", () => {
    renderPanel({ simulation: simulation({ triggers: [AGENT, BIRTHDAY] }), nodeLabel: (id) => (id === "t4" ? "Aniversário" : undefined) });
    const chips = within(screen.getByRole("group", { name: COPY.chooser })).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Chamado por agente IA", "Aniversário"]);
    expect(chips[1].querySelector("svg")).not.toBeNull();
  });

  it("shows examples as faint placeholders and fills only the empty fields on request", () => {
    const sim = simulation({ triggers: [AGENT] });
    renderPanel({ simulation: sim });
    expect(screen.getByLabelText("cpf")).toHaveAttribute("placeholder", "Ex.: 000.000.000-00");
    expect(screen.getByLabelText("cpf")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("agent.name"), { target: { value: "Bia" } });
    fireEvent.click(screen.getByRole("button", { name: COPY.fillExamples }));
    expect(screen.getByLabelText("cpf")).toHaveValue("000.000.000-00");
    expect(screen.getByLabelText("agent.name")).toHaveValue("Bia");
    expect(screen.getByLabelText("idade")).toHaveValue(18);
    expect(screen.queryByRole("button", { name: COPY.fillExamples })).toBeNull();
  });

  it("picks the birthday as a date and sends AAAA-MM-DD", () => {
    const sim = simulation({ triggers: [BIRTHDAY], defaultTriggerNodeId: "t4" });
    renderPanel({ simulation: sim });
    const input = screen.getByLabelText("birthday");
    expect(input).toHaveAttribute("type", "date");
    fireEvent.change(input, { target: { value: "2026-03-09" } });
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).toHaveBeenCalledWith({ trigger: { triggerNodeId: "t4", input: { birthday: "2026-03-09" }, windowOpen: false } });
  });

  it("offers the service window with the spec default, explains it and sends the choice", () => {
    const sim = simulation({ triggers: [BIRTHDAY], defaultTriggerNodeId: "t4" });
    renderPanel({ simulation: sim });
    const group = screen.getByRole("group", { name: COPY.window.label });
    expect(within(group).getByRole("button", { name: COPY.window.closed })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(COPY.window.hint)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole("button", { name: COPY.window.open }));
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).toHaveBeenCalledWith({ trigger: { triggerNodeId: "t4", input: {}, windowOpen: true } });
  });

  it("offers no window choice when the spec has none", () => {
    renderPanel({ simulation: simulation({ triggers: [AGENT] }) });
    expect(screen.queryByRole("group", { name: COPY.window.label })).toBeNull();
  });

  it("offers no window choice for a message trigger, whose window the customer's own message opens", () => {
    const message: TriggerInputSpec = { ...MESSAGE, window: "open", windowEditable: false };
    const sim = simulation({ triggers: [message], defaultTriggerNodeId: "t3" });
    renderPanel({ simulation: sim });
    expect(screen.queryByRole("group", { name: COPY.window.label })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(sim.start).toHaveBeenCalledWith({ trigger: { triggerNodeId: "t3" } });
  });

  it("lists the accepted events next to an event refusal", () => {
    const webhook: TriggerInputSpec = { ...WEBHOOK, acceptedEvents: ["lead.created", "lead.updated"] };
    const sim = simulation({ triggers: [webhook], defaultTriggerNodeId: "t2", refusal: { command: "start", error: "x", code: "trigger_input_invalid", issues: [{ code: "event_not_accepted", key: "event" }] } });
    renderPanel({ simulation: sim });
    fireEvent.click(screen.getByRole("button", { name: COPY.start }));
    expect(screen.getByText("Eventos aceitos: lead.created, lead.updated")).toBeInTheDocument();
  });
});
