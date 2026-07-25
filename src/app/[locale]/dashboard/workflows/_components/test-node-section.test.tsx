/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TestNodeSection } from "./test-node-section";

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
