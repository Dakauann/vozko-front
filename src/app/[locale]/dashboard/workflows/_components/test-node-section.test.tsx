
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { fireEvent, render as renderBare, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

import { TestNodeSection } from "./test-node-section";

function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

const render = (ui: ReactElement) => renderBare(ui, { wrapper: IntlWrapper });

const { analyze, test, setMockedValue, setTriggerVar, reset, useTestNode } =
  vi.hoisted(() => ({
    analyze: vi.fn(),
    test: vi.fn(),
    setMockedValue: vi.fn(),
    setTriggerVar: vi.fn(),
    reset: vi.fn(),
    useTestNode: vi.fn(),
  }));

vi.mock("@/hooks/use-test-node", () => ({
  useTestNode,
}));

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => false }) }));
vi.mock("@/app/actions/conversations", () => ({ getConversationMediaAction: vi.fn() }));

vi.mock("@/components/elevated-design/button", () => ({
  default: ({
    title,
    onClick,
    disabled,
  }: {
    title?: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {title}
    </button>
  ),
}));

vi.mock("@/components/elevated-design/elevated-input", () => ({
  default: ({
    label,
    placeholder,
    value,
    onChange,
  }: {
    label?: string;
    placeholder?: string;
    value?: string;
    onChange?: (event: { target: { value: string } }) => void;
  }) => (
    <input
      aria-label={label ?? placeholder}
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(event) =>
        onChange?.({ target: { value: event.target.value } })
      }
    />
  ),
}));

function TestNodeSectionHarness({ nodeId }: { nodeId: string }) {
  return (
    <TestNodeSection key={`wf-1:${nodeId}`} workflowId="wf-1" nodeId={nodeId} />
  );
}

describe("TestNodeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requests analysis when the section is expanded from idle", () => {
    useTestNode.mockReturnValue({
      status: "idle",
      analysis: null,
      result: null,
      error: null,
      mockedState: {},
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });

    render(<TestNodeSection workflowId="wf-1" nodeId="node-1" />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));

    expect(analyze).toHaveBeenCalledWith("wf-1", "node-1");
  });

  it("opens and analyzes with the recorded values when a run step seeds the test", async () => {
    analyze.mockResolvedValue(undefined);
    useTestNode.mockReturnValue({
      status: "ready",
      analysis: {
        node_id: "node-1",
        node_type: "action_set_variable",
        node_label: "Definir Variavel",
        test_mode: "mock",
        mock_fields: [],
        can_run_direct: false,
        has_ai_deps: false,
        message: "Precisa de mocks",
      },
      result: null,
      error: null,
      mockedState: {},
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });
    const valueFor = vi.fn();

    render(<TestNodeSection workflowId="wf-1" nodeId="node-1" seed={{ id: "run-1:step-3", valueFor }} />);

    expect(analyze).toHaveBeenCalledWith("wf-1", "node-1", valueFor);
    expect(await screen.findByText("Precisa de mocks")).not.toBeNull();
  });

  it("shows recorded values that are not text as JSON so they can be read and edited", () => {
    useTestNode.mockReturnValue({
      status: "ready",
      analysis: {
        node_id: "node-1",
        node_type: "action_set_variable",
        node_label: "Definir Variavel",
        test_mode: "mock",
        mock_fields: [{ key: "_last_body", display_name: "last.body", source: "previous_node" }],
        can_run_direct: false,
        has_ai_deps: false,
        message: "Precisa de mocks",
      },
      result: null,
      error: null,
      mockedState: { _last_body: { ok: true } },
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });

    render(<TestNodeSection workflowId="wf-1" nodeId="node-1" />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));

    expect((screen.getByPlaceholderText("Digite o valor para last.body") as HTMLInputElement).value).toBe('{"ok":true}');
  });

  it("renders analysis content and disabled warning", () => {
    useTestNode.mockReturnValue({
      status: "ready",
      analysis: {
        node_id: "node-1",
        node_type: "action_set_variable",
        node_label: "Definir Variavel",
        test_mode: "mock",
        mock_fields: [
          {
            key: "_last_body",
            display_name: "last.body",
            source: "previous_node",
          },
        ],
        can_run_direct: false,
        has_ai_deps: false,
        message: "Precisa de mocks",
      },
      result: null,
      error: null,
      mockedState: { _last_body: "" },
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });

    render(
      <TestNodeSection
        workflowId="wf-1"
        nodeId="node-1"
        disabled
        disabledReason="Salve antes de testar"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));

    expect(screen.queryByText("Precisa de mocks")).not.toBeNull();
    expect(screen.queryByText("Salve antes de testar")).not.toBeNull();
    expect(screen.queryByText("{{last.body}}")).not.toBeNull();
    expect(screen.queryByText(/Variavel esperada/i)).not.toBeNull();
    expect(
      screen.queryByPlaceholderText("Digite o valor para last.body"),
    ).not.toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: /executar teste/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("requires all mocked values before enabling execution", () => {
    useTestNode.mockReturnValue({
      status: "ready",
      analysis: {
        node_id: "node-1",
        node_type: "action_set_variable",
        node_label: "Definir Variavel",
        test_mode: "execute_until",
        mock_fields: [
          {
            key: "_ai_response",
            display_name: "ai.response",
            source: "ai",
          },
        ],
        can_run_direct: false,
        has_ai_deps: true,
        message:
          "Preencha os valores simulados abaixo para testar sem executar a IA.",
      },
      result: null,
      error: null,
      mockedState: { _ai_response: "" },
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });

    render(<TestNodeSection workflowId="wf-1" nodeId="node-1" />);

    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));

    expect(
      screen.queryByText(/Preencha os valores simulados obrigatórios/i),
    ).not.toBeNull();
    expect(
      (
        screen.getByRole("button", {
          name: /executar teste/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("enables execution when all mocked values are present", () => {
    useTestNode.mockReturnValue({
      status: "ready",
      analysis: {
        node_id: "node-1",
        node_type: "action_set_variable",
        node_label: "Definir Variavel",
        test_mode: "execute_until",
        mock_fields: [
          {
            key: "_ai_response",
            display_name: "ai.response",
            source: "ai",
          },
        ],
        can_run_direct: false,
        has_ai_deps: true,
        message:
          "Preencha os valores simulados abaixo para testar sem executar a IA.",
      },
      result: null,
      error: null,
      mockedState: { _ai_response: "captured reply" },
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });

    render(<TestNodeSection workflowId="wf-1" nodeId="node-1" />);

    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));

    expect(
      (
        screen.getByRole("button", {
          name: /executar teste/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("resets the section when navigating to a different node", () => {
    useTestNode.mockReturnValue({
      status: "ready",
      analysis: {
        node_id: "node-1",
        node_type: "action_set_variable",
        node_label: "Definir Variavel",
        test_mode: "mock",
        mock_fields: [],
        can_run_direct: false,
        has_ai_deps: false,
        message: "Precisa de mocks",
      },
      result: null,
      error: null,
      mockedState: {},
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });

    const { rerender } = render(<TestNodeSectionHarness nodeId="node-1" />);

    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));
    expect(screen.queryByText("Precisa de mocks")).not.toBeNull();

    rerender(<TestNodeSectionHarness nodeId="node-2" />);

    expect(screen.queryByText("Precisa de mocks")).toBeNull();
  });
});

describe("TestNodeSection result", () => {
  const analysis = {
    node_id: "n5",
    node_type: "action_http_request",
    node_label: "Login",
    test_mode: "execute_until",
    mock_fields: [],
    can_run_direct: false,
    has_ai_deps: false,
    message: "Executa os nós anteriores",
  };
  const step = (overrides: Record<string, unknown>) => ({
    id: "t",
    runId: "test",
    nodeId: "n5",
    nodeType: "action_http_request",
    status: "executed",
    executedAt: "2026-10-20T12:00:00Z",
    attempt: 1,
    durationMs: 42,
    ...overrides,
  });

  function renderWithResult(result: Record<string, unknown>, onShowPath = vi.fn()) {
    useTestNode.mockReturnValue({
      status: "success",
      analysis,
      result,
      error: null,
      mockedState: {},
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });
    render(<TestNodeSection workflowId="wf-1" nodeId="n5" onShowPath={onShowPath} />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));
    return onShowPath;
  }

  it("shows the node test with the run viewer's step detail and real milliseconds", () => {
    renderWithResult({
      node_id: "n5",
      node_type: "action_http_request",
      success: true,
      interpolated_config: { url: "https://api.test" },
      execution_output: { status_code: 200 },
      execution_duration_ms: 42,
    });
    const result = screen.getByTestId("node-test-result");
    expect(within(result).getByRole("tab", { name: "Parâmetros usados" })).toBeInTheDocument();
    expect(within(result).getByRole("tab", { name: "Saída" })).toBeInTheDocument();
    expect(within(result).getAllByText(/42\s*ms/).length).toBeGreaterThan(0);
  });

  it("lists the upstream steps of an execute until test and draws their path", () => {
    const upstream = step({ id: "t0", nodeId: "n4", nodeType: "action_code" });
    const target = step({ id: "t1" });
    const onShowPath = renderWithResult({
      node_id: "n5",
      node_type: "action_http_request",
      success: true,
      interpolated_config: {},
      execution_duration_ms: 42,
      step: target,
      upstream_steps: [upstream],
    });
    expect(screen.getByText("Etapas anteriores executadas")).toBeInTheDocument();
    expect(onShowPath).toHaveBeenCalledWith([upstream, target]);
  });

  it("renders what a send node sent with the conversation bubble and what a CRM node would do", () => {
    renderWithResult({
      node_id: "n5",
      node_type: "action_send_message",
      success: true,
      execution_duration_ms: 3,
      step: step({
        nodeType: "action_send_message",
        simulated: true,
        output: {
          sent_messages: [
            {
              id: "m1",
              entryType: "whatsapp",
              channel: "whatsapp",
              messageType: "ai_response",
              direction: "OUTBOUND",
              text: "Escolha o turno",
              createdAt: "2026-10-20T12:00:00Z",
              metadata: { buttons: { body_text: "Escolha o turno", buttons: [{ id: "manha", title: "Manhã" }] } },
            },
          ],
          would_do: [{ kind: "stage", action: "move", description: "Moveria para Matriculados" }],
        },
      }),
    });
    const result = screen.getByTestId("node-test-result");
    expect(within(result).getByText("Mensagens enviadas")).toBeInTheDocument();
    expect(within(result).getByText("Escolha o turno")).toBeInTheDocument();
    expect(within(result).getByRole("button", { name: "Manhã" })).toBeDisabled();
    expect(within(result).getByText("Simulado: Moveria para Matriculados")).toBeInTheDocument();
  });

  it("says the viewer has no access to the workflow instead of the raw refusal", () => {
    useTestNode.mockReturnValue({
      status: "error",
      analysis: null,
      result: null,
      error: "You don't have access to this workflow",
      errorStatus: 403,
      mockedState: {},
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });
    render(<TestNodeSection workflowId="wf-1" nodeId="n5" />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));
    expect(screen.getByText("Sem acesso a este fluxo")).toBeInTheDocument();
    expect(screen.queryByText("You don't have access to this workflow")).toBeNull();
  });

  it("explains any other refused test with the catalog copy of its code", () => {
    useTestNode.mockReturnValue({
      status: "error",
      analysis: null,
      result: null,
      error: "raw unavailable",
      errorStatus: 501,
      errorCode: "node_test_unavailable",
      mockedState: {},
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });
    render(<TestNodeSection workflowId="wf-1" nodeId="n5" />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));
    expect(screen.getByText(ptMessages.workflowsPage.errors.node_test_unavailable)).toBeInTheDocument();
    expect(screen.queryByText("raw unavailable")).toBeNull();
  });

  it("sends the real call confirmation only when ticked", () => {
    useTestNode.mockReturnValue({
      status: "ready",
      analysis: { ...analysis, test_mode: "direct", can_run_direct: true },
      result: null,
      error: null,
      mockedState: {},
      triggerVars: {},
      analyze,
      test,
      setMockedValue,
      setTriggerVar,
      reset,
    });
    render(<TestNodeSection workflowId="wf-1" nodeId="n5" />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Permitir chamadas reais neste teste/ }));
    fireEvent.click(screen.getByRole("button", { name: /executar teste/i }));
    expect(test).toHaveBeenCalledWith("wf-1", "n5", false, true);
  });
});

describe("TestNodeSection trigger input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const triggerSpec = {
    nodeId: "t1",
    triggerType: "trigger_agent_call",
    label: "Chamado por agente IA",
    shape: "fields",
    fields: [
      { key: "cpf", type: "text", required: true, description: "CPF do candidato", example: "000", readBy: ["n5"] },
      { key: "dados", type: "object", required: false, description: "", example: null, readBy: [] },
    ],
    sample: null,
    readKeys: [],
    issues: [],
    windowEditable: true,
  };
  const analysis = {
    node_id: "n5",
    node_type: "action_http_request",
    node_label: "Login",
    test_mode: "execute_until",
    mock_fields: [],
    can_run_direct: false,
    has_ai_deps: false,
    message: "Executa os nós anteriores",
    trigger: triggerSpec,
  };
  const hookState = (overrides: Record<string, unknown> = {}) => ({
    status: "ready",
    analysis,
    result: null,
    error: null,
    mockedState: {},
    triggerVars: {},
    analyze,
    test,
    setMockedValue,
    setTriggerVar,
    reset,
    ...overrides,
  });

  it("fills the trigger's input with the Testar editor and sends it with the test", () => {
    useTestNode.mockReturnValue(hookState());
    render(<TestNodeSection workflowId="wf-1" nodeId="n5" />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));

    expect(screen.getByTestId("trigger-input-editor")).toBeInTheDocument();
    expect(screen.getByText("CPF do candidato")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ex.: 000"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /executar teste/i }));
    expect(test).toHaveBeenCalledWith("wf-1", "n5", false, false, { nodeId: "t1", input: { cpf: "123" } });
  });

  it("blocks a test only for text that is not JSON", () => {
    useTestNode.mockReturnValue(hookState());
    render(<TestNodeSection workflowId="wf-1" nodeId="n5" />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));
    fireEvent.change(screen.getByLabelText("dados"), { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: /executar teste/i }));
    expect(test).not.toHaveBeenCalled();
    expect(screen.getByText(ptMessages.workflowDebug.triggerInput.syntax)).toBeInTheDocument();
  });

  it("shows the refused trigger fields inline with the coded copy", () => {
    useTestNode.mockReturnValue(
      hookState({
        status: "error",
        error: "raw",
        errorStatus: 422,
        errorCode: "trigger_input_invalid",
        errorIssues: [{ code: "required", key: "cpf" }],
      }),
    );
    render(<TestNodeSection workflowId="wf-1" nodeId="n5" />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));
    expect(screen.getByText(ptMessages.workflowsPage.errors.trigger_input_invalid)).toBeInTheDocument();
    expect(screen.getByText(ptMessages.workflowDebug.triggerInput.issues.required)).toBeInTheDocument();
    expect(screen.queryByText("raw")).toBeNull();
  });

  it("keeps the old request when the path has no trigger with input", () => {
    useTestNode.mockReturnValue(hookState({ analysis: { ...analysis, trigger: { ...triggerSpec, shape: "none", fields: [] } } }));
    render(<TestNodeSection workflowId="wf-1" nodeId="n5" />);
    fireEvent.click(screen.getByRole("button", { name: /testar nó/i }));
    expect(screen.queryByTestId("trigger-input-editor")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /executar teste/i }));
    expect(test).toHaveBeenCalledWith("wf-1", "n5", false, false);
  });
});
