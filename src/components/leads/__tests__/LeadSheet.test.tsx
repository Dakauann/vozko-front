import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import { toast } from "sonner";

import ptMessages from "@/i18n/messages/pt.json";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import type { LeadDetail } from "@/lib/leads/types";

const leadActions = vi.hoisted(() => ({
  getLeadByIdAction: vi.fn(),
  getLeadSummaryAction: vi.fn(),
  createLeadAction: vi.fn(),
  updateLeadAction: vi.fn(),
  setLeadOwnerAction: vi.fn(),
  addLeadRelativeAction: vi.fn(),
  linkLeadRelationAction: vi.fn(),
  removeLeadRelationAction: vi.fn(),
  listLeadRelativesAction: vi.fn(),
  findLeadByNumberAction: vi.fn(),
  findLeadsByNameAction: vi.fn(),
}));
const fieldDefinitions = vi.hoisted(() => ({ value: [] as CustomFieldDefinition[] }));
const searchCepAction = vi.hoisted(() => vi.fn());
const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const mapActions = vi.hoisted(() => ({ fetchReferencePoint: vi.fn(), fetchLeadMapViewport: vi.fn() }));

vi.mock("@/app/actions/leads", () => leadActions);
vi.mock("@/app/actions/cep", () => ({ searchCepAction }));
vi.mock("@/app/actions/lead-map", () => mapActions);
vi.mock("@/components/maps/MiniMap", () => ({
  MiniMap: ({ position, draggable }: { position: { lat: number; lng: number } | null; draggable?: boolean }) => (
    <div data-testid="mini-map" data-position={position ? `${position.lat},${position.lng}` : ""} data-draggable={draggable ? "true" : "false"} />
  ),
}));
vi.mock("@/app/actions/custom-fields", () => ({
  listCustomFieldsAction: () => Promise.resolve({ fields: fieldDefinitions.value }),
}));
vi.mock("@/app/actions/workspace", () => ({
  listAssignableMembersAction: vi.fn().mockResolvedValue({ members: [], page: 1, pageSize: 0, totalPages: 0, totalItems: 0 }),
}));
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import { LeadSheet } from "../sheet/LeadSheet";

function storedLead(overrides: Partial<LeadDetail> = {}): LeadDetail {
  return {
    id: "lead-1",
    workspaceId: "ws-1",
    number: "5511987654321",
    name: "Maria Souza",
    realName: "Maria Souza",
    nickname: "Cida",
    blocked: false,
    relativesCount: 0,
    referredCount: 0,
    version: 4,
    phones: [],
    addresses: [],
    whatsappCampaigns: 0,
    totalCampaigns: 0,
    whatsappWindowOpen: false,
    campaigns: [],
    ...overrides,
  };
}

function renderSheet(props: { leadId?: string; onSaved?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <LeadSheet open onOpenChange={onOpenChange} leadId={props.leadId ?? null} onSaved={props.onSaved} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Salvar lead" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  grants.value = new Set(["leads:read", "leads:create", "leads:update", "leads:read_addresses"]);
  leadActions.listLeadRelativesAction.mockResolvedValue({ page: { items: [] }, error: null });
  leadActions.findLeadByNumberAction.mockResolvedValue({ matches: [], error: null });
  leadActions.findLeadsByNameAction.mockResolvedValue({ matches: [], error: null });
  leadActions.getLeadSummaryAction.mockResolvedValue({ summary: { memoriesCount: 0, sharedNumbers: [] }, error: null });
  fieldDefinitions.value = [];
  mapActions.fetchReferencePoint.mockResolvedValue({ point: null, error: { code: "reference_point_not_found", status: 404 } });
});

describe("lead sheet shared phones", () => {
  it("names the other leads that hold a stored contact phone of the lead being edited", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: storedLead({ phones: [{ id: "p-1", number: "551141990000", label: "landline" }] }), error: null });
    leadActions.getLeadSummaryAction.mockResolvedValue({
      summary: { memoriesCount: 0, sharedNumbers: [{ number: "551141990000", holders: [{ leadId: "lead-2", name: "João Souza" }], more: false }] },
      error: null,
    });
    renderSheet({ leadId: "lead-1" });
    expect(await screen.findByText(/Este telefone também está em/)).toHaveTextContent("Este telefone também está em João Souza.");
    expect(leadActions.getLeadSummaryAction.mock.calls[0][0]).toBe("lead-1");
  });

  it("asks for no holders while creating a lead", async () => {
    renderSheet();
    await screen.findByRole("button", { name: "Salvar lead" });
    expect(leadActions.getLeadSummaryAction).not.toHaveBeenCalled();
  });
});

const hiddenClassification: CustomFieldDefinition = {
  id: "f-1",
  workspaceId: "ws-1",
  objectType: "lead",
  key: "classificacao",
  label: "Classificação",
  type: "select",
  options: ["Positivo"],
  required: true,
  sensitive: true,
  readable: false,
  role: "classification",
  position: 0,
  createdAt: "",
  updatedAt: "",
};

describe("LeadSheet, a new lead", () => {
  it("leaves the name or WhatsApp rule to the server and shows its refusal on the name", async () => {
    leadActions.createLeadAction.mockResolvedValue({ lead: null, error: { code: "lead_identity_required", status: 400 } });
    renderSheet();
    save();
    expect(await screen.findByText("Informe o nome ou o WhatsApp.")).toBeInTheDocument();
    expect(leadActions.createLeadAction).toHaveBeenCalledWith({});
    expect(toast.error).toHaveBeenCalledWith("Revise os campos destacados.");
  });

  it("explains a refusal on a field this viewer cannot see in the message itself", async () => {
    fieldDefinitions.value = [hiddenClassification];
    leadActions.createLeadAction.mockResolvedValue({
      lead: null,
      error: { code: "custom_field_value_required", status: 400, expected: { key: "classificacao" } },
    });
    renderSheet();
    expect(await screen.findByText(/1 campo sensível não aparece/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana" } });
    save();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(ptMessages.leads.errors.custom_field_value_required));
    expect(toast.error).not.toHaveBeenCalledWith("Revise os campos destacados.");
  });

  it("offers to link the lead that already holds a new relative's number", async () => {
    leadActions.createLeadAction.mockResolvedValue({ lead: { ...storedLead({ id: "new-1", version: 1 }), duplicates: [] }, error: null });
    leadActions.addLeadRelativeAction.mockResolvedValue({ result: null, error: { code: "lead_identity_taken", status: 409, expected: { leadId: "holder-1" } } });
    leadActions.linkLeadRelationAction.mockResolvedValue({ result: { id: "r-9" }, error: null });
    renderSheet();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Nome ou telefone"), { target: { value: "Bia Souza" } });
    fireEvent.click(screen.getByRole("button", { name: 'Cadastrar "Bia Souza" como novo lead' }));
    save();

    const offers = await screen.findByText("O número de Bia Souza já está cadastrado.");
    const row = offers.closest("li") as HTMLElement;
    expect(within(row).getByRole("link", { name: "Abrir lead" })).toHaveAttribute("href", "/dashboard/leads/holder-1");
    fireEvent.click(within(row).getByRole("button", { name: "Vincular como Cônjuge" }));
    await waitFor(() => expect(leadActions.linkLeadRelationAction).toHaveBeenCalledWith("new-1", "holder-1", "spouse"));
    expect(await within(row).findByText("Vinculado")).toBeInTheDocument();
  });

  it("points at an empty contact phone row", async () => {
    renderSheet();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar telefone" }));
    save();
    expect(await screen.findByText("Informe o número ou remova esta linha.")).toBeInTheDocument();
    expect(leadActions.createLeadAction).not.toHaveBeenCalled();
  });

  it("shows who already holds the WhatsApp number when the server refuses it", async () => {
    leadActions.createLeadAction.mockResolvedValue({
      lead: null,
      error: { code: "lead_identity_taken", status: 409, expected: { leadId: "other-lead" } },
    });
    renderSheet();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("WhatsApp (principal)"), { target: { value: "(11) 98765-4321" } });
    save();

    expect(await screen.findByText("Este número já é de outro lead.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir o lead que tem este número" })).toHaveAttribute("href", "/dashboard/leads/other-lead");
    expect(leadActions.createLeadAction).toHaveBeenCalledWith({ name: "Ana", number: "(11) 98765-4321" });
  });

  it("keeps the sheet open with the duplicate warnings and links to open them", async () => {
    const onSaved = vi.fn();
    leadActions.createLeadAction.mockResolvedValue({
      lead: { ...storedLead({ id: "new-1", version: 1 }), duplicates: [{ leadId: "dup-1", reasons: ["shared_phone"], name: "João Souza" }] },
      error: null,
    });
    renderSheet({ onSaved });
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Ana" } });
    save();

    const panel = await screen.findByRole("status");
    expect(within(panel).getByText("João Souza")).toBeInTheDocument();
    expect(within(panel).getByText("mesmo telefone")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Abrir lead" })).toHaveAttribute("href", "/dashboard/leads/dup-1");
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "new-1" }));
  });

  it("fills the address from the CEP through the backend lookup", async () => {
    searchCepAction.mockResolvedValue({
      status: "found",
      address: { cep: "06402000", logradouro: "R. das Acácias", complemento: "", bairro: "Jardim Silveira", localidade: "Barueri", uf: "SP", ibge: "3505708" },
    });
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar endereço" }));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "06402-000" } });

    await waitFor(() => expect(screen.getByLabelText("Bairro")).toHaveValue("Jardim Silveira"));
    expect(searchCepAction).toHaveBeenCalledWith("06402000");
    expect(screen.getByLabelText("Logradouro")).toHaveValue("R. das Acácias");
    expect(screen.getByLabelText("Cidade")).toHaveValue("Barueri");
    expect(screen.getByLabelText("UF")).toHaveValue("SP");
  });

  it("starts a draggable pin at the CEP point of the new address before the lead exists", async () => {
    searchCepAction.mockResolvedValue({ status: "not_found" });
    mapActions.fetchReferencePoint.mockResolvedValue({
      point: { position: { lat: -23.5113, lng: -46.8761 }, precision: "postal_code", attribution: "IBGE, CNEFE 2022" },
      error: null,
    });
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar endereço" }));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "06402-000" } });

    const map = await screen.findByTestId("mini-map");
    expect(map).toHaveAttribute("data-position", "-23.5113,-46.8761");
    expect(map).toHaveAttribute("data-draggable", "true");
    expect(mapActions.fetchReferencePoint).toHaveBeenCalledWith({ zipCode: "06402000" }, expect.anything());
  });

  it("only previews the CEP point for a viewer who cannot place pins", async () => {
    grants.value = new Set(["leads:read", "leads:create", "leads:read_addresses"]);
    searchCepAction.mockResolvedValue({ status: "not_found" });
    mapActions.fetchReferencePoint.mockResolvedValue({
      point: { position: { lat: -23.5113, lng: -46.8761 }, precision: "postal_code", attribution: "IBGE, CNEFE 2022" },
      error: null,
    });
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar endereço" }));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "06402-000" } });

    const map = await screen.findByTestId("mini-map");
    expect(map).toHaveAttribute("data-draggable", "false");
  });

  it("asks no reference point for a viewer without leads:read_addresses", async () => {
    grants.value = new Set(["leads:read", "leads:create"]);
    searchCepAction.mockResolvedValue({ status: "not_found" });
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar endereço" }));
    fireEvent.change(screen.getByLabelText("CEP"), { target: { value: "06402-000" } });

    await waitFor(() => expect(searchCepAction).toHaveBeenCalled());
    expect(mapActions.fetchReferencePoint).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mini-map")).not.toBeInTheDocument();
  });
});

describe("LeadSheet, an existing lead", () => {
  it("sends only the changed fields with the version it read", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: storedLead(), error: null });
    leadActions.updateLeadAction.mockResolvedValue({ status: "saved", lead: storedLead({ version: 5, nickname: "Mari" }) });
    const { onOpenChange } = renderSheet({ leadId: "lead-1" });

    fireEvent.change(await screen.findByLabelText("Apelido"), { target: { value: "Mari" } });
    save();

    await waitFor(() => expect(leadActions.updateLeadAction).toHaveBeenCalledWith("lead-1", 4, { nickname: "Mari" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows a version conflict and re-applies my edit on the newer record", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: storedLead(), error: null });
    leadActions.updateLeadAction
      .mockResolvedValueOnce({ status: "conflict", current: storedLead({ version: 6, email: "outro@exemplo.com.br" }) })
      .mockResolvedValueOnce({ status: "saved", lead: storedLead({ version: 7 }) });
    renderSheet({ leadId: "lead-1" });

    fireEvent.change(await screen.findByLabelText("Apelido"), { target: { value: "Mari" } });
    save();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Também mudou: E-mail.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar lead" })).toBeDisabled();

    fireEvent.click(within(alert).getByRole("button", { name: "Reaplicar minhas alterações" }));
    expect(screen.getByLabelText("E-mail")).toHaveValue("outro@exemplo.com.br");
    expect(screen.getByLabelText("Apelido")).toHaveValue("Mari");
    save();

    await waitFor(() => expect(leadActions.updateLeadAction).toHaveBeenLastCalledWith("lead-1", 6, { nickname: "Mari" }));
  });

  it("shows the newer value next to mine on a field we both changed and keeps the newer one unless I choose mine", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: storedLead(), error: null });
    leadActions.updateLeadAction
      .mockResolvedValueOnce({ status: "conflict", current: storedLead({ version: 6, nickname: "Dona Cida" }) })
      .mockResolvedValue({ status: "saved", lead: storedLead({ version: 7 }) });
    renderSheet({ leadId: "lead-1" });

    fireEvent.change(await screen.findByLabelText("Apelido"), { target: { value: "Mari" } });
    save();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Dona Cida")).toBeInTheDocument();
    expect(within(alert).getByText("Mari")).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Reaplicar minhas alterações" }));
    expect(screen.getByLabelText("Apelido")).toHaveValue("Dona Cida");
  });

  it("re-applies my value on an overlapping field once I choose to keep it", async () => {
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: storedLead(), error: null });
    leadActions.updateLeadAction
      .mockResolvedValueOnce({ status: "conflict", current: storedLead({ version: 6, nickname: "Dona Cida" }) })
      .mockResolvedValue({ status: "saved", lead: storedLead({ version: 7 }) });
    renderSheet({ leadId: "lead-1" });

    fireEvent.change(await screen.findByLabelText("Apelido"), { target: { value: "Mari" } });
    save();

    const alert = await screen.findByRole("alert");
    fireEvent.click(within(alert).getByRole("checkbox", { name: "Manter o meu valor em Apelido" }));
    fireEvent.click(within(alert).getByRole("button", { name: "Reaplicar minhas alterações" }));
    expect(screen.getByLabelText("Apelido")).toHaveValue("Mari");
    save();
    await waitFor(() => expect(leadActions.updateLeadAction).toHaveBeenLastCalledWith("lead-1", 6, { nickname: "Mari" }));
  });

  it("explains an address refusal in the message when the addresses are read only", async () => {
    grants.value = new Set(["leads:read", "leads:update"]);
    leadActions.getLeadByIdAction.mockResolvedValue({ lead: storedLead(), error: null });
    leadActions.updateLeadAction.mockResolvedValue({ status: "failed", error: { code: "lead_addresses_forbidden", status: 403 } });
    renderSheet({ leadId: "lead-1" });

    fireEvent.change(await screen.findByLabelText("Apelido"), { target: { value: "Mari" } });
    save();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(ptMessages.leads.errors.lead_addresses_forbidden));
  });

  it("never offers address editing to a viewer without leads:read_addresses", async () => {
    grants.value = new Set(["leads:read", "leads:update"]);
    leadActions.getLeadByIdAction.mockResolvedValue({
      lead: storedLead({ addresses: [{ id: "a-1", label: "home", primary: true, district: "Centro", city: "Barueri", state: "SP", geoStatus: "pending" }] }),
      error: null,
    });
    renderSheet({ leadId: "lead-1" });

    expect(await screen.findByText("Centro · Barueri/SP")).toBeInTheDocument();
    expect(screen.queryByLabelText("CEP")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar endereço" })).not.toBeInTheDocument();
  });
});
