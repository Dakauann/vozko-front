import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogAnswer } from "@/lib/workflows/variable-catalog-loader";

import { TemplateRefText } from "./template-ref-text";
import { VariableCatalogSourceProvider } from "./variable-catalog-context";

const actions = vi.hoisted(() => ({ getNodeVariablesAction: vi.fn<(workflowId: string, nodeId: string) => Promise<CatalogAnswer>>() }));
vi.mock("@/app/actions/workflows", () => actions);
vi.mock("@xyflow/react", async (original) => ({ ...(await original<typeof import("@xyflow/react")>()), useNodeId: () => "n2" }));

const CATALOG: CatalogAnswer = {
  catalog: {
    variables: [{ ref: "input.cpf", label: "Enviado pelo agente › cpf", group: "trigger", kind: "trigger", source: null, type: "text", example: null, availability: "always" }],
    unreadable: 0,
  },
};

beforeEach(() => actions.getNodeVariablesAction.mockReset());

describe("TemplateRefText", () => {
  it("renders plain text untouched and reads nothing", () => {
    render(<TemplateRefText text="Olá" />);
    expect(screen.getByText("Olá")).toBeInTheDocument();
    expect(actions.getNodeVariablesAction).not.toHaveBeenCalled();
  });

  it("names a known reference on hover from the node's catalog, read only when hovered", async () => {
    actions.getNodeVariablesAction.mockResolvedValue(CATALOG);
    render(
      <VariableCatalogSourceProvider workflowId="wf-1" revision={2}>
        <p>
          <TemplateRefText text="CPF {{input.cpf}} e {{x.y}}" />
        </p>
      </VariableCatalogSourceProvider>,
    );
    expect(actions.getNodeVariablesAction).not.toHaveBeenCalled();
    const known = screen.getByText("{{input.cpf}}");
    fireEvent.pointerEnter(known);
    await waitFor(() => expect(known).toHaveAttribute("title", "Enviado pelo agente › cpf"));
    expect(actions.getNodeVariablesAction).toHaveBeenCalledWith("wf-1", "n2");
    const unknown = screen.getByText("{{x.y}}");
    fireEvent.pointerEnter(unknown);
    await waitFor(() => expect(actions.getNodeVariablesAction).toHaveBeenCalledTimes(1));
    expect(unknown).not.toHaveAttribute("title");
  });
});
