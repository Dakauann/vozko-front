import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { CatalogAnswer } from "@/lib/workflows/variable-catalog-loader";
import type { CatalogVariable } from "@/lib/workflows/variable-catalog";

import { NodeVariablesProvider, VariableCatalogSourceProvider, useNodeVariableCatalog } from "./variable-catalog-context";
import { VariableCommandInput } from "./variable-command-input";

const actions = vi.hoisted(() => ({ getNodeVariablesAction: vi.fn<(workflowId: string, nodeId: string) => Promise<CatalogAnswer>>() }));
vi.mock("@/app/actions/workflows", () => actions);

const COPY = ptMessages.workflowsPage.variablePicker;

const VARIABLES: CatalogVariable[] = [
  { ref: "webhook.body.nome", label: "Corpo do webhook › nome", group: "trigger", kind: "trigger", source: null, type: "text", example: "Ana", availability: "always" },
  { ref: "last.message_id", label: "Envio › id da mensagem", group: "nodes", kind: "node", source: { nodeId: "n1", nodeName: "Boas-vindas" }, type: "text", example: null, availability: "some_paths" },
  { ref: "sys.date", label: "Data de hoje", group: "system", kind: "system", source: null, type: "date", example: null, availability: "always" },
];

function Field({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const variables = useNodeVariableCatalog("n2", { workflowId: "wf-1", revision: 3 });
  return (
    <NodeVariablesProvider value={variables}>
      <VariableCommandInput label="Mensagem" value={value} onChange={setValue} />
    </NodeVariablesProvider>
  );
}

function renderField(initial?: string) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
      <VariableCatalogSourceProvider workflowId="wf-1" revision={3}>
        <Field initial={initial} />
      </VariableCatalogSourceProvider>
    </NextIntlClientProvider>,
  );
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: COPY.title }));
}

beforeEach(() => {
  actions.getNodeVariablesAction.mockReset();
});

describe("VariableCommandInput with the backend catalog", () => {
  it("lists the node's variables in the backend group order with their badges, type and example", async () => {
    actions.getNodeVariablesAction.mockResolvedValue({ catalog: { variables: VARIABLES, unreadable: 0 } });
    renderField();
    openPicker();
    await screen.findByText("Data de hoje");
    expect(actions.getNodeVariablesAction).toHaveBeenCalledWith("wf-1", "n2");

    const headings = [COPY.groups.trigger, COPY.groups.nodes, COPY.groups.system].map((text) => screen.getByText(text));
    expect(headings[0].compareDocumentPosition(headings[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(headings[1].compareDocumentPosition(headings[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const sent = screen.getByText("Envio › id da mensagem").closest("[cmdk-item]") as HTMLElement;
    expect(within(sent).getByText(COPY.badges.somePaths)).toBeInTheDocument();
    expect(within(sent).getByText("definido em Boas-vindas")).toBeInTheDocument();
    const today = screen.getByText("Data de hoje").closest("[cmdk-item]") as HTMLElement;
    expect(within(today).getByText(COPY.badges.default)).toBeInTheDocument();
    expect(within(today).getByText(COPY.types.date)).toBeInTheDocument();
    const name = screen.getByText("Corpo do webhook › nome").closest("[cmdk-item]") as HTMLElement;
    expect(within(name).getByText("Ex.: Ana")).toBeInTheDocument();
  });

  it("searches by label and by ref", async () => {
    actions.getNodeVariablesAction.mockResolvedValue({ catalog: { variables: VARIABLES, unreadable: 0 } });
    renderField();
    openPicker();
    const search = await screen.findByLabelText(COPY.search);
    fireEvent.change(search, { target: { value: "corpo" } });
    expect(screen.getByText("Corpo do webhook › nome")).toBeInTheDocument();
    expect(screen.queryByText("Data de hoje")).toBeNull();
    fireEvent.change(search, { target: { value: "sys.da" } });
    expect(screen.getByText("Data de hoje")).toBeInTheDocument();
    expect(screen.queryByText("Corpo do webhook › nome")).toBeNull();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText(COPY.noMatch)).toBeInTheDocument();
  });

  it("inserts the ref as a template into the field", async () => {
    actions.getNodeVariablesAction.mockResolvedValue({ catalog: { variables: VARIABLES, unreadable: 0 } });
    renderField("Olá ");
    openPicker();
    fireEvent.click(await screen.findByText("Corpo do webhook › nome"));
    expect(screen.getByLabelText("Mensagem")).toHaveValue("Olá {{webhook.body.nome}}");
  });

  it("names the known references of the field on hover", async () => {
    actions.getNodeVariablesAction.mockResolvedValue({ catalog: { variables: VARIABLES, unreadable: 0 } });
    renderField("Oi {{webhook.body.nome}}, hoje é {{ sys.date }} e {{x.y}}");
    await waitFor(() =>
      expect(screen.getByLabelText("Mensagem")).toHaveAttribute("title", "{{webhook.body.nome}} · Corpo do webhook › nome\n{{sys.date}} · Data de hoje"),
    );
  });

  it("fails closed with a retry when the catalog cannot be read, never a guessed list", async () => {
    actions.getNodeVariablesAction.mockResolvedValueOnce({ error: "boom" }).mockResolvedValueOnce({ catalog: { variables: VARIABLES, unreadable: 0 } });
    renderField();
    openPicker();
    expect(await screen.findByText(COPY.failed)).toBeInTheDocument();
    expect(screen.queryByText("Data de hoje")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: COPY.retry }));
    expect(await screen.findByText("Data de hoje")).toBeInTheDocument();
    expect(actions.getNodeVariablesAction).toHaveBeenCalledTimes(2);
  });

  it("says how many entries it could not read", async () => {
    actions.getNodeVariablesAction.mockResolvedValue({ catalog: { variables: VARIABLES, unreadable: 2 } });
    renderField();
    openPicker();
    expect(await screen.findByText("2 variáveis não puderam ser lidas e não aparecem aqui.")).toBeInTheDocument();
  });

  it("asks to save first when the workflow was never saved", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <VariableCommandInput label="Mensagem" value="" onChange={vi.fn()} />
      </NextIntlClientProvider>,
    );
    openPicker();
    expect(screen.getByText(COPY.unavailable)).toBeInTheDocument();
  });
});
