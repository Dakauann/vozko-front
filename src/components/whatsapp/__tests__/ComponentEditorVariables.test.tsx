import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { BUTTON_ACTION_KINDS } from "@/lib/whatsapp-templates/exit";

const listTemplateFieldsAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/campaign-audience", () => ({ listTemplateFieldsAction }));

const checkTemplateVariableNamesAction = vi.hoisted(() => vi.fn());
vi.mock("@/app/actions/whatsapp-templates", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkTemplateVariableNamesAction,
}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));

import ComponentEditor from "../ComponentEditor";
import type { DraggableComponent } from "../DragDropBuilder";

const body = ptMessages.whatsappTemplates.form.editor.body;
const sources = ptMessages.leadSends.bindings.sources;

const FIELDS = [
  { source: "lead.first_name", kind: "lead", column: "primeiro_nome" },
  { source: "lead.district", kind: "lead", column: "bairro" },
  { source: "lead.custom:serie", kind: "custom", column: "serie", key: "serie", label: "Série de interesse", type: "text" },
];

const latest: { component: DraggableComponent | null } = { component: null };

function Harness({ initial, variableFormat }: { initial: DraggableComponent; variableFormat?: "positional" | "named" }) {
  const [component, setComponent] = useState(initial);
  return (
    <ComponentEditor
      component={component}
      variableFormat={variableFormat}
      onChange={(next) => {
        latest.component = next;
        setComponent(next);
      }}
      category="MARKETING"
      allowedKinds={BUTTON_ACTION_KINDS}
    />
  );
}

function renderComponent(initial: DraggableComponent, variableFormat?: "positional" | "named") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <Harness initial={initial} variableFormat={variableFormat} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function renderBody(data: DraggableComponent["data"]) {
  return renderComponent({ id: "body", type: "BODY", data });
}

beforeEach(() => {
  listTemplateFieldsAction.mockReset().mockResolvedValue({ data: FIELDS, error: null });
  checkTemplateVariableNamesAction.mockReset().mockResolvedValue({ data: { valid: true }, error: null });
  latest.component = null;
});

describe("BodyEditor variable menu", () => {
  it("offers the lead fields from the backend and a free variable", async () => {
    renderBody({ text: "Olá " });
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    const group = await screen.findByRole("group", { name: body.variableMenu.fieldGroup });
    expect(await within(group).findByRole("button", { name: sources.firstName })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: sources.district })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "Campo: Série de interesse" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(body.variableMenu.free) })).toHaveTextContent("O próximo {{1}}, sem campo do lead");
  });

  it("inserts the next variable for a lead field, shows the field and prefills the example", async () => {
    renderBody({ text: "Olá " });
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    fireEvent.click(await screen.findByRole("button", { name: sources.firstName }));
    expect(latest.component?.data).toMatchObject({ text: "Olá {{1}}", variableSuggestions: { "1": "lead.first_name" }, variableExamples: ["Maria"] });
    expect(await screen.findByText(sources.firstName)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Maria")).toBeInTheDocument();
    expect(screen.queryByText(body.freeNotice)).not.toBeInTheDocument();
    expect(screen.getByText(body.suggestionHint)).toBeInTheDocument();
  });

  it("uses the label of a custom field for its example and chip", async () => {
    renderBody({ text: "Olá " });
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    fireEvent.click(await screen.findByRole("button", { name: "Campo: Série de interesse" }));
    expect(latest.component?.data.variableExamples).toEqual(["Série de interesse"]);
    expect(await screen.findByText("Campo: Série de interesse")).toBeInTheDocument();
  });

  it("explains a free variable", async () => {
    renderBody({ text: "Olá " });
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(body.variableMenu.free) }));
    expect(latest.component?.data.text).toBe("Olá {{1}}");
    expect(await screen.findByText(body.freeNotice)).toBeInTheDocument();
    expect(screen.getByText(body.freeChip)).toBeInTheDocument();
  });

  it("names a lead field variable after its column in a named template and prefills its example", async () => {
    renderBody({ text: "Olá {{nome}} " });
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    fireEvent.click(await screen.findByRole("button", { name: sources.district }));
    expect(latest.component?.data).toMatchObject({ text: "Olá {{nome}} {{bairro}}", variableSuggestions: { bairro: "lead.district" }, namedVariableExamples: { bairro: "Jardim Silveira" } });
    expect(await screen.findByText(sources.district)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Jardim Silveira")).toBeInTheDocument();
    expect(screen.getByText(body.freeNotice)).toBeInTheDocument();
  });

  it("asks a name for a free variable in a named body and inserts it", async () => {
    renderBody({ text: "Olá {{nome}} " });
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(body.variableMenu.free) }));
    const input = screen.getByLabelText(body.variableMenu.nameLabel);

    checkTemplateVariableNamesAction.mockResolvedValueOnce({ data: null, error: { message: "bad", status: 400, code: "template_variable_name_invalid", expected: { variable: "Serie" } } });
    fireEvent.change(input, { target: { value: "Serie" } });
    fireEvent.click(screen.getByRole("button", { name: body.variableMenu.nameAdd }));
    expect(await screen.findByText(`${ptMessages.whatsappTemplates.errors.template_variable_name_invalid} (Serie)`)).toBeInTheDocument();
    expect(checkTemplateVariableNamesAction).toHaveBeenLastCalledWith(["Serie"]);
    expect(latest.component).toBeNull();

    checkTemplateVariableNamesAction.mockClear();
    fireEvent.change(input, { target: { value: "nome" } });
    fireEvent.click(screen.getByRole("button", { name: body.variableMenu.nameAdd }));
    expect(screen.getByText(body.variableMenu.nameTaken)).toBeInTheDocument();
    expect(checkTemplateVariableNamesAction).not.toHaveBeenCalled();
    expect(latest.component).toBeNull();

    checkTemplateVariableNamesAction.mockResolvedValueOnce({ data: null, error: { message: "Network error" } });
    fireEvent.change(input, { target: { value: "serie_2027" } });
    fireEvent.click(screen.getByRole("button", { name: body.variableMenu.nameAdd }));
    expect(await screen.findByText("Network error")).toBeInTheDocument();
    expect(latest.component).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: body.variableMenu.nameAdd }));
    await waitFor(() => expect(latest.component?.data.text).toBe("Olá {{nome}} {{serie_2027}}"));
    expect(checkTemplateVariableNamesAction).toHaveBeenLastCalledWith(["serie_2027"]);
    expect(await screen.findByText(body.freeNotice)).toBeInTheDocument();
    expect(screen.getAllByText(body.freeChip).length).toBeGreaterThan(0);
  });

  it("keeps inserting the next number for a free variable in a numbered body", async () => {
    renderBody({ text: "Olá {{1}} " });
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp(body.variableMenu.free) }));
    expect(latest.component?.data.text).toBe("Olá {{1}} {{2}}");
    expect(screen.queryByLabelText(body.variableMenu.nameLabel)).not.toBeInTheDocument();
  });

  it("follows the named format of the rest of the template on an empty body", async () => {
    renderComponent({ id: "body", type: "BODY", data: { text: "Olá " } }, "named");
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    fireEvent.click(await screen.findByRole("button", { name: sources.firstName }));
    expect(latest.component?.data.text).toBe("Olá {{primeiro_nome}}");
  });
});

describe("HeaderEditor variable", () => {
  it("adds the header variable from a lead field and shows its field and example", async () => {
    renderComponent({ id: "header", type: "HEADER", data: { format: "TEXT", text: "Oferta para " } });
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    fireEvent.click(await screen.findByRole("button", { name: sources.firstName }));
    expect(latest.component?.data).toMatchObject({ text: "Oferta para {{1}}", variableSuggestions: { "1": "lead.first_name" }, variableExamples: ["Maria"] });
    expect(await screen.findByText(sources.firstName)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Maria")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: body.addVariable })).not.toBeInTheDocument();
  });

  it("names the header variable when the template uses named variables", async () => {
    renderComponent({ id: "header", type: "HEADER", data: { format: "TEXT", text: "Oi " } }, "named");
    fireEvent.click(screen.getByRole("button", { name: body.addVariable }));
    fireEvent.click(await screen.findByRole("button", { name: sources.firstName }));
    expect(latest.component?.data).toMatchObject({ text: "Oi {{primeiro_nome}}", variableSuggestions: { primeiro_nome: "lead.first_name" }, namedVariableExamples: { primeiro_nome: "Maria" } });
  });
});
